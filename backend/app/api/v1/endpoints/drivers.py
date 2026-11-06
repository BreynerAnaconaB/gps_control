"""
Endpoints de conductores.

Rutas:
  GET    /drivers                       → lista paginada
  POST   /drivers                       → crear
  PUT    /drivers/{driver_id}           → actualizar
  DELETE /drivers/{driver_id}           → eliminar
  POST   /drivers/{driver_id}/bind/{unit_id}    → vincular a unidad
  DELETE /drivers/{driver_id}/bind/{unit_id}    → desvincular de unidad
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.dependencies import (
    get_current_user,
    get_db,
    get_wialon_gateway,
    require_permission,
)
from app.api.v1.schemas.driver import (
    DriverCreate,
    DriverPageResponse,
    DriverResponse,
    DriverUpdate,
)
from app.infrastructure.database.models import User
from app.infrastructure.wialon.gateway import WialonGateway
from app.services.driver_service import DriverService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["Drivers"])


def _get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# ---------------------------------------------------------------------------
# GET /drivers
# ---------------------------------------------------------------------------


@router.get(
    "/drivers",
    response_model=DriverPageResponse,
    dependencies=[Depends(require_permission("read", "drivers"))],
)
async def list_drivers(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, min_length=1, max_length=100),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> DriverPageResponse:
    """Lista paginada de conductores con búsqueda opcional por nombre/código."""
    service = DriverService(gateway, db)
    return await service.list_drivers(page=page, page_size=page_size, search=search)


# ---------------------------------------------------------------------------
# POST /drivers
# ---------------------------------------------------------------------------


@router.post(
    "/drivers",
    response_model=DriverResponse,
    status_code=201,
)
async def create_driver(
    payload: DriverCreate,
    request: Request,
    current_user: User = Depends(require_permission("write", "drivers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> DriverResponse:
    """Crea un nuevo conductor en Wialon."""
    service = DriverService(gateway, db)
    return await service.create_driver(
        payload=payload,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# PUT /drivers/{driver_id}
# ---------------------------------------------------------------------------


@router.put(
    "/drivers/{driver_id}",
    response_model=DriverResponse,
)
async def update_driver(
    driver_id: int,
    payload: DriverUpdate,
    request: Request,
    current_user: User = Depends(require_permission("write", "drivers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> DriverResponse:
    """Actualiza un conductor existente en Wialon."""
    service = DriverService(gateway, db)
    return await service.update_driver(
        driver_id=driver_id,
        payload=payload,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# DELETE /drivers/{driver_id}
# ---------------------------------------------------------------------------


@router.delete(
    "/drivers/{driver_id}",
    status_code=204,
)
async def delete_driver(
    driver_id: int,
    request: Request,
    current_user: User = Depends(require_permission("write", "drivers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Elimina un conductor de Wialon."""
    service = DriverService(gateway, db)
    await service.delete_driver(
        driver_id=driver_id,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# POST /drivers/{driver_id}/bind/{unit_id}
# ---------------------------------------------------------------------------


@router.post(
    "/drivers/{driver_id}/bind/{unit_id}",
    status_code=204,
)
async def bind_driver(
    driver_id: int,
    unit_id: int,
    request: Request,
    current_user: User = Depends(require_permission("write", "drivers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Vincula un conductor a una unidad GPS."""
    service = DriverService(gateway, db)
    await service.bind_driver(
        driver_id=driver_id,
        unit_id=unit_id,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# DELETE /drivers/{driver_id}/bind/{unit_id}
# ---------------------------------------------------------------------------


@router.delete(
    "/drivers/{driver_id}/bind/{unit_id}",
    status_code=204,
)
async def unbind_driver(
    driver_id: int,
    unit_id: int,
    request: Request,
    current_user: User = Depends(require_permission("write", "drivers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Desvincula un conductor de una unidad GPS."""
    service = DriverService(gateway, db)
    await service.unbind_driver(
        driver_id=driver_id,
        unit_id=unit_id,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )
