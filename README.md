# BlindNav — Smart Navigation for the Visually Impaired

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-lightgrey)](https://flask.palletsprojects.com)
[![React](https://img.shields.io/badge/Frontend-React+MapLibre-61dafb)](https://reactjs.org)
[![OSMnx](https://img.shields.io/badge/OSM-Osmnx%201.9%2B-green)](https://osmnx.readthedocs.io)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

---

**BlindNav** is an accessibility-aware route planning system designed specifically for **visually impaired pedestrians**. It computes optimal walking routes by factoring in real-world street conditions — tactile paving, steps, surface quality, sidewalk availability, lighting, road width, and incline — using OpenStreetMap data and weighted cost functions.

> **Demo:** Navigate cities like Singapore, Tokyo, and Berlin with a rich, interactive map interface.

---

## Table of Contents

- [Features](#features)
- [System Architecture](#system-architecture)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Application](#running-the-application)
  - [Frontend Development](#frontend-development)
- [Usage Guide](#usage-guide)
  - [Navigation Modes](#navigation-modes)
  - [Time-Aware Routing](#time-aware-routing)
  - [Route Analysis](#route-analysis)
  - [Map Interaction](#map-interaction)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
- [Algorithm Details](#algorithm-details)
  - [Accessibility Cost Function](#accessibility-cost-function)
  - [Time-Dependent Dynamic Cost](#time-dependent-dynamic-cost)
  - [Weighted Bidirectional A\* (Fusion Algorithm)](#weighted-bidirectional-a-fusion-algorithm)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
  - [`GET /api/health`](#get-apihealth)
  - [`POST /api/shortest_path`](#post-apishortest_path)
  - [`GET /api/v2/meta`](#get-apiv2meta)
  - [`POST /api/v2/routes`](#post-apiv2routes)
  - [`GET /api/v2/search`](#get-apiv2search)
  - [`GET /api/v2/reverse`](#get-apiv2reverse)
- [Configuration](#configuration)
  - [Navigation Modes](#navigation-modes-1)
  - [Area Definitions](#area-definitions)
  - [Region Tag Overrides](#region-tag-overrides)
- [Data Sources](#data-sources)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Accessibility-First Routing** — Routes are scored on tactile paving, steps, surface smoothness, sidewalk presence, lighting, road width, and incline.
- **Multi-City Support** — Pre-configured for Kuala Lumpur, Singapore, Tokyo, and Berlin, with dynamic area loading for any location worldwide.
- **Time-Aware Dynamic Costs** — Lighting and crowd multipliers adjust route costs by hour of day (dawn, day, dusk, night, late night).
- **Multiple Navigation Modes** — Preset weight profiles for Blind, Wheelchair, Elderly, and Balanced preferences.
- **Side-by-Side Alternatives** — One request evaluates several objectives at once (*Most Accessible*, *Fastest*, *Best Lit*, *Step-Free*) so the trade-off between speed and comfort is visible instead of implied.
- **Explainable Routes** — Every segment keeps its raw OpenStreetMap attributes, so the map can be coloured by tactile paving, lighting, sidewalk, surface or slope, and any stretch can be tapped for the underlying data.
- **Hazard Timeline** — Steps, unlit stretches and missing sidewalks are merged into distance-ordered hazards with a severity rating and a position on the map.
- **Turn-by-Turn Directions** — Bearing changes and street names produce a readable instruction list (e.g. *Turn left onto Jalan Sultan*), each row highlighting its own stretch of the route.
- **Accessibility Grading** — A 0–100 score with a six-axis factor profile (tactile, lighting, sidewalk, surface, slope, width), tuned per profile.
- **Three Themes** — Deep-space neon (default), daylight glass, and a high-contrast mode with larger type, plus a reduced-motion switch.
- **Chinese and English UI** — The interface ships in Simplified Chinese and switches to English from the map toolbar; the choice is remembered between visits.
- **Real 3D** — A DEM-backed terrain surface (Mapzen/AWS terrarium tiles) plus extruded OpenStreetMap buildings on vector basemaps, with a theme-matched sky and fog.
- **Satellite Basemap** — Esri World Imagery with a boundaries-and-places label overlay, draped over the same terrain, for a photographic view of the route.
- **Keyboard and Screen-Reader Support** — Full ARIA labelling, a combobox place search, shortcut keys (`?` lists them), and optional spoken route summaries.
- **Weighted Bidirectional A\* Algorithm** — A fusion of weighted heuristic search and bidirectional meet-in-the-middle expansion for optimal accessibility-aware pathfinding.
- **RESTful API** — Clean Flask backend with JSON endpoints for seamless integration.

---

## System Architecture

```
┌───────────────────────────────────────────────────────────┐
│                     Frontend (Browser)                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  Vite · React · TypeScript · Tailwind                 │ │
│  │  MapLibre GL JS · design tokens · 3 themes            │ │
│  └───────────────────────┬───────────────────────────────┘ │
│                          │ HTTP / JSON                      │
├──────────────────────────┼────────────────────────────────┤
│                     Backend (Flask)                          │
│  ┌───────────────────────┴───────────────────────────────┐ │
│  │  API layer (blueprints)                               │ │
│  │  legacy.py   meta.py   routes_v2.py   search.py       │ │
│  └───────────────────────┬───────────────────────────────┘ │
│  ┌───────────────────────┴───────────────────────────────┐ │
│  │  Service layer                                        │ │
│  │  GraphManager · route_service · analysis · geocode    │ │
│  └───────────────────────┬───────────────────────────────┘ │
│  ┌───────────────────────┴───────────────────────────────┐ │
│  │  Algorithm Layer                                      │ │
│  │  ┌────────────────────────────────────────────────┐   │ │
│  │  │  Weighted A* · Bidirectional A*                │   │ │
│  │  │  CostFunction · StaticCost · TimeDependentCost │   │ │
│  │  └────────────────────────────────────────────────┘   │ │
│  └───────────────────────┬───────────────────────────────┘ │
│  ┌───────────────────────┴───────────────────────────────┐ │
│  │  Data Layer                                           │ │
│  │  ┌────────────────────────────────────────────────┐   │ │
│  │  │  OSMLoader · OSMnx · Pickle Cache · KDTree     │   │ │
│  │  └────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

The application follows a three-tier architecture:

1. **Frontend** — A Vite-built React + TypeScript single-page app styled with Tailwind. MapLibre GL JS renders the basemap and every overlay (routes, per-segment colouring, hazard pins); all charts are hand-drawn SVG so no charting library is needed.
2. **Backend** — Flask, split into a thin API layer (blueprints) and a service layer holding the routing logic, so the same code backs both the frozen v1 endpoint and the richer v2 API.
3. **Data** — OpenStreetMap data fetched via OSMnx, enriched with accessibility tags, and cached locally as pickle files.

---

## Getting Started

### Prerequisites

- **Python** 3.10 or higher
- **pip** (Python package manager)
- **Node.js** 18 or higher with npm (frontend build)
- A modern web browser (Chrome, Firefox, Edge, Safari)

> The map basemap and the optional place search need internet access. Basemap
> tiles come from OpenFreeMap (vector) or OpenStreetMap (raster), and place
> search is proxied through the backend to Nominatim. Neither needs an API key;
> fonts are bundled with the frontend, so nothing else is fetched at runtime.

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/blindnav.git
   cd blindnav
   ```

2. **Create and activate a virtual environment (recommended)**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

   > **Note:** OSMnx has system-level dependencies on Windows. If you encounter issues, consider using [WSL](https://learn.microsoft.com/en-us/windows/wsl/) or consult the [OSMnx installation guide](https://osmnx.readthedocs.io/en/stable/installation.html).

4. **Pre-download OSM data (optional but recommended)**
   ```bash
   python scripts/download_osm_data.py --area all
   ```
   This downloads the road network for all pre-configured cities. The data is cached in `data/osm_cache/` for faster subsequent loads.

5. **Build the frontend**
   ```bash
   cd frontend
   npm install
   npm run build
   ```
   The bundle lands in `frontend/dist/`, which the Flask server picks up
   automatically. (If `dist/` is missing, the server falls back to the original
   no-build UI in `frontend/public/` so the API stays usable.)

### Running the Application

1. **Start the Flask server** (from the repository root)
   ```bash
   python backend/app.py
   ```
   The server starts on `http://0.0.0.0:5000` by default.

2. **Open the application**
   Navigate to [http://localhost:5000](http://localhost:5000) in your browser.

3. **Optional: Change port or enable debug mode**
   ```bash
   PORT=8080 DEBUG=1 python backend/app.py
   ```

### Frontend Development

The UI is a Vite + React + TypeScript + Tailwind project. For hot reload while
editing components, run the Flask API and the Vite dev server side by side:

```bash
# terminal 1 — API only
python backend/app.py

# terminal 2 — UI with HMR, proxies /api to the Flask server
cd frontend
npm run dev        # http://localhost:5173
```

`npm run build` refreshes `frontend/dist/` for the single-server deployment.

In dev builds the live MapLibre instance is exposed as `window.__bnMap`, which is
handy for poking at terrain, layers and the camera from the browser console. It
is stripped from production builds.

---

## Usage Guide

### Navigation Modes

BlindNav offers four preset navigation modes, each with specially tuned weight coefficients:

| Mode | Description | Key Priorities |
|------|-------------|----------------|
| **Blind** | For visually impaired users | Tactile paving (×5.0), sidewalks (×4.0), avoids steps |
| **Wheelchair** | For wheelchair users | Step-free (×5.0), wide paths (×4.0), smooth surfaces (×3.5) |
| **Elderly** | For elderly pedestrians | Good lighting (×3.0), smooth surfaces (×3.0), gentle slopes (×2.5) |
| **Balanced** | Generic pedestrian | Moderate preferences across all factors |

### Time-Aware Routing

The time slider (0:00 – 23:00) controls how lighting and crowd conditions affect route costs:

| Time Slot | Hours | Lighting Multiplier | Crowd Multiplier | Behavior |
|-----------|-------|---------------------|------------------|----------|
| **Late Night** | 23:00–05:00 | ×2.0 | ×0.8 | Unlit paths penalized; quiet roads preferred |
| **Dawn** | 05:00–07:00 | ×1.5 | ×0.8 | Early morning, sparse crowd |
| **Day** | 07:00–18:00 | ×0.5 | ×1.0 | Best for unlit paths; normal crowd |
| **Dusk** | 18:00–20:00 | ×1.5 | ×1.2 | Moderate lighting penalty; busy |
| **Night** | 20:00–23:00 | ×3.0 | ×1.5 | Heavy penalty on unlit paths; busy |

At night, the dynamic cost model triples the cost of unlit segments, naturally steering routes toward well-lit streets and main roads.

### Route Analysis

Every request returns a set of alternatives, and the right-hand panel explains
the selected one in four views:

**Comparison cards** — one per alternative, with an animated score dial, grade,
distance, walking time, step count, and tactile/lighting/sidewalk coverage bars.
Badges mark which alternative wins on score, speed and distance.

| Profile | Objective | Typical outcome |
|---------|-----------|-----------------|
| **Most Accessible** | Blind-mode weights | Tactile paving and sidewalks, no steps |
| **Fastest** | Pure walking distance | Shorter, but may cross unlit streets without sidewalks |
| **Best Lit** | Night-mode weights | Longer, but fully lit |
| **Step-Free** | Wheelchair weights | Smooth, wide, gentle slopes |

**Overview** — a six-axis accessibility radar (tactile, lighting, sidewalk,
surface, slope, width) plus composition stats: rough ground, steps length,
narrowest point, mean slope, node and exploration counts, and the top highway
types on the route.

**Hazards** — a distance-ordered timeline where each band is sized by the real
stretch it covers, with a severity rating (high / caution / minor) and a list of
every hazard. Hovering a band highlights it on the map; clicking opens a popup.

**Steps** — turn-by-turn directions derived from bearing changes and street
names. Hovering a row highlights exactly the stretch it describes; clicking
zooms to it.

**Slope** — a ground profile chart with a 10% barrier line and steep stretches
marked, plus mean/peak slope readouts.

Tapping any stretch of a route on the map opens a **segment inspector** showing
the raw OpenStreetMap tags behind the scoring decision.

### Map Interaction

- **Colour by** — switch the route colouring between hazard level, tactile
  paving, lighting, sidewalk, surface and slope (`C` cycles).
- **Hazard pins** — one marker per hazard, filterable by minimum severity.
- **Basemaps** — Night, Midnight, Daylight, Liberty (all OpenFreeMap vector
  tiles), Esri satellite imagery with a labels overlay, and OSM Standard raster
  (`B` cycles). Every option is key-free, so the demo works from a fresh clone
  without credentials. The switcher sits in the bottom-right corner of the open
  map area, so it never ends up underneath a panel. If a basemap cannot be
  reached, the map says so and offers another one instead of going blank.
- **3D** — tilts the camera to 52° and layers two things on top of the basemap:
  a terrain surface built from Mapzen/AWS terrarium DEM tiles, and extruded
  buildings (`fill-extrusion`) grown from `render_height`/`render_min_height` on
  the vector styles. Buildings need a vector basemap; with satellite or OSM
  Standard the terrain still applies and the map offers a one-click switch back
  to a vector style. Extrusions are inserted underneath the route overlays, so
  the coloured route stays on top.
- **Language** — the toolbar switch flips the whole interface between
  Simplified Chinese and English, including the generated turn-by-turn wording
  and the spoken route summary.
- **Draggable markers** — drag the start or destination pin to re-plan.
- **Shareable links** — the URL always encodes both points, the hour, the
  chosen profiles and the colour factor.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `S` / `E` | Arm start / destination picking on the map |
| `Enter` | Compute the route |
| `1`–`4` | Focus an alternative |
| `C` | Cycle the map colour factor |
| `T` | Cycle the theme |
| `B` | Cycle the basemap |
| `D` | Toggle 3D terrain and buildings |
| `D` | Toggle 3D terrain and buildings |
| `L` | Toggle large text |
| `V` | Read the selected route aloud |
| `?` | Show the shortcut list |
| `Esc` | Cancel picking or close panels |

---

## Algorithm Details

### Accessibility Cost Function

The core innovation of BlindNav is its **multi-factor accessibility cost function**. Each road segment (edge) in the graph is scored according to:

$$C_{\text{static}}(e) = \left( \sum_{i} w_i \cdot s_i \right) \cdot \max(\text{length}(e), L_{\text{ref}})$$

Where:
- $w_i$ = user-configurable weight for factor $i$
- $s_i$ = score for factor $i$ (from OSM tags)
- $L_{\text{ref}}$ = reference length (1.0 m), prevents distortion on extremely short edges

**Factors evaluated:**

| Factor | Weight (Default) | Score Range | Description |
|--------|------------------|-------------|-------------|
| Tactile Paving | 3.0 | 1.0 – 10.0 | Guiding ground indicators for the blind |
| Steps | 5.0 | 0.0 – 15.0 | Staircases (heavily penalized) |
| Surface | 2.0 | 1.0 – 9.0 | Asphalt=1.0, gravel=7.0, sand=9.0 |
| Lighting | 2.0 | 0.0 – 5.0 | Street lighting availability |
| Sidewalk | 2.5 | 0.0 – 8.0 | Presence of pedestrian walkways |
| Highway Type | 1.5 | 1.0 – 10.0 | Road classification (footway=1, motorway=10) |
| Incline | 1.5 | 0.0 – 8.0 | Slope steepness |
| Width | 1.0 | 0.0 – 6.0 | Path width (penalty if < 2.0 m) |

### Time-Dependent Dynamic Cost

The dynamic cost model adjusts the static cost by time-of-day multipliers:

$$C_{\text{dynamic}}(e, t) = C_{\text{static}}(e) \cdot M_{\text{lit}}(t, e) \cdot M_{\text{crowd}}(t, e)$$

Where:
- $M_{\text{lit}}$ = lighting multiplier from the time slot (applied only to unlit/unknown segments)
- $M_{\text{crowd}} = \max(0.6,\ 1.0 + (m_{\text{slot}} - 1.0) \cdot w_{\text{traffic}})$
  - $m_{\text{slot}}$ = crowd multiplier for the current time slot
  - $w_{\text{traffic}}$ = traffic weight for the road type (motorway=2.0, footway=0.6, etc.)

### Weighted Bidirectional A\* (Fusion Algorithm)

BlindNav's core pathfinder fuses **weighted heuristic search** with **bidirectional meet-in-the-middle expansion**, combining the strengths of both approaches:

- **Weighted Heuristic:** Each expansion step uses the priority function $f(n) = g(n) + w \cdot h(n)$ where $w = 1.0$ (admissible) by default and $h(n)$ is the approximate Euclidean distance (accounting for latitude scaling), well-aligned with the metric cost dimension.
- **Bidirectional Expansion:** Two frontiers grow simultaneously — one forward from the start node and one backward from the goal node — alternating expansion to balance progress.
- **Meeting Detection:** When a node appears in both closed sets, a candidate solution is found.
- **Early Termination:** If the minimum $f$-scores of both frontiers exceed the best known total cost, no better path can exist and the search stops immediately.
- **Path Reconstruction:** Forward half from start to meet node, backward half from meet node to goal.
- **Dead-end Detection:** The search exhausts its frontier up to 200,000 iterations.

This fusion typically explores **far fewer nodes** than standard unidirectional A\*, especially in large road networks, while retaining the optimality guarantees of a weighted heuristic.

---

## Project Structure

```
├── backend/
│   ├── __init__.py
│   ├── app.py                  # App factory: logging, CORS, blueprint registration
│   ├── paths.py                # Locates frontend/dist (falls back to public/)
│   ├── config.py               # Score maps, weights, profiles, areas, time slots
│   ├── api/                    # HTTP layer (thin)
│   │   ├── __init__.py         # register_blueprints()
│   │   ├── legacy.py           # /, static files, /api/health, /api/shortest_path
│   │   ├── meta.py             # /api/v2/meta — UI metadata and design scales
│   │   ├── routes_v2.py        # /api/v2/routes — alternatives + enrichment
│   │   └── search.py           # /api/v2/search, /api/v2/reverse (geocoding)
│   ├── services/               # Domain logic (testable, no Flask imports)
│   │   ├── graph_manager.py    # Graph loading, KDTree index, snapping, area choice
│   │   ├── cost.py             # Cost-function builders shared by v1 and v2
│   │   ├── route_service.py    # Multi-profile planning, dedupe, response shaping
│   │   ├── analysis.py         # Segments, hazards, directions, scoring, summaries
│   │   ├── geocode.py          # Nominatim proxy with disk cache + rate limiting
│   │   └── cache.py            # TTL + LRU cache for routing responses
│   ├── algorithm/
│   │   ├── __init__.py
│   │   ├── astar.py            # Weighted A* search implementation
│   │   ├── bidirectional_astar.py  # Bidirectional A* with meet-in-the-middle
│   │   └── cost_function.py    # Static & time-dependent cost computation
│   ├── data/
│   │   ├── __init__.py
│   │   └── osm_loader.py       # OSM graph loading, tag enrichment, caching
│   ├── models/
│   │   └── __init__.py
│   └── utils/
│       ├── __init__.py
│       └── geoutils.py         # Haversine, Euclidean approx, bearing
├── frontend/                   # Vite + React + TypeScript + Tailwind
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts          # Dev proxy /api -> Flask, build to dist/
│   └── src/
│       ├── main.tsx            # Entry: fonts, providers, mount
│       ├── App.tsx             # State orchestration, layout, shortcuts
│       ├── styles/index.css    # Design tokens for the three themes
│       ├── lib/                # Types, API client, geo, risk, speech, themes
│       ├── hooks/              # Meta, routes, places, media query, debounce
│       └── components/
│           ├── ui/             # Icon set and primitives (button, pill, card…)
│           ├── panel/          # Control surface: search, inputs, time, themes
│           ├── map/            # MapLibre lifecycle, route/segment/hazard layers
│           └── results/        # Comparison cards, radar, timeline, directions
│   └── public/                 # Legacy no-build UI (fallback only)
├── scripts/
│   └── download_osm_data.py    # Pre-download OSM data for configured areas
├── data/
│   └── osm_cache/              # Pickle cache of downloaded OSM graphs
├── cache/                      # Geocode JSON cache
├── logs/                       # Application logs
└── requirements.txt            # Python dependencies
```

---

## API Reference

### `GET /api/health`

Returns the server and graph loading status.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-20T12:00:00Z",
  "graph_ready": true,
  "graph_loading": false,
  "loaded_area": "kl"
}
```

### `POST /api/shortest_path`

Computes the optimal accessibility-aware route between two points.

**Request Body:**
```json
{
  "start_lat": 3.1489,
  "start_lon": 101.6957,
  "end_lat": 3.1400,
  "end_lon": 101.7000,
  "mode": "blind",
  "hour": 14,
  "area": "kl",
  "use_bidirectional": true,
  "use_dynamic_cost": true,
  "weights": {}
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start_lat` | float | — | Start latitude |
| `start_lon` | float | — | Start longitude |
| `end_lat` | float | — | End latitude |
| `end_lon` | float | — | End longitude |
| `mode` | string | `"balanced"` | Navigation mode preset |
| `hour` | int | `14` | Departure hour (0–23) |
| `area` | string | `"kl"` | Predefined area ID or `"custom"` |
| `use_bidirectional` | bool | `true` | Use bidirectional A\* (faster) |
| `use_dynamic_cost` | bool | `true` | Apply time-dependent multipliers |
| `weights` | object | `{}` | Override individual weight coefficients |

**Response:**
```json
{
  "status": "success",
  "path": [[3.1489, 101.6957], [3.1440, 101.6980], [3.1400, 101.7000]],
  "path_node_ids": [12345, 12346, 12347],
  "total_cost": 452.3,
  "static_cost": 380.1,
  "dynamic_cost": 72.2,
  "total_distance_m": 1250.5,
  "explored_count": 3420,
  "time_slot": "day",
  "algorithm": "bidirectional_a*",
  "num_nodes": 85,
  "route_analysis": {
    "total_edges": 84,
    "tactile_paving_pct": 65.0,
    "steps_count": 0,
    "lit_pct": 78.0,
    "sidewalk_pct": 72.0,
    "top_highways": [
      {"name": "footway", "pct": 45.0},
      {"name": "residential", "pct": 30.0},
      {"name": "tertiary", "pct": 15.0}
    ]
  },
  "meet_node": 12346,
  "forward_explored": 1800,
  "backward_explored": 1620
}
```

> This endpoint is frozen for backward compatibility. New clients should use
> `/api/v2/routes`, which returns the same search results plus the alternatives,
> per-segment attributes, hazards and directions described below.

### `GET /api/v2/meta`

Everything the UI needs so it hardcodes nothing: areas, profiles, modes (with
their weights), time slots, segment colour scales, hazard catalogue, severity
levels and the current graph size. Also reports `ui`, which is `vite-dist` when
the built bundle is being served and `legacy-public` otherwise.

```json
{
  "api_version": "2.0",
  "ui": "vite-dist",
  "areas": [{"id": "kl", "name": "Kuala Lumpur", "lat": 3.11, "lon": 101.686, "span_m": 5000, "zoom": 14}],
  "default_area": "kl",
  "profiles": [{"id": "accessible", "label": "Most Accessible", "short": "Accessible", "color": "#22d3a6", "icon": "eye", "mode": "blind", "description": "…"}],
  "default_profiles": ["accessible", "fast", "lit"],
  "max_profiles": 4,
  "modes": [{"id": "blind", "name": "Blind Mode", "weights": {"tactile_paving": 5.0, "steps": 5.0}}],
  "time_slots": [{"name": "night", "label": "Night", "start_hour": 20, "end_hour": 23, "lighting_multiplier": 3.0, "crowd_multiplier": 1.5}],
  "segment_factors": [{"id": "risk", "label": "Hazard level", "scale": [{"value": "high", "color": "#ff4d5f", "label": "High risk"}]}],
  "risk_catalog": [{"type": "steps", "label": "Steps", "severity": "high"}],
  "severities": [{"id": "high", "label": "High", "color": "#ff4d5f"}],
  "graph": {"nodes": 104843, "edges": 118120, "avg_degree": 2.25, "area": "kl"}
}
```

### `POST /api/v2/routes`

Plans every requested alternative in one call and enriches each with its
per-segment attributes, hazards, directions and accessibility grade.

**Request:**

```json
{
  "start": {"lat": 3.1489, "lon": 101.6957},
  "end": {"lat": 3.1400, "lon": 101.7000},
  "hour": 21,
  "area": "kl",
  "profiles": ["accessible", "fast", "lit"],
  "use_dynamic_cost": true
}
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `start` / `end` | object | — | `{lat, lon}`; flat `start_lat` / `start_lon` pairs also accepted |
| `hour` | int | `14` | Departure hour (0–23) |
| `area` | string | `"kl"` | Preferred graph; ignored when the coordinates fall outside it |
| `profiles` | string[] | `["accessible","fast","lit"]` | Any of `accessible`, `fast`, `lit`, `wheelchair` (max 4) |
| `use_dynamic_cost` | bool | `true` | Apply the time-of-day multipliers |
| `use_bidirectional` | bool | `true` | Use bidirectional A\*; `false` falls back to weighted A\* |

**Response (abridged):**

```json
{
  "status": "success",
  "request": {"hour": 21, "area": "kl", "time_slot": {"name": "night", "lighting_multiplier": 3.0, "crowd_multiplier": 1.5}},
  "snapped": {"start": {"node_id": 12260602442, "lat": 3.1489345, "lon": 101.6955503, "distance_m": 17.1}},
  "graph": {"nodes": 104843, "edges": 118120, "area": "kl"},
  "routes": [
    {
      "id": "accessible",
      "label": "Most Accessible",
      "color": "#22d3a6",
      "score": 83,
      "grade": "B",
      "factors": {"tactile": 55, "lighting": 100, "sidewalk": 100, "surface": 82, "incline": 90, "width": 100},
      "summary": "Rated 83/100: step-free, little tactile paving, well lit, sidewalk throughout.",
      "total_distance_m": 1612.9,
      "duration_s": 1740.2,
      "duration_min": 29,
      "algorithm": "bidirectional_a*",
      "explored_count": 15291,
      "path": [[3.1489345, 101.6955503], [3.1492066, 101.6956286]],
      "segments": [
        {
          "index": 0,
          "coordinates": [[3.1489345, 101.6955503], [3.1492066, 101.6956286]],
          "length_m": 31.48,
          "duration_s": 35.3,
          "highway": "footway",
          "name": null,
          "tactile_paving": "limited",
          "lit": "yes",
          "sidewalk": "yes",
          "surface": "paving_stones",
          "incline_pct": 2.0,
          "width_m": 2.0,
          "steps": false,
          "risk": "low",
          "risk_reasons": [{"code": "limited_tactile", "label": "Limited tactile paving", "severity": "low"}]
        }
      ],
      "risks": [
        {
          "id": "risk-no_sidewalk-42",
          "type": "no_sidewalk",
          "severity": "high",
          "label": "No sidewalk",
          "detail": "Walking in the roadway — stay close to the kerb",
          "from": [3.1471, 101.6992],
          "to": [3.1468, 101.6998],
          "at": [3.1468, 101.6998],
          "offset_m": 412.5,
          "length_m": 63.2,
          "segment_indexes": [42, 43]
        }
      ],
      "directions": [
        {"type": "depart", "icon": "start", "instruction": "Head north-northeast", "street": null, "distance_m": 41.4, "position": [3.1489345, 101.6955503], "angle": null},
        {"type": "turn", "icon": "left", "instruction": "Turn left onto Jalan Sultan", "street": "Jalan Sultan", "distance_m": 287.0, "position": [3.1462, 101.6987], "angle": -82.4},
        {"type": "arrive", "icon": "destination", "instruction": "Arrive at destination", "street": null, "distance_m": 0.0, "position": [3.14, 101.7], "angle": null}
      ],
      "metrics": {
        "total_edges": 131,
        "tactile_pct": 0.0,
        "lit_pct": 100.0,
        "sidewalk_pct": 100.0,
        "steps_count": 0,
        "steps_length_m": 0.0,
        "max_incline_pct": 2.0,
        "mean_incline_pct": 1.8,
        "min_width_m": 2.0,
        "rough_length_m": 0.0,
        "top_highways": [{"name": "footway", "pct": 76.3}, {"name": "pedestrian", "pct": 23.7}]
      },
      "bounds": {"south": 3.14, "north": 3.1493, "west": 101.6955, "east": 101.7001},
      "also_matches": ["lit"]
    }
  ],
  "highlights": {"best_score": "lit", "fastest": "fast", "shortest": "fast", "aliases": {}}
}
```

Routes whose paths are identical are folded together: the duplicate is dropped
and recorded in the kept route's `also_matches`, and `highlights.aliases` maps
the surviving id to the labels it also satisfies.

**Errors** use a stable envelope so the UI can react precisely:

```json
{"status": "error", "code": "graph_loading", "message": "Map data still loading, please try again (first launch downloads from OpenStreetMap)"}
```

| Code | HTTP | Meaning |
|------|------|---------|
| `missing_coordinates` | 400 | `start` / `end` absent or incomplete |
| `invalid_coordinates` | 400 | Non-numeric, out of range, or the `(0,0)` sentinel |
| `invalid_profiles` | 400 | No recognised profile id in `profiles` |
| `no_network` | 400 | No road network near the requested point |
| `no_path` | 404 | No feasible path for any profile |
| `graph_loading` | 503 | The OpenStreetMap extract for this area is still downloading |
| `internal_error` | 500 | Unexpected failure (logged server-side) |

### `GET /api/v2/search`

Forward geocoding through a server-side Nominatim proxy (project User-Agent,
one request per second, on-disk cache under `cache/geocode/`). Queries shorter
than three characters return an empty list without touching the network.

```
GET /api/v2/search?q=KLCC&limit=6
```

```json
{
  "status": "success",
  "query": "KLCC",
  "results": [
    {"id": "351317315", "name": "KLCC", "label": "KLCC, 156, Jalan Ampang, Kuala Lumpur, Malaysia", "category": "tourism", "type": "attraction", "lat": 3.1592, "lon": 101.7134, "bbox": {"south": 3.15, "north": 3.16, "west": 101.71, "east": 101.72}}
  ]
}
```

### `GET /api/v2/reverse`

Turns a map click into a readable address.

```
GET /api/v2/reverse?lat=3.1489&lon=101.6957
```

```json
{
  "status": "success",
  "place": {"label": "Jalan Benteng, Bukit Bintang, Kuala Lumpur, 50050, Malaysia", "name": "Jalan Benteng", "road": "Jalan Benteng", "suburb": "Bukit Bintang", "city": "Kuala Lumpur", "country": "Malaysia", "lat": 3.1489, "lon": 101.6957}
}
```

Both geocoding endpoints answer with `code: "geocode_unavailable"` and HTTP 502
when Nominatim cannot be reached, which the UI degrades to coordinate-only
input.

---

## Configuration

### Navigation Modes

Navigation modes are defined in `backend/config.py` under `PRESET_MODES`. Each mode specifies a `WeightCoefficients` object with custom weights for each accessibility factor. You can add your own mode:

```python
PRESET_MODES["my_mode"] = {
    "name": "My Custom Mode",
    "description": "Custom preferences...",
    "weights": WeightCoefficients(
        tactile_paving=3.0,
        steps=5.0,
        # ... other weights
    ),
}
```

### Area Definitions

Areas are configured via `AREA_CONFIGS`:

```python
AREA_CONFIGS = {
    "kl":   {"lat": 3.110, "lon": 101.686, "dist": 5000, "name": "Kuala Lumpur"},
    "singapore": {"lat": 1.352, "lon": 103.820, "dist": 3000, "name": "Singapore"},
    "tokyo": {"lat": 35.676, "lon": 139.750, "dist": 3000, "name": "Tokyo"},
    "berlin": {"lat": 52.520, "lon": 13.405, "dist": 3000, "name": "Berlin"},
}
```

You can add any city by providing its latitude, longitude, and search radius (in meters). When a user's coordinates fall outside predefined areas, the system automatically loads the surrounding region dynamically.

### Region Tag Overrides

Real-world OSM tag completeness varies by region. `REGION_TAG_OVERRIDES` in `config.py` allows per-city, per-highway-type tag defaults:

```python
REGION_TAG_OVERRIDES = {
    "kl": {
        "footway": {
            "tactile_paving": "limited",
            "lit": "yes",
            "surface": "paving_stones",
        },
        # ...
    },
    "singapore": {
        "footway": {
            "tactile_paving": "yes",
            "lit": "yes",
            "surface": "concrete",
        },
        # ...
    },
}
```

The tag filling priority is:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 (Lowest) | `FALLBACK_DEFAULTS` | Global defaults for any tag |
| 2 | `HIGHWAY_TAG_DEFAULTS` | Per-road-type defaults |
| 3 | `REGION_TAG_OVERRIDES` | Regional customizations |
| 4 (Highest) | Original OSM data | Preserved via `setdefault` |

---

## Data Sources

- **[OpenStreetMap](https://www.openstreetmap.org/)** — Primary source for road networks and accessibility tags (tactile_paving, sidewalk, lit, surface, incline, width, etc.).
- **[OSMnx](https://osmnx.readthedocs.org/)** — Python library for downloading and modeling OSM street networks.
- **[MapLibre GL JS](https://maplibre.org/)** — Open-source map rendering library for the frontend.
- **[OpenFreeMap](https://openfreemap.org/)** — Key-free vector tile service backing the Night, Midnight, Daylight and Liberty basemaps, including fonts and sprites.
- **[Esri World Imagery](https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9)** — Satellite basemap, with the *World Boundaries and Places* reference layer drawn on top for labels.
- **[Mapzen / AWS Open Data terrain tiles](https://registry.opendata.aws/terrain-tiles/)** — Terrarium-encoded DEM tiles that drive the 3D terrain surface.
- **[Nominatim](https://nominatim.org/)** — Geocoding for the place-search box, proxied through the backend with a project User-Agent and one request per second.
- **[CARTO](https://carto.com/)** — *No longer used.* Its free raster basemaps now answer with an "API key required" placeholder image, which is why every basemap became key-free.

---

## Development

### Running Tests

```bash
pytest
```

> The repository currently ships no test suite; `pytest` is listed for the
> cases the service layer is designed for (it takes plain dicts and graphs, so
> it can be exercised without Flask or the network).

### Linting

```bash
# Python
ruff check backend

# TypeScript / React
cd frontend
npm run typecheck
```

### Adding a New City

1. Add an entry to `AREA_CONFIGS` in `backend/config.py`:
   ```python
   "paris": {"lat": 48.8566, "lon": 2.3522, "dist": 3000, "name": "Paris"},
   ```
2. (Optional) Add region tag overrides in `REGION_TAG_OVERRIDES`. The city
   appears in the UI automatically — `/api/v2/meta` publishes every area, so no
   frontend change is required.
3. Pre-download the data:
   ```bash
   python scripts/download_osm_data.py --area paris
   ```

### Adding a New Navigation Mode

1. Add a `WeightCoefficients` entry to `PRESET_MODES` in `backend/config.py`.
2. If it should appear as a comparison alternative, add a matching entry to
   `ROUTE_PROFILES` (label, colour, icon, `base_speed_mps`, and a `cost`
   descriptor referencing the preset). It is then offered by `/api/v2/meta`
   with no frontend change.
3. Add an icon in `frontend/src/components/ui/Icon.tsx` if the profile uses a
   new glyph.

---

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository.
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`).
3. **Commit your changes** (`git commit -m 'Add amazing feature'`).
4. **Push to the branch** (`git push origin feature/amazing-feature`).
5. **Open a Pull Request** describing your changes in detail.

Please ensure your code passes linting (`ruff check .`) and existing tests (`pytest`).

---

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Acknowledgments

- OpenStreetMap contributors for providing the foundational map data.
- The OSMnx project for making OSM data accessible in Python.
- MapLibre GL JS for enabling open-source map rendering.
- Academic research on accessibility-aware pathfinding that inspired the multi-factor cost model.

---


