
from pydantic import BaseModel, Field


class VehicleResponse(BaseModel):
    id: int
    name: str = Field(..., min_length=1)
