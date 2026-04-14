"""
Project-wide pytest fixtures and configuration.
Run tests with:  cd backend && pytest project/ -v
"""
from __future__ import annotations

import pytest
from decimal import Decimal
from unittest.mock import MagicMock, patch

from django.test import override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Brand, Broadcaster, User
from apps.bidding.models import AuctionResult, Bid, Creative, Refund
from apps.matches.models import Match, MatchEventConfig, ExclusionGroup, ExclusionGroupMember
from apps.wallets.models import Deposit, Transaction


# ── Blockchain mock ─────────────────────────────────────────────────────────


def make_tx(success: bool = True, tx_hash: str = "0x" + "a" * 64, data: dict | None = None, error: str = "") -> MagicMock:
    """Build a TxResult-like mock object."""
    tx = MagicMock()
    tx.success = success
    tx.tx_hash = tx_hash
    tx.gas_used = 21000
    tx.data = data or {}
    tx.error = error
    return tx


@pytest.fixture(autouse=True)
def mock_blockchain(settings):
    """
    Patch get_blockchain_service globally for all tests.
    Returns a mock blockchain service — no real chain calls.
    """
    settings.USE_MOCK_BLOCKCHAIN = True

    service = MagicMock()
    service.generate_wallet.return_value = (
        "0xBrandWallet0000000000000000000000000001",
        "0x" + "b" * 64,
    )
    service.fund_gas.return_value = make_tx()
    service.mint_tokens.return_value = make_tx()
    service.approve_tokens.return_value = make_tx()
    service.create_match.return_value = make_tx(data={"match_id": 1})
    service.configure_event.return_value = make_tx()
    service.transition_state.return_value = make_tx()
    service.place_bid.return_value = make_tx()
    service.increase_bid.return_value = make_tx()
    service.set_budget_cap.return_value = make_tx()
    service.trigger_event.return_value = make_tx(data={"match_id": 1, "event_type": 0})
    service.claim_refund.return_value = make_tx(data={"refund_amount": 250000})
    service.create_exclusion_group.return_value = make_tx()
    service.get_mbt_balance.return_value = 500000
    service.grant_brand_role = MagicMock(return_value=make_tx())
    service.grant_broadcaster_role = MagicMock(return_value=make_tx())

    with patch("apps.blockchain.get_blockchain_service", return_value=service), \
         patch("apps.accounts.views.get_blockchain_service", return_value=service), \
         patch("apps.wallets.views.get_blockchain_service", return_value=service), \
         patch("apps.matches.views.get_blockchain_service", return_value=service), \
         patch("apps.bidding.views.get_blockchain_service", return_value=service):
        yield service


# ── WebSocket push mock ─────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def mock_push():
    """Suppress WebSocket push calls — no Redis/RabbitMQ needed in tests."""
    with patch("apps.indexer.push.push_match_event"):
        yield


# ── API Client ──────────────────────────────────────────────────────────────


@pytest.fixture
def api_client():
    return APIClient()


def _auth_client(user: User) -> APIClient:
    """Return authenticated APIClient for given user (JWT)."""
    from rest_framework_simplejwt.tokens import RefreshToken
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")
    return client


# ── Organisation / User factories ───────────────────────────────────────────


@pytest.fixture
def brand(db) -> Brand:
    b = Brand.objects.create(name="TestBrand", wallet_address="0x" + "1" * 40)
    b.encrypt_private_key("0x" + "c" * 64)
    b.save()
    return b


@pytest.fixture
def brand2(db) -> Brand:
    b = Brand.objects.create(name="TestBrand2", wallet_address="0x" + "2" * 40)
    b.encrypt_private_key("0x" + "d" * 64)
    b.save()
    return b


@pytest.fixture
def broadcaster(db) -> Broadcaster:
    b = Broadcaster.objects.create(name="TestBroadcaster", wallet_address="0x" + "3" * 40)
    b.encrypt_private_key("0x" + "e" * 64)
    b.save()
    return b


@pytest.fixture
def brand_user(db, brand) -> User:
    return User.objects.create_user(
        username="brand_user", password="testpass123", role=User.Role.BRAND_OWNER, brand=brand
    )


@pytest.fixture
def brand_user2(db, brand2) -> User:
    return User.objects.create_user(
        username="brand_user2", password="testpass123", role=User.Role.BRAND_OWNER, brand=brand2
    )


@pytest.fixture
def broadcaster_user(db, broadcaster) -> User:
    return User.objects.create_user(
        username="broadcaster_user", password="testpass123",
        role=User.Role.BROADCASTER_OWNER, broadcaster=broadcaster,
    )


@pytest.fixture
def admin_user(db) -> User:
    return User.objects.create_user(
        username="admin_user", password="testpass123", role=User.Role.ADMIN,
    )


# ── Auth clients ─────────────────────────────────────────────────────────────


@pytest.fixture
def brand_client(brand_user) -> APIClient:
    return _auth_client(brand_user)


@pytest.fixture
def brand_client2(brand_user2) -> APIClient:
    return _auth_client(brand_user2)


@pytest.fixture
def broadcaster_client(broadcaster_user) -> APIClient:
    return _auth_client(broadcaster_user)


@pytest.fixture
def admin_client(admin_user) -> APIClient:
    return _auth_client(admin_user)


# ── Domain object factories ──────────────────────────────────────────────────


@pytest.fixture
def deposit(db, brand) -> Deposit:
    return Deposit.objects.create(
        brand=brand, amount_pkr=Decimal("500000"), status="confirmed", tx_hash="0x" + "d" * 64
    )


@pytest.fixture
def match(db, broadcaster) -> Match:
    return Match.objects.create(
        broadcaster=broadcaster,
        team_a="Lahore Qalandars",
        team_b="Karachi Kings",
        venue="Gaddafi Stadium",
        match_date="2026-05-01",
        match_time="19:00:00",
        on_chain_match_id=1,
        state=Match.State.CREATED,
    )


@pytest.fixture
def event_config(db, match) -> MatchEventConfig:
    return MatchEventConfig.objects.create(
        match=match,
        event_type=MatchEventConfig.EventType.OVER_BREAK,
        reserve_price=Decimal("50000"),
        reservation_fee_pct=Decimal("5.00"),
        slot_count=3,
        max_triggers=40,
    )


@pytest.fixture
def open_match(db, match, event_config) -> Match:
    """Match in OPEN state with one OVER_BREAK event config."""
    match.state = Match.State.OPEN
    match.save()
    return match


@pytest.fixture
def active_match(db, match, event_config) -> Match:
    match.state = Match.State.ACTIVE
    match.save()
    return match


@pytest.fixture
def completed_match(db, match, event_config) -> Match:
    match.state = Match.State.COMPLETED
    match.save()
    return match


@pytest.fixture
def approved_creative(db, brand) -> Creative:
    return Creative.objects.create(
        brand=brand,
        title="Test Ad",
        ad_url="https://cdn.example.com/ad.mp4",
        status=Creative.Status.APPROVED,
    )


@pytest.fixture
def pending_creative(db, brand) -> Creative:
    return Creative.objects.create(
        brand=brand,
        title="Pending Ad",
        ad_url="https://cdn.example.com/pending.mp4",
        status=Creative.Status.PENDING,
    )


@pytest.fixture
def placed_bid(db, open_match, brand, approved_creative, deposit) -> Bid:
    """Brand has 500k deposited and one bid placed (100k) on OVER_BREAK."""
    return Bid.objects.create(
        match=open_match,
        brand=brand,
        event_type=MatchEventConfig.EventType.OVER_BREAK,
        amount=Decimal("100000"),
        creative=approved_creative,
        tx_hash="0x" + "f" * 64,
    )
