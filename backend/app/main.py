
import logging
import logging.config as _logging_config
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1.endpoints.audit import router as audit_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.drivers import router as drivers_router
from app.api.v1.endpoints.export import router as export_router
from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.history import router as history_router
from app.api.v1.endpoints.passengers import router as passengers_router
from app.api.v1.endpoints.vehicles import router as vehicles_router
from app.core.config import settings
from app.core.exceptions import AppException

# ---------------------------------------------------------------------------
# Structured logging setup (ARQ-07)
# ---------------------------------------------------------------------------
_LOGGING_CONFIG = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "structured": {
            "format": "%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            "datefmt": "%Y-%m-%dT%H:%M:%S",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "structured",
            "stream": "ext://sys.stdout",
        },
    },
    "root": {
        "level": "INFO",
        "handlers": ["console"],
    },
    "loggers": {
        "uvicorn.access": {"level": "WARNING"},
        "sqlalchemy.engine": {"level": "WARNING"},
    },
}

_logging_config.dictConfig(_LOGGING_CONFIG)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan: self-bootstraps database schema & default seed on cold start
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.infrastructure.database.base import AsyncSessionLocal, engine
        from app.infrastructure.database.models import Base

        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Seed roles and admin idempotently
        seed_fn = None
        try:
            from scripts.seed_admin import seed as seed_fn
        except ImportError:
            try:
                from backend.scripts.seed_admin import seed as seed_fn
            except ImportError:
                pass

        if seed_fn:
            async with AsyncSessionLocal() as db:
                await seed_fn(db)
            logger.info("Database initialized and verified.")
    except Exception as exc:
        logger.warning("Database auto-initialization skipped or failed: %s", exc)

    yield


# ---------------------------------------------------------------------------
# Rate limiter (SEG-07: brute-force protection on login)
# ---------------------------------------------------------------------------

limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.APP_NAME,
    description="API para la gestión y monitoreo de flotas vehiculares.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = [
    "https://gps-control-pi.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
for _origin in settings.cors_origins_list:
    if _origin and _origin not in ALLOWED_ORIGINS:
        ALLOWED_ORIGINS.append(_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Security Headers Middleware (SEG-05: OWASP Hardening)
# ---------------------------------------------------------------------------
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=*"
    return response

# ---------------------------------------------------------------------------
# Exception handlers (with CORS headers guaranteed on errors)
# ---------------------------------------------------------------------------

def _cors_headers_for_request(request: Request) -> dict[str, str]:
    origin = request.headers.get("origin")
    if origin and (origin in ALLOWED_ORIGINS or any(origin == o for o in settings.cors_origins_list)):
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    return {}


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": "about:blank",
            "title": exc.code,
            "status": exc.status_code,
            "detail": exc.message,
            "code": exc.code,
        },
        headers=_cors_headers_for_request(request),
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    error_detail = str(exc) if settings.DEBUG else f"Error interno: {str(exc)}"
    return JSONResponse(
        status_code=500,
        content={
            "type": "about:blank",
            "title": "INTERNAL_SERVER_ERROR",
            "status": 500,
            "detail": error_detail,
            "code": "INTERNAL_SERVER_ERROR",
        },
        headers=_cors_headers_for_request(request),
    )


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(health_router, prefix=settings.API_V1_PREFIX)
app.include_router(auth_router, prefix=settings.API_V1_PREFIX)
app.include_router(vehicles_router, prefix=settings.API_V1_PREFIX)
app.include_router(drivers_router, prefix=settings.API_V1_PREFIX)
app.include_router(passengers_router, prefix=settings.API_V1_PREFIX)
app.include_router(history_router, prefix=settings.API_V1_PREFIX)
app.include_router(export_router, prefix=settings.API_V1_PREFIX)
app.include_router(audit_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["Health"], include_in_schema=False)
async def root_health_check():
    return {
        "status": "ok",
        "application": settings.APP_NAME,
    }
