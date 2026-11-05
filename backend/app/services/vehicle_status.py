
from datetime import datetime, timedelta, timezone
from typing import Literal

VehicleStatus = Literal["moving", "stopped", "no_signal"]

SPEED_THRESHOLD_KMH = 3.0
MAX_POSITION_AGE_MINUTES = 10


def has_valid_coordinates(
    latitude: float | None,
    longitude: float | None,
) -> bool:
    """Verifica que las coordenadas estén dentro de los rangos geográficos."""
    if latitude is None or longitude is None:
        return False

    return (
        -90 <= latitude <= 90
        and -180 <= longitude <= 180
    )


def calculate_vehicle_status(
    latitude: float | None,
    longitude: float | None,
    speed: float | None,
    last_position: datetime | None,
    now: datetime | None = None,
) -> VehicleStatus:
    """Calcula el estado GPS usando la posición, velocidad y antigüedad."""

    if not has_valid_coordinates(latitude, longitude):
        return "no_signal"

    if last_position is None:
        return "no_signal"

    current_time = now or datetime.now(timezone.utc)

    # Normalizamos las fechas para comparar siempre en UTC.
    if last_position.tzinfo is None:
        last_position = last_position.replace(tzinfo=timezone.utc)

    if last_position > current_time:
        return "no_signal"

    if current_time - last_position > timedelta(
        minutes=MAX_POSITION_AGE_MINUTES
    ):
        return "no_signal"

    if speed is not None and speed > SPEED_THRESHOLD_KMH:
        return "moving"

    return "stopped"


def heading_to_direction(heading: float | None) -> str | None:
    """Convierte un rumbo en grados a una dirección cardinal."""

    if heading is None:
        return None

    normalized_heading = heading % 360

    directions = [
        "N", "NE", "E", "SE",
        "S", "SW", "W", "NW",
    ]

    index = int((normalized_heading + 22.5) // 45) % 8

    return directions[index]
