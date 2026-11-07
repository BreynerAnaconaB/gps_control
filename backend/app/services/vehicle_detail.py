from typing import Any

from app.infrastructure.wialon.gateway import WialonGateway
from app.infrastructure.wialon.session import WialonSessionManager


class VehicleDetailService:
    def __init__(self, session_manager: WialonSessionManager):
        self.session_manager = session_manager
        self.gateway = WialonGateway(session_manager)

    async def get_vehicle_detail(self, vehicle_id: int) -> dict[str, Any]:
        result = await self.session_manager.call(
            "core/search_item",
            {
                "id": vehicle_id,
                "flags": 1 | 8 | 16 | 256 | 512 | 1024 | 4096,
            },
        )

        item = result.get("item")
        if not item:
            return {}

        raw_flds = item.get("flds", {})
        custom_fields: dict[str, Any] = {}
        custom_field_items: list[dict[str, Any]] = []

        if isinstance(raw_flds, dict):
            for field in raw_flds.values():
                if isinstance(field, dict) and field.get("n"):
                    field_id = int(field.get("id", 0))
                    name = str(field.get("n", "")).strip()
                    val = str(field.get("v", ""))
                    custom_fields[name.upper()] = val
                    custom_field_items.append(
                        {
                            "id": field_id,
                            "name": name,
                            "value": val,
                        }
                    )

        sensors = [
            {
                "id": sensor.get("id"),
                "name": sensor.get("n"),
                "type": sensor.get("t"),
                "parameter": sensor.get("p"),
                "unit": sensor.get("m"),
            }
            for sensor in item.get("sens", {}).values()
            if isinstance(sensor, dict)
        ]

        # Obtener conductor y pasajeros asignados desde Wialon
        assigned_driver = None
        assigned_passengers = []

        try:
            resource_id = await self.gateway.get_first_resource_id()

            # Conductor asignado
            drivers = await self.gateway.get_drivers(resource_id)
            for d in drivers:
                bu = d.get("bu")
                if bu is not None and str(bu) != "0" and int(bu) == int(vehicle_id):
                    assigned_driver = {
                        "id": d["id"],
                        "name": d.get("n", ""),
                        "code": d.get("c") or d.get("cod") or None,
                        "phone": d.get("p") or d.get("ph") or None,
                    }
                    break

            # Pasajeros asignados
            passengers = await self.gateway.get_passengers(resource_id)
            for p in passengers:
                bu = p.get("bu")
                if bu is not None and str(bu) != "0" and int(bu) == int(vehicle_id):
                    assigned_passengers.append(
                        {
                            "id": p["id"],
                            "name": p.get("n", ""),
                            "code": p.get("c") or None,
                        }
                    )
        except Exception:
            # Tolerancia a fallos: si falla la consulta de recurso, retornar detalle base
            pass

        return {
            "id": item.get("id"),
            "name": item.get("nm"),
            "custom_fields": custom_fields,
            "custom_field_items": custom_field_items,
            "sensors": sensors,
            "active": bool(item.get("act")),
            "image": item.get("uri"),
            "assigned_driver": assigned_driver,
            "assigned_passengers": assigned_passengers,
        }
