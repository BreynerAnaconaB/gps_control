"""
ExportService — generación de CSV para vehículos, conductores y pasajeros.

Seguridad (CSV Injection):
  Cualquier valor que comience con =, +, -, @, TAB (\\t) o CR (\\r)
  es prefijado con una comilla simple (') para evitar que fórmulas
  sean ejecutadas en hojas de cálculo (OWASP: CSV Injection).
"""

from __future__ import annotations

import csv
import io

from app.api.v1.schemas.driver import DriverResponse
from app.api.v1.schemas.passenger import PassengerResponse
from app.api.v1.schemas.vehicle import VehicleResponse

# Caracteres que deben ser sanitizados al inicio del valor
_DANGEROUS_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _sanitize(value: object) -> str:
    """Sanitiza un valor para prevenir CSV injection."""
    s = str(value) if value is not None else ""
    if s and s[0] in _DANGEROUS_PREFIXES:
        return f"'{s}"
    return s


class ExportService:
    """Genera CSVs sanitizados en memoria."""

    # ------------------------------------------------------------------
    # Vehicles
    # ------------------------------------------------------------------

    def export_vehicles(self, vehicles: list[VehicleResponse]) -> str:
        """Genera un CSV con los datos de vehículos."""
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)

        writer.writerow(
            [
                "ID",
                "Nombre",
                "Estado",
                "Latitud",
                "Longitud",
                "Velocidad (km/h)",
                "Rumbo",
                "Altitud",
                "Satélites",
                "Dirección",
                "Última posición",
            ]
        )

        for v in vehicles:
            writer.writerow(
                [
                    _sanitize(v.id),
                    _sanitize(v.name),
                    _sanitize(v.status.value if hasattr(v.status, "value") else v.status),
                    _sanitize(v.latitude),
                    _sanitize(v.longitude),
                    _sanitize(v.speed),
                    _sanitize(v.heading),
                    _sanitize(v.altitude),
                    _sanitize(v.satellites),
                    _sanitize(v.direction),
                    _sanitize(
                        v.last_position.isoformat() if v.last_position else ""
                    ),
                ]
            )

        return output.getvalue()

    # ------------------------------------------------------------------
    # Drivers
    # ------------------------------------------------------------------

    def export_drivers(self, drivers: list[DriverResponse]) -> str:
        """Genera un CSV con los datos de conductores."""
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)

        writer.writerow(
            [
                "ID",
                "Nombre",
                "Código",
                "Teléfono",
                "Descripción",
                "ID Unidad Asignada",
            ]
        )

        for d in drivers:
            writer.writerow(
                [
                    _sanitize(d.id),
                    _sanitize(d.name),
                    _sanitize(d.code),
                    _sanitize(d.phone),
                    _sanitize(d.description),
                    _sanitize(d.assigned_unit_id if d.assigned_unit_id is not None else ""),
                ]
            )

        return output.getvalue()

    # ------------------------------------------------------------------
    # Passengers
    # ------------------------------------------------------------------

    def export_passengers(self, passengers: list[PassengerResponse]) -> str:
        """Genera un CSV con los datos de pasajeros."""
        output = io.StringIO()
        writer = csv.writer(output, quoting=csv.QUOTE_ALL)

        writer.writerow(
            [
                "ID",
                "Nombre",
                "Código",
                "Parámetros personalizados",
                "ID Unidad Asignada",
            ]
        )

        for p in passengers:
            custom_str = "; ".join(f"{k}={v}" for k, v in p.custom_params.items())
            writer.writerow(
                [
                    _sanitize(p.id),
                    _sanitize(p.name),
                    _sanitize(p.code),
                    _sanitize(custom_str),
                    _sanitize(p.assigned_unit_id if p.assigned_unit_id is not None else ""),
                ]
            )

        return output.getvalue()
