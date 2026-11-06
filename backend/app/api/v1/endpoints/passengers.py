"""
Endpoints de pasajeros.

Rutas:
  GET    /passengers                          → lista paginada
  POST   /passengers                          → crear
  PUT    /passengers/{passenger_id}           → actualizar (merge de custom_params)
  DELETE /passengers/{passenger_id}           → eliminar
  POST   /passengers/{passenger_id}/bind/{unit_id}    → vincular a unidad
  DELETE /passengers/{passenger_id}/bind/{unit_id}    → desvincular de unidad
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request

from app.api.v1.dependencies import (
    get_db,
    get_wialon_gateway,
    require_permission,
)
from app.api.v1.schemas.passenger import (
    PassengerCreate,
    PassengerPageResponse,
    PassengerResponse,
    PassengerUpdate,
)
from app.infrastructure.database.models import User
from app.infrastructure.wialon.gateway import WialonGateway
from app.services.passenger_service import PassengerService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["Passengers"])


def _get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


# ---------------------------------------------------------------------------
# GET /passengers
# ---------------------------------------------------------------------------


@router.get(
    "/passengers",
    response_model=PassengerPageResponse,
    dependencies=[Depends(require_permission("read", "passengers"))],
)
async def list_passengers(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    search: str | None = Query(None, min_length=1, max_length=100),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> PassengerPageResponse:
    """Lista paginada de pasajeros con búsqueda opcional por nombre/código."""
    service = PassengerService(gateway, db)
    return await service.list_passengers(page=page, page_size=page_size, search=search)


# ---------------------------------------------------------------------------
# POST /passengers
# ---------------------------------------------------------------------------


@router.post(
    "/passengers",
    response_model=PassengerResponse,
    status_code=201,
)
async def create_passenger(
    payload: PassengerCreate,
    request: Request,
    current_user: User = Depends(require_permission("write", "passengers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> PassengerResponse:
    """Crea un nuevo pasajero en Wialon."""
    service = PassengerService(gateway, db)
    return await service.create_passenger(
        payload=payload,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# PUT /passengers/{passenger_id}
# ---------------------------------------------------------------------------


@router.put(
    "/passengers/{passenger_id}",
    response_model=PassengerResponse,
)
async def update_passenger(
    passenger_id: int,
    payload: PassengerUpdate,
    request: Request,
    current_user: User = Depends(require_permission("write", "passengers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> PassengerResponse:
    """
    Actualiza un pasajero.
    Los custom_params del body se fusionan con los existentes (merge).
    """
    service = PassengerService(gateway, db)
    return await service.update_passenger(
        passenger_id=passenger_id,
        payload=payload,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# DELETE /passengers/{passenger_id}
# ---------------------------------------------------------------------------


@router.delete(
    "/passengers/{passenger_id}",
    status_code=204,
)
async def delete_passenger(
    passenger_id: int,
    request: Request,
    current_user: User = Depends(require_permission("write", "passengers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Elimina un pasajero de Wialon."""
    service = PassengerService(gateway, db)
    await service.delete_passenger(
        passenger_id=passenger_id,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# POST /passengers/{passenger_id}/bind/{unit_id}
# ---------------------------------------------------------------------------


@router.post(
    "/passengers/{passenger_id}/bind/{unit_id}",
    status_code=204,
)
async def bind_passenger(
    passenger_id: int,
    unit_id: int,
    request: Request,
    current_user: User = Depends(require_permission("write", "passengers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Vincula un pasajero a una unidad GPS."""
    service = PassengerService(gateway, db)
    await service.bind_passenger(
        passenger_id=passenger_id,
        unit_id=unit_id,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )


# ---------------------------------------------------------------------------
# DELETE /passengers/{passenger_id}/bind/{unit_id}
# ---------------------------------------------------------------------------


@router.delete(
    "/passengers/{passenger_id}/bind/{unit_id}",
    status_code=204,
)
async def unbind_passenger(
    passenger_id: int,
    unit_id: int,
    request: Request,
    current_user: User = Depends(require_permission("write", "passengers")),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Desvincula un pasajero de una unidad GPS."""
    service = PassengerService(gateway, db)
    await service.unbind_passenger(
        passenger_id=passenger_id,
        unit_id=unit_id,
        user_id=current_user.id,
        ip_address=_get_client_ip(request),
    )
