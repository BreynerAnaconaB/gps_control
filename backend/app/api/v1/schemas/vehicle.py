from datetime import datetime, timezone

from pydantic import BaseModel, Field


class VehicleResponse(BaseModel):
    id: int
    name: str = Field(..., min_length=1)

    latitude: float | None = None
    longitude: float | None = None
    speed: float | None = None
    heading: float | None = None
    altitude: float | None = None
    satellites: int | None = None
    last_position: datetime | None = None