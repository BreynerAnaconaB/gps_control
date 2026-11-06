"""Pydantic schemas para pasajeros (tags de Wialon)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PassengerBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Nombre del pasajero")
    code: str = Field(..., min_length=1, max_length=64, description="Código único")


class PassengerCreate(PassengerBase):
    """Payload para crear un pasajero."""

    custom_params: dict[str, str] = Field(
        default_factory=dict,
        description="Parámetros personalizados (clave-valor)",
    )


class PassengerUpdate(BaseModel):
    """Payload para actualizar un pasajero (todos los campos son opcionales)."""

    name: str | None = Field(None, min_length=1, max_length=255)
    code: str | None = Field(None, min_length=1, max_length=64)
    custom_params: dict[str, str] | None = Field(
        None,
        description="Parámetros que se FUSIONAN con los existentes (merge)",
    )


class PassengerResponse(BaseModel):
    """Respuesta de un pasajero."""

    id: int
    name: str
    code: str
    custom_params: dict[str, str]
    assigned_unit_id: int | None = None

    model_config = {"from_attributes": True}


class PassengerPageResponse(BaseModel):
    """Respuesta paginada de pasajeros."""

    items: list[PassengerResponse]
    total: int
    page: int
    page_size: int
    pages: int
