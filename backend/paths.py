"""Filesystem locations for the served frontend."""

from __future__ import annotations

import os

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_ROOT = os.path.join(_REPO_ROOT, "frontend")

# Vite production build (preferred).
DIST_DIR = os.path.join(FRONTEND_ROOT, "dist")

# Original no-build UI, kept as a fallback so the Flask app still serves a
# working page when the Vite bundle has not been built.
PUBLIC_DIR = os.path.join(FRONTEND_ROOT, "public")


def frontend_dir() -> str:
    """Directory Flask should serve from."""
    if os.path.exists(os.path.join(DIST_DIR, "index.html")):
        return DIST_DIR
    return PUBLIC_DIR


def frontend_source() -> str:
    return "vite-dist" if frontend_dir() == DIST_DIR else "legacy-public"
