"""
AuditService — consulta paginada de registros de auditoría desde la DB.

Responsabilidades:
  - Listar AuditLog con filtros opcionales (action, resource)
  - Paginado con total y páginas
  - Incluir email del usuario si existe
"""

from __future__ import annotations

import math

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.schemas.audit import AuditLogPageResponse, AuditLogResponse
from app.infrastructure.database.models import AuditLog, User


class AuditService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_audit_logs(
        self,
        page: int = 1,
        page_size: int = 20,
        action: str | None = None,
        resource: str | None = None,
    ) -> AuditLogPageResponse:
        """
        Lista registros de auditoría paginados.

        Filtros opcionales: action (ej. 'login', 'create') y resource (ej. 'drivers').
        """
        # --- Construir filtros ---
        filters = []
        if action:
            filters.append(AuditLog.action == action)
        if resource:
            filters.append(AuditLog.resource == resource)

        # --- Count total ---
        count_stmt = select(func.count()).select_from(AuditLog)
        if filters:
            count_stmt = count_stmt.where(*filters)
        total_result = await self._db.execute(count_stmt)
        total = total_result.scalar_one()

        # --- Fetch page ---
        stmt = (
            select(AuditLog)
            .options(selectinload(AuditLog.user))
            .order_by(AuditLog.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        if filters:
            stmt = stmt.where(*filters)

        result = await self._db.execute(stmt)
        logs = list(result.scalars().all())

        items = [
            AuditLogResponse(
                id=log.id,
                user_email=log.user.email if log.user else None,
                action=log.action,
                resource=log.resource,
                resource_id=log.resource_id,
                detail=log.detail,
                ip_address=log.ip_address,
                created_at=log.created_at,
            )
            for log in logs
        ]

        return AuditLogPageResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=max(1, math.ceil(total / page_size)),
        )
