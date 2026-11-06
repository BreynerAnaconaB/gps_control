"""
DriverService — gestión de conductores a través de WialonGateway.

Responsabilidades:
  - CRUD de conductores en Wialon (resource/update_driver)
  - Paginado y búsqueda en memoria
  - Vinculación / desvinculación con unidades
  - Emisión de AuditLog en DB para create/update/delete
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.driver import (
    DriverCreate,
    DriverPageResponse,
    DriverResponse,
    DriverUpdate,
)
from app.core.exceptions import AppException
from app.infrastructure.database.models import AuditLog
from app.infrastructure.wialon.gateway import WialonGateway


def _map_driver(raw: dict, bindings: dict[int, int]) -> DriverResponse:
    """Convierte un driver crudo de Wialon a DriverResponse."""
    driver_id = int(raw["id"])
    unit_id: int | None = int(raw["bu"]) if raw.get("bu") else None
    if unit_id is None:
        for uid, did in bindings.items():
            if did == driver_id:
                unit_id = uid
                break

    return DriverResponse(
        id=driver_id,
        name=raw.get("n", ""),
        code=raw.get("c") or raw.get("cod") or "",
        phone=raw.get("p") or raw.get("ph") or "",
        description=raw.get("ds", ""),
        assigned_unit_id=unit_id,
    )


class DriverService:
    def __init__(self, gateway: WialonGateway, db: AsyncSession) -> None:
        self._gw = gateway
        self._db = db

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _get_resource_id(self) -> int:
        return await self._gw.get_first_resource_id()

    async def _emit_audit(
        self,
        action: str,
        resource_id: str | None,
        user_id: int | None,
        detail: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        log = AuditLog(
            user_id=user_id,
            action=action,
            resource="drivers",
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address,
        )
        self._db.add(log)

    # ------------------------------------------------------------------
    # List (paginado)
    # ------------------------------------------------------------------

    async def list_drivers(
        self,
        page: int = 1,
        page_size: int = 10,
        search: str | None = None,
    ) -> DriverPageResponse:
        """Lista conductores con paginado y búsqueda opcional por nombre/código."""
        resource_id = await self._get_resource_id()
        raw_drivers = await self._gw.get_drivers(resource_id)
        bindings = await self._gw.get_driver_bindings(resource_id)

        drivers = [_map_driver(d, bindings) for d in raw_drivers]

        if search:
            q = search.strip().casefold()
            drivers = [
                d
                for d in drivers
                if q in d.name.casefold() or q in d.code.casefold()
            ]

        total = len(drivers)
        pages = max(1, math.ceil(total / page_size))
        start = (page - 1) * page_size
        end = start + page_size

        return DriverPageResponse(
            items=drivers[start:end],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_driver(
        self,
        payload: DriverCreate,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> DriverResponse:
        """Crea un conductor en Wialon y emite AuditLog."""
        resource_id = await self._get_resource_id()
        raw = await self._gw.create_driver(
            resource_id=resource_id,
            name=payload.name,
            code=payload.code,
            phone=payload.phone,
            description=payload.description,
        )
        bindings = await self._gw.get_driver_bindings(resource_id)
        driver = _map_driver(raw, bindings)

        await self._emit_audit(
            action="create",
            resource_id=str(driver.id),
            user_id=user_id,
            detail=f"name={payload.name}, code={payload.code}",
            ip_address=ip_address,
        )
        await self._db.commit()
        return driver

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update_driver(
        self,
        driver_id: int,
        payload: DriverUpdate,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> DriverResponse:
        """Actualiza un conductor. Carga los valores actuales para campos omitidos."""
        resource_id = await self._get_resource_id()
        raw_drivers = await self._gw.get_drivers(resource_id)

        current_raw = next(
            (d for d in raw_drivers if int(d["id"]) == driver_id), None
        )
        if current_raw is None:
            raise AppException(
                message=f"Conductor {driver_id} no encontrado",
                code="DRIVER_NOT_FOUND",
                status_code=404,
            )

        name = payload.name if payload.name is not None else current_raw.get("n", "")
        code = payload.code if payload.code is not None else current_raw.get("cod", "")
        phone = payload.phone if payload.phone is not None else current_raw.get("ph", "")
        description = (
            payload.description
            if payload.description is not None
            else current_raw.get("ds", "")
        )

        raw = await self._gw.update_driver(
            resource_id=resource_id,
            driver_id=driver_id,
            name=name,
            code=code,
            phone=phone,
            description=description,
        )
        bindings = await self._gw.get_driver_bindings(resource_id)
        driver = _map_driver(raw, bindings)

        await self._emit_audit(
            action="update",
            resource_id=str(driver_id),
            user_id=user_id,
            detail=f"name={name}, code={code}",
            ip_address=ip_address,
        )
        await self._db.commit()
        return driver

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_driver(
        self,
        driver_id: int,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Elimina un conductor de Wialon y emite AuditLog."""
        resource_id = await self._get_resource_id()
        await self._gw.delete_driver(resource_id, driver_id)
        await self._emit_audit(
            action="delete",
            resource_id=str(driver_id),
            user_id=user_id,
            ip_address=ip_address,
        )
        await self._db.commit()

    # ------------------------------------------------------------------
    # Bind / Unbind
    # ------------------------------------------------------------------

    async def bind_driver(
        self,
        driver_id: int,
        unit_id: int,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Vincula un conductor a una unidad."""
        resource_id = await self._get_resource_id()
        await self._gw.bind_driver_to_unit(resource_id, driver_id, unit_id)
        await self._emit_audit(
            action="bind",
            resource_id=str(driver_id),
            user_id=user_id,
            detail=f"unit_id={unit_id}",
            ip_address=ip_address,
        )
        await self._db.commit()

    async def unbind_driver(
        self,
        driver_id: int,
        unit_id: int,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Desvincula un conductor de una unidad."""
        resource_id = await self._get_resource_id()
        await self._gw.unbind_driver_from_unit(resource_id, unit_id)
        await self._emit_audit(
            action="unbind",
            resource_id=str(driver_id),
            user_id=user_id,
            detail=f"unit_id={unit_id}",
            ip_address=ip_address,
        )
        await self._db.commit()
