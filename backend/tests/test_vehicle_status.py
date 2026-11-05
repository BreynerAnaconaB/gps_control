
from datetime import datetime, timedelta, timezone

import pytest

from app.services.vehicle_status import (
    calculate_vehicle_status,
    heading_to_direction,
    has_valid_coordinates,
)


NOW = datetime.now(timezone.utc)


@pytest.mark.parametrize(
    "speed, expected",
    [
        (50, "moving"),
        (3, "stopped"),
        (0, "stopped"),
        (None, "stopped"),
    ],
)
def test_calculate_vehicle_status(speed, expected):
    result = calculate_vehicle_status(
        latitude=4.65,
        longitude=-74.05,
        speed=speed,
        last_position=NOW,
        now=NOW,
    )

    assert result == expected


def test_vehicle_without_position_has_no_signal():
    result = calculate_vehicle_status(
        latitude=None,
        longitude=None,
        speed=None,
        last_position=None,
        now=NOW,
    )

    assert result == "no_signal"


def test_old_position_has_no_signal():
    result = calculate_vehicle_status(
        latitude=4.65,
        longitude=-74.05,
        speed=50,
        last_position=NOW - timedelta(minutes=11),
        now=NOW,
    )

    assert result == "no_signal"


@pytest.mark.parametrize(
    "latitude, longitude",
    [
        (91, -74),
        (4.65, 181),
        (-91, 0),
        (None, -74),
    ],
)
def test_invalid_coordinates(latitude, longitude):
    assert not has_valid_coordinates(latitude, longitude)


@pytest.mark.parametrize(
    "heading, expected",
    [
        (0, "N"),
        (90, "E"),
        (180, "S"),
        (270, "W"),
        (45, "NE"),
        (360, "N"),
    ],
)
def test_heading_to_direction(heading, expected):
    assert heading_to_direction(heading) == expected
