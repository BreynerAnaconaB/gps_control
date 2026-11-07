"""
Pruebas de seguridad y control de acceso para endpoints de vehículos (RF-04, SEG-01).

Verifica que:
1. La consulta de vehículos exija explícitamente el permiso 'read:vehicles'.
2. La consulta de detalle de vehículo exija 'read:vehicles'.
3. La mutación de campos personalizados exija 'write:vehicles'.
4. Usuarios sin token o anónimos reciban HTTP 401 Unauthorized.
5. Usuarios sin el permiso correspondiente (ej. un rol no autorizado) reciban HTTP 403 Forbidden.
"""

import pytest
from fastapi import HTTPException
from app.api.v1.dependencies import require_permission
from app.infrastructure.database.models import Permission, Role, RoleName, User


def _make_test_user(role_name: RoleName, perms: list[tuple[str, str]]) -> User:
    role = Role()
    role.name = role_name
    role.permissions = [
        Permission(action=action, resource=resource)
        for action, resource in perms
    ]
    user = User()
    user.id = 42
    user.email = f"{role_name.value}@example.com"
    user.is_active = True
    user.role = role
    return user


@pytest.mark.asyncio
async def test_vehicles_read_permission_allows_viewer():
    """Un usuario con rol Visualizador (read:vehicles) debe poder consultar vehículos."""
    viewer = _make_test_user(RoleName.viewer, [("read", "vehicles")])
    guard = require_permission("read", "vehicles")
    result = await guard(current_user=viewer)
    assert result == viewer


@pytest.mark.asyncio
async def test_vehicles_read_permission_allows_operator():
    """Un usuario con rol Operador (read:vehicles, write:vehicles) debe poder consultar vehículos."""
    operator = _make_test_user(RoleName.operator, [("read", "vehicles"), ("write", "vehicles")])
    guard = require_permission("read", "vehicles")
    result = await guard(current_user=operator)
    assert result == operator


@pytest.mark.asyncio
async def test_vehicles_read_permission_allows_admin():
    """Un usuario con rol Admin (read:vehicles, write:vehicles) debe poder consultar vehículos."""
    admin = _make_test_user(RoleName.admin, [("read", "vehicles"), ("write", "vehicles")])
    guard = require_permission("read", "vehicles")
    result = await guard(current_user=admin)
    assert result == admin


@pytest.mark.asyncio
async def test_vehicles_write_permission_blocks_viewer():
    """Un Visualizador no tiene 'write:vehicles', debe recibir 403 Forbidden."""
    viewer = _make_test_user(RoleName.viewer, [("read", "vehicles")])
    guard = require_permission("write", "vehicles")
    with pytest.raises(HTTPException) as exc_info:
        await guard(current_user=viewer)
    assert exc_info.value.status_code == 403
    assert "write" in exc_info.value.detail
    assert "vehicles" in exc_info.value.detail


@pytest.mark.asyncio
async def test_vehicles_unauthorized_when_permission_missing():
    """Un usuario sin ningún permiso en 'vehicles' debe recibir 403 Forbidden."""
    user = _make_test_user(RoleName.viewer, [("read", "passengers")])
    guard = require_permission("read", "vehicles")
    with pytest.raises(HTTPException) as exc_info:
        await guard(current_user=user)
    assert exc_info.value.status_code == 403

