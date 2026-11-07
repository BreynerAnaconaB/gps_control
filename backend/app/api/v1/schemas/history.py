"""Pydantic schemas para historial de viajes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class TripPoint(BaseModel):
    """Un punto GPS dentro de un viaje."""

    latitude: float
    longitude: float
    speed: float = Field(description="Velocidad en km/h")
    heading: float = Field(description="Rumbo en grados (0-360)")
    timestamp: str = Field(description="Fecha/hora ISO-8601 (zona Bogotá)")


class TripHistoryResponse(BaseModel):
    """Historial de puntos GPS de una unidad en un rango de tiempo."""

    unit_id: int
    unit_name: str
    points: list[TripPoint]
    total_points: int
    distance_km: float = Field(description="Distancia total recorrida en km (Haversine)")
