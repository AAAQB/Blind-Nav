"""``/api/v2/search`` and ``/api/v2/reverse`` — geocoding proxied via Nominatim."""

from __future__ import annotations

import logging
from typing import Any

from flask import Blueprint, jsonify, request

from backend.services.geocode import GeocodeError, reverse, search

logger = logging.getLogger(__name__)

bp = Blueprint("search", __name__)


@bp.route("/search", methods=["GET"])
def search_places() -> Any:
    query = (request.args.get("q") or "").strip()
    if len(query) < 3:
        return jsonify({"status": "success", "query": query, "results": []})

    try:
        limit = int(request.args.get("limit", 6))
    except (TypeError, ValueError):
        limit = 6

    try:
        results = search(query, limit=limit)
    except GeocodeError as exc:
        logger.warning("Geocode search failed: %s", exc.message)
        return jsonify({
            "status": "error",
            "code": exc.code,
            "message": exc.message,
            "results": [],
        }), exc.status

    return jsonify({"status": "success", "query": query, "results": results})


@bp.route("/reverse", methods=["GET"])
def reverse_place() -> Any:
    try:
        lat = float(request.args["lat"])
        lon = float(request.args["lon"])
    except (KeyError, TypeError, ValueError):
        return jsonify({
            "status": "error",
            "code": "missing_coordinates",
            "message": "lat and lon query parameters are required",
        }), 400

    try:
        place = reverse(lat, lon)
    except GeocodeError as exc:
        logger.warning("Reverse geocode failed: %s", exc.message)
        return jsonify({
            "status": "error",
            "code": exc.code,
            "message": exc.message,
        }), exc.status

    return jsonify({"status": "success", "place": place})
