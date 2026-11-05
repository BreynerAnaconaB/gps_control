from datetime import datetime

from pydantic import BaseModel, Field

from app.services.vehicle_status import VehicleStatus


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

    status: VehicleStatus
    direction: str | None = None

class VehiclePageResponse(BaseModel):
    items: list[VehicleResponse]
    total: int
    page: int
    page_size: int
    pages: int

