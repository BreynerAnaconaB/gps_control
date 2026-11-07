"""
Endpoints de exportación a CSV.

Rutas:
  GET /export/vehicles    → CSV de vehículos
  GET /export/drivers     → CSV de conductores
  GET /export/passengers  → CSV de pasajeros

Cabeceras: Content-Type: text/csv; charset=utf-8
           Content-Disposition: attachment; filename=...
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.api.v1.dependencies import (
    get_db,
    get_vehicle_cache,
    get_wialon_gateway,
    get_wialon_session_manager,
    require_permission,
)
from app.infrastructure.wialon.gateway import WialonGateway
from app.infrastructure.wialon.session import WialonSessionManager
from app.services.driver_service import DriverService
from app.services.export_service import ExportService
from app.services.passenger_service import PassengerService
from app.services.vehicle_cache import AsyncTTLCache
from app.api.v1.schemas.vehicle import VehicleResponse
from app.api.v1.endpoints.vehicles import get_cached_vehicles
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["Export"])

_CSV_CONTENT_TYPE = "text/csv; charset=utf-8"


def _csv_response(content: str, filename: str) -> Response:
    return Response(
        content=content.encode("utf-8"),
        media_type=_CSV_CONTENT_TYPE,
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ---------------------------------------------------------------------------
# GET /export/vehicles
# ---------------------------------------------------------------------------


@router.get(
    "/export/vehicles",
    dependencies=[Depends(require_permission("export", "data"))],
)
async def export_vehicles(
    session_manager: WialonSessionManager = Depends(get_wialon_session_manager),
    cache: AsyncTTLCache[list[VehicleResponse]] = Depends(get_vehicle_cache),
) -> Response:
    """Exporta todos los vehículos a CSV."""
    vehicles = await get_cached_vehicles(session_manager, cache)
    svc = ExportService()
    csv_content = svc.export_vehicles(vehicles)
    return _csv_response(csv_content, "vehicles.csv")


# ---------------------------------------------------------------------------
# GET /export/drivers
# ---------------------------------------------------------------------------


@router.get(
    "/export/drivers",
    dependencies=[Depends(require_permission("export", "data"))],
)
async def export_drivers(
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exporta todos los conductores a CSV."""
    driver_svc = DriverService(gateway, db)
    page = await driver_svc.list_drivers(page=1, page_size=10000)
    svc = ExportService()
    csv_content = svc.export_drivers(page.items)
    return _csv_response(csv_content, "drivers.csv")


# ---------------------------------------------------------------------------
# GET /export/passengers
# ---------------------------------------------------------------------------


@router.get(
    "/export/passengers",
    dependencies=[Depends(require_permission("export", "data"))],
)
async def export_passengers(
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Exporta todos los pasajeros a CSV."""
    passenger_svc = PassengerService(gateway, db)
    page = await passenger_svc.list_passengers(page=1, page_size=10000)
    svc = ExportService()
    csv_content = svc.export_passengers(page.items)
    return _csv_response(csv_content, "passengers.csv")
