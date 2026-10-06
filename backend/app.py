"""BlindNav Flask application.

The app is a thin composition layer: blueprints live in ``backend.api`` and all
routing logic lives in ``backend.services``. The graph manager starts preloading
the default area at import time so the first request is already warm.
"""

from __future__ import annotations

import logging
import os
import sys

from flask import Flask, jsonify, request
from flask_cors import CORS

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.api import register_blueprints
from backend.services.graph_manager import graph_mgr  # noqa: F401  (re-exported)

logger = logging.getLogger(__name__)


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    register_blueprints(app)

    @app.after_request
    def _revalidate_html(response):
        # index.html must never be cached: it points at hashed Vite bundles.
        if response.mimetype == "text/html":
            response.headers["Cache-Control"] = "no-cache, must-revalidate"
        return response

    @app.errorhandler(404)
    def _not_found(error):
        if request.path.startswith("/api/"):
            return jsonify({
                "status": "error",
                "code": "not_found",
                "message": f"No such endpoint: {request.path}",
            }), 404
        return error

    return app


app = create_app()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("DEBUG", "0") == "1"
    app.run(host="0.0.0.0", port=port, debug=debug)
