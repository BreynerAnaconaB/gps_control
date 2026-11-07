"""
HistoryService — historial de viajes de una unidad Wialon.

Responsabilidades:
  - Cargar mensajes desde messages/load_interval
  - Convertir timestamps UNIX a ISO-8601 en zona Bogotá (America/Bogota)
  - Calcular distancia total con fórmula de Haversine
  - Limitar a 5000 puntos por consulta
"""

from __future__ import annotations

import math
from datetime import datetime, timezone, timedelta
from typing import TYPE_CHECKING

from app.api.v1.schemas.history import TripHistoryResponse, TripPoint
from app.core.exceptions import AppException
from app.infrastructure.wialon.gateway import WialonGateway

# UTC-5 (Colombia no tiene horario de verano)
_BOGOTA_TZ = timezone(timedelta(hours=-5))
_MAX_POINTS = 5000


def _unix_to_bogota_iso(ts: int) -> str:
    """Convierte UNIX timestamp a ISO-8601 en zona Bogotá."""
    dt_utc = datetime.fromtimestamp(ts, tz=timezone.utc)
    dt_bogota = dt_utc.astimezone(_BOGOTA_TZ)
    return dt_bogota.isoformat()


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distancia en km entre dos puntos GPS (fórmula de Haversine)."""
    R = 6371.0  # Radio de la Tierra en km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


class HistoryService:
    def __init__(self, gateway: WialonGateway) -> None:
        self._gw = gateway

    async def get_trip_history(
        self,
        unit_id: int,
        unit_name: str,
        from_dt: datetime,
        to_dt: datetime,
    ) -> TripHistoryResponse:
        """
        Retorna el historial de viaje de una unidad en el rango indicado.

        Los datetimes deben ser timezone-aware. Se convierten a UNIX antes
        de llamar a Wialon.
        """
        if from_dt > to_dt:
            raise AppException(
                message="'from' debe ser anterior a 'to'",
                code="INVALID_DATE_RANGE",
                status_code=422,
            )

        # Si el usuario consulta el mismo instante o fecha (ej. 2026-11-06 a 2026-11-06),
        # ampliamos hasta el final del día para abarcar todos los recorridos de esa jornada.
        if from_dt == to_dt:
            to_dt = to_dt + timedelta(days=1) - timedelta(seconds=1)

        time_from = int(from_dt.timestamp())
        time_to = int(to_dt.timestamp())

        raw_messages = await self._gw.get_trip_history(unit_id, time_from, time_to)

        # Limitar a MAX_POINTS
        raw_messages = raw_messages[:_MAX_POINTS]

        points: list[TripPoint] = []
        for msg in raw_messages:
            pos = msg.get("pos")
            if not pos:
                continue
            lat = pos.get("y")
            lon = pos.get("x")
            if lat is None or lon is None:
                continue

            points.append(
                TripPoint(
                    latitude=float(lat),
                    longitude=float(lon),
                    speed=float(pos.get("s", 0)),
                    heading=float(pos.get("c", 0)),
                    timestamp=_unix_to_bogota_iso(int(msg.get("t", 0))),
                )
            )

        # Calcular distancia total
        total_distance = 0.0
        for i in range(1, len(points)):
            p1 = points[i - 1]
            p2 = points[i]
            total_distance += _haversine_km(
                p1.latitude, p1.longitude, p2.latitude, p2.longitude
            )

        return TripHistoryResponse(
            unit_id=unit_id,
            unit_name=unit_name,
            points=points,
            total_points=len(points),
            distance_km=round(total_distance, 3),
        )
