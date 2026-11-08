"""
WialonGateway — centraliza TODAS las llamadas a la API de Wialon.

Cada método mapea exactamente a un servicio de Wialon y convierte la
respuesta cruda a estructuras Python tipadas. Los errores de Wialon se
propagan como WialonAPIException.
"""

from __future__ import annotations

import json
from typing import Any

from app.core.exceptions import AppException, WialonAPIException
from app.infrastructure.wialon.session import WialonSessionManager

# Flags para core/search_items de avl_resource: datos base + conductores + tags
_RESOURCE_FLAGS = 1 | 2 | 256 | 512  # sys_base | name | drivers | tags


def _unwrap_wialon_item(result: Any) -> dict:
    """Extrae el dict de un resultado de update_driver / update_tag que Wialon retorna como [id, {...}]."""
    if isinstance(result, list):
        for elem in result:
            if isinstance(elem, dict):
                return elem
        return {}
    if isinstance(result, dict):
        return result
    return {}


class WialonGateway:
    """Fachada sobre WialonSessionManager que provee métodos semánticos."""

    def __init__(self, session_manager: WialonSessionManager) -> None:
        self._sm = session_manager

    # ------------------------------------------------------------------
    # Helpers internos
    # ------------------------------------------------------------------

    async def _call(self, service: str, params: dict) -> dict | list:
        """Thin wrapper; propaga WialonAPIException sin modificarla."""
        return await self._sm.call(service, params)

    # ------------------------------------------------------------------
    # Resources
    # ------------------------------------------------------------------

    async def get_first_resource_id(self) -> int:
        """
        Retorna el id del primer avl_resource al que tiene acceso la sesión.

        Raises AppException (404) si no hay recursos disponibles.
        """
        result = await self._call(
            "core/search_items",
            {
                "spec": {
                    "itemsType": "avl_resource",
                    "propName": "sys_name",
                    "propValueMask": "*",
                    "sortType": "sys_name",
                },
                "force": 1,
                "flags": 1,
                "from": 0,
                "to": 0,
            },
        )
        items = result.get("items", [])  # type: ignore[union-attr]
        if not items:
            raise AppException(
                message="No se encontró ningún recurso en Wialon",
                code="WIALON_RESOURCE_NOT_FOUND",
                status_code=404,
            )
        return int(items[0]["id"])

    async def _get_resource(self, resource_id: int, flags: int) -> dict:
        """Obtiene un recurso con los flags indicados."""
        result = await self._call(
            "core/search_item",
            {"id": resource_id, "flags": flags},
        )
        return result.get("item", {})  # type: ignore[union-attr]

    # ------------------------------------------------------------------
    # Drivers
    # ------------------------------------------------------------------

    async def get_drivers(self, resource_id: int) -> list[dict]:
        """
        Retorna todos los conductores del recurso.

        Cada dict tiene: id, nm (name), cod (code), ph (phone), ds (description).
        """
        item = await self._get_resource(resource_id, flags=1 | 256)
        # 'drvrs' es un dict {str(id): {id, nm, cod, ph, ds, ...}}
        drivers_raw: dict = item.get("drvrs", {})
        return list(drivers_raw.values())

    async def create_driver(
        self,
        resource_id: int,
        name: str,
        code: str,
        phone: str,
        description: str,
    ) -> dict:
        """Crea un conductor en el recurso y retorna el objeto creado."""
        result = await self._call(
            "resource/update_driver",
            {
                "itemId": resource_id,
                "id": 0,
                "callMode": "create",
                "n": name,
                "cod": code,
                "ph": phone,
                "ph2": "",
                "ds": description,
                "img": "",
                "c": "",
                "r": 0,
            },
        )
        return _unwrap_wialon_item(result)

    async def update_driver(
        self,
        resource_id: int,
        driver_id: int,
        name: str,
        code: str,
        phone: str,
        description: str,
    ) -> dict:
        """Actualiza un conductor existente."""
        result = await self._call(
            "resource/update_driver",
            {
                "itemId": resource_id,
                "id": driver_id,
                "callMode": "update",
                "n": name,
                "cod": code,
                "ph": phone,
                "ph2": "",
                "ds": description,
                "img": "",
                "c": "",
                "r": 0,
            },
        )
        return _unwrap_wialon_item(result)

    async def delete_driver(self, resource_id: int, driver_id: int) -> None:
        """Elimina un conductor del recurso."""
        await self._call(
            "resource/update_driver",
            {
                "itemId": resource_id,
                "id": driver_id,
                "callMode": "delete",
            },
        )

    async def bind_driver_to_unit(
        self, resource_id: int, driver_id: int, unit_id: int
    ) -> None:
        """Vincula un conductor a una unidad en Wialon."""
        await self._call(
            "resource/bind_unit_driver",
            {
                "resourceId": resource_id,
                "itemId": unit_id,
                "driverId": driver_id,
                "time": 0,
            },
        )

    async def unbind_driver_from_unit(
        self, resource_id: int, unit_id: int, driver_id: int | None = None
    ) -> None:
        """Desvincula el conductor de la unidad en Wialon de forma idempotente."""
        try:
            await self._call(
                "resource/bind_unit_driver",
                {
                    "resourceId": resource_id,
                    "itemId": unit_id,
                    "driverId": 0,
                    "time": 0,
                },
            )
        except WialonAPIException as exc:
            # Tolerancia: error 4 (parámetros no aplicables) o error 6 (no vinculado/no encontrado)
            if exc.api_error_code in (4, 6, 7):
                return
            raise

    async def get_driver_bindings(self, resource_id: int) -> dict[int, int]:
        """
        Retorna un mapa {unit_id: driver_id} con los vínculos activos.
        """
        drivers = await self.get_drivers(resource_id)
        bindings: dict[int, int] = {}
        for d in drivers:
            bu = d.get("bu")
            if bu:
                bindings[int(bu)] = int(d["id"])
        return bindings

    # ------------------------------------------------------------------
    # Passengers (Tags en Wialon)
    # ------------------------------------------------------------------

    async def get_passengers(self, resource_id: int) -> list[dict]:
        """
        Retorna todos los pasajeros (tags) del recurso.

        Cada dict tiene: id, n (name), c (code), jp (custom_params dict).
        """
        # Flag 0x200000 (2097152) es el flag oficial de Wialon para tags/pasajeros
        item = await self._get_resource(resource_id, flags=1 | 0x200000)
        tags_raw: dict = item.get("tags", {})
        result = []
        for tag in tags_raw.values():
            jp_raw = tag.get("jp", "{}")
            if isinstance(jp_raw, str):
                try:
                    jp = json.loads(jp_raw)
                except (ValueError, TypeError):
                    jp = {}
            else:
                jp = jp_raw if isinstance(jp_raw, dict) else {}
            result.append({**tag, "jp": jp})
        return result

    async def create_passenger(
        self,
        resource_id: int,
        name: str,
        code: str,
        custom_params: dict[str, str],
    ) -> dict:
        """Crea un pasajero (tag) en el recurso."""
        result = await self._call(
            "resource/update_tag",
            {
                "itemId": resource_id,
                "id": 0,
                "callMode": "create",
                "n": name,
                "c": code,
                "jp": json.dumps(custom_params),
            },
        )
        return _unwrap_wialon_item(result)

    async def update_passenger(
        self,
        resource_id: int,
        passenger_id: int,
        name: str,
        code: str,
        custom_params: dict[str, str],
    ) -> dict:
        """Actualiza un pasajero existente. custom_params ya debe ser el merge final."""
        result = await self._call(
            "resource/update_tag",
            {
                "itemId": resource_id,
                "id": passenger_id,
                "callMode": "update",
                "n": name,
                "c": code,
                "jp": json.dumps(custom_params),
            },
        )
        return _unwrap_wialon_item(result)

    async def delete_passenger(self, resource_id: int, passenger_id: int) -> None:
        """Elimina un pasajero (tag) del recurso."""
        await self._call(
            "resource/update_tag",
            {
                "itemId": resource_id,
                "id": passenger_id,
                "callMode": "delete",
            },
        )

    async def bind_passenger_to_unit(
        self, resource_id: int, passenger_id: int, unit_id: int
    ) -> None:
        """Vincula un pasajero a una unidad en Wialon."""
        await self._call(
            "resource/bind_unit_tag",
            {
                "resourceId": resource_id,
                "unitId": unit_id,
                "tagId": passenger_id,
                "time": 0,
                "mode": 1,
            },
        )

    async def unbind_passenger_from_unit(
        self, resource_id: int, unit_id: int, passenger_id: int | None = None
    ) -> None:
        """Desvincula el pasajero activo de una unidad en Wialon de forma idempotente."""
        try:
            await self._call(
                "resource/bind_unit_tag",
                {
                    "resourceId": resource_id,
                    "unitId": unit_id,
                    "tagId": passenger_id or 0,
                    "time": 0,
                    "mode": 0,
                },
            )
        except WialonAPIException as exc:
            if exc.api_error_code in (4, 6, 7):
                return
            raise

    async def get_passenger_bindings(self, resource_id: int) -> dict[int, int]:
        """
        Retorna un mapa {unit_id: passenger_id} con los vínculos activos.
        """
        passengers = await self.get_passengers(resource_id)
        bindings: dict[int, int] = {}
        for p in passengers:
            bu = p.get("bu")
            if bu:
                bindings[int(bu)] = int(p["id"])
        return bindings

    # ------------------------------------------------------------------
    # Custom fields for vehicles
    # ------------------------------------------------------------------

    async def update_vehicle_custom_field(
        self,
        unit_id: int,
        field_id: int,
        name: str,
        value: str,
    ) -> dict:
        """
        Crea (field_id=0) o actualiza un campo personalizado de una unidad.
        Retorna el campo actualizado.
        """
        result = await self._call(
            "item/update_custom_field",
            {
                "itemId": unit_id,
                "id": field_id,
                "callMode": "update" if field_id else "create",
                "n": name,
                "v": value,
            },
        )
        return result  # type: ignore[return-value]

    async def delete_vehicle_custom_field(
        self, unit_id: int, field_id: int
    ) -> None:
        """Elimina un campo personalizado de una unidad."""
        await self._call(
            "item/update_custom_field",
            {
                "itemId": unit_id,
                "id": field_id,
                "callMode": "delete",
            },
        )

    # ------------------------------------------------------------------
    # Trip history
    # ------------------------------------------------------------------

    async def get_trip_history(
        self,
        unit_id: int,
        time_from: int,
        time_to: int,
    ) -> list[dict]:
        """
        Carga el historial de mensajes de una unidad en el rango UNIX dado.

        Retorna una lista de mensajes crudos de Wialon.
        """
        result = await self._call(
            "messages/load_interval",
            {
                "itemId": unit_id,
                "timeFrom": time_from,
                "timeTo": time_to,
                "flags": 0x0000,  # flags 0x0000 con máscara 0xFF00 carga mensajes de posición sin error 7
                "flagsMask": 0xFF00,
                "loadCount": 5000,
            },
        )
        # Wialon devuelve {"messages": [...], "count": N}
        if isinstance(result, dict):
            return result.get("messages", [])
        return []

    # ------------------------------------------------------------------
    # Audit / last messages
    # ------------------------------------------------------------------

    async def get_last_messages(
        self, unit_id: int, count: int = 1
    ) -> list[dict]:
        """Retorna los últimos `count` mensajes de una unidad."""
        result = await self._call(
            "messages/load_last",
            {
                "itemId": unit_id,
                "lastTime": 0,
                "lastCount": count,
                "flags": 0x0001,
                "flagsMask": 0x0001,
                "loadCount": count,
            },
        )
        if isinstance(result, dict):
            return result.get("messages", [])
        return []
