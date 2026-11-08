"""
PassengerService — gestión de pasajeros (tags Wialon) a través de WialonGateway.

Responsabilidades:
  - CRUD de pasajeros en Wialon (resource/update_tag)
  - Paginado y búsqueda en memoria
  - Vinculación / desvinculación con unidades
  - Merge de custom_params al actualizar (no se pierden campos existentes)
  - Emisión de AuditLog en DB para create/update/delete
"""

from __future__ import annotations

import json
import math
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.schemas.passenger import (
    PassengerCreate,
    PassengerPageResponse,
    PassengerResponse,
    PassengerUpdate,
)
from app.core.exceptions import AppException
from app.infrastructure.database.models import AuditLog
from app.infrastructure.wialon.gateway import WialonGateway


def _map_passenger(raw: Any, bindings: dict[int, int]) -> PassengerResponse:
    """Convierte un tag crudo de Wialon a PassengerResponse."""
    if isinstance(raw, list):
        for elem in raw:
            if isinstance(elem, dict):
                raw = elem
                break
    if not isinstance(raw, dict):
        raw = {}

    passenger_id = int(raw.get("id", 0))
    unit_id: int | None = int(raw["bu"]) if raw.get("bu") else None
    if unit_id is None:
        for uid, tid in bindings.items():
            if tid == passenger_id:
                unit_id = uid
                break

    jp = raw.get("jp", {})
    if isinstance(jp, str):
        try:
            jp = json.loads(jp)
        except Exception:
            jp = {}
    elif not isinstance(jp, dict):
        jp = {}

    return PassengerResponse(
        id=passenger_id,
        name=raw.get("n", ""),
        code=raw.get("c", ""),
        custom_params={str(k): str(v) for k, v in jp.items()},
        assigned_unit_id=unit_id,
    )


class PassengerService:
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
            resource="passengers",
            resource_id=resource_id,
            detail=detail,
            ip_address=ip_address,
        )
        self._db.add(log)

    # ------------------------------------------------------------------
    # List (paginado)
    # ------------------------------------------------------------------

    async def list_passengers(
        self,
        page: int = 1,
        page_size: int = 10,
        search: str | None = None,
    ) -> PassengerPageResponse:
        """Lista pasajeros con paginado y búsqueda opcional por nombre/código."""
        resource_id = await self._get_resource_id()
        raw_passengers = await self._gw.get_passengers(resource_id)
        bindings = await self._gw.get_passenger_bindings(resource_id)

        passengers = [_map_passenger(p, bindings) for p in raw_passengers]

        if search:
            q = search.strip().casefold()
            passengers = [
                p
                for p in passengers
                if q in p.name.casefold() or q in p.code.casefold()
            ]

        total = len(passengers)
        pages = max(1, math.ceil(total / page_size))
        start = (page - 1) * page_size
        end = start + page_size

        return PassengerPageResponse(
            items=passengers[start:end],
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_passenger(
        self,
        payload: PassengerCreate,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> PassengerResponse:
        """Crea un pasajero en Wialon y emite AuditLog."""
        resource_id = await self._get_resource_id()
        raw = await self._gw.create_passenger(
            resource_id=resource_id,
            name=payload.name,
            code=payload.code,
            custom_params=payload.custom_params,
        )
        bindings = await self._gw.get_passenger_bindings(resource_id)
        passenger = _map_passenger(raw, bindings)

        await self._emit_audit(
            action="create",
            resource_id=str(passenger.id),
            user_id=user_id,
            detail=f"name={payload.name}, code={payload.code}",
            ip_address=ip_address,
        )
        await self._db.commit()
        return passenger

    # ------------------------------------------------------------------
    # Update (con merge de custom_params)
    # ------------------------------------------------------------------

    async def update_passenger(
        self,
        passenger_id: int,
        payload: PassengerUpdate,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> PassengerResponse:
        """
        Actualiza un pasajero.

        Los custom_params del payload se FUSIONAN con los existentes para no
        perder parámetros que el payload no menciona.
        """
        resource_id = await self._get_resource_id()
        raw_passengers = await self._gw.get_passengers(resource_id)

        current_raw = next(
            (p for p in raw_passengers if int(p["id"]) == passenger_id), None
        )
        if current_raw is None:
            raise AppException(
                message=f"Pasajero {passenger_id} no encontrado",
                code="PASSENGER_NOT_FOUND",
                status_code=404,
            )

        name = payload.name if payload.name is not None else current_raw.get("n", "")
        code = payload.code if payload.code is not None else current_raw.get("c", "")

        # Merge: comenzar con los jp existentes y sobreescribir con los nuevos
        existing_jp: dict[str, str] = current_raw.get("jp", {})
        merged_jp = {**existing_jp, **(payload.custom_params or {})}

        raw = await self._gw.update_passenger(
            resource_id=resource_id,
            passenger_id=passenger_id,
            name=name,
            code=code,
            custom_params=merged_jp,
        )
        bindings = await self._gw.get_passenger_bindings(resource_id)
        passenger = _map_passenger(raw, bindings)

        await self._emit_audit(
            action="update",
            resource_id=str(passenger_id),
            user_id=user_id,
            detail=f"name={name}, code={code}",
            ip_address=ip_address,
        )
        await self._db.commit()
        return passenger

    # ------------------------------------------------------------------
    # Delete
    # ------------------------------------------------------------------

    async def delete_passenger(
        self,
        passenger_id: int,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Elimina un pasajero de Wialon y emite AuditLog."""
        resource_id = await self._get_resource_id()
        await self._gw.delete_passenger(resource_id, passenger_id)
        await self._emit_audit(
            action="delete",
            resource_id=str(passenger_id),
            user_id=user_id,
            ip_address=ip_address,
        )
        await self._db.commit()

    # ------------------------------------------------------------------
    # Bind / Unbind
    # ------------------------------------------------------------------

    async def bind_passenger(
        self,
        passenger_id: int,
        unit_id: int,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Vincula un pasajero a una unidad gestionando permisos de Wialon (RF-09)."""
        from app.core.exceptions import WialonAPIException

        resource_id = await self._get_resource_id()
        try:
            await self._gw.bind_passenger_to_unit(resource_id, passenger_id, unit_id)
        except WialonAPIException as exc:
            if exc.api_error_code == 7:
                raise AppException(
                    message="El token de Wialon no cuenta con permisos ACL para vincular pasajeros a esta unidad (Código 7: Acceso Denegado).",
                    code="WIALON_PERMISSION_DENIED",
                    status_code=403,
                )
            elif exc.api_error_code == 4:
                raise AppException(
                    message="Pasajero o unidad inexistente en Wialon.",
                    code="NOT_FOUND",
                    status_code=404,
                )
            raise

        await self._emit_audit(
            action="bind",
            resource_id=str(passenger_id),
            user_id=user_id,
            detail=f"unit_id={unit_id}",
            ip_address=ip_address,
        )
        await self._db.commit()

    async def unbind_passenger(
        self,
        passenger_id: int,
        unit_id: int,
        user_id: int | None = None,
        ip_address: str | None = None,
    ) -> None:
        """Desvincula un pasajero de una unidad."""
        resource_id = await self._get_resource_id()
        try:
            await self._gw.unbind_passenger_from_unit(resource_id, unit_id, passenger_id=passenger_id)
        except Exception:
            pass
        await self._emit_audit(
            action="unbind",
            resource_id=str(passenger_id),
            user_id=user_id,
            detail=f"unit_id={unit_id}",
            ip_address=ip_address,
        )
        await self._db.commit()
