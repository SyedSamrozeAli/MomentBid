"""
Tests for wallets app: deposits, balance calculation.
"""
from __future__ import annotations

import pytest
from decimal import Decimal
from rest_framework import status

from apps.wallets.models import Deposit, Transaction
from apps.bidding.models import Bid, Refund


DEPOSITS_URL = "/api/deposits/"
BALANCE_URL = "/api/balance/"


# ── Deposits ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestDeposits:

    def test_create_deposit_success(self, brand_client, mock_blockchain):
        res = brand_client.post(DEPOSITS_URL, {"amount": "100000"})
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["success"] is True
        assert Deposit.objects.filter(amount_pkr=Decimal("100000")).exists()
        mock_blockchain.mint_tokens.assert_called_once()

    def test_deposit_creates_confirmed_record(self, brand_client, mock_blockchain):
        brand_client.post(DEPOSITS_URL, {"amount": "200000"})
        dep = Deposit.objects.get(amount_pkr=Decimal("200000"))
        assert dep.status == "confirmed"
        assert dep.tx_hash != ""

    def test_deposit_creates_transaction_log(self, brand_client, mock_blockchain, brand_user):
        brand_client.post(DEPOSITS_URL, {"amount": "50000"})
        assert Transaction.objects.filter(action="mint_tokens").exists()

    def test_deposit_zero_amount_rejected(self, brand_client):
        res = brand_client.post(DEPOSITS_URL, {"amount": "0"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_deposit_negative_amount_rejected(self, brand_client):
        res = brand_client.post(DEPOSITS_URL, {"amount": "-1000"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_deposit_missing_amount_rejected(self, brand_client):
        res = brand_client.post(DEPOSITS_URL, {})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_deposit_requires_brand_user(self, broadcaster_client):
        res = broadcaster_client.post(DEPOSITS_URL, {"amount": "100000"})
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_deposit_requires_authentication(self, api_client):
        res = api_client.post(DEPOSITS_URL, {"amount": "100000"})
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_deposit_blockchain_failure_does_not_create_confirmed(
        self, brand_client, mock_blockchain
    ):
        from unittest.mock import MagicMock
        fail_tx = MagicMock()
        fail_tx.success = False
        fail_tx.tx_hash = ""
        fail_tx.error = "RPC failure"
        mock_blockchain.mint_tokens.return_value = fail_tx

        res = brand_client.post(DEPOSITS_URL, {"amount": "100000"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        # No confirmed deposit created
        assert not Deposit.objects.filter(status="confirmed").exists()

    def test_list_deposits_returns_own_deposits(self, brand_client, deposit, brand2):
        # Other brand's deposit — should not appear
        Deposit.objects.create(brand=brand2, amount_pkr=Decimal("999"), status="confirmed")
        res = brand_client.get(DEPOSITS_URL)
        assert res.status_code == status.HTTP_200_OK
        amounts = [d["amount_pkr"] for d in res.json()["data"]]
        assert "500000.00" in amounts or "500000" in str(amounts)
        assert "999.00" not in str(amounts)

    def test_list_deposits_sorted_newest_first(self, brand_client, brand):
        Deposit.objects.create(brand=brand, amount_pkr=Decimal("1000"), status="confirmed")
        Deposit.objects.create(brand=brand, amount_pkr=Decimal("2000"), status="confirmed")
        res = brand_client.get(DEPOSITS_URL)
        amounts = [d["amount_pkr"] for d in res.json()["data"]]
        assert amounts[0] in ("2000.00", "2000")


# ── Balance ───────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestBalance:

    def test_balance_zero_no_deposits(self, brand_client):
        res = brand_client.get(BALANCE_URL)
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"]["balance_pkr"] == 0

    def test_balance_equals_confirmed_deposits(self, brand_client, deposit):
        res = brand_client.get(BALANCE_URL)
        assert res.json()["data"]["balance_pkr"] == 500000

    def test_balance_deducts_unsettled_bid(self, brand_client, deposit, open_match, approved_creative, brand):
        Bid.objects.create(
            match=open_match, brand=brand, event_type=0,
            amount=Decimal("200000"), creative=approved_creative,
            tx_hash="0x" + "a" * 64, is_settled=False,
        )
        res = brand_client.get(BALANCE_URL)
        assert res.json()["data"]["balance_pkr"] == 300000

    def test_balance_deducts_settled_bid(self, brand_client, deposit, open_match, approved_creative, brand):
        Bid.objects.create(
            match=open_match, brand=brand, event_type=0,
            amount=Decimal("150000"), creative=approved_creative,
            tx_hash="0x" + "a" * 64, is_settled=True,
        )
        res = brand_client.get(BALANCE_URL)
        assert res.json()["data"]["balance_pkr"] == 350000

    def test_balance_adds_refund(self, brand_client, deposit, brand, completed_match):
        Bid.objects.create(
            match=completed_match, brand=brand, event_type=0,
            amount=Decimal("100000"), creative=None,
            tx_hash="0x" + "a" * 64, is_settled=True,
        )
        Refund.objects.create(match=completed_match, brand=brand, amount=Decimal("95000"))
        res = brand_client.get(BALANCE_URL)
        # 500000 - 100000 + 95000 = 495000
        assert res.json()["data"]["balance_pkr"] == 495000

    def test_balance_pending_deposit_not_counted(self, brand_client, brand):
        Deposit.objects.create(brand=brand, amount_pkr=Decimal("100000"), status="pending")
        res = brand_client.get(BALANCE_URL)
        assert res.json()["data"]["balance_pkr"] == 0

    def test_balance_requires_brand_user(self, broadcaster_client):
        res = broadcaster_client.get(BALANCE_URL)
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_balance_requires_authentication(self, api_client):
        res = api_client.get(BALANCE_URL)
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_balance_multiple_deposits_summed(self, brand_client, brand):
        Deposit.objects.create(brand=brand, amount_pkr=Decimal("100000"), status="confirmed")
        Deposit.objects.create(brand=brand, amount_pkr=Decimal("250000"), status="confirmed")
        Deposit.objects.create(brand=brand, amount_pkr=Decimal("150000"), status="confirmed")
        res = brand_client.get(BALANCE_URL)
        assert res.json()["data"]["balance_pkr"] == 500000
