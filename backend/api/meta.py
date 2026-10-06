"""``GET /api/v2/meta`` — everything the UI needs so it hardcodes nothing."""

from __future__ import annotations

from typing import Any, Dict, List

from flask import Blueprint, jsonify

from backend.config import (
    AREA_CONFIGS,
    DEFAULT_AREA,
    DEFAULT_PROFILES,
    MAX_PROFILES_PER_REQUEST,
    PRESET_MODES,
    ROUTE_PROFILES,
    TIME_SLOTS,
)
from backend.paths import frontend_source
from backend.services.graph_manager import graph_mgr

bp = Blueprint("meta", __name__)

_API_VERSION = "2.0"

# Display zoom used when flying to a predefined area.
_AREA_ZOOM: Dict[str, int] = {
    "kl": 14,
    "singapore": 15,
    "tokyo": 14,
    "berlin": 13,
}

_TIME_SLOT_DISPLAY: Dict[str, Dict[str, str]] = {
    "dawn": {"label": "Dawn", "icon": "sunrise"},
    "day": {"label": "Daytime", "icon": "sun"},
    "dusk": {"label": "Dusk", "icon": "sunset"},
    "night": {"label": "Night", "icon": "moon"},
    "late_night": {"label": "Late Night", "icon": "moon"},
}

# Segment colouring modes offered by the map legend.
_SEGMENT_FACTORS: List[Dict[str, Any]] = [
    {
        "id": "risk",
        "label": "Hazard level",
        "description": "Colours each stretch by how hostile it is to a blind pedestrian.",
        "icon": "warning",
        "default": True,
        "scale": [
            {"value": "high", "color": "#ff4d4f", "label": "High risk"},
            {"value": "medium", "color": "#f0b429", "label": "Caution"},
            {"value": "low", "color": "#4d8dff", "label": "Minor"},
            {"value": "none", "color": "#22d3a6", "label": "Clear"},
        ],
    },
    {
        "id": "tactile",
        "label": "Tactile paving",
        "description": "Guide-surface coverage along the route.",
        "icon": "grid",
        "default": False,
        "scale": [
            {"value": "yes", "color": "#22d3a6", "label": "Tactile paving"},
            {"value": "limited", "color": "#f0b429", "label": "Limited"},
            {"value": "incorrect", "color": "#ff8a00", "label": "Incorrect"},
            {"value": "no", "color": "#ff4d4f", "label": "None"},
            {"value": "unknown", "color": "#6b7280", "label": "Unmapped"},
        ],
    },
    {
        "id": "lighting",
        "label": "Lighting",
        "description": "Recording street lighting, weighted for the departure hour.",
        "icon": "moon",
        "default": False,
        "scale": [
            {"value": "yes", "color": "#f0b429", "label": "Lit"},
            {"value": "24/7", "color": "#f0b429", "label": "Lit 24/7"},
            {"value": "automatic", "color": "#f7d774", "label": "Automatic"},
            {"value": "limited", "color": "#8a6d1f", "label": "Limited"},
            {"value": "no", "color": "#4b5563", "label": "Unlit"},
            {"value": "unknown", "color": "#4b5563", "label": "Unmapped"},
        ],
    },
    {
        "id": "sidewalk",
        "label": "Sidewalk",
        "description": "Whether the stretch is separated from traffic.",
        "icon": "footpath",
        "default": False,
        "scale": [
            {"value": "yes", "color": "#22d3a6", "label": "Sidewalk"},
            {"value": "both", "color": "#22d3a6", "label": "Both sides"},
            {"value": "separate", "color": "#5eead4", "label": "Separate path"},
            {"value": "right", "color": "#a7f3d0", "label": "Right only"},
            {"value": "left", "color": "#a7f3d0", "label": "Left only"},
            {"value": "limited", "color": "#f0b429", "label": "Limited"},
            {"value": "no", "color": "#ff4d4f", "label": "None"},
            {"value": "none", "color": "#ff4d4f", "label": "None"},
            {"value": "unknown", "color": "#6b7280", "label": "Unmapped"},
        ],
    },
    {
        "id": "surface",
        "label": "Surface",
        "description": "Ground surface roughness underfoot.",
        "icon": "layers",
        "default": False,
        "scale": [
            {"value": "asphalt", "color": "#22d3a6", "label": "Asphalt"},
            {"value": "concrete", "color": "#34d399", "label": "Concrete"},
            {"value": "paved", "color": "#34d399", "label": "Paved"},
            {"value": "paving_stones", "color": "#a3e635", "label": "Paving stones"},
            {"value": "sett", "color": "#facc15", "label": "Sett"},
            {"value": "compacted", "color": "#fb923c", "label": "Compacted"},
            {"value": "fine_gravel", "color": "#fb923c", "label": "Fine gravel"},
            {"value": "gravel", "color": "#f97316", "label": "Gravel"},
            {"value": "ground", "color": "#f97316", "label": "Ground"},
            {"value": "dirt", "color": "#ef4444", "label": "Dirt"},
            {"value": "grass", "color": "#84cc16", "label": "Grass"},
            {"value": "sand", "color": "#ef4444", "label": "Sand"},
            {"value": "unknown", "color": "#6b7280", "label": "Unmapped"},
        ],
    },
    {
        "id": "incline",
        "label": "Slope",
        "description": "Gradient of each stretch, bucketed by percent.",
        "icon": "trending",
        "default": False,
        "scale": [
            {"value": "0-2", "color": "#22d3a6", "label": "Flat (0-2%)"},
            {"value": "2-5", "color": "#a3e635", "label": "Gentle (2-5%)"},
            {"value": "5-10", "color": "#f0b429", "label": "Moderate (5-10%)"},
            {"value": "10+", "color": "#ff4d4f", "label": "Steep (10%+)"},
        ],
    },
]

_RISK_CATALOG: List[Dict[str, Any]] = [
    {"type": "steps", "label": "Steps", "icon": "stairs", "severity": "high"},
    {"type": "no_sidewalk", "label": "No sidewalk", "icon": "road", "severity": "high"},
    {"type": "unlit", "label": "Unlit", "icon": "moon", "severity": "high"},
    {"type": "no_tactile", "label": "No tactile paving", "icon": "grid", "severity": "medium"},
    {"type": "rough_surface", "label": "Uneven surface", "icon": "layers", "severity": "medium"},
    {"type": "steep", "label": "Steep incline", "icon": "trending", "severity": "medium"},
    {"type": "narrow", "label": "Narrow path", "icon": "compress", "severity": "medium"},
]

_SEVERITY_META = [
    {"id": "high", "label": "High", "color": "#ff4d4f"},
    {"id": "medium", "label": "Caution", "color": "#f0b429"},
    {"id": "low", "label": "Minor", "color": "#4d8dff"},
]


@bp.route("/meta", methods=["GET"])
def meta() -> Any:
    return jsonify({
        "api_version": _API_VERSION,
        "ui": frontend_source(),
        "areas": [
            {
                "id": key,
                "name": cfg.get("name", key),
                "lat": cfg["lat"],
                "lon": cfg["lon"],
                "span_m": cfg["dist"],
                "zoom": _AREA_ZOOM.get(key, 13),
            }
            for key, cfg in AREA_CONFIGS.items()
        ],
        "default_area": DEFAULT_AREA,
        "profiles": [
            {
                "id": key,
                "label": p["label"],
                "short": p["short"],
                "description": p["description"],
                "color": p["color"],
                "accent": p["accent"],
                "icon": p["icon"],
                "mode": p["mode"],
            }
            for key, p in ROUTE_PROFILES.items()
        ],
        "default_profiles": DEFAULT_PROFILES,
        "max_profiles": MAX_PROFILES_PER_REQUEST,
        "modes": [
            {"id": key, "name": value["name"], "description": value["description"],
             "weights": value["weights"].to_dict()}
            for key, value in PRESET_MODES.items()
        ],
        "time_slots": [
            {
                "name": slot.name,
                "label": _TIME_SLOT_DISPLAY.get(slot.name, {}).get("label", slot.name),
                "icon": _TIME_SLOT_DISPLAY.get(slot.name, {}).get("icon", "clock"),
                "start_hour": slot.start_hour,
                "end_hour": slot.end_hour,
                "lighting_multiplier": slot.lighting_multiplier,
                "crowd_multiplier": slot.crowd_multiplier,
            }
            for slot in TIME_SLOTS
        ],
        "segment_factors": _SEGMENT_FACTORS,
        "risk_catalog": _RISK_CATALOG,
        "severities": _SEVERITY_META,
        "graph": graph_mgr.stats(),
    })
