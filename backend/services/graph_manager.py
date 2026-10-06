from __future__ import annotations

import logging
import threading
from typing import Any, Dict, Optional

import numpy as np
from scipy.spatial import KDTree

from backend.config import AREA_CONFIGS, DEFAULT_AREA
from backend.data.osm_loader import OSMLoader
from backend.utils.geoutils import haversine

logger = logging.getLogger(__name__)


class GraphManager:
    """Manages road network graph loading, caching, and spatial indexing.

    Encapsulates global mutable state with thread-safe graph loading and
    nearest-neighbor queries.
    """

    def __init__(self) -> None:
        self._osm = OSMLoader()
        self._graph = None
        self._area = ""
        self._spatial_tree: Optional[KDTree] = None
        self._spatial_ids: Optional[list] = None
        self._loading = False
        self._lock = threading.Lock()

    # ── Public Properties ──

    @property
    def graph(self):
        return self._graph

    @property
    def loaded_area(self) -> str:
        return self._area

    @property
    def is_loading(self) -> bool:
        return self._loading

    @property
    def is_ready(self) -> bool:
        return self._graph is not None

    # ── Graph Loading ──

    def ensure_graph(self, area_or_cfg: str | Dict[str, Any] = DEFAULT_AREA) -> bool:
        """Ensure the road network graph is loaded (thread-safe).

        Args:
          area_or_cfg: Predefined area name (str), or a config dict with lat/lon/dist.
                       When a dict is passed, a dynamic area ID is generated.
        """
        area_key = area_or_cfg if isinstance(area_or_cfg, str) else "custom"

        if self._graph is not None and self._area == area_key:
            return True
        if self._loading:
            return False
        with self._lock:
            if self._graph is not None and self._area == area_key:
                return True

            if isinstance(area_or_cfg, str):
                cfg = AREA_CONFIGS.get(area_or_cfg)
                if cfg is None:
                    cfg = AREA_CONFIGS[DEFAULT_AREA]
                    area_key = DEFAULT_AREA
                lat, lon, dist = cfg["lat"], cfg["lon"], cfg["dist"]
            else:
                lat = area_or_cfg["lat"]
                lon = area_or_cfg["lon"]
                dist = area_or_cfg["dist"]
                # Generate unique key for cache differentiation
                area_key = f"auto_{lat:.2f}_{lon:.2f}_{int(dist)}"

            self._loading = True
            try:
                self._graph = self._osm.load_area(
                    lat=lat, lon=lon, dist=dist,
                    area=area_key,
                )
                self._area = area_key
                logger.info("Graph loaded for '%s': %d nodes, %d edges",
                            area_key, self._graph.number_of_nodes(), self._graph.number_of_edges())
                self._rebuild_spatial_index()
                return True
            except Exception:
                logger.exception("Failed to load graph for area '%s'", area_key)
                return False
            finally:
                self._loading = False

    def preload_default(self) -> None:
        """Preload the default area graph in a background thread."""
        logger.info("Pre-loading graph for default area '%s'...", DEFAULT_AREA)
        self.ensure_graph(DEFAULT_AREA)

    # ── Spatial Index ──

    def _rebuild_spatial_index(self) -> None:
        """Rebuild KDTree spatial index from the current graph."""
        nodes = list(self._graph.nodes(data=True))
        self._spatial_ids = [nid for nid, _ in nodes]
        coords = np.array([[nd.get("y", 0.0), nd.get("x", 0.0)] for _, nd in nodes])
        self._spatial_tree = KDTree(coords)

    def find_nearest_node(self, lat: float, lon: float) -> Optional[int]:
        """Find the nearest graph node to (lat, lon), always returns the closest."""
        if self._spatial_tree is None or not self._spatial_ids:
            return None
        _dist, idx = self._spatial_tree.query([lat, lon])
        return self._spatial_ids[idx]

    def snap(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """Snap a coordinate onto the nearest graph node.

        Returns the node id, its coordinates and how far (metres) the given
        point was from the network. ``None`` when no graph is loaded.
        """
        node_id = self.find_nearest_node(lat, lon)
        if node_id is None or self._graph is None:
            return None
        node = self._graph.nodes[node_id]
        node_lat = float(node.get("y", lat))
        node_lon = float(node.get("x", lon))
        return {
            "node_id": node_id,
            "lat": node_lat,
            "lon": node_lon,
            "distance_m": round(haversine((lat, lon), (node_lat, node_lon)), 1),
        }

    def stats(self) -> Dict[str, Any]:
        """Summary of the currently loaded graph."""
        if self._graph is None:
            return {"nodes": 0, "edges": 0, "avg_degree": 0.0, "area": None}
        nodes = self._graph.number_of_nodes()
        edges = self._graph.number_of_edges()
        return {
            "nodes": nodes,
            "edges": edges,
            "avg_degree": round((2 * edges) / max(nodes, 1), 2),
            "area": self._area or None,
        }

    def resolve_area(self, area: str, lat: float, lon: float, span_m: float) -> Any:
        """Pick which graph to load for a request.

        Prefers the requested predefined area when the request coordinates fall
        inside it (20% buffer); otherwise loads a dynamic square centred on the
        request. Mirrors the behaviour of the original single-endpoint API.
        """
        min_dist = 1500   # minimum load radius, metres
        buffer = 1.3      # 30% buffer around the requested span
        load_dist = max(int(span_m * buffer), min_dist)

        if area in AREA_CONFIGS:
            cfg = AREA_CONFIGS[area]
            dist_from_center = haversine((lat, lon), (cfg["lat"], cfg["lon"]))
            if dist_from_center <= cfg["dist"] * 1.2:
                return area
            return {"lat": lat, "lon": lon, "dist": load_dist}
        return {"lat": lat, "lon": lon, "dist": load_dist}


# ── Global Graph Manager Instance ──
graph_mgr = GraphManager()
threading.Thread(target=graph_mgr.preload_default, daemon=True).start()
