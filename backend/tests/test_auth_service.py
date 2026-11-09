"""
Tests for AuthService: login, logout, refresh, change_password, create_user.

The database is an in-memory SQLite instance created fresh for each test
(no network, no Wialon calls). Wialon is not involved here.
"""

import asyncio
from datetime import datetime, timedelta, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.security import hash_password, create_access_token, hash_refresh_token
from app.infrastructure.database.base import Base
from app.infrastructure.database.models import Permission, RefreshToken, Role, RoleName, User
from app.services.auth_service import (
    AccountInactiveError,
    AuthService,
    InvalidCredentialsError,
    TokenExpiredError,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        yield session

    await engine.dispose()


async def _create_role(db: AsyncSession, name: RoleName, permissions: list[tuple[str, str]]) -> Role:
    role = Role(name=name)
    db.add(role)
    await db.flush()

    for action, resource in permissions:
        db.add(Permission(role_id=role.id, action=action, resource=resource))

    await db.commit()
    await db.refresh(role)
    return role


async def _create_user(
    db: AsyncSession,
    email: str = "user@test.com",
    password: str = "secret123",
    role_name: RoleName = RoleName.admin,
    is_active: bool = True,
    must_change_password: bool = False,
) -> User:
    role = await _create_role(db, role_name, [("read", "vehicles"), ("manage", "users")])
    user = User(
        email=email,
        password_hash=hash_password(password),
        role_id=role.id,
        is_active=is_active,
        must_change_password=must_change_password,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_success(db_session):
    await _create_user(db_session, email="admin@test.com", password="correctpass")
    service = AuthService(db_session)

    result = await service.login("admin@test.com", "correctpass")

    assert "access_token" in result
    assert "raw_refresh_token" in result
    assert result["user"]["email"] == "admin@test.com"
    assert result["must_change_password"] is False


@pytest.mark.asyncio
async def test_login_wrong_password(db_session):
    await _create_user(db_session, email="admin@test.com", password="correctpass")
    service = AuthService(db_session)

    with pytest.raises(InvalidCredentialsError):
        await service.login("admin@test.com", "wrongpass")


@pytest.mark.asyncio
async def test_login_nonexistent_user(db_session):
    service = AuthService(db_session)

    # Should raise InvalidCredentials, NOT reveal user does not exist (SEG-07)
    with pytest.raises(InvalidCredentialsError):
        await service.login("nobody@test.com", "whatever")


@pytest.mark.asyncio
async def test_login_inactive_user(db_session):
    await _create_user(db_session, email="inactive@test.com", password="pass", is_active=False)
    service = AuthService(db_session)

    with pytest.raises(AccountInactiveError):
        await service.login("inactive@test.com", "pass")


@pytest.mark.asyncio
async def test_login_stores_refresh_token(db_session):
    user = await _create_user(db_session, email="a@test.com", password="pass123")
    service = AuthService(db_session)

    result = await service.login("a@test.com", "pass123")

    raw = result["raw_refresh_token"]
    stored = await db_session.get(RefreshToken, 1)
    assert stored is not None
    assert stored.user_id == user.id
    assert stored.revoked is False


# ---------------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_logout_revokes_token(db_session):
    user = await _create_user(db_session, email="b@test.com", password="pass123")
    service = AuthService(db_session)

    result = await service.login("b@test.com", "pass123")
    raw = result["raw_refresh_token"]

    await service.logout(raw, user.id)

    stored = await db_session.get(RefreshToken, 1)
    assert stored.revoked is True


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_refresh_returns_new_tokens(db_session):
    await _create_user(db_session, email="c@test.com", password="pass123")
    service = AuthService(db_session)

    login_result = await service.login("c@test.com", "pass123")
    old_raw = login_result["raw_refresh_token"]

    refresh_result = await service.refresh_session(old_raw)

    assert "access_token" in refresh_result
    # Token was rotated
    assert refresh_result["raw_refresh_token"] != old_raw


@pytest.mark.asyncio
async def test_refresh_with_revoked_token_fails(db_session):
    user = await _create_user(db_session, email="d@test.com", password="pass123")
    service = AuthService(db_session)

    result = await service.login("d@test.com", "pass123")
    raw = result["raw_refresh_token"]
    await service.logout(raw, user.id)

    with pytest.raises(TokenExpiredError):
        await service.refresh_session(raw)


@pytest.mark.asyncio
async def test_refresh_with_expired_token_fails(db_session):
    user = await _create_user(db_session, email="e@test.com", password="pass123")

    # Manually insert an expired refresh token
    expired = RefreshToken(
        user_id=user.id,
        token_hash=hash_refresh_token("expired_raw"),
        expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        revoked=False,
    )
    db_session.add(expired)
    await db_session.commit()

    service = AuthService(db_session)
    with pytest.raises(TokenExpiredError):
        await service.refresh_session("expired_raw")


# ---------------------------------------------------------------------------
# Change password
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_change_password_success(db_session):
    await _create_user(db_session, email="f@test.com", password="oldpass123", must_change_password=True)
    service = AuthService(db_session)

    login_result = await service.login("f@test.com", "oldpass123")
    user_id = login_result["user"]["id"]

    await service.change_password(user_id, "oldpass123", "newpass456")

    # Can now login with new password
    new_login = await service.login("f@test.com", "newpass456")
    assert new_login["must_change_password"] is False


@pytest.mark.asyncio
async def test_change_password_wrong_current(db_session):
    await _create_user(db_session, email="g@test.com", password="realpass")
    service = AuthService(db_session)
    login_result = await service.login("g@test.com", "realpass")

    with pytest.raises(InvalidCredentialsError):
        await service.change_password(login_result["user"]["id"], "wrongpass", "newone")


# ---------------------------------------------------------------------------
# Create user (Admin)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_user_success(db_session):
    admin = await _create_user(db_session, email="admin@test.com", password="adminpass")
    # Need a viewer role too
    viewer_role = Role(name=RoleName.viewer)
    db_session.add(viewer_role)
    await db_session.commit()

    service = AuthService(db_session)
    new_user = await service.create_user(
        email="newuser@test.com",
        password="pass12345",
        role_name=RoleName.viewer,
        created_by_id=admin.id,
    )

    assert new_user.email == "newuser@test.com"
    assert new_user.role.name == RoleName.viewer
    assert new_user.must_change_password is True  # RF-06


@pytest.mark.asyncio
async def test_create_duplicate_user_fails(db_session):
    from app.core.exceptions import AppException

    admin = await _create_user(db_session, email="admin@test.com", password="adminpass")
    service = AuthService(db_session)

    with pytest.raises(AppException) as exc_info:
        await service.create_user(
            email="admin@test.com",
            password="pass12345",
            role_name=RoleName.admin,
            created_by_id=admin.id,
        )

    assert exc_info.value.code == "EMAIL_ALREADY_EXISTS"


@pytest.mark.asyncio
async def test_update_user_role_and_active(db_session):
    admin = await _create_user(db_session, email="admin_up@test.com", password="adminpass")
    viewer_role = Role(name=RoleName.viewer)
    operator_role = Role(name=RoleName.operator)
    db_session.add_all([viewer_role, operator_role])
    await db_session.commit()

    service = AuthService(db_session)
    user = await service.create_user(
        email="target@test.com",
        password="pass12345",
        role_name=RoleName.viewer,
        created_by_id=admin.id,
    )

    updated = await service.update_user(
        target_user_id=user.id,
        updated_by_id=admin.id,
        is_active=False,
        role_name=RoleName.operator,
    )

    assert updated.is_active is False
    assert updated.role.name == RoleName.operator

