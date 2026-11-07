
import pytest

from app.services.vehicle_detail import VehicleDetailService


class FakeWialonSession:
    async def call(self, service, params):
        assert service == "core/search_item"
        assert params["id"] == 123

        return {
            "item": {
                "id": 123,
                "nm": "Vehículo de prueba",
                "act": 1,
                "uri": "/vehicle.svg",
                "flds": {
                    "1": {"n": "PLACA", "v": "ABC123"},
                    "2": {"n": "MARCA", "v": "RENAULT"},
                },
                "sens": {
                    "1": {
                        "id": 1,
                        "n": "Ignición",
                        "t": "engine operation",
                        "p": "in2",
                        "m": "Encendida/Apagada",
                    }
                },
            }
        }


@pytest.mark.asyncio
async def test_get_vehicle_detail():
    service = VehicleDetailService(FakeWialonSession())

    result = await service.get_vehicle_detail(123)

    assert result["id"] == 123
    assert result["name"] == "Vehículo de prueba"
    assert result["custom_fields"]["PLACA"] == "ABC123"
    assert result["custom_fields"]["MARCA"] == "RENAULT"
    assert result["sensors"][0]["name"] == "Ignición"
    assert result["active"] is True
    assert result["image"] == "/vehicle.svg"


@pytest.mark.asyncio
async def test_vehicle_without_custom_fields_or_sensors():
    class EmptyWialonSession:
        async def call(self, service, params):
            return {
                "item": {
                    "id": 123,
                    "nm": "Vehículo sin datos adicionales",
                    "act": 0,
                }
            }

    service = VehicleDetailService(EmptyWialonSession())

    result = await service.get_vehicle_detail(123)

    assert result["custom_fields"] == {}
    assert result["sensors"] == []
    assert result["active"] is False
    assert result["image"] is None
