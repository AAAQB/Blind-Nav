"""``POST /api/v2/routes`` — accessibility alternatives with full enrichment."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from flask import Blueprint, jsonify, request

from backend.config import (
    DEFAULT_AREA,
    DEFAULT_PROFILES,
    MAX_PROFILES_PER_REQUEST,
    ROUTE_PROFILES,
)
from backend.services.route_service import RouteError, RouteRequest, plan_routes

logger = logging.getLogger(__name__)

bp = Blueprint("routes_v2", __name__)


def _coord_pair(data: Dict[str, Any], nested: str, flat_lat: str, flat_lon: str) -> tuple:
    node = data.get(nested)
    if isinstance(node, dict) and node.get("lat") is not None and node.get("lon") is not None:
        return float(node["lat"]), float(node["lon"])
    if data.get(flat_lat) is not None and data.get(flat_lon) is not None:
        return float(data[flat_lat]), float(data[flat_lon])
    raise RouteError(f"Missing {nested} coordinates", code="missing_coordinates", status=400)


def _profiles(data: Dict[str, Any]) -> List[str]:
    requested = data.get("profiles")
    if not isinstance(requested, list) or not requested:
        return list(DEFAULT_PROFILES)

    ordered: List[str] = []
    for item in requested:
        profile_id = str(item)
        if profile_id in ROUTE_PROFILES and profile_id not in ordered:
            ordered.append(profile_id)
    if not ordered:
        raise RouteError(
            "No valid profile requested (available: " + ", ".join(ROUTE_PROFILES) + ")",
            code="invalid_profiles",
        )
    return ordered[:MAX_PROFILES_PER_REQUEST]


@bp.route("/routes", methods=["POST"])
def routes() -> Any:
    data = request.get_json(silent=True) or {}

    try:
        start_lat, start_lon = _coord_pair(data, "start", "start_lat", "start_lon")
        end_lat, end_lon = _coord_pair(data, "end", "end_lat", "end_lon")

        hour = int(data.get("hour", 14))
        if not 0 <= hour <= 23:
            hour = 14

        req = RouteRequest(
            start_lat=start_lat,
            start_lon=start_lon,
            end_lat=end_lat,
            end_lon=end_lon,
            hour=hour,
            area=str(data.get("area", DEFAULT_AREA)),
            profiles=_profiles(data),
            use_dynamic_cost=bool(data.get("use_dynamic_cost", True)),
            use_bidirectional=bool(data.get("use_bidirectional", True)),
        )
    except RouteError as exc:
        return jsonify({"status": "error", "code": exc.code, "message": exc.message}), exc.status
    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "code": "invalid_coordinates",
            "message": "Coordinates must be numeric lat/lon pairs",
        }), 400

    try:
        return jsonify(plan_routes(req))
    except RouteError as exc:
        return jsonify({"status": "error", "code": exc.code, "message": exc.message}), exc.status
    except Exception:
        logger.exception("v2 route planning failed")
        return jsonify({
            "status": "error",
            "code": "internal_error",
            "message": "Internal path search error, please retry",
        }), 500
