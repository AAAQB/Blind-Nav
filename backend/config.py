from __future__ import annotations
from dataclasses import dataclass
from typing import Dict, List, Optional, TypedDict
# ── Score maps defining accessibility difficulty for each OSM tag value ──
TACTILE_PAVING_MAP: Dict[str, float] = {
    "yes": 1.0,
    "incorrect": 5.0,
    "limited": 6.0,
    "no": 10.0,
}
STEPS_MAP: Dict[str, float] = {
    "yes": 15.0,
    "no": 0.0,
}
SURFACE_MAP: Dict[str, float] = {
    "asphalt": 1.0,
    "concrete": 1.5,
    "concrete:lanes": 2.0,
    "concrete:plates": 2.0,
    "paving_stones": 3.0,
    "sett": 3.5,
    "paved": 2.0,
    "unpaved": 6.0,
    "compacted": 5.0,
    "fine_gravel": 6.0,
    "gravel": 7.0,
    "dirt": 7.5,
    "ground": 7.0,
    "grass": 7.0,
    "sand": 9.0,
    "wood": 4.0,
    "metal": 4.0,
}
LIGHTING_MAP: Dict[str, float] = {
    "yes": 0.0,
    "24/7": 0.0,
    "automatic": 0.5,
    "limited": 3.0,
    "no": 5.0,
}
SIDEWALK_MAP: Dict[str, float] = {
    "yes": 0.0,
    "both": 0.0,
    "left": 2.0,
    "right": 2.0,
    "no": 8.0,
    "none": 8.0,
    "separate": 1.0,
}
HIGHWAY_MAP: Dict[str, float] = {
    "footway": 1.0,
    "path": 2.0,
    "pedestrian": 1.0,
    "steps": 15.0,
    "living_street": 3.0,
    "residential": 5.0,
    "service": 4.0,
    "track": 5.0,
    "unclassified": 6.0,
    "tertiary": 7.0,
    "secondary": 8.0,
    "primary": 9.0,
    "trunk": 10.0,
    "trunk_link": 10.0,
    "motorway": 10.0,
    "motorway_link": 10.0,
    "primary_link": 9.0,
    "secondary_link": 8.0,
    "tertiary_link": 7.0,
    "crossing": 3.0,
}
INCLINE_COST_PER_PERCENT: float = 0.8
INCLINE_MAX_COST: float = 8.0
WIDTH_THRESHOLD_M: float = 2.0
WIDTH_COST_PER_METER_BELOW: float = 3.0
WIDTH_MAX_COST: float = 6.0
INCLINE_STR_MAP: Dict[str, float] = {
    "steep": 8.0, "up": 4.0, "down": 4.0, "yes": 4.0,
}
UNKNOWN_SCORE: float = 5.0

HIGHWAY_TAG_DEFAULTS: Dict[str, Dict[str, str]] = {
    "footway": {
        "tactile_paving": "yes", "steps": "no", "surface": "paving_stones",
        "lit": "yes", "sidewalk": "yes", "incline": "2%", "width": "2.0",
    },
    "path": {
        "tactile_paving": "no", "steps": "no", "surface": "compacted",
        "lit": "no", "sidewalk": "no", "incline": "3%", "width": "1.5",
    },
    "pedestrian": {
        "tactile_paving": "yes", "steps": "no", "surface": "asphalt",
        "lit": "yes", "sidewalk": "yes", "incline": "0%", "width": "3.0",
    },
    "steps": {
        "tactile_paving": "no", "steps": "yes", "surface": "paving_stones",
        "lit": "yes", "sidewalk": "yes", "incline": "10%", "width": "1.5",
    },
    "living_street": {
        "tactile_paving": "no", "steps": "no", "surface": "asphalt",
        "lit": "yes", "sidewalk": "yes", "incline": "2%", "width": "3.0",
    },
    "residential": {
        "tactile_paving": "no", "steps": "no", "surface": "asphalt",
        "lit": "limited", "sidewalk": "yes", "incline": "2%", "width": "3.5",
    },
    "service": {
        "tactile_paving": "no", "steps": "no", "surface": "asphalt",
        "lit": "limited", "sidewalk": "limited", "incline": "2%", "width": "3.0",
    },
    "track": {
        "tactile_paving": "no", "steps": "no", "surface": "ground",
        "lit": "no", "sidewalk": "no", "incline": "3%", "width": "2.0",
    },
    "unclassified": {
        "tactile_paving": "no", "steps": "no", "surface": "asphalt",
        "lit": "no", "sidewalk": "no", "incline": "2%", "width": "3.0",
    },
    "tertiary": {
        "tactile_paving": "no", "steps": "no", "surface": "asphalt",
        "lit": "yes", "sidewalk": "no", "incline": "0%", "width": "5.0",
    },
    "secondary": {
        "tactile_paving": "no", "steps": "no", "surface": "asphalt",
        "lit": "yes", "sidewalk": "no", "incline": "0%", "width": "6.0",
    },
    "primary": {
        "tactile_paving": "no", "steps": "no", "surface": "asphalt",
        "lit": "yes", "sidewalk": "no", "incline": "0%", "width": "7.0",
    },
    "trunk": {
        "tactile_paving": "no", "steps": "no", "surface": "asphalt",
        "lit": "yes", "sidewalk": "no", "incline": "0%", "width": "7.0",
    },
}
FALLBACK_DEFAULTS: Dict[str, str] = {
    "tactile_paving": "no", "steps": "no", "surface": "asphalt",
    "lit": "no", "sidewalk": "no", "highway": "unclassified",
    "incline": "0%", "width": "2.0",
}

# ── Regional Tag Overrides ──
# OSM data completeness and infrastructure characteristics vary greatly by region.
# This table defines per-area overrides on top of HIGHWAY_TAG_DEFAULTS.
# Only fields differing from the global defaults are listed.
# Format: REGION_TAG_OVERRIDES[area_id][highway_type] = {tag: value, ...}
REGION_TAG_OVERRIDES: Dict[str, Dict[str, Dict[str, str]]] = {
    # ═══════════════════════════════════════════════════════════
    # Kuala Lumpur, Malaysia — Tropical SE Asia
    # Tactile paving uncommon, limited lighting,
    # sidewalks often missing on main roads
    # ═══════════════════════════════════════════════════════════
    "kl": {
        "footway": {
            "tactile_paving": "limited",  # Some tactile paving in city center
            "lit": "yes",                 # Good lighting in city center
            "surface": "paving_stones",
        },
        "path": {"surface": "compacted", "lit": "no"},
        "pedestrian": {"tactile_paving": "limited", "lit": "yes"},
        "residential": {
            "tactile_paving": "no",
            "lit": "limited",
            "sidewalk": "limited",
        },
        "tertiary": {"sidewalk": "no", "lit": "limited"},
        "secondary": {"sidewalk": "no"},
    },
    # ═══════════════════════════════════════════════════════════
    # Singapore — Modern garden city, excellent accessibility
    # ═══════════════════════════════════════════════════════════
    "singapore": {
        "footway": {
            "tactile_paving": "yes",
            "lit": "yes",
            "surface": "concrete",
            "sidewalk": "yes",
        },
        "path": {
            "tactile_paving": "limited",
            "surface": "concrete",
            "lit": "yes",
            "sidewalk": "yes",
        },
        "pedestrian": {
            "tactile_paving": "yes",
            "lit": "yes",
            "surface": "concrete",
        },
        "residential": {
            "tactile_paving": "no",
            "lit": "yes",
            "sidewalk": "yes",
        },
        "tertiary": {"sidewalk": "limited", "lit": "yes"},
        "secondary": {"sidewalk": "limited"},
        "steps": {"tactile_paving": "yes"},  # Steps often have tactile paving
    },
    # ═══════════════════════════════════════════════════════════
    # Tokyo — Global accessibility benchmark
    # Tactile paving (ブロック) is ubiquitous,
    # but streets tend to be narrower
    # ═══════════════════════════════════════════════════════════
    "tokyo": {
        "footway": {
            "tactile_paving": "yes",
            "lit": "yes",
            "surface": "asphalt",
            "sidewalk": "yes",
        },
        "path": {
            "tactile_paving": "limited",
            "surface": "asphalt",
            "lit": "yes",
        },
        "pedestrian": {
            "tactile_paving": "yes",
            "lit": "yes",
            "surface": "asphalt",
        },
        "residential": {
            "tactile_paving": "limited",
            "lit": "yes",
            "sidewalk": "yes",
            "width": "2.5",  # Japanese residential streets are narrow
        },
        "tertiary": {
            "sidewalk": "limited",
            "lit": "yes",
            "width": "3.0",
        },
        "secondary": {"sidewalk": "limited"},
        "steps": {"tactile_paving": "yes"},  # Steps usually have tactile paving
        "crossing": {"tactile_paving": "yes"},  # Crosswalks often have tactile paving
    },
    # ═══════════════════════════════════════════════════════════
    # Berlin — Typical European city
    # Good accessibility infrastructure, high sidewalk coverage
    # ═══════════════════════════════════════════════════════════
    "berlin": {
        "footway": {
            "tactile_paving": "yes",
            "lit": "yes",
            "surface": "paving_stones",  # Berlin's characteristic paving stone surfaces
            "sidewalk": "yes",
        },
        "path": {
            "tactile_paving": "limited",
            "surface": "compacted",
            "lit": "limited",
            "sidewalk": "yes",
        },
        "pedestrian": {
            "tactile_paving": "yes",
            "lit": "yes",
            "surface": "paving_stones",
        },
        "residential": {
            "tactile_paving": "no",
            "lit": "yes",
            "sidewalk": "yes",
        },
        "tertiary": {"sidewalk": "limited", "lit": "yes"},
        "secondary": {"sidewalk": "limited"},
        "steps": {"tactile_paving": "yes"},
    },
}

# ── Note: sepang & putrajaya configs removed as those regions were deprecated ──

@dataclass
class WeightCoefficients:
    tactile_paving: float = 3.0
    steps: float = 5.0
    surface: float = 2.0
    lighting: float = 2.0
    sidewalk: float = 2.5
    highway: float = 1.5
    incline: float = 1.5
    width: float = 1.0
    def to_dict(self) -> Dict[str, float]:
        return {
            "tactile_paving": self.tactile_paving,
            "steps": self.steps,
            "surface": self.surface,
            "lighting": self.lighting,
            "sidewalk": self.sidewalk,
            "highway": self.highway,
            "incline": self.incline,
            "width": self.width,
        }
    @classmethod
    def from_dict(cls, d: Dict[str, float]) -> "WeightCoefficients":
        return cls(
            tactile_paving=d.get("tactile_paving", 3.0),
            steps=d.get("steps", 5.0),
            surface=d.get("surface", 2.0),
            lighting=d.get("lighting", 2.0),
            sidewalk=d.get("sidewalk", 2.5),
            highway=d.get("highway", 1.5),
            incline=d.get("incline", 1.5),
            width=d.get("width", 1.0),
        )
@dataclass
class TimeSlot:
    """Defines a time-of-day period with lighting and crowd multipliers.

    lighting_multiplier: Applied to UNLIT segments during this period.
        - >1.0 penalises unlit segments (night: 3.0 → triple cost)
        - <1.0 discounts unlit segments (day: 0.5 → half cost, lighting matters less)
    crowd_multiplier: Base crowd factor for the period.
        - >1.0 means busier (rush hour, evening)
        - <1.0 means quieter (late night)
        Actual M_crowd = max(0.6, 1.0 + (crowd_multiplier - 1.0) * traffic_weight)
    """
    name: str
    start_hour: int
    end_hour: int
    lighting_multiplier: float
    crowd_multiplier: float

TIME_SLOTS: List[TimeSlot] = [
    TimeSlot("dawn",       5,  7, 1.5, 0.8),   # early morning, sparse crowd
    TimeSlot("day",        7, 18, 0.5, 1.0),   # daytime, normal crowd
    TimeSlot("dusk",      18, 20, 1.5, 1.2),   # dusk, moderate crowd
    TimeSlot("night",     20, 23, 3.0, 1.5),   # night, heavy crowd in lit areas
    TimeSlot("late_night",23,  5, 2.0, 0.8),   # late night, sparse crowd
]
def get_time_slot(hour: int) -> TimeSlot:
    for slot in TIME_SLOTS:
        if slot.start_hour <= slot.end_hour:
            if slot.start_hour <= hour < slot.end_hour:
                return slot
        else:
            if hour >= slot.start_hour or hour < slot.end_hour:
                return slot
    return TIME_SLOTS[1]
PRESET_MODES: Dict[str, Dict] = {
    "blind": {
        "name": "Blind Mode",
        "description": "Prioritises tactile paving, avoids steps, prefers "
                       "smooth surfaces and dedicated footways.",
        "weights": WeightCoefficients(
            tactile_paving=5.0, steps=5.0, surface=2.5,
            lighting=2.0, sidewalk=4.0, highway=4.0,
            incline=1.0, width=1.0,
        ),
    },
    "wheelchair": {
        "name": "Wheelchair Mode",
        "description": "Wide, smooth, step-free, and gentle slopes.",
        "weights": WeightCoefficients(
            tactile_paving=1.0, steps=5.0, surface=3.5,
            lighting=1.0, sidewalk=4.0, highway=2.0,
            incline=3.0, width=4.0,
        ),
    },
    "elderly": {
        "name": "Elderly Mode",
        "description": "Flat, well-lit, smooth paths with minimal steps.",
        "weights": WeightCoefficients(
            tactile_paving=1.5, steps=4.0, surface=3.0,
            lighting=3.0, sidewalk=2.5, highway=1.5,
            incline=2.5, width=1.5,
        ),
    },
    "night": {
        "name": "Night Mode",
        "description": "Well-lit routes, avoids unlit / isolated segments.",
        "weights": WeightCoefficients(
            tactile_paving=2.0, steps=3.0, surface=1.5,
            lighting=5.0, sidewalk=2.0, highway=2.5,
            incline=1.0, width=1.0,
        ),
    },
    "stroller": {
        "name": "Stroller Mode",
        "description": "Smooth, wide, step-free, gentle slopes.",
        "weights": WeightCoefficients(
            tactile_paving=1.0, steps=5.0, surface=3.5,
            lighting=1.5, sidewalk=3.5, highway=1.5,
            incline=3.0, width=3.5,
        ),
    },
    "balanced": {
        "name": "Balanced Mode",
        "description": "Generic pedestrian with moderate safety preferences.",
        "weights": WeightCoefficients(
            tactile_paving=2.0, steps=3.0, surface=2.0,
            lighting=1.5, sidewalk=2.0, highway=1.5,
            incline=1.0, width=1.0,
        ),
    },
}
HEURISTIC_WEIGHT: float = 1.0
BIDIRECTIONAL_MEET_RADIUS: int = 1
MAX_SEARCH_ITERATIONS: int = 200_000
class AreaConfig(TypedDict):
    """Type definition for area configuration."""
    lat: float
    lon: float
    dist: int
    name: str

AREA_CONFIGS: Dict[str, AreaConfig] = {
    "kl":   {"lat": 3.110, "lon": 101.686, "dist": 5000, "name": "Kuala Lumpur"},
    "singapore": {"lat": 1.352, "lon": 103.820, "dist": 3000, "name": "Singapore"},
    "tokyo": {"lat": 35.676, "lon": 139.750, "dist": 3000, "name": "Tokyo"},
    "berlin": {"lat": 52.520, "lon": 13.405, "dist": 3000, "name": "Berlin"},
}
DEFAULT_AREA: str = "kl"
OSM_NETWORK_TYPE: str = "walk"


# ══════════════════════════════════════════════════════════════════
# Route Profiles — the alternatives computed for a single request
# ══════════════════════════════════════════════════════════════════
# `cost` selects the objective the search optimises:
#   {"type": "weights", "preset": <PRESET_MODES key>}  → accessibility cost
#   {"type": "distance"}                               → pure shortest walk
#
# `base_speed_mps` feeds the per-segment travel-time model (see
# services/analysis.py): the same path takes longer for a blind pedestrian
# than for a sighted one, so estimated duration is profile-aware.
ROUTE_PROFILES: Dict[str, Dict[str, Any]] = {
    "accessible": {
        "label": "Most Accessible",
        "short": "Accessible",
        "description": "Maximises tactile paving and sidewalk coverage, avoids steps.",
        "color": "#22d3a6",
        "accent": "#0f766e",
        "icon": "eye",
        "mode": "blind",
        "base_speed_mps": 1.15,
        "cost": {"type": "weights", "preset": "blind"},
    },
    "fast": {
        "label": "Fastest",
        "short": "Fastest",
        "description": "Shortest walking distance, ignores accessibility comfort.",
        "color": "#4d8dff",
        "accent": "#1d4ed8",
        "icon": "route",
        "mode": "balanced",
        "base_speed_mps": 1.45,
        "cost": {"type": "distance"},
    },
    "lit": {
        "label": "Best Lit",
        "short": "Night Safe",
        "description": "Prefers well-lit segments — safest after dark.",
        "color": "#f0b429",
        "accent": "#b45309",
        "icon": "moon",
        "mode": "night",
        "base_speed_mps": 1.25,
        "cost": {"type": "weights", "preset": "night"},
    },
    "wheelchair": {
        "label": "Step-Free",
        "short": "Step-Free",
        "description": "Step-free, smooth, wide paths with gentle slopes.",
        "color": "#a78bfa",
        "accent": "#6d28d9",
        "icon": "wheelchair",
        "mode": "wheelchair",
        "base_speed_mps": 1.0,
        "cost": {"type": "weights", "preset": "wheelchair"},
    },
}

# Profiles computed when the client does not ask for a specific set.
DEFAULT_PROFILES: List[str] = ["accessible", "fast", "lit"]

# Max number of alternatives a single request may compute (protects latency).
MAX_PROFILES_PER_REQUEST: int = 4

# ── Speed model inputs (services/analysis.py) ──
SURFACE_SPEED_FACTOR: Dict[str, float] = {
    "asphalt": 1.0,
    "concrete": 0.98,
    "concrete:lanes": 0.95,
    "concrete:plates": 0.95,
    "paved": 0.97,
    "paving_stones": 0.9,
    "sett": 0.85,
    "wood": 0.85,
    "metal": 0.85,
    "compacted": 0.85,
    "fine_gravel": 0.8,
    "gravel": 0.75,
    "ground": 0.78,
    "grass": 0.78,
    "dirt": 0.75,
    "sand": 0.6,
}
STEPS_SPEED_MPS: float = 0.4

# ── Accessibility score tuning ──
# Length-weighted tag quality (0..100) for each accessibility factor.
FACTOR_QUALITY: Dict[str, Dict[str, float]] = {
    "tactile":    {"yes": 100.0, "limited": 55.0, "incorrect": 20.0, "no": 10.0, "unknown": 10.0},
    "lighting":   {"yes": 100.0, "24/7": 100.0, "automatic": 85.0, "limited": 55.0, "no": 15.0, "unknown": 15.0},
    "sidewalk":   {"yes": 100.0, "both": 100.0, "separate": 80.0, "left": 70.0, "right": 70.0,
                   "limited": 50.0, "no": 10.0, "none": 10.0, "unknown": 10.0},
    "surface":    {"asphalt": 100.0, "concrete": 95.0, "paved": 95.0, "concrete:lanes": 90.0,
                   "concrete:plates": 88.0, "paving_stones": 78.0, "sett": 70.0, "wood": 65.0,
                   "metal": 65.0, "compacted": 62.0, "fine_gravel": 55.0, "ground": 50.0,
                   "grass": 50.0, "dirt": 42.0, "gravel": 40.0, "sand": 25.0, "unknown": 55.0},
    "width":      {"_default": 60.0},
}
# Relative importance of each factor for the overall score, per profile.
FACTOR_WEIGHTS: Dict[str, Dict[str, float]] = {
    "accessible": {"tactile": 0.30, "lighting": 0.15, "sidewalk": 0.25, "surface": 0.15, "incline": 0.07, "width": 0.08},
    "fast":       {"tactile": 0.15, "lighting": 0.15, "sidewalk": 0.20, "surface": 0.20, "incline": 0.15, "width": 0.15},
    "lit":        {"tactile": 0.12, "lighting": 0.45, "sidewalk": 0.18, "surface": 0.13, "incline": 0.06, "width": 0.06},
    "wheelchair": {"tactile": 0.10, "lighting": 0.10, "sidewalk": 0.20, "surface": 0.22, "incline": 0.20, "width": 0.18},
}
# Score deducted per steps segment (a flight of stairs is a hard blocker).
STEPS_SCORE_PENALTY: float = 9.0
STEPS_SCORE_PENALTY_CAP: float = 35.0

# ── Risk classification thresholds ──
NARROW_WIDTH_M: float = 1.5
VERY_NARROW_WIDTH_M: float = 1.2
STEEP_INCLINE_PCT: float = 10.0
POOR_SURFACES: List[str] = ["unpaved", "gravel", "fine_gravel", "dirt", "ground", "grass", "sand", "compacted"]
UNLIT_VALUES: List[str] = ["no", "unknown", "limited"]

# ── Geocoding (services/geocode.py) ──
GEOCODE_USER_AGENT: str = "BlindNav/2.0 (accessibility routing demo)"
GEOCODE_MIN_INTERVAL_S: float = 1.1   # Nominatim usage policy: max 1 req/s
GEOCODE_CACHE_TTL_S: int = 60 * 60 * 24 * 7
GEOCODE_TIMEOUT_S: float = 8.0

# ── Routing response cache ──
ROUTE_CACHE_SIZE: int = 64
ROUTE_CACHE_TTL_S: int = 120