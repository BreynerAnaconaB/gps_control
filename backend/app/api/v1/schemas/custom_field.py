"""Pydantic schemas para campos personalizados de unidades Wialon."""

from __future__ import annotations

from pydantic import BaseModel, Field


class CustomFieldUpsert(BaseModel):
    """
    Payload para crear o actualizar un campo personalizado.
    field_id=None (o 0) → crear; field_id>0 → actualizar.
    """

    field_id: int | None = Field(
        None,
        description="ID del campo. None o 0 para crear uno nuevo.",
    )
    name: str = Field(..., min_length=1, max_length=255, description="Nombre del campo")
    value: str = Field(..., max_length=1024, description="Valor del campo")


class CustomFieldResponse(BaseModel):
    """Respuesta de un campo personalizado."""

    field_id: int
    name: str
    value: str
