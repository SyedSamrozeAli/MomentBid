"""
Tests for accounts app: registration, login, /me, dashboards, permissions.
"""

from __future__ import annotations

import pytest
from decimal import Decimal
from rest_framework import status

from apps.accounts.models import Brand, Broadcaster, User
from apps.wallets.models import Deposit
from apps.bidding.models import Bid, Creative


BRAND_REGISTER_URL = "/api/auth/register/brand/"
BROADCASTER_REGISTER_URL = "/api/auth/register/broadcaster/"
LOGIN_URL = "/api/auth/login/"
ME_URL = "/api/auth/me/"
BRAND_DASHBOARD_URL = "/api/brands/me/dashboard/"
BROADCASTER_DASHBOARD_URL = "/api/broadcasters/me/dashboard/"
BRANDS_LIST_URL = "/api/brands/"
BROADCASTERS_LIST_URL = "/api/broadcasters/"


# ── Registration ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestBrandRegistration:

    def test_register_brand_success(self, api_client, mock_blockchain):
        res = api_client.post(
            BRAND_REGISTER_URL,
            {
                "brand_name": "Pepsi Pakistan",
                "username": "pepsi_user",
                "password": "SecurePass123!",
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["success"] is True
        assert "brand" in data["data"]
        assert data["data"]["brand"]["name"] == "Pepsi Pakistan"
        assert "wallet_address" in data["data"]["brand"]
        assert "tokens" in data["data"]
        assert "access" in data["data"]["tokens"]

        brand = Brand.objects.get(name="Pepsi Pakistan")
        assert brand.wallet_address != ""
        assert brand.encrypted_private_key is not None

        mock_blockchain.generate_wallet.assert_called_once()
        mock_blockchain.fund_gas.assert_called_once()

    def test_register_brand_duplicate_name(self, api_client, brand):
        res = api_client.post(
            BRAND_REGISTER_URL,
            {
                "brand_name": brand.name,
                "username": "new_user",
                "password": "SecurePass123!",
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert res.json()["success"] is False

    def test_register_brand_missing_required_fields(self, api_client):
        res = api_client.post(BRAND_REGISTER_URL, {"brand_name": "OnlyName"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_brand_duplicate_username(self, api_client, brand_user):
        res = api_client.post(
            BRAND_REGISTER_URL,
            {
                "brand_name": "Unique Brand",
                "username": brand_user.username,
                "password": "SecurePass123!",
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestBroadcasterRegistration:

    def test_register_broadcaster_success(self, api_client, mock_blockchain):
        res = api_client.post(
            BROADCASTER_REGISTER_URL,
            {
                "broadcaster_name": "PTV Sports",
                "username": "ptv_user",
                "password": "SecurePass123!",
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["success"] is True
        assert data["data"]["broadcaster"]["name"] == "PTV Sports"
        assert Broadcaster.objects.filter(name="PTV Sports").exists()
        mock_blockchain.generate_wallet.assert_called_once()
        mock_blockchain.fund_gas.assert_called_once()

    def test_register_broadcaster_duplicate_name(self, api_client, broadcaster):
        res = api_client.post(
            BROADCASTER_REGISTER_URL,
            {
                "broadcaster_name": broadcaster.name,
                "username": "new_user",
                "password": "SecurePass123!",
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_broadcaster_missing_fields(self, api_client):
        res = api_client.post(BROADCASTER_REGISTER_URL, {})
        assert res.status_code == status.HTTP_400_BAD_REQUEST


# ── Login ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestLogin:

    def test_login_brand_success(self, api_client, brand_user):
        res = api_client.post(
            LOGIN_URL,
            {
                "username": brand_user.username,
                "password": "testpass123",
            },
        )
        assert res.status_code == status.HTTP_200_OK
        data = res.json()
        assert data["success"] is True
        assert "access" in data["data"]["tokens"]
        assert "refresh" in data["data"]["tokens"]
        assert data["data"]["role"] == User.Role.BRAND_OWNER

    def test_login_broadcaster_success(self, api_client, broadcaster_user):
        res = api_client.post(
            LOGIN_URL,
            {
                "username": broadcaster_user.username,
                "password": "testpass123",
            },
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["role"] == User.Role.BROADCASTER_OWNER

    def test_login_wrong_password(self, api_client, brand_user):
        res = api_client.post(
            LOGIN_URL,
            {
                "username": brand_user.username,
                "password": "wrongpassword",
            },
        )
        assert res.status_code in (
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_401_UNAUTHORIZED,
        )
        assert res.json()["success"] is False

    def test_login_nonexistent_user(self, api_client):
        res = api_client.post(
            LOGIN_URL,
            {
                "username": "nobody",
                "password": "somepassword",
            },
        )
        assert res.status_code in (
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_401_UNAUTHORIZED,
        )

    def test_login_missing_fields(self, api_client):
        res = api_client.post(LOGIN_URL, {"username": "someone"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST


# ── /me endpoint ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCurrentUser:

    def test_me_returns_brand_user_info(self, brand_client, brand_user):
        res = brand_client.get(ME_URL)
        assert res.status_code == status.HTTP_200_OK
        data = res.json()["data"]
        assert data["username"] == brand_user.username
        assert data["role"] == User.Role.BRAND_OWNER

    def test_me_returns_broadcaster_user_info(
        self, broadcaster_client, broadcaster_user
    ):
        res = broadcaster_client.get(ME_URL)
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["role"] == User.Role.BROADCASTER_OWNER

    def test_me_requires_authentication(self, api_client):
        res = api_client.get(ME_URL)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


# ── Permission enforcement ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestPermissions:

    def test_brand_dashboard_rejects_broadcaster(self, broadcaster_client):
        res = broadcaster_client.get(BRAND_DASHBOARD_URL)
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_broadcaster_dashboard_rejects_brand(self, brand_client):
        res = brand_client.get(BROADCASTER_DASHBOARD_URL)
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_blocked_from_brand_dashboard(self, api_client):
        res = api_client.get(BRAND_DASHBOARD_URL)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_unauthenticated_blocked_from_broadcaster_dashboard(self, api_client):
        res = api_client.get(BROADCASTER_DASHBOARD_URL)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED


# ── Brand Dashboard ──────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestBrandDashboard:

    def test_dashboard_balance_zero_with_no_deposits(self, brand_client):
        res = brand_client.get(BRAND_DASHBOARD_URL)
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["balance_pkr"] == 0

    def test_dashboard_balance_reflects_confirmed_deposit(self, brand_client, deposit):
        res = brand_client.get(BRAND_DASHBOARD_URL)
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["balance_pkr"] == 500000

    def test_dashboard_balance_deducts_active_bid(
        self, brand_client, open_match, approved_creative, deposit
    ):
        Bid.objects.create(
            match=open_match,
            brand=deposit.brand,
            event_type=0,
            amount=Decimal("100000"),
            creative=approved_creative,
            tx_hash="0x" + "b" * 64,
            is_settled=False,
        )
        res = brand_client.get(BRAND_DASHBOARD_URL)
        # 500000 deposited - 100000 escrowed = 400000
        assert res.json()["data"]["balance_pkr"] == 400000

    def test_dashboard_balance_adds_back_refund(
        self, brand_client, deposit, brand, completed_match
    ):
        from apps.bidding.models import Refund

        Bid.objects.create(
            match=completed_match,
            brand=brand,
            event_type=0,
            amount=Decimal("100000"),
            creative=None,
            tx_hash="0x" + "f" * 64,
            is_settled=True,
        )
        Refund.objects.create(
            match=completed_match, brand=brand, amount=Decimal("80000")
        )
        res = brand_client.get(BRAND_DASHBOARD_URL)
        # 500000 - 100000 (settled bid) + 80000 (refund) = 480000
        assert res.json()["data"]["balance_pkr"] == 480000

    def test_dashboard_pending_deposit_not_counted(self, brand_client, brand):
        Deposit.objects.create(
            brand=brand, amount_pkr=Decimal("100000"), status="pending"
        )
        res = brand_client.get(BRAND_DASHBOARD_URL)
        assert res.json()["data"]["balance_pkr"] == 0


# ── Organisation listing ─────────────────────────────────────────────────────


@pytest.mark.django_db
class TestOrganisationLists:

    def test_brands_list_is_public(self, api_client, brand):
        res = api_client.get(BRANDS_LIST_URL)
        assert res.status_code == status.HTTP_200_OK
        names = [b["name"] for b in res.json()["data"]]
        assert brand.name in names

    def test_broadcasters_list_is_public(self, api_client, broadcaster):
        res = api_client.get(BROADCASTERS_LIST_URL)
        assert res.status_code == status.HTTP_200_OK
        names = [b["name"] for b in res.json()["data"]]
        assert broadcaster.name in names
