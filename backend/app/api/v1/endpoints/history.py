"""
Endpoint de historial de viajes.

Ruta:
  GET /vehicles/{vehicle_id}/history?from=ISO&to=ISO  → TripHistoryResponse
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.api.v1.dependencies import (
    get_wialon_gateway,
    get_wialon_session_manager,
    require_permission,
)
from app.api.v1.schemas.history import TripHistoryResponse
from app.core.exceptions import AppException
from app.infrastructure.wialon.gateway import WialonGateway
from app.infrastructure.wialon.session import WialonSessionManager
from app.services.history_service import HistoryService

router = APIRouter(tags=["History"])


async def _resolve_unit_name(
    unit_id: int, session_manager: WialonSessionManager
) -> str:
    """Obtiene el nombre de la unidad desde Wialon."""
    result = await session_manager.call(
        "core/search_item",
        {"id": unit_id, "flags": 1},
    )
    item = result.get("item", {})
    return item.get("nm", str(unit_id))


# ---------------------------------------------------------------------------
# GET /vehicles/{vehicle_id}/history
# ---------------------------------------------------------------------------


@router.get(
    "/vehicles/{vehicle_id}/history",
    response_model=TripHistoryResponse,
    dependencies=[Depends(require_permission("read", "history"))],
)
async def get_trip_history(
    vehicle_id: int,
    from_dt: datetime = Query(
        ...,
        alias="from",
        description="Inicio del rango (ISO-8601, ej. 2024-01-01T00:00:00Z)",
    ),
    to_dt: datetime = Query(
        ...,
        alias="to",
        description="Fin del rango (ISO-8601)",
    ),
    gateway: WialonGateway = Depends(get_wialon_gateway),
    session_manager: WialonSessionManager = Depends(get_wialon_session_manager),
) -> TripHistoryResponse:
    """
    Retorna el historial de puntos GPS de una unidad en el rango indicado.

    - Máximo 5000 puntos por consulta.
    - Timestamps en zona Bogotá (UTC-5).
    - Incluye distancia total estimada (Haversine).
    """
    # Asegurar timezone-aware
    if from_dt.tzinfo is None:
        from_dt = from_dt.replace(tzinfo=timezone.utc)
    if to_dt.tzinfo is None:
        to_dt = to_dt.replace(tzinfo=timezone.utc)

    unit_name = await _resolve_unit_name(vehicle_id, session_manager)
    service = HistoryService(gateway)
    return await service.get_trip_history(
        unit_id=vehicle_id,
        unit_name=unit_name,
        from_dt=from_dt,
        to_dt=to_dt,
    )
