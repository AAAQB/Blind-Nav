# BlindNav

> **Smart, accessibility-aware pedestrian navigation for the visually impaired.**

BlindNav is a full-stack web application that computes safe, comfortable walking routes by modeling pedestrian accessibility through OpenStreetMap (OSM) road network data. Unlike conventional navigation apps that optimize for distance or time, BlindNav scores each road segment on a rich set of accessibility dimensions — tactile paving, surface type, lighting, sidewalk availability, incline, steps, road width, and road class — and finds the path that best matches the user's mobility needs.

---

## Features

### Accessibility-Aware Routing

The routing engine evaluates **8 accessibility dimensions** for every road segment:

| Dimension     | What it measures                          |
|---------------|-------------------------------------------|
| Tactile Paving| Presence of guiding ground indicators     |
| Steps         | Presence of stairways                     |
| Surface       | Smoothness (asphalt to sand/dirt)          |
| Lighting      | Street lighting at night                  |
| Sidewalk      | Availability of dedicated walkways        |
| Highway       | Road classification & traffic exposure    |
| Incline       | Steepness (grade %)                       |
| Width         | Path width (narrow paths penalized)       |

### Preset Navigation Modes

Four presets tailor routes to specific user profiles:

| Mode         | Best for                                      |
|--------------|-----------------------------------------------|
| **Blind**    | Prioritizes tactile paving, footways, no steps|
| **Wheelchair**| Wide, smooth, step-free, gentle inclines      |
| **Elderly**  | Flat, well-lit, smooth paths                  |
| **Balanced** | Generic pedestrian with moderate preferences  |

### Time-Aware Dynamic Costs

The cost function adapts to the time of day using **5 time slots**:

| Slot         | Hours   | Lighting Effect                     | Crowd Effect                    |
|--------------|---------|-------------------------------------|---------------------------------|
| Dawn         | 05-07   | Unlit segments cost 1.5×            | Sparse crowd (0.8×)             |
| Day          | 07-18   | Unlit segments discounted (0.5×)    | Normal crowd (1.0×)             |
| Dusk         | 18-20   | Unlit segments cost 1.5×            | Moderate crowd (1.2×)           |
| Night        | 20-23   | Unlit segments cost **3.0×**        | Heavy crowd (1.5×)              |
| Late Night   | 23-05   | Unlit segments cost 2.0×            | Sparse crowd (0.8×)             |

### Multi-City Support

Pre-configured for 4 cities with **region-specific accessibility tag overrides**:

| City       | Coordinates          | Coverage      |
|------------|----------------------|---------------|
| Kuala Lumpur | 3.110°N, 101.686°E | 5 km radius   |
| Singapore    | 1.352°N, 103.820°E | 3 km radius   |
| Tokyo        | 35.676°N, 139.750°E| 3 km radius   |
| Berlin       | 52.520°N, 13.405°E | 3 km radius   |

The system also supports **dynamic area loading** — if you set coordinates outside the predefined areas, the server automatically downloads the necessary OSM data for that region.

### Pathfinding Algorithm: Weighted Bidirectional A*

The routing engine uses a **fusion of weighted A\* and bidirectional A\*** — a single algorithm that simultaneously expands the search from both the start and goal frontiers, with each expansion guided by a weighted heuristic ($f = g + w \cdot h$). This approach offers the best of both worlds:

- **Weighted heuristic** — Prioritizes exploration toward the goal, reducing search space.
- **Bidirectional expansion** — Halves the effective search depth, resulting in significantly faster convergence on long routes.
- **Early termination** — Once the minimum f-scores of both frontiers exceed the best known total cost, the search stops with a proven optimal bound.

---

## Tech Stack

| Layer       | Technology                         |
|-------------|------------------------------------|
| Backend     | Python 3, Flask, Flask-CORS        |
| Pathfinding | NetworkX, SciPy KDTree             |
| Map Data    | OpenStreetMap via OSMnx            |
| Frontend    | Vanilla HTML/CSS/JS, React 18, MapLibre GL JS |
| Spatial     | NumPy, SciPy (KDTree)              |

---

## Project Structure

```
blind_nav/
├── backend/
│   ├── app.py                     # Flask server, REST API, graph manager
│   ├── config.py                  # Score maps, presets, time slots, area configs
│   ├── algorithm/
│   │   ├── astar.py               # Weighted A* search
│   │   ├── bidirectional_astar.py # Bidirectional A* search
│   │   └── cost_function.py       # Static & time-dependent cost functions
│   ├── data/
│   │   └── osm_loader.py          # OSM data download, caching, tag enrichment
│   ├── models/
│   │   └── __init__.py
│   └── utils/
│       └── geoutils.py            # Haversine, Euclidean approx, bearing, etc.
├── frontend/
│   └── public/
│       └── index.html             # Single-page app (React + MapLibre)
├── scripts/
│   └── download_osm_data.py       # CLI tool for pre-downloading city data
├── data/
│   └── osm_cache/                 # Pickled graph cache (auto-populated)
├── cache/                         # Route query cache (auto-populated)
├── logs/                          # Application logs
└── requirements.txt
```

---

## Quick Start

### Prerequisites

- Python 3.10+
- [OSMnx](https://osmnx.readthedocs.io/) requires C++ build tools on Windows (install via `Build Tools for Visual Studio`).

### Installation

```bash
# Clone the repository
git clone <repo-url> && cd blind_nav/blind_nav

# Create a virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### Pre-download map data (optional but recommended)

```bash
# Download all predefined cities
python scripts/download_osm_data.py --area all

# Or download a specific city
python scripts/download_osm_data.py --area singapore

# Force re-download (overwrite cached files)
python scripts/download_osm_data.py --area all --force
```

### Run the server

```bash
python backend/app.py
```

The server starts at **http://localhost:5000**. The frontend is served directly from the same port.

The first request for a given area will trigger an OSM download (this may take 10-30 seconds depending on the region).

---

## API

### `GET /api/health`

Returns server status and graph loading state.

```json
{
  "status": "ok",
  "graph_ready": true,
  "graph_loading": false,
  "loaded_area": "kl"
}
```

### `POST /api/shortest_path`

Computes an accessibility-aware route between two coordinates.

**Request body:**
```json
{
  "start_lat": 3.1105,
  "start_lon": 101.686,
  "end_lat": 3.1200,
  "end_lon": 101.700,
  "hour": 14,
  "mode": "blind",
  "use_dynamic_cost": true,
  "area": "kl"
}
```

**Response:**
```json
{
  "status": "success",
  "path": [[3.1105, 101.686], [3.1112, 101.687], ...],
  "total_cost": 42.5,
  "static_cost": 38.2,
  "dynamic_cost": 4.3,
  "total_distance_m": 850.3,
  "algorithm": "bidirectional_a*",
  "time_slot_name": "day",
  "num_nodes": 47,
  "route_analysis": {
    "total_edges": 46,
    "tactile_paving_pct": 65.0,
    "steps_count": 0,
    "lit_pct": 88.0,
    "sidewalk_pct": 72.0,
    "top_highways": [
      {"name": "footway", "pct": 45.0},
      {"name": "residential", "pct": 30.0}
    ]
  }
}
```

---

## Cost Model

### Static Cost

For each edge, the cost is computed as:

$$C_{static} = \left( \sum_{i} w_i \cdot s_i(t) \right) \times \max(\text{length}, 1.0)$$

Where $w_i$ is the weight for accessibility factor $i$, and $s_i(t)$ is the score for tag value $t$.

### Dynamic Cost (Time-Dependent)

$$C_{dynamic}(e, t) = C_{static}(e) \times M_{lit}(t, e) \times M_{crowd}(t, e)$$

- $M_{lit}$ penalizes unlit segments at night (up to 3×).
- $M_{crowd}$ scales with expected pedestrian traffic by time slot and road type.

---

## Development

### Code quality

```bash
# Lint with Ruff
ruff check backend/
```

### Testing

```bash
pytest
```

---

## License

MIT
