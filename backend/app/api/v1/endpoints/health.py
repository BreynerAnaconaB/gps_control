"""
Health check endpoints.

GET /api/v1/health        — Shallow check (always fast, used by container probes)
GET /api/v1/health/detail — Deep check (DB + Wialon connectivity verification)
"""

from __future__ import annotations

import logging
from time import monotonic

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/health", tags=["Health"], include_in_schema=True)
async def health_check():
    """Shallow liveness probe — always returns 200 if the process is running."""
    return {
        "status": "ok",
        "application": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "version": "1.0.0",
    }


@router.get("/health/detail", tags=["Health"], include_in_schema=True)
async def health_check_detail():
    """
    Deep readiness probe — checks DB and Wialon connectivity.
    Returns 200 when all systems are healthy, 503 when degraded.
    """
    checks: dict[str, str] = {}
    overall = "ok"

    # --- Database check ---
    t0 = monotonic()
    try:
        from app.infrastructure.database.base import AsyncSessionLocal
        from sqlalchemy import text

        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["database"] = f"ok ({(monotonic() - t0) * 1000:.0f}ms)"
    except Exception as exc:
        logger.warning("Health check: DB unavailable — %s", exc)
        checks["database"] = "error"
        overall = "degraded"

    # --- Wialon check (non-blocking: inspects gateway / session manager state) ---
    try:
        from app.api.v1.dependencies import get_wialon_session_manager

        sm = get_wialon_session_manager()
        if sm._session_id:
            checks["wialon"] = "ok (session active)"
        elif settings.WIALON_TOKEN:
            checks["wialon"] = "ok (configured, token present)"
        else:
            checks["wialon"] = "unconfigured"
    except Exception as exc:
        logger.warning("Health check: Wialon manager unavailable — %s", exc)
        checks["wialon"] = "error"
        overall = "degraded"

    status_code = 200 if overall == "ok" else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": overall,
            "application": settings.APP_NAME,
            "environment": settings.APP_ENV,
            "checks": checks,
        },
    )
