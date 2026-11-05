from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.v1.endpoints.health import router as health_router
from app.api.v1.endpoints.vehicles import router as vehicles_router
from app.core.config import settings
from app.core.exceptions import AppException


app = FastAPI(
    title=settings.APP_NAME,
    description="API para la gestión y monitoreo de flotas vehiculares.",
    version="1.0.0",
    debug=settings.DEBUG,
)


@app.exception_handler(AppException)
async def app_exception_handler(
    request: Request,
    exc: AppException,
):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "type": "about:blank",
            "title": exc.code,
            "status": exc.status_code,
            "detail": exc.message,
            "code": exc.code,
        },
    )


app.include_router(
    health_router,
    prefix=settings.API_V1_PREFIX,
)

app.include_router(
    vehicles_router,
    prefix=settings.API_V1_PREFIX,
)


@app.get("/health", tags=["Health"], include_in_schema=False)
async def root_health_check():
    return {
        "status": "ok",
        "application": settings.APP_NAME,
    }