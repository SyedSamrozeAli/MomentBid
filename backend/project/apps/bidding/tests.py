"""
Tests for bidding app: creatives, bids, leaderboard, increase, refunds.
Also contains the end-to-end integration test for the full demo flow.
"""
from __future__ import annotations

import pytest
from decimal import Decimal
from rest_framework import status
from unittest.mock import MagicMock

from apps.bidding.models import Bid, Creative, AuctionResult, Refund
from apps.matches.models import Match, MatchEventConfig
from apps.wallets.models import Deposit


CREATIVES_URL = "/api/creatives/"
BALANCE_URL = "/api/balance/"


def creative_url(cid):
    return f"/api/creatives/{cid}/"

def bids_url(match_id):
    return f"/api/matches/{match_id}/bids/"

def bids_all_url(match_id):
    return f"/api/matches/{match_id}/bids/all/"

def leaderboard_url(match_id):
    return f"/api/matches/{match_id}/bids/leaderboard/"

def bid_increase_url(match_id, bid_id):
    return f"/api/matches/{match_id}/bids/{bid_id}/increase/"

def budget_cap_url(match_id):
    return f"/api/matches/{match_id}/budget-cap/"

def refund_claim_url(match_id):
    return f"/api/matches/{match_id}/refunds/claim/"

def refunds_url(match_id):
    return f"/api/matches/{match_id}/refunds/"


# ── Creatives ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCreativeUpload:

    def test_brand_can_upload_creative(self, brand_client):
        res = brand_client.post(CREATIVES_URL, {
            "title": "Pepsi Ad 30s",
            "ad_url": "https://cdn.example.com/pepsi_30s.mp4",
            "description": "Summer campaign",
        })
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["success"] is True
        assert data["data"]["status"] == Creative.Status.PENDING
        assert data["data"]["title"] == "Pepsi Ad 30s"
        assert Creative.objects.filter(title="Pepsi Ad 30s").exists()

    def test_creative_starts_as_pending(self, brand_client):
        brand_client.post(CREATIVES_URL, {
            "title": "New Ad",
            "ad_url": "https://cdn.example.com/ad.mp4",
        })
        creative = Creative.objects.get(title="New Ad")
        assert creative.status == Creative.Status.PENDING

    def test_creative_requires_title(self, brand_client):
        res = brand_client.post(CREATIVES_URL, {"ad_url": "https://cdn.example.com/ad.mp4"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_creative_requires_valid_url(self, brand_client):
        res = brand_client.post(CREATIVES_URL, {
            "title": "Bad Ad",
            "ad_url": "not-a-url",
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_creative_requires_brand_user(self, broadcaster_client):
        res = broadcaster_client.post(CREATIVES_URL, {
            "title": "Broadcaster Ad",
            "ad_url": "https://cdn.example.com/ad.mp4",
        })
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_brand_sees_only_own_creatives(self, brand_client, approved_creative, brand2):
        other_creative = Creative.objects.create(
            brand=brand2, title="Other Brand Ad",
            ad_url="https://cdn.example.com/other.mp4",
        )
        res = brand_client.get(CREATIVES_URL)
        assert res.status_code == status.HTTP_200_OK
        ids = [c["id"] for c in res.json()["data"]]
        assert approved_creative.id in ids
        assert other_creative.id not in ids

    def test_creative_list_filter_by_status(self, brand_client, approved_creative, pending_creative):
        res = brand_client.get(CREATIVES_URL + "?status=approved")
        ids = [c["id"] for c in res.json()["data"]]
        assert approved_creative.id in ids
        assert pending_creative.id not in ids

    def test_creative_list_search_by_title(self, brand_client, approved_creative):
        res = brand_client.get(CREATIVES_URL + f"?search={approved_creative.title[:4]}")
        assert res.status_code == status.HTTP_200_OK
        ids = [c["id"] for c in res.json()["data"]]
        assert approved_creative.id in ids

    def test_creative_detail_returns_own(self, brand_client, approved_creative):
        res = brand_client.get(creative_url(approved_creative.id))
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["id"] == approved_creative.id

    def test_creative_detail_404_for_other_brand(self, brand_client, brand2):
        other = Creative.objects.create(
            brand=brand2, title="Other",
            ad_url="https://cdn.example.com/other.mp4",
        )
        res = brand_client.get(creative_url(other.id))
        assert res.status_code == status.HTTP_404_NOT_FOUND


# ── Bid Placement ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestBidPlacement:

    def test_brand_can_place_bid(
        self, brand_client, open_match, approved_creative, deposit, mock_blockchain
    ):
        res = brand_client.post(bids_url(open_match.id), {
            "event_type": 0,
            "amount": "100000",
            "creative_id": approved_creative.id,
        })
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["success"] is True
        assert data["data"]["amount"] == "100000.00"
        assert data["data"]["event_type"] == 0
        assert Bid.objects.filter(match=open_match).exists()
        mock_blockchain.approve_tokens.assert_called_once()
        mock_blockchain.place_bid.assert_called_once()

    def test_bid_below_reserve_price_rejected(
        self, brand_client, open_match, approved_creative, deposit
    ):
        # event_config has reserve_price=50000
        res = brand_client.post(bids_url(open_match.id), {
            "event_type": 0,
            "amount": "1000",  # below 50000
            "creative_id": approved_creative.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "reserve" in res.json()["message"].lower()

    def test_bid_without_event_config_rejected(
        self, brand_client, open_match, approved_creative, deposit
    ):
        res = brand_client.post(bids_url(open_match.id), {
            "event_type": 7,  # SUPER_OVER — not configured
            "amount": "100000",
            "creative_id": approved_creative.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_pending_creative_cannot_be_used(
        self, brand_client, open_match, pending_creative, deposit
    ):
        res = brand_client.post(bids_url(open_match.id), {
            "event_type": 0,
            "amount": "100000",
            "creative_id": pending_creative.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "approved" in res.json()["message"].lower()

    def test_other_brand_creative_rejected(
        self, brand_client, open_match, brand2, deposit
    ):
        other_creative = Creative.objects.create(
            brand=brand2, title="Other Ad",
            ad_url="https://cdn.example.com/ad.mp4",
            status=Creative.Status.APPROVED,
        )
        res = brand_client.post(bids_url(open_match.id), {
            "event_type": 0,
            "amount": "100000",
            "creative_id": other_creative.id,
        })
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_duplicate_bid_on_same_event_rejected(
        self, brand_client, placed_bid, approved_creative, deposit
    ):
        res = brand_client.post(bids_url(placed_bid.match.id), {
            "event_type": placed_bid.event_type,
            "amount": "200000",
            "creative_id": approved_creative.id,
        })
        assert res.status_code == status.HTTP_409_CONFLICT

    def test_insufficient_balance_rejected(
        self, brand_client, open_match, approved_creative
    ):
        # No deposit — balance is 0
        res = brand_client.post(bids_url(open_match.id), {
            "event_type": 0,
            "amount": "100000",
            "creative_id": approved_creative.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert "insufficient" in res.json()["message"].lower()

    def test_bid_on_non_open_match_rejected(
        self, brand_client, match, approved_creative, deposit
    ):
        # match is CREATED, not OPEN
        res = brand_client.post(bids_url(match.id), {
            "event_type": 0,
            "amount": "100000",
            "creative_id": approved_creative.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_broadcaster_cannot_place_bid(self, broadcaster_client, open_match, event_config):
        res = broadcaster_client.post(bids_url(open_match.id), {
            "event_type": 0, "amount": "100000", "creative_id": 1,
        })
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_bid_deducts_from_balance(
        self, brand_client, open_match, approved_creative, deposit, mock_blockchain
    ):
        brand_client.post(bids_url(open_match.id), {
            "event_type": 0,
            "amount": "100000",
            "creative_id": approved_creative.id,
        })
        res = brand_client.get(BALANCE_URL)
        assert res.json()["data"]["balance_pkr"] == 400000  # 500000 - 100000

    def test_bid_blockchain_failure_does_not_create_db_record(
        self, brand_client, open_match, approved_creative, deposit, mock_blockchain
    ):
        fail_tx = MagicMock()
        fail_tx.success = False
        fail_tx.error = "Chain reverted"
        mock_blockchain.place_bid.return_value = fail_tx

        res = brand_client.post(bids_url(open_match.id), {
            "event_type": 0,
            "amount": "100000",
            "creative_id": approved_creative.id,
        })
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert not Bid.objects.filter(match=open_match).exists()


# ── Bid listing & leaderboard ─────────────────────────────────────────────────


@pytest.mark.django_db
class TestBidListing:

    def test_bid_list_returns_all_bids(self, brand_client, placed_bid):
        res = brand_client.get(bids_url(placed_bid.match.id))
        assert res.status_code == status.HTTP_200_OK
        assert len(res.json()["data"]) >= 1

    def test_bids_all_with_event_type_filter(self, brand_client, placed_bid):
        res = brand_client.get(bids_all_url(placed_bid.match.id) + "?event_type=0")
        assert res.status_code == status.HTTP_200_OK
        bids = res.json()["data"]
        assert all(b["event_type_label"] is not None for b in bids)

    def test_bids_all_ordered_by_amount_desc(self, brand_client, open_match, brand, brand2, approved_creative, deposit):
        Deposit.objects.create(brand=brand2, amount_pkr=Decimal("500000"), status="confirmed")
        other_creative = Creative.objects.create(
            brand=brand2, title="Ad2", ad_url="https://cdn.example.com/ad2.mp4",
            status=Creative.Status.APPROVED,
        )
        Bid.objects.create(
            match=open_match, brand=brand, event_type=0,
            amount=Decimal("100000"), creative=approved_creative, tx_hash="0x" + "a" * 64,
        )
        Bid.objects.create(
            match=open_match, brand=brand2, event_type=0,
            amount=Decimal("300000"), creative=other_creative, tx_hash="0x" + "b" * 64,
        )
        res = brand_client.get(bids_all_url(open_match.id) + "?ordering=-amount")
        amounts = [Decimal(b["amount"]) for b in res.json()["data"]]
        assert amounts == sorted(amounts, reverse=True)

    def test_leaderboard_groups_by_event_type(self, brand_client, open_match, brand, brand2, approved_creative, deposit):
        Deposit.objects.create(brand=brand2, amount_pkr=Decimal("500000"), status="confirmed")
        other_creative = Creative.objects.create(
            brand=brand2, title="Ad2", ad_url="https://cdn.example.com/ad2.mp4",
            status=Creative.Status.APPROVED,
        )
        Bid.objects.create(
            match=open_match, brand=brand, event_type=0,
            amount=Decimal("100000"), creative=approved_creative, tx_hash="0x" + "a" * 64,
        )
        Bid.objects.create(
            match=open_match, brand=brand2, event_type=0,
            amount=Decimal("200000"), creative=other_creative, tx_hash="0x" + "b" * 64,
        )
        res = brand_client.get(leaderboard_url(open_match.id))
        assert res.status_code == status.HTTP_200_OK
        groups = res.json()["data"]
        assert len(groups) >= 1
        over_break = next(g for g in groups if g["event_type"] == 0)
        assert over_break["total_escrowed"] == 300000
        # Bids ordered highest first
        amounts = [Decimal(b["amount"]) for b in over_break["bids"]]
        assert amounts == sorted(amounts, reverse=True)

    def test_leaderboard_filter_by_event_type(self, brand_client, placed_bid):
        res = brand_client.get(leaderboard_url(placed_bid.match.id) + "?event_type=0")
        assert res.status_code == status.HTTP_200_OK
        for group in res.json()["data"]:
            assert group["event_type"] == 0


# ── Bid increase ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestBidIncrease:

    def test_brand_can_increase_bid(self, brand_client, placed_bid, mock_blockchain):
        original_amount = placed_bid.amount
        res = brand_client.patch(
            bid_increase_url(placed_bid.match.id, placed_bid.id),
            {"additional_amount": "50000"},
        )
        assert res.status_code == status.HTTP_200_OK
        placed_bid.refresh_from_db()
        assert placed_bid.amount == original_amount + Decimal("50000")
        mock_blockchain.approve_tokens.assert_called_once()
        mock_blockchain.increase_bid.assert_called_once()

    def test_cannot_increase_zero_amount(self, brand_client, placed_bid):
        res = brand_client.patch(
            bid_increase_url(placed_bid.match.id, placed_bid.id),
            {"additional_amount": "0"},
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_increase_other_brands_bid(
        self, brand_client2, placed_bid
    ):
        res = brand_client2.patch(
            bid_increase_url(placed_bid.match.id, placed_bid.id),
            {"additional_amount": "50000"},
        )
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_increase_blockchain_failure_does_not_change_amount(
        self, brand_client, placed_bid, mock_blockchain
    ):
        fail_tx = MagicMock()
        fail_tx.success = False
        fail_tx.error = "Tx failed"
        mock_blockchain.increase_bid.return_value = fail_tx

        original = placed_bid.amount
        res = brand_client.patch(
            bid_increase_url(placed_bid.match.id, placed_bid.id),
            {"additional_amount": "50000"},
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        placed_bid.refresh_from_db()
        assert placed_bid.amount == original


# ── Budget cap ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestBudgetCap:

    def test_brand_can_set_budget_cap(self, brand_client, open_match, mock_blockchain):
        res = brand_client.post(budget_cap_url(open_match.id), {"cap": "500000"})
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["cap"] == "500000"
        mock_blockchain.set_budget_cap.assert_called_once()

    def test_zero_cap_rejected(self, brand_client, open_match):
        res = brand_client.post(budget_cap_url(open_match.id), {"cap": "0"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_broadcaster_cannot_set_budget_cap(self, broadcaster_client, open_match):
        res = broadcaster_client.post(budget_cap_url(open_match.id), {"cap": "500000"})
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ── Refunds ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestRefundClaim:

    def test_brand_can_claim_refund_on_completed_match(
        self, brand_client, completed_match, placed_bid, mock_blockchain
    ):
        placed_bid.match = completed_match
        placed_bid.save()

        res = brand_client.post(refund_claim_url(completed_match.id))
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["success"] is True
        assert Refund.objects.filter(match=completed_match).exists()
        mock_blockchain.claim_refund.assert_called_once()

    def test_refund_on_cancelled_match(
        self, brand_client, brand, broadcaster, mock_blockchain
    ):
        cancelled_match = Match.objects.create(
            broadcaster=broadcaster, team_a="A", team_b="B",
            venue="V", match_date="2026-05-10", match_time="19:00:00",
            on_chain_match_id=99, state=Match.State.CANCELLED,
        )
        res = brand_client.post(refund_claim_url(cancelled_match.id))
        assert res.status_code == status.HTTP_201_CREATED

    def test_cannot_double_claim_refund(
        self, brand_client, completed_match, placed_bid, brand, mock_blockchain
    ):
        placed_bid.match = completed_match
        placed_bid.save()
        Refund.objects.create(match=completed_match, brand=brand, amount=Decimal("100000"))

        res = brand_client.post(refund_claim_url(completed_match.id))
        assert res.status_code == status.HTTP_409_CONFLICT

    def test_cannot_claim_refund_on_active_match(
        self, brand_client, active_match
    ):
        res = brand_client.post(refund_claim_url(active_match.id))
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_claim_refund_on_open_match(self, brand_client, open_match):
        res = brand_client.post(refund_claim_url(open_match.id))
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_refund_list_shows_brand_refunds(self, brand_client, completed_match, brand):
        Refund.objects.create(match=completed_match, brand=brand, amount=Decimal("80000"))
        res = brand_client.get(refunds_url(completed_match.id))
        assert res.status_code == status.HTTP_200_OK
        assert len(res.json()["data"]) == 1
        assert res.json()["data"][0]["amount"] == "80000.00"

    def test_refund_list_does_not_show_other_brand_refunds(
        self, brand_client, completed_match, brand2
    ):
        Refund.objects.create(match=completed_match, brand=brand2, amount=Decimal("80000"))
        res = brand_client.get(refunds_url(completed_match.id))
        # brand_user's brand has no refund
        assert res.json()["data"] == [] or all(
            r.get("brand") != brand2.name for r in res.json()["data"]
        )

    def test_broadcaster_cannot_claim_refund(self, broadcaster_client, completed_match):
        res = broadcaster_client.post(refund_claim_url(completed_match.id))
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ── End-to-End Integration Test ───────────────────────────────────────────────


@pytest.mark.django_db
class TestFullDemoFlow:
    """
    Simulates the complete PSL Hackathon demo from setup to settlement.

    Flow:
    1.  Register broadcaster + 2 brands
    2.  Broadcaster creates match
    3.  Broadcaster configures OVER_BREAK event (reserve=50000, fee=5%, slots=3)
    4.  Broadcaster opens bidding
    5.  Brand A deposits 500,000 PKR
    6.  Brand A uploads + gets approved creative
    7.  Brand A places bid: 300,000 on OVER_BREAK
    8.  Brand B deposits 500,000 PKR
    9.  Brand B uploads + gets approved creative
    10. Brand B places bid: 400,000 on OVER_BREAK
    11. Admin starts match (OPEN → ACTIVE)
    12. Admin triggers OVER_BREAK (simulates event)
    13. Admin completes match
    14. Brand A claims refund (lost bidder — event triggered, didn't win)
    15. Brand B claims refund (won — no refund expected)
    """

    def test_complete_psl_demo_flow(
        self, api_client, mock_blockchain, broadcaster_client, admin_client,
        broadcaster, brand, brand2
    ):
        # ── Setup wallets ──────────────────────────────────────────────────
        mock_blockchain.generate_wallet.side_effect = [
            ("0x" + "a" * 40, "0x" + "a" * 64),
            ("0x" + "b" * 40, "0x" + "b" * 64),
        ]

        # ── Step 1: Create match ───────────────────────────────────────────
        mock_blockchain.create_match.return_value = MagicMock(
            success=True, tx_hash="0x" + "1" * 64, gas_used=100000,
            data={"match_id": 42}
        )
        res = broadcaster_client.post("/api/matches/", {
            "team_a": "Lahore Qalandars",
            "team_b": "Karachi Kings",
            "venue": "Gaddafi Stadium",
            "match_date": "2026-05-20",
            "match_time": "19:00:00",
        })
        assert res.status_code == status.HTTP_201_CREATED
        match_id = res.json()["data"]["id"]

        # ── Step 2: Configure event ────────────────────────────────────────
        res = broadcaster_client.post(f"/api/matches/{match_id}/event-configs/", {
            "event_type": 0,
            "reserve_price": "50000",
            "reservation_fee_pct": "5",
            "slot_count": 3,
            "max_triggers": 40,
        })
        assert res.status_code == status.HTTP_201_CREATED

        # ── Step 3: Open bidding ───────────────────────────────────────────
        res = broadcaster_client.post(f"/api/matches/{match_id}/open-bidding/")
        assert res.status_code == status.HTTP_200_OK
        assert Match.objects.get(pk=match_id).state == Match.State.OPEN

        # ── Step 4: Brand A deposit ────────────────────────────────────────
        from rest_framework_simplejwt.tokens import RefreshToken
        from rest_framework.test import APIClient

        brand_a_client = APIClient()
        brand_a_user = brand.users.first()
        if brand_a_user:
            refresh = RefreshToken.for_user(brand_a_user)
            brand_a_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")

            Deposit.objects.create(brand=brand, amount_pkr=Decimal("500000"), status="confirmed")

            # ── Step 5: Brand A upload creative ───────────────────────────
            creative_a = Creative.objects.create(
                brand=brand, title="Pepsi Summer Ad",
                ad_url="https://cdn.example.com/pepsi.mp4",
                status=Creative.Status.APPROVED,
            )

            # ── Step 6: Brand A place bid ──────────────────────────────────
            res = brand_a_client.post(f"/api/matches/{match_id}/bids/", {
                "event_type": 0,
                "amount": "300000",
                "creative_id": creative_a.id,
            })
            assert res.status_code == status.HTTP_201_CREATED
            bid_a_id = res.json()["data"]["id"]

        # ── Step 7: Brand B deposit + bid ─────────────────────────────────
        Deposit.objects.create(brand=brand2, amount_pkr=Decimal("500000"), status="confirmed")
        creative_b = Creative.objects.create(
            brand=brand2, title="KFC Hot Deal Ad",
            ad_url="https://cdn.example.com/kfc.mp4",
            status=Creative.Status.APPROVED,
        )
        brand_b_user = brand2.users.first()
        if brand_b_user:
            brand_b_client = APIClient()
            refresh = RefreshToken.for_user(brand_b_user)
            brand_b_client.credentials(HTTP_AUTHORIZATION=f"Bearer {str(refresh.access_token)}")

            res = brand_b_client.post(f"/api/matches/{match_id}/bids/", {
                "event_type": 0,
                "amount": "400000",
                "creative_id": creative_b.id,
            })
            assert res.status_code == status.HTTP_201_CREATED

        # ── Step 8: Admin starts match ─────────────────────────────────────
        res = admin_client.post(f"/api/simulator/{match_id}/start/")
        assert res.status_code == status.HTTP_200_OK
        assert Match.objects.get(pk=match_id).state == Match.State.ACTIVE

        # ── Step 9: Admin triggers event ───────────────────────────────────
        res = admin_client.post(f"/api/simulator/{match_id}/trigger-event/", {"event_type": 0})
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["trigger_number"] == 1

        # ── Step 10: Admin completes match ─────────────────────────────────
        res = admin_client.post(f"/api/simulator/{match_id}/complete/")
        assert res.status_code == status.HTTP_200_OK
        assert Match.objects.get(pk=match_id).state == Match.State.COMPLETED

        # ── Step 11: Brands claim refunds ──────────────────────────────────
        mock_blockchain.claim_refund.return_value = MagicMock(
            success=True, tx_hash="0x" + "r" * 64, gas_used=50000,
            data={"refund_amount": 300000}
        )
        if brand.users.first():
            res = brand_a_client.post(f"/api/matches/{match_id}/refunds/claim/")
            assert res.status_code == status.HTTP_201_CREATED
            refund = Refund.objects.get(match_id=match_id, brand=brand)
            assert refund.amount > 0

        # ── Step 12: Verify auction results visible ─────────────────────────
        res = api_client.get(f"/api/matches/{match_id}/auction-results/")
        assert res.status_code == status.HTTP_200_OK

        # ── Summary: all core flows completed without errors ────────────────
        assert Match.objects.get(pk=match_id).state == Match.State.COMPLETED
        assert MatchEventConfig.objects.get(
            match_id=match_id, event_type=0
        ).trigger_count == 1
