"""Flask blueprints for the HTTP API."""

from __future__ import annotations

from flask import Flask


def register_blueprints(app: Flask) -> None:
    from backend.api.legacy import bp as legacy_bp
    from backend.api.meta import bp as meta_bp
    from backend.api.routes_v2 import bp as routes_bp
    from backend.api.search import bp as search_bp

    app.register_blueprint(legacy_bp)
    app.register_blueprint(meta_bp, url_prefix="/api/v2")
    app.register_blueprint(routes_bp, url_prefix="/api/v2")
    app.register_blueprint(search_bp, url_prefix="/api/v2")
