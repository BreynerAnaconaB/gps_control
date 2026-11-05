from datetime import datetime, timezone

from fastapi import APIRouter, Depends

from app.api.v1.dependencies import get_wialon_session_manager
from app.api.v1.schemas.vehicle import VehicleResponse
from app.infrastructure.wialon.session import WialonSessionManager


router = APIRouter()


@router.get(
    "/vehicles",
    response_model=list[VehicleResponse],
    tags=["Vehicles"],
)
async def get_vehicles(
    session_manager: WialonSessionManager = Depends(
        get_wialon_session_manager
    ),
):
    params = {
        "spec": {
            "itemsType": "avl_unit",
            "propName": "sys_name",
            "propValueMask": "*",
            "sortType": "sys_name",
        },
        "force": 1,
        "flags": 1025,
        "from": 0,
        "to": 0,
    }

    result = await session_manager.call("core/search_items", params)

    vehicles = []

    for vehicle in result.get("items", []):
        position = vehicle.get("pos") or {}

        timestamp = position.get("t")

        vehicles.append(
            VehicleResponse(
                id=vehicle["id"],
                name=vehicle["nm"],
                latitude=position.get("y"),
                longitude=position.get("x"),
                speed=position.get("s"),
                heading=position.get("c"),
                altitude=position.get("z"),
                satellites=position.get("sc"),
                last_position=(
                    datetime.fromtimestamp(timestamp, tz=timezone.utc)
                    if timestamp
                    else None
                ),
            )
        )

    return vehicles