"""Multi-profile route planning: alternatives, hazards, directions and grading."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from backend.algorithm.astar import WeightedAStar
from backend.algorithm.bidirectional_astar import BidirectionalAStar
from backend.config import (
    BIDIRECTIONAL_MEET_RADIUS,
    DEFAULT_PROFILES,
    ROUTE_CACHE_SIZE,
    ROUTE_CACHE_TTL_S,
    ROUTE_PROFILES,
    get_time_slot,
)
from backend.services.cache import TTLCache
from backend.services.cost import build_profile_cost_fn
from backend.services.graph_manager import graph_mgr
from backend.services.analysis import (
    accessibility_score,
    build_directions,
    build_risk_events,
    build_segments,
    route_metrics,
    route_summary,
)
from backend.utils.geoutils import haversine, path_to_coords

logger = logging.getLogger(__name__)

_route_cache = TTLCache(maxsize=ROUTE_CACHE_SIZE, ttl_s=ROUTE_CACHE_TTL_S)


class RouteError(Exception):
    """Request-level failure carrying an HTTP status and a stable code."""

    def __init__(self, message: str, code: str = "route_error", status: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


@dataclass
class RouteRequest:
    start_lat: float
    start_lon: float
    end_lat: float
    end_lon: float
    hour: int = 14
    area: str = "kl"
    profiles: List[str] = field(default_factory=lambda: list(DEFAULT_PROFILES))
    use_dynamic_cost: bool = True
    use_bidirectional: bool = True


@dataclass
class RoutePlan:
    """Computed route plus its enrichment, before serialisation."""

    profile_id: str
    path: List[int]
    result: Dict[str, Any]
    segments: List[Dict[str, Any]]
    distance_m: float
    duration_s: float
    cost: float
    static_cost: float
    score: Dict[str, Any]
    metrics: Dict[str, Any]
    risks: List[Dict[str, Any]]
    directions: List[Dict[str, Any]]
    also_matches: List[str] = field(default_factory=list)


# ── Cache key ──

def _cache_key(req: RouteRequest) -> str:
    return "|".join([
        f"{req.start_lat:.5f},{req.start_lon:.5f}",
        f"{req.end_lat:.5f},{req.end_lon:.5f}",
        str(req.hour),
        req.area,
        ",".join(req.profiles),
        "dyn" if req.use_dynamic_cost else "static",
        "bi" if req.use_bidirectional else "uni",
    ])


# ── Public API ──

def plan_routes(req: RouteRequest) -> Dict[str, Any]:
    """Compute accessibility-aware alternatives between two coordinates."""
    cached = _route_cache.get(_cache_key(req))
    if cached is not None:
        return cached

    _validate(req)
    span = haversine((req.start_lat, req.start_lon), (req.end_lat, req.end_lon))
    load_arg = graph_mgr.resolve_area(
        req.area,
        (req.start_lat + req.end_lat) / 2.0,
        (req.start_lon + req.end_lon) / 2.0,
        span,
    )

    if not graph_mgr.ensure_graph(load_arg):
        raise RouteError(
            "Map data still loading, please try again "
            "(first launch downloads from OpenStreetMap)",
            code="graph_loading",
            status=503,
        )

    start_snap = graph_mgr.snap(req.start_lat, req.start_lon)
    end_snap = graph_mgr.snap(req.end_lat, req.end_lon)
    if start_snap is None or end_snap is None:
        raise RouteError("No road network data near the requested coordinates",
                         code="no_network", status=400)

    graph = graph_mgr.graph
    if graph is None:  # pragma: no cover - guarded by ensure_graph
        raise RouteError("Graph unavailable", code="graph_unavailable", status=503)

    plans = _compute_plans(req, start_snap["node_id"], end_snap["node_id"])
    routes, highlights = _deduplicate(plans)

    payload = {
        "status": "success",
        "request": _request_echo(req),
        "snapped": {"start": start_snap, "end": end_snap},
        "graph": graph_mgr.stats(),
        "routes": [ _serialize(plan, req) for plan in routes ],
        "highlights": highlights,
    }
    _route_cache.set(_cache_key(req), payload)
    return payload


def _validate(req: RouteRequest) -> None:
    if abs(req.start_lat) < 0.1 and abs(req.start_lon) < 0.1:
        raise RouteError("Invalid start coordinates (0,0)", code="invalid_coordinates")
    if abs(req.end_lat) < 0.1 and abs(req.end_lon) < 0.1:
        raise RouteError("Invalid end coordinates (0,0)", code="invalid_coordinates")
    for value, name in ((req.start_lat, "start_lat"), (req.end_lat, "end_lat")):
        if not -90.0 <= value <= 90.0:
            raise RouteError(f"{name} out of range", code="invalid_coordinates")
    for value, name in ((req.start_lon, "start_lon"), (req.end_lon, "end_lon")):
        if not -180.0 <= value <= 180.0:
            raise RouteError(f"{name} out of range", code="invalid_coordinates")


def _request_echo(req: RouteRequest) -> Dict[str, Any]:
    slot = get_time_slot(req.hour)
    return {
        "hour": req.hour,
        "area": req.area,
        "profiles": req.profiles,
        "use_dynamic_cost": req.use_dynamic_cost,
        "time_slot": {
            "name": slot.name,
            "start_hour": slot.start_hour,
            "end_hour": slot.end_hour,
            "lighting_multiplier": slot.lighting_multiplier,
            "crowd_multiplier": slot.crowd_multiplier,
        },
    }


# ── Plan computation ──

def _compute_plans(req: RouteRequest, start_node: int, end_node: int) -> List[RoutePlan]:
    plans: List[RoutePlan] = []
    for profile_id in req.profiles:
        try:
            plans.append(_compute_one(req, profile_id, start_node, end_node))
        except Exception:
            logger.exception("Profile '%s' failed", profile_id)
    if not plans:
        raise RouteError("No feasible path found between start and end",
                         code="no_path", status=404)
    return plans


def _compute_one(
    req: RouteRequest,
    profile_id: str,
    start_node: int,
    end_node: int,
) -> RoutePlan:
    graph = graph_mgr.graph
    draw_fn = build_profile_cost_fn(profile_id, req.hour, req.use_dynamic_cost)
    static_fn = build_profile_cost_fn(profile_id, None, False)

    if req.use_bidirectional:
        searcher = BidirectionalAStar(cost_function=draw_fn, meet_radius=BIDIRECTIONAL_MEET_RADIUS)
    else:
        searcher = WeightedAStar(cost_function=draw_fn)

    result = searcher.search(graph, start_node, end_node, req.hour)
    if result is None:
        raise RouteError(f"No feasible path for profile '{profile_id}'",
                         code="no_path", status=404)

    path = result["path"]
    segments = build_segments(graph, path, profile_id, req.hour)
    distance_m = round(sum(s["length_m"] for s in segments), 1)
    duration_s = round(sum(s["duration_s"] for s in segments), 1)

    static_cost = 0.0
    for u, v in zip(path, path[1:]):
        ed = graph.get_edge_data(u, v) or {}
        tags = dict(ed.get("tags", {}) or {})
        if ed.get("length") is not None:
            tags["length"] = float(ed["length"])
        static_cost += static_fn(u, v, tags, None)

    metrics = route_metrics(segments)
    score = accessibility_score(segments, profile_id, req.hour)

    return RoutePlan(
        profile_id=profile_id,
        path=path,
        result=result,
        segments=segments,
        distance_m=distance_m,
        duration_s=duration_s,
        cost=float(result["cost"]),
        static_cost=static_cost,
        score=score,
        metrics=metrics,
        risks=build_risk_events(segments),
        directions=build_directions(graph, path),
    )


# ── Deduplication ──

def _deduplicate(plans: List[RoutePlan]) -> Tuple[List[RoutePlan], Dict[str, Optional[str]]]:
    """Fold identical paths together and pick the headline alternatives."""
    kept: List[RoutePlan] = []
    aliases: Dict[str, List[str]] = {}
    signatures: Dict[Tuple[int, ...], str] = {}

    for plan in plans:
        signature = tuple(plan.path)
        if signature in signatures:
            aliases.setdefault(signatures[signature], []).append(plan.profile_id)
            continue
        signatures[signature] = plan.profile_id
        kept.append(plan)

    for plan in kept:
        plan.also_matches = aliases.get(plan.profile_id, [])

    best_score = max(kept, key=lambda p: (p.score["score"], -p.distance_m)).profile_id
    fastest = min(kept, key=lambda p: p.duration_s).profile_id
    shortest = min(kept, key=lambda p: p.distance_m).profile_id

    highlights = {
        "best_score": best_score,
        "fastest": fastest,
        "shortest": shortest,
        "aliases": aliases,
    }
    return kept, highlights


# ── Serialisation ──

def _serialize(plan: RoutePlan, req: RouteRequest) -> Dict[str, Any]:
    profile = ROUTE_PROFILES[plan.profile_id]
    graph = graph_mgr.graph
    coords = path_to_coords(graph, plan.path)

    payload: Dict[str, Any] = {
        "id": plan.profile_id,
        "label": profile["label"],
        "short": profile["short"],
        "description": profile["description"],
        "color": profile["color"],
        "accent": profile["accent"],
        "icon": profile["icon"],
        "mode": profile["mode"],
        "score": plan.score["score"],
        "grade": plan.score["grade"],
        "factors": plan.score["factors"],
        "score_penalty": plan.score["penalty"],
        "summary": route_summary(plan.metrics, plan.score, plan.profile_id),
        "total_distance_m": plan.distance_m,
        "duration_s": plan.duration_s,
        "duration_min": max(1, round(plan.duration_s / 60.0)) if plan.distance_m > 0 else 0,
        "total_cost": round(plan.cost, 4),
        "static_cost": round(plan.static_cost, 4),
        "dynamic_adjustment": round(plan.cost - plan.static_cost, 4) if req.use_dynamic_cost else None,
        "algorithm": "bidirectional_a*" if req.use_bidirectional else "weighted_a*",
        "explored_count": plan.result.get("explored_count", 0),
        "num_nodes": len(plan.path),
        "path": coords,
        "path_node_ids": plan.path,
        "segments": plan.segments,
        "risks": plan.risks,
        "directions": plan.directions,
        "metrics": plan.metrics,
        "bounds": _bounds(coords),
        "also_matches": plan.also_matches,
    }
    if "meet_node" in plan.result:
        payload["meet_node"] = plan.result["meet_node"]
    return payload


def _bounds(coords: List[List[float]]) -> Dict[str, float]:
    lats = [c[0] for c in coords]
    lons = [c[1] for c in coords]
    return {
        "south": min(lats), "north": max(lats),
        "west": min(lons), "east": max(lons),
    }
