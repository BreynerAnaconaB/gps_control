"""
test_export_service.py — Unit tests for CSV export and CSV injection sanitization (RF-25, SEG-03).
"""

from app.api.v1.schemas.driver import DriverResponse
from app.api.v1.schemas.passenger import PassengerResponse
from app.api.v1.schemas.vehicle import VehicleResponse
from app.services.export_service import _sanitize, ExportService


def test_sanitize_plain_text():
    assert _sanitize("Vehículo 1") == "Vehículo 1"
    assert _sanitize("Juan Pérez") == "Juan Pérez"
    assert _sanitize("12345") == "12345"


def test_sanitize_escapes_formula_prefixes():
    # Dangerous formula prefixes according to OWASP CSV Injection
    assert _sanitize("=cmd|'/C calc'!A0") == "'=cmd|'/C calc'!A0"
    assert _sanitize("+12345-6789") == "'+12345-6789"
    assert _sanitize("-10+20") == "'-10+20"
    assert _sanitize("@SUM(A1:A10)") == "'@SUM(A1:A10)"
    assert _sanitize("\tTAB_FORMULA") == "'\tTAB_FORMULA"
    assert _sanitize("\rCARRIAGE_RETURN") == "'\rCARRIAGE_RETURN"


def test_sanitize_handles_none():
    assert _sanitize(None) == ""


def test_export_vehicles_csv_generation():
    service = ExportService()
    vehicles = [
        VehicleResponse(
            id=101,
            name="=DANGEROUS_FORMULA()",
            status="moving",
            latitude=4.65,
            longitude=-74.05,
            speed=45.0,
            direction="N",
        )
    ]
    csv_str = service.export_vehicles(vehicles)
    assert "ID" in csv_str
    assert "Nombre" in csv_str
    # Formula injection must be prefixed with single quote
    assert "'=DANGEROUS_FORMULA()" in csv_str


def test_export_drivers_csv_generation():
    service = ExportService()
    drivers = [
        DriverResponse(
            id=201,
            name="+Carlos Gómez",
            code="DRV-01",
            phone="+573001234567",
            description="Chofer principal",
        )
    ]
    csv_str = service.export_drivers(drivers)
    assert "DRV-01" in csv_str
    assert "'+Carlos Gómez" in csv_str


def test_export_passengers_csv_generation():
    service = ExportService()
    passengers = [
        PassengerResponse(
            id=301,
            name="@Admin",
            code="TAG-99",
            custom_params={"CARGO": "=1+1"},
        )
    ]
    csv_str = service.export_passengers(passengers)
    assert "TAG-99" in csv_str
    assert "'@Admin" in csv_str
