"""
Endpoint de auditoría.

Ruta:
  GET /audit?page=&page_size=&action=&resource=  → AuditLogPageResponse
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.api.v1.dependencies import get_db, require_permission
from app.api.v1.schemas.audit import AuditLogPageResponse
from app.services.audit_service import AuditService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(tags=["Audit"])


# ---------------------------------------------------------------------------
# GET /audit
# ---------------------------------------------------------------------------


@router.get(
    "/audit",
    response_model=AuditLogPageResponse,
    dependencies=[Depends(require_permission("read", "audit"))],
)
async def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None, description="Filtrar por acción (ej. 'login', 'create')"),
    resource: str | None = Query(None, description="Filtrar por recurso (ej. 'drivers', 'auth')"),
    db: AsyncSession = Depends(get_db),
) -> AuditLogPageResponse:
    """
    Lista paginada de registros de auditoría.

    Filtros opcionales: `action` y `resource`.
    Ordenados por fecha descendente (más reciente primero).
    """
    service = AuditService(db)
    return await service.list_audit_logs(
        page=page,
        page_size=page_size,
        action=action,
        resource=resource,
    )
