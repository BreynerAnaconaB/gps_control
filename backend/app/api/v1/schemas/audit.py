"""Pydantic schemas para registros de auditoría."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    """Respuesta de un registro de auditoría."""

    id: int
    user_email: str | None = None
    action: str
    resource: str
    resource_id: str | None = None
    detail: str | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditLogPageResponse(BaseModel):
    """Respuesta paginada de registros de auditoría."""

    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int
    pages: int
