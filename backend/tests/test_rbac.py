"""
RBAC tests (TST-02): verifies that each role can only do what it's allowed to.

Tests the require_permission dependency by calling it directly with mock users,
without spinning up a full HTTP server.
"""

import pytest
from fastapi import HTTPException
from unittest.mock import AsyncMock

from app.infrastructure.database.models import Permission, Role, RoleName, User
from app.api.v1.dependencies import require_permission


def _make_user(role_name: RoleName, permissions: list[tuple[str, str]]) -> User:
    """Creates an in-memory User with the given role and permissions (no DB)."""
    role = Role()
    role.name = role_name
    role.permissions = [
        _make_permission(action, resource)
        for action, resource in permissions
    ]

    user = User()
    user.id = 1
    user.email = f"{role_name}@test.com"
    user.is_active = True
    user.role = role
    return user


def _make_permission(action: str, resource: str) -> Permission:
    p = Permission()
    p.action = action
    p.resource = resource
    return p


# ---------------------------------------------------------------------------
# Admin
# ---------------------------------------------------------------------------

ADMIN_PERMS = [
    ("read", "vehicles"), ("write", "vehicles"),
    ("read", "drivers"), ("write", "drivers"),
    ("read", "passengers"), ("write", "passengers"),
    ("manage", "users"), ("read", "audit"),
    ("export", "data"), ("read", "history"),
]

OPERATOR_PERMS = [
    ("read", "vehicles"), ("write", "vehicles"),
    ("read", "drivers"), ("write", "drivers"),
    ("read", "passengers"), ("write", "passengers"),
    ("export", "data"), ("read", "history"),
]

VIEWER_PERMS = [
    ("read", "vehicles"),
    ("read", "drivers"),
    ("read", "passengers"),
    ("read", "history"),
]


@pytest.mark.asyncio
async def test_admin_can_manage_users():
    admin = _make_user(RoleName.admin, ADMIN_PERMS)
    checker = require_permission("manage", "users")
    result = await checker(current_user=admin)
    assert result is admin


@pytest.mark.asyncio
async def test_admin_can_write_drivers():
    admin = _make_user(RoleName.admin, ADMIN_PERMS)
    checker = require_permission("write", "drivers")
    result = await checker(current_user=admin)
    assert result is admin


# ---------------------------------------------------------------------------
# Operator
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_operator_can_write_drivers():
    operator = _make_user(RoleName.operator, OPERATOR_PERMS)
    checker = require_permission("write", "drivers")
    result = await checker(current_user=operator)
    assert result is operator


@pytest.mark.asyncio
async def test_operator_cannot_manage_users():
    operator = _make_user(RoleName.operator, OPERATOR_PERMS)
    checker = require_permission("manage", "users")

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=operator)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_operator_cannot_read_audit():
    operator = _make_user(RoleName.operator, OPERATOR_PERMS)
    checker = require_permission("read", "audit")

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=operator)

    assert exc_info.value.status_code == 403


# ---------------------------------------------------------------------------
# Viewer
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_viewer_can_read_vehicles():
    viewer = _make_user(RoleName.viewer, VIEWER_PERMS)
    checker = require_permission("read", "vehicles")
    result = await checker(current_user=viewer)
    assert result is viewer


@pytest.mark.asyncio
async def test_viewer_cannot_write_drivers():
    viewer = _make_user(RoleName.viewer, VIEWER_PERMS)
    checker = require_permission("write", "drivers")

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=viewer)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_export_data():
    viewer = _make_user(RoleName.viewer, VIEWER_PERMS)
    checker = require_permission("export", "data")

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=viewer)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_manage_users():
    viewer = _make_user(RoleName.viewer, VIEWER_PERMS)
    checker = require_permission("manage", "users")

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=viewer)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_write_vehicles():
    viewer = _make_user(RoleName.viewer, VIEWER_PERMS)
    checker = require_permission("write", "vehicles")

    with pytest.raises(HTTPException) as exc_info:
        await checker(current_user=viewer)

    assert exc_info.value.status_code == 403

