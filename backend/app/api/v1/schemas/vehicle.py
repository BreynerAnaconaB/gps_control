from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field

from app.services.vehicle_status import VehicleStatus


class AssignedDriverSummary(BaseModel):
    id: int
    name: str
    code: str | None = None
    phone: str | None = None


class AssignedPassengerSummary(BaseModel):
    id: int
    name: str
    code: str | None = None


class VehicleCustomFieldItem(BaseModel):
    id: int
    name: str
    value: str


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

    assigned_driver_id: int | None = None
    assigned_driver_name: str | None = None


class VehiclePageResponse(BaseModel):
    items: list[VehicleResponse]
    total: int
    page: int
    page_size: int
    pages: int


class VehicleSensorResponse(BaseModel):
    id: int | None = None
    name: str
    type: str | None = None
    parameter: str | None = None
    unit: str | None = None


class VehicleDetailResponse(BaseModel):
    id: int
    name: str
    custom_fields: dict[str, Any]
    custom_field_items: list[VehicleCustomFieldItem] = []
    sensors: list[VehicleSensorResponse] = []
    active: bool
    image: str | None = None
    assigned_driver: AssignedDriverSummary | None = None
    assigned_passengers: list[AssignedPassengerSummary] = []
