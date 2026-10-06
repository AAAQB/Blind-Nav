"""Route enrichment: per-segment attributes, hazards, directions and scoring.

Everything here works on an already-computed node path, so it is independent of
which search algorithm produced it.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import networkx as nx

from backend.config import (
    FACTOR_QUALITY,
    FACTOR_WEIGHTS,
    NARROW_WIDTH_M,
    POOR_SURFACES,
    ROUTE_PROFILES,
    STEEP_INCLINE_PCT,
    STEPS_SCORE_PENALTY,
    STEPS_SCORE_PENALTY_CAP,
    STEPS_SPEED_MPS,
    SURFACE_SPEED_FACTOR,
    VERY_NARROW_WIDTH_M,
)
from backend.utils.geoutils import bearing, haversine

logger = logging.getLogger(__name__)

# Severity ordering — higher index wins when a segment has several reasons.
_SEVERITY_ORDER = ["none", "low", "medium", "high"]

_CARDINAL_16 = [
    "north", "north-northeast", "northeast", "east-northeast",
    "east", "east-southeast", "southeast", "south-southeast",
    "south", "south-southwest", "southwest", "west-southwest",
    "west", "west-northwest", "northwest", "north-northwest",
]

# Below this heading change a junction is reported as "continue" rather than a
# turn: footways zig-zag around obstacles far more often than streets do.
_TURN_THRESHOLD_DEG: float = 45.0
# Moves shorter than this are absorbed into the following move so directions do
# not degrade into a list of 5-metre stubs at every kerb.
_MIN_MOVE_M: float = 12.0
# Hard ceiling so a pathological path cannot produce an unusable wall of steps.
_MAX_RISK_EVENTS: int = 60


# ── Tag helpers ──

def parse_incline_pct(raw: Any) -> float:
    """Absolute incline in percent; 0.0 when unknown or non-numeric."""
    if raw is None:
        return 0.0
    text = str(raw).lower().replace("%", "").strip()
    try:
        return abs(float(text))
    except ValueError:
        return {"steep": 12.0, "up": 6.0, "down": 6.0, "yes": 6.0}.get(text, 0.0)


def parse_width_m(raw: Any) -> Optional[float]:
    """Width in metres, or ``None`` when unknown."""
    if raw is None:
        return None
    text = str(raw).lower().replace("m", "").strip()
    try:
        return float(text)
    except ValueError:
        return None


def _edge_data(graph: nx.Graph, u: int, v: int) -> Dict[str, Any]:
    """Edge attributes including the flattened accessibility tags."""
    ed = graph.get_edge_data(u, v)
    return dict(ed) if ed else {}


def _edge_tags(graph: nx.Graph, u: int, v: int) -> Dict[str, Any]:
    ed = _edge_data(graph, u, v)
    tags = dict(ed.get("tags", {}) or {})
    if ed.get("length") is not None:
        tags["length"] = float(ed["length"])
    if ed.get("name") is not None:
        tags["name"] = ed["name"]
    return tags


def _node_coord(graph: nx.Graph, nid: int) -> List[float]:
    node = graph.nodes[nid]
    return [float(node.get("y", 0.0)), float(node.get("x", 0.0))]


def _pct(numerator: float, denominator: float) -> float:
    return round(numerator / denominator * 100.0, 1) if denominator else 0.0


# ── Segment extraction ──

def build_segments(
    graph: nx.Graph,
    path: List[int],
    profile_id: str = "accessible",
    hour: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Expand a node path into per-edge segments carrying all accessibility tags."""
    profile = ROUTE_PROFILES.get(profile_id, {})
    base_speed = float(profile.get("base_speed_mps", 1.3))
    night = hour is not None and (hour >= 20 or hour < 6)

    segments: List[Dict[str, Any]] = []
    for index, (u, v) in enumerate(zip(path, path[1:])):
        start = _node_coord(graph, u)
        end = _node_coord(graph, v)
        ed = _edge_data(graph, u, v)
        tags = dict(ed.get("tags", {}) or {})

        length = ed.get("length")
        length = float(length) if length is not None else haversine(tuple(start), tuple(end))

        incline_pct = parse_incline_pct(tags.get("incline"))
        width_m = parse_width_m(tags.get("width"))
        is_steps = str(tags.get("steps", "no")).lower() == "yes"
        surface = str(tags.get("surface", "unknown")).lower()
        highway = str(tags.get("highway", "unknown")).lower()

        speed = _segment_speed(base_speed, surface, incline_pct, is_steps)
        level, risks = _segment_risks(tags, incline_pct, width_m, night, is_steps)

        segments.append({
            "index": index,
            "from": start,
            "to": end,
            "coordinates": [start, end],
            "length_m": round(length, 2),
            "duration_s": round(length / speed, 1) if speed > 0 else 0.0,
            "highway": highway,
            "name": tags.get("name") or ed.get("name"),
            "tactile_paving": str(tags.get("tactile_paving", "unknown")).lower(),
            "lit": str(tags.get("lit", "unknown")).lower(),
            "sidewalk": str(tags.get("sidewalk", "unknown")).lower(),
            "surface": surface,
            "incline_pct": round(incline_pct, 2),
            "width_m": width_m,
            "steps": is_steps,
            "risk": level,
            "risk_reasons": risks,
        })
    return segments


def _segment_speed(base_speed: float, surface: str, incline_pct: float, is_steps: bool) -> float:
    """Walking speed (m/s) for one segment under this profile."""
    if is_steps:
        return STEPS_SPEED_MPS
    surface_factor = SURFACE_SPEED_FACTOR.get(surface, 0.85)
    incline_factor = 1.0 / (1.0 + incline_pct * 0.08)
    return max(0.35, base_speed * surface_factor * incline_factor)


def _segment_risks(
    tags: Dict[str, Any],
    incline_pct: float,
    width_m: Optional[float],
    night: bool,
    is_steps: bool,
) -> Tuple[str, List[Dict[str, str]]]:
    """Classify hazards for one segment; returns (worst level, reasons)."""
    reasons: List[Dict[str, str]] = []

    def add(code: str, label: str, severity: str) -> None:
        reasons.append({"code": code, "label": label, "severity": severity})

    if is_steps:
        add("steps", "Steps", "high")

    sidewalk = str(tags.get("sidewalk", "unknown")).lower()
    if sidewalk in ("no", "none"):
        add("no_sidewalk", "No sidewalk", "high")

    lit = str(tags.get("lit", "unknown")).lower()
    if lit in ("no", "unknown"):
        add("unlit", "Unlit", "high" if night else "medium")
    elif lit == "limited":
        add("poorly_lit", "Poorly lit", "low")

    tactile = str(tags.get("tactile_paving", "unknown")).lower()
    if tactile in ("no", "unknown"):
        add("no_tactile", "No tactile paving", "medium")
    elif tactile == "limited":
        add("limited_tactile", "Limited tactile paving", "low")

    surface = str(tags.get("surface", "unknown")).lower()
    if surface in POOR_SURFACES:
        add("rough_surface", "Uneven surface", "medium")

    if incline_pct >= STEEP_INCLINE_PCT:
        add("steep", "Steep incline", "medium")

    if width_m is not None:
        if width_m < VERY_NARROW_WIDTH_M:
            add("narrow", "Very narrow path", "medium")
        elif width_m < NARROW_WIDTH_M:
            add("narrow", "Narrow path", "low")

    level = "none"
    for reason in reasons:
        if _SEVERITY_ORDER.index(reason["severity"]) > _SEVERITY_ORDER.index(level):
            level = reason["severity"]
    return level, reasons


# ── Hazard events ──

_RISK_LABELS = {
    "steps": ("Steps", "Step-free alternative not available here"),
    "no_sidewalk": ("No sidewalk", "Walking in the roadway — stay close to the kerb"),
    "unlit": ("Unlit section", "No lighting recorded in OpenStreetMap"),
    "no_tactile": ("No tactile paving", "Guide surface absent on this stretch"),
    "rough_surface": ("Uneven surface", "Rough or loose ground underfoot"),
    "steep": ("Steep incline", "Slope above 10%"),
    "narrow": ("Narrow path", "Less than 1.5 m of clearance"),
}


def build_risk_events(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merge consecutive segments sharing the same primary hazard into events."""
    events: List[Dict[str, Any]] = []
    offset = 0.0
    current: Optional[Dict[str, Any]] = None

    for seg in segments:
        seg_offset = offset
        offset += seg["length_m"]

        primary = _primary_reason(seg)
        if primary is None:
            current = None
            continue

        code = primary["code"]
        if current is not None and current["type"] == code:
            current["length_m"] = round(current["length_m"] + seg["length_m"], 1)
            current["to"] = seg["to"]
            current["at"] = seg["to"]
            current["segment_indexes"].append(seg["index"])
            continue

        label, detail = _RISK_LABELS.get(code, (primary["label"], primary["label"]))
        current = {
            "id": f"risk-{code}-{seg['index']}",
            "type": code,
            "severity": primary["severity"],
            "label": label,
            "detail": detail,
            "from": seg["from"],
            "to": seg["to"],
            "at": seg["to"],
            "offset_m": round(seg_offset, 1),
            "length_m": round(seg["length_m"], 1),
            "segment_indexes": [seg["index"]],
        }
        events.append(current)

    # Low-severity stretches are kept: for a blind pedestrian a 400 m run with
    # only "limited" tactile paving is still actionable information. The client
    # decides which severities to emphasise.
    return events[:_MAX_RISK_EVENTS]


def _primary_reason(seg: Dict[str, Any]) -> Optional[Dict[str, str]]:
    best: Optional[Dict[str, str]] = None
    for reason in seg.get("risk_reasons", []):
        if best is None or _SEVERITY_ORDER.index(reason["severity"]) > _SEVERITY_ORDER.index(best["severity"]):
            best = reason
    return best


# ── Accessibility scoring ──

def accessibility_score(
    segments: List[Dict[str, Any]],
    profile_id: str = "accessible",
    hour: Optional[int] = None,
) -> Dict[str, Any]:
    """Grade a route from 0-100 plus a per-factor breakdown for the radar chart."""
    factors = _factor_breakdown(segments)
    weights = FACTOR_WEIGHTS.get(profile_id, FACTOR_WEIGHTS["accessible"])

    total_weight = sum(weights.values()) or 1.0
    base = sum(factors[key] * weights.get(key, 0.0) for key in factors) / total_weight

    steps_segments = sum(1 for s in segments if s.get("steps"))
    penalty = min(STEPS_SCORE_PENALTY * steps_segments, STEPS_SCORE_PENALTY_CAP)
    score = max(0.0, min(100.0, base - penalty))

    return {
        "score": round(score),
        "grade": _grade(score),
        "factors": {k: round(v) for k, v in factors.items()},
        "penalty": round(penalty, 1),
    }


def _factor_breakdown(segments: List[Dict[str, Any]]) -> Dict[str, float]:
    total = sum(s["length_m"] for s in segments) or 1.0

    def quality(key: str, tag: str) -> float:
        table = FACTOR_QUALITY[key]
        acc = 0.0
        for seg in segments:
            value = str(seg.get(tag) or "unknown").lower()
            acc += table.get(value, table.get("unknown", 50.0)) * seg["length_m"]
        return acc / total

    incline_acc = sum(s["incline_pct"] * s["length_m"] for s in segments) / total
    incline_factor = max(0.0, 100.0 - incline_acc * 6.0)

    widths = [s["width_m"] for s in segments if s.get("width_m") is not None]
    if widths:
        # The narrowest stretch dominates the experience, so weight it hardest.
        width_factor = max(0.0, 100.0 - max(0.0, 2.0 - min(widths)) * 45.0)
    else:
        width_factor = 60.0

    return {
        "tactile": quality("tactile", "tactile_paving"),
        "lighting": quality("lighting", "lit"),
        "sidewalk": quality("sidewalk", "sidewalk"),
        "surface": quality("surface", "surface"),
        "incline": incline_factor,
        "width": width_factor,
    }


def _grade(score: float) -> str:
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    if score >= 40:
        return "D"
    return "E"


def route_metrics(segments: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate per-segment stats used by the summary cards."""
    total = sum(s["length_m"] for s in segments) or 1.0
    tactile_length = sum(s["length_m"] for s in segments if s["tactile_paving"] == "yes")
    lit_length = sum(s["length_m"] for s in segments if s["lit"] in ("yes", "24/7", "automatic"))
    sidewalk_length = sum(s["length_m"] for s in segments if s["sidewalk"] in ("yes", "both", "left", "right", "separate"))

    highway_length: Dict[str, float] = {}
    for seg in segments:
        highway_length[seg["highway"]] = highway_length.get(seg["highway"], 0.0) + seg["length_m"]
    top_highways = sorted(highway_length.items(), key=lambda item: -item[1])[:4]

    inclines = [s["incline_pct"] for s in segments]
    return {
        "total_edges": len(segments),
        "tactile_pct": _pct(tactile_length, total),
        "lit_pct": _pct(lit_length, total),
        "sidewalk_pct": _pct(sidewalk_length, total),
        "steps_count": sum(1 for s in segments if s["steps"]),
        "steps_length_m": round(sum(s["length_m"] for s in segments if s["steps"]), 1),
        "max_incline_pct": round(max(inclines), 1) if inclines else 0.0,
        "mean_incline_pct": round(sum(inclines) / len(inclines), 1) if inclines else 0.0,
        "min_width_m": min((s["width_m"] for s in segments if s.get("width_m") is not None), default=None),
        "rough_length_m": round(sum(s["length_m"] for s in segments if s["surface"] in POOR_SURFACES), 1),
        "top_highways": [{"name": name, "pct": _pct(length, total)} for name, length in top_highways],
    }


# ── Turn-by-turn directions ──

def build_directions(graph: nx.Graph, path: List[int]) -> List[Dict[str, Any]]:
    """Derive human-readable directions from path geometry and street names."""
    if len(path) < 2:
        return []

    coords = [_node_coord(graph, nid) for nid in path]
    moves: List[Dict[str, Any]] = []

    names: List[Optional[str]] = []
    lengths: List[float] = []
    for i in range(len(path) - 1):
        tags = _edge_tags(graph, path[i], path[i + 1])
        name = tags.get("name")
        names.append(str(name) if name else None)
        length = tags.get("length")
        lengths.append(float(length) if length is not None else haversine(tuple(coords[i]), tuple(coords[i + 1])))

    current = {"name": names[0], "distance": 0.0, "start_index": 0}
    for i in range(len(lengths)):
        current["distance"] += lengths[i]
        is_last = i == len(lengths) - 1
        turn = None
        name_changed = False

        if not is_last:
            if names[i + 1] != current["name"] and names[i + 1] is not None:
                name_changed = True
            turn_angle = _turn_angle(coords[i], coords[i + 1], coords[i + 2])
            if abs(turn_angle) >= _TURN_THRESHOLD_DEG:
                turn = turn_angle

        if is_last or turn is not None or name_changed:
            # The move keeps the street walked during it; the next move adopts
            # the street the path turns onto.
            moves.append({
                "name": current["name"],
                "distance_m": round(current["distance"], 1),
                "turn_angle": turn,
                "start_index": current["start_index"],
                "end_index": i + 1,
            })
            if not is_last:
                current = {"name": names[i + 1] or current["name"], "distance": 0.0, "start_index": i + 1}

    return _moves_to_steps(_merge_short_moves(moves), coords)


def _merge_short_moves(moves: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Absorb stubs shorter than ``_MIN_MOVE_M`` into the following move.

    A typical footway path passes through many 3-8 m segments around kerbs and
    driveways; reporting each as its own direction produces unusable output.
    """
    merged: List[Dict[str, Any]] = []
    for move in moves:
        if merged and merged[-1]["distance_m"] < _MIN_MOVE_M:
            previous = merged.pop()
            absorbed = dict(move)
            absorbed["distance_m"] = round(previous["distance_m"] + move["distance_m"], 1)
            absorbed["start_index"] = previous["start_index"]
            merged.append(absorbed)
        else:
            merged.append(dict(move))
    return merged


def _turn_angle(a: List[float], b: List[float], c: List[float]) -> float:
    """Signed turn at ``b`` in degrees: positive = right, negative = left."""
    incoming = bearing(tuple(a), tuple(b))
    outgoing = bearing(tuple(b), tuple(c))
    delta = (outgoing - incoming + 540.0) % 360.0 - 180.0
    return delta


def _moves_to_steps(moves: List[Dict[str, Any]], coords: List[List[float]]) -> List[Dict[str, Any]]:
    steps: List[Dict[str, Any]] = []
    if not moves:
        return steps

    first = moves[0]
    heading = _cardinal(bearing(tuple(coords[0]), tuple(coords[min(1, len(coords) - 1)])))
    steps.append({
        "type": "depart",
        "icon": "start",
        "instruction": f"Head {heading}" + (f" on {first['name']}" if first["name"] else ""),
        "street": first["name"],
        "distance_m": first["distance_m"],
        "position": coords[0],
        "angle": None,
    })

    for move in moves[1:]:
        angle = move.get("turn_angle")
        street = move["name"]
        if angle is None or abs(angle) < 30:
            kind, icon, text = "continue", "straight", "Continue"
        elif abs(angle) < 60:
            kind = "slight"
            icon = "slight-right" if angle > 0 else "slight-left"
            text = "Bear right" if angle > 0 else "Bear left"
        elif abs(angle) < 130:
            kind = "turn"
            icon = "right" if angle > 0 else "left"
            text = "Turn right" if angle > 0 else "Turn left"
        else:
            kind, icon, text = "uturn", "uturn", "Make a U-turn"

        steps.append({
            "type": kind,
            "icon": icon,
            "instruction": text + (f" onto {street}" if street else ""),
            "street": street,
            "distance_m": move["distance_m"],
            "position": coords[move["end_index"]],
            "angle": round(angle, 1) if angle is not None else None,
        })

    steps.append({
        "type": "arrive",
        "icon": "destination",
        "instruction": "Arrive at destination",
        "street": None,
        "distance_m": 0.0,
        "position": coords[-1],
        "angle": None,
    })
    return steps


def _cardinal(deg: float) -> str:
    return _CARDINAL_16[int((deg % 360) / 22.5 + 0.5) % 16]


# ── Narrative summary ──

def route_summary(metrics: Dict[str, Any], score: Dict[str, Any], profile_id: str) -> str:
    """One-line justification shown on the comparison card."""
    parts: List[str] = []

    if metrics["steps_count"] == 0:
        parts.append("step-free")
    else:
        parts.append(f"{metrics['steps_count']} step section(s)")

    if metrics["tactile_pct"] >= 60:
        parts.append("strong tactile paving")
    elif metrics["tactile_pct"] >= 25:
        parts.append("partial tactile paving")
    else:
        parts.append("little tactile paving")

    if metrics["lit_pct"] >= 80:
        parts.append("well lit")
    elif metrics["lit_pct"] >= 40:
        parts.append("patchy lighting")
    else:
        parts.append("mostly unlit")

    if metrics["sidewalk_pct"] >= 80:
        parts.append("sidewalk throughout")
    elif metrics["sidewalk_pct"] < 30:
        parts.append("limited sidewalk")

    if profile_id == "fast":
        return "Shortest walk — " + ", ".join(parts) + "."
    return "Rated " + str(score["score"]) + "/100: " + ", ".join(parts) + "."
