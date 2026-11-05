
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
        "flags": 1,
        "from": 0,
        "to": 0,
    }

    result = await session_manager.call(
        "core/search_items",
        params,
    )

    vehicles = result.get("items", [])

    return [
        {
            "id": vehicle["id"],
            "name": vehicle["nm"],
        }
        for vehicle in vehicles
    ]
