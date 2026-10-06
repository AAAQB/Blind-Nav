"""Nominatim geocoding proxy with on-disk caching and polite rate limiting.

Kept server-side so the browser never talks to a third party directly: the
User-Agent identifies the project and requests are serialised to at most one
per second, as Nominatim's usage policy requires.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from backend.config import (
    GEOCODE_CACHE_TTL_S,
    GEOCODE_MIN_INTERVAL_S,
    GEOCODE_TIMEOUT_S,
    GEOCODE_USER_AGENT,
)

logger = logging.getLogger(__name__)

_NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search"
_NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse"

_cache_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "cache", "geocode",
)
os.makedirs(_cache_dir, exist_ok=True)

_lock = threading.Lock()
_last_request_ts = [0.0]


class GeocodeError(Exception):
    def __init__(self, message: str, code: str = "geocode_failed", status: int = 502) -> None:
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


def _cache_path(url: str) -> str:
    return os.path.join(_cache_dir, hashlib.sha1(url.encode("utf-8")).hexdigest() + ".json")


def _read_cache(url: str) -> Optional[Any]:
    path = _cache_path(url)
    if not os.path.exists(path):
        return None
    try:
        if time.time() - os.path.getmtime(path) > GEOCODE_CACHE_TTL_S:
            return None
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:  # pragma: no cover - cache is best effort
        logger.warning("Geocode cache read failed: %s", exc)
        return None


def _write_cache(url: str, payload: Any) -> None:
    try:
        with open(_cache_path(url), "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
    except Exception as exc:  # pragma: no cover - cache is best effort
        logger.warning("Geocode cache write failed: %s", exc)


def _fetch(url: str) -> Any:
    cached = _read_cache(url)
    if cached is not None:
        return cached

    with _lock:
        wait = GEOCODE_MIN_INTERVAL_S - (time.time() - _last_request_ts[0])
        if wait > 0:
            time.sleep(wait)
        _last_request_ts[0] = time.time()

    request = urllib.request.Request(url, headers={
        "User-Agent": GEOCODE_USER_AGENT,
        "Accept": "application/json",
        "Accept-Language": "en",
    })
    try:
        with urllib.request.urlopen(request, timeout=GEOCODE_TIMEOUT_S) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        raise GeocodeError(f"Geocoding service returned HTTP {exc.code}",
                           code="geocode_http_error") from exc
    except Exception as exc:
        raise GeocodeError("Geocoding service unreachable",
                           code="geocode_unavailable") from exc

    _write_cache(url, payload)
    return payload


def search(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """Forward geocoding: free-text query to candidate places."""
    query = query.strip()
    if not query:
        return []

    url = "?".join([_NOMINATIM_SEARCH, urllib.parse.urlencode({
        "q": query,
        "format": "jsonv2",
        "limit": max(1, min(limit, 10)),
        "addressdetails": 1,
        "dedupe": 1,
    })])

    raw = _fetch(url)
    results: List[Dict[str, Any]] = []
    for item in raw if isinstance(raw, list) else []:
        try:
            results.append({
                "id": str(item.get("place_id") or item.get("osm_id") or len(results)),
                "name": (item.get("name") or "").strip() or _first_line(item.get("display_name", "")),
                "label": item.get("display_name", ""),
                "category": item.get("category") or item.get("class"),
                "type": item.get("type"),
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
                "bbox": _bbox(item.get("boundingbox")),
            })
        except (KeyError, TypeError, ValueError):
            continue
    return results


def reverse(lat: float, lon: float) -> Dict[str, Any]:
    """Reverse geocoding: coordinates to a human-readable address."""
    url = "?".join([_NOMINATIM_REVERSE, urllib.parse.urlencode({
        "lat": f"{lat:.6f}",
        "lon": f"{lon:.6f}",
        "format": "jsonv2",
        "zoom": 18,
        "addressdetails": 1,
    })])

    raw = _fetch(url)
    if not isinstance(raw, dict):
        raise GeocodeError("Unexpected geocoding response", code="geocode_bad_response")

    address = raw.get("address", {}) or {}
    return {
        "label": raw.get("display_name", ""),
        "name": raw.get("name") or address.get("road") or address.get("suburb") or "",
        "road": address.get("road"),
        "suburb": address.get("suburb") or address.get("neighbourhood"),
        "city": address.get("city") or address.get("town") or address.get("village"),
        "country": address.get("country"),
        "postcode": address.get("postcode"),
        "lat": lat,
        "lon": lon,
    }


def _first_line(display_name: str) -> str:
    return display_name.split(",")[0].strip() if display_name else ""


def _bbox(boundingbox: Any) -> Optional[Dict[str, float]]:
    try:
        south, north, west, east = (float(v) for v in boundingbox)
        return {"south": south, "north": north, "west": west, "east": east}
    except (TypeError, ValueError):
        return None
