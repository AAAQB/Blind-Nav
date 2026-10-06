"""Version 1 endpoints, preserved byte-for-byte for backward compatibility.

The response contract of ``POST /api/shortest_path`` is unchanged: existing
clients keep working while the v2 API grows alongside it.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict

from flask import Blueprint, jsonify, request, send_from_directory

from backend.config import DEFAULT_AREA, PRESET_MODES, get_time_slot
from backend.paths import frontend_dir
from backend.services.cost import build_cost_fn
from backend.services.graph_manager import graph_mgr
from backend.utils.geoutils import haversine as haversine_distance, path_to_coords

logger = logging.getLogger(__name__)

bp = Blueprint("legacy", __name__)


# ── Static frontend ──

@bp.route("/")
def index():
    return send_from_directory(frontend_dir(), "index.html")


@bp.route("/<path:filename>")
def static_files(filename: str):
    return send_from_directory(frontend_dir(), filename)


# ── Health ──

@bp.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "graph_ready": graph_mgr.is_ready,
        "graph_loading": graph_mgr.is_loading,
        "loaded_area": graph_mgr.loaded_area or None,
    })


# ── Routing (v1) ──

@bp.route("/api/shortest_path", methods=["POST"])
def shortest_path():
    data = request.get_json(silent=True) or {}

    try:
        start_lat = float(data["start_lat"])
        start_lon = float(data["start_lon"])
        end_lat = float(data["end_lat"])
        end_lon = float(data["end_lon"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Missing start or end coordinates"}), 400

    hour = int(data.get("hour", 14))
    if not (0 <= hour <= 23):
        hour = 14

    use_bidi = bool(data.get("use_bidirectional", True))
    use_dyn = bool(data.get("use_dynamic_cost", True))
    area = str(data.get("area", DEFAULT_AREA))

    if abs(start_lat) < 0.1 and abs(start_lon) < 0.1:
        return jsonify({
            "status": "error",
            "error": "Invalid coordinates (0,0), please enter valid lat/lng"
        }), 400

    if start_lat == end_lat and start_lon == end_lon:
        slot = get_time_slot(hour)
        return jsonify({
            "status": "success",
            "path": [[start_lat, start_lon]],
            "path_node_ids": [],
            "total_cost": 0.0,
            "static_cost": 0.0,
            "dynamic_cost": 0.0 if use_dyn else None,
            "total_distance_m": 0,
            "time_slot": slot.name,
            "time_slot_name": slot.name,
            "algorithm": "direct_arrival_bypass",
            "num_nodes": 1,
        })

    mode_id = data.get("mode")
    if mode_id and mode_id in PRESET_MODES:
        weights = PRESET_MODES[mode_id]["weights"].to_dict()
    else:
        weights = PRESET_MODES["balanced"]["weights"].to_dict()

    if isinstance(data.get("weights"), dict):
        for k, v in data["weights"].items():
            weights[k] = float(v)

    # ── Dynamically determine load area ──
    # Center on midpoint of start/end, radius = distance + buffer
    mid_lat = (start_lat + end_lat) / 2
    mid_lon = (start_lon + end_lon) / 2
    span = haversine_distance((start_lat, start_lon), (end_lat, end_lon))
    load_arg = graph_mgr.resolve_area(area, mid_lat, mid_lon, span)

    if not graph_mgr.ensure_graph(load_arg):
        return jsonify({"error": "Map data still loading, please try again (first launch downloads from OpenStreetMap)"}), 503

    start_node = graph_mgr.find_nearest_node(start_lat, start_lon)
    end_node = graph_mgr.find_nearest_node(end_lat, end_lon)
    if start_node is None:
        return jsonify({"error": "No road network data near start point"}), 400
    if end_node is None:
        return jsonify({"error": "No road network data near end point"}), 400

    cost_fn = build_cost_fn(weights, use_dyn, hour)

    try:
        from backend.algorithm.astar import WeightedAStar
        from backend.algorithm.bidirectional_astar import BidirectionalAStar
        from backend.config import BIDIRECTIONAL_MEET_RADIUS

        if use_bidi:
            searcher = BidirectionalAStar(cost_function=cost_fn, meet_radius=BIDIRECTIONAL_MEET_RADIUS)
            algo = "bidirectional_a*"
        else:
            searcher = WeightedAStar(cost_function=cost_fn)
            algo = "weighted_a*"

        result = searcher.search(graph_mgr.graph, start_node, end_node, hour)
        if result is None:
            return jsonify({"error": "No feasible path found between start and end"}), 404

        coords = path_to_coords(graph_mgr.graph, result["path"])
        dist = sum(haversine_distance(coords[i], coords[i + 1]) for i in range(len(coords) - 1))

        # Use _edge_tags (with length) to ensure correct static_cost
        from backend.algorithm.astar import _edge_tags as _fetch_edge_tags
        static_fn = build_cost_fn(weights, use_dynamic=False)
        static_cost = 0.0
        for u, v in zip(result["path"], result["path"][1:]):
            tags = _fetch_edge_tags(graph_mgr.graph, u, v)
            static_cost += static_fn(u, v, tags, None)

        slot = get_time_slot(hour)

        # ── Route Feature Analysis (based on OSM tag defaults) ──
        tactile_count = 0
        steps_count = 0
        lit_count = 0
        sidewalk_count = 0
        highway_stats: Dict[str, int] = {}
        total_edges = 0
        for u, v in zip(result["path"], result["path"][1:]):
            ed = graph_mgr.graph.get_edge_data(u, v)
            tags = dict(ed.get("tags", {})) if ed else {}
            total_edges += 1
            if str(tags.get("tactile_paving", "no")).lower() == "yes":
                tactile_count += 1
            if str(tags.get("steps", "no")).lower() == "yes":
                steps_count += 1
            if str(tags.get("lit", "no")).lower() in ("yes", "24/7", "automatic"):
                lit_count += 1
            if str(tags.get("sidewalk", "no")).lower() in ("yes", "both", "left", "right", "separate"):
                sidewalk_count += 1
            hw = str(tags.get("highway", "unknown")).lower()
            highway_stats[hw] = highway_stats.get(hw, 0) + 1

        top_highways = sorted(highway_stats.items(), key=lambda x: -x[1])[:3]

        def _pct(n: int) -> float:
            return round(n / total_edges * 100, 0) if total_edges else 0

        analysis: Dict[str, Any] = {
            "total_edges": total_edges,
            "tactile_paving_pct": _pct(tactile_count),
            "steps_count": steps_count,
            "lit_pct": _pct(lit_count),
            "sidewalk_pct": _pct(sidewalk_count),
            "top_highways": [{"name": k, "pct": _pct(v)} for k, v in top_highways],
        }

        resp: Dict[str, Any] = {
            "status": "success",
            "path": coords,
            "path_node_ids": result["path"],
            "total_cost": round(result["cost"], 4),
            "static_cost": round(static_cost, 4),
            "dynamic_cost": round(result["cost"] - static_cost, 4) if use_dyn else None,
            "total_distance_m": round(dist, 1),
            "explored_count": result.get("explored_count", 0),
            "time_slot": slot.name,
            "time_slot_name": slot.name,
            "algorithm": algo,
            "num_nodes": len(result["path"]),
            "route_analysis": analysis,
        }
        if "meet_node" in result:
            resp["meet_node"] = result["meet_node"]
            resp["forward_explored"] = result.get("forward_explored", 0)
            resp["backward_explored"] = result.get("backward_explored", 0)
        return jsonify(resp)

    except Exception:
        logger.exception("Path search failed")
        return jsonify({"error": "Internal path search error, please retry"}), 500
