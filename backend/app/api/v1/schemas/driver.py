"""Pydantic schemas para conductores (drivers)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class DriverBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Nombre del conductor")
    code: str = Field(..., min_length=1, max_length=64, description="Código único del conductor")
    phone: str = Field(default="", max_length=64, description="Teléfono")
    description: str = Field(default="", max_length=512, description="Descripción")


class DriverCreate(DriverBase):
    """Payload para crear un conductor."""


class DriverUpdate(BaseModel):
    """Payload para actualizar un conductor (todos los campos son opcionales)."""

    name: str | None = Field(None, min_length=1, max_length=255)
    code: str | None = Field(None, min_length=1, max_length=64)
    phone: str | None = Field(None, max_length=64)
    description: str | None = Field(None, max_length=512)


class DriverResponse(BaseModel):
    """Respuesta de un conductor."""

    id: int
    name: str
    code: str
    phone: str
    description: str
    assigned_unit_id: int | None = None

    model_config = {"from_attributes": True}


class DriverPageResponse(BaseModel):
    """Respuesta paginada de conductores."""

    items: list[DriverResponse]
    total: int
    page: int
    page_size: int
    pages: int
