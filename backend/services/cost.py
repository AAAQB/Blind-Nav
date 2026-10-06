"""Edge-cost builders shared by the legacy and v2 routing endpoints."""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from backend.algorithm.cost_function import CostFunction
from backend.config import PRESET_MODES, ROUTE_PROFILES, WeightCoefficients

CostFn = Callable[[int, int, Dict[str, Any], Optional[int]], float]

_MIN_LENGTH: float = 1.0


def build_cost_fn(
    weights: Optional[Dict[str, float]] = None,
    use_dynamic: bool = False,
    hour: Optional[int] = None,
) -> CostFn:
    """Accessibility cost function, optionally time-dependent.

    Behaviour is identical to the original inline builder in ``backend.app``:
    when ``use_dynamic`` is set but no hour is available for an edge, the static
    cost is used as a fallback.
    """
    coeffs = WeightCoefficients.from_dict(weights) if weights else WeightCoefficients()
    cf = CostFunction(coeffs)

    if use_dynamic:
        def cost_fn(current_id: int, neighbor_id: int, tags: Dict, _hour: Optional[int] = None) -> float:
            h = hour if hour is not None else _hour
            if h is not None:
                return cf.compute_dynamic(tags, h)
            return cf.compute_static(tags)
    else:
        def cost_fn(current_id: int, neighbor_id: int, tags: Dict, _hour: Optional[int] = None) -> float:
            return cf.compute_static(tags)

    return cost_fn


def build_distance_cost_fn() -> CostFn:
    """Pure walking-distance cost (metres), used by the "Fastest" profile."""
    def cost_fn(current_id: int, neighbor_id: int, tags: Dict, _hour: Optional[int] = None) -> float:
        try:
            return max(float(tags.get("length", _MIN_LENGTH)), _MIN_LENGTH)
        except (TypeError, ValueError):
            return _MIN_LENGTH

    return cost_fn


def profile_weights(profile_id: str) -> Optional[Dict[str, float]]:
    """Weight dict for a route profile, or ``None`` for distance-based profiles."""
    profile = ROUTE_PROFILES.get(profile_id)
    if not profile:
        return None
    cost = profile.get("cost", {})
    if cost.get("type") == "distance":
        return None
    preset = PRESET_MODES.get(cost.get("preset", ""))
    if preset is None:
        return None
    return preset["weights"].to_dict()


def build_profile_cost_fn(
    profile_id: str,
    hour: Optional[int] = None,
    use_dynamic: bool = True,
) -> CostFn:
    """Cost function implementing a named route profile."""
    cost = ROUTE_PROFILES.get(profile_id, {}).get("cost", {})
    if cost.get("type") == "distance":
        return build_distance_cost_fn()
    return build_cost_fn(profile_weights(profile_id), use_dynamic=use_dynamic, hour=hour)
