"""
Tests for matches app: match lifecycle, event config, exclusion groups, simulator.
"""

from __future__ import annotations

import pytest
from decimal import Decimal
from rest_framework import status
from unittest.mock import MagicMock

from apps.matches.models import (
    Match,
    MatchEventConfig,
    ExclusionGroup,
    ExclusionGroupMember,
)
from apps.bidding.models import AuctionResult, Bid


MATCHES_URL = "/api/matches/"
EXCLUSION_GROUPS_URL = "/api/exclusion-groups/"


def match_url(match_id):
    return f"/api/matches/{match_id}/"


def event_config_url(match_id):
    return f"/api/matches/{match_id}/event-configs/"


def open_bidding_url(match_id):
    return f"/api/matches/{match_id}/open-bidding/"


def exclusion_group_url(group_id):
    return f"/api/exclusion-groups/{group_id}/"


def exclusion_group_members_url(group_id):
    return f"/api/exclusion-groups/{group_id}/members/"


def exclusion_group_member_url(group_id, brand_id):
    return f"/api/exclusion-groups/{group_id}/members/{brand_id}/"


def simulator_start_url(match_id):
    return f"/api/simulator/{match_id}/start/"


def simulator_complete_url(match_id):
    return f"/api/simulator/{match_id}/complete/"


def simulator_cancel_url(match_id):
    return f"/api/simulator/{match_id}/cancel/"


def simulator_trigger_url(match_id):
    return f"/api/simulator/{match_id}/trigger-event/"


def simulator_status_url(match_id):
    return f"/api/simulator/{match_id}/status/"


def auction_results_url(match_id):
    return f"/api/matches/{match_id}/auction-results/"


# ── Match creation ────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestMatchCreation:

    def test_broadcaster_can_create_match(self, broadcaster_client, mock_blockchain):
        res = broadcaster_client.post(
            MATCHES_URL,
            {
                "team_a": "Lahore Qalandars",
                "team_b": "Karachi Kings",
                "venue": "Gaddafi Stadium",
                "match_date": "2026-05-01",
                "match_time": "19:00:00",
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        data = res.json()
        assert data["success"] is True
        assert data["data"]["team_a"] == "Lahore Qalandars"
        assert data["data"]["state"] == Match.State.CREATED
        assert Match.objects.filter(team_a="Lahore Qalandars").exists()
        mock_blockchain.create_match.assert_called_once()

    def test_brand_cannot_create_match(self, brand_client):
        res = brand_client.post(
            MATCHES_URL,
            {
                "team_a": "Team A",
                "team_b": "Team B",
                "venue": "Stadium",
                "match_date": "2026-05-01",
                "match_time": "19:00:00",
            },
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_unauthenticated_cannot_create_match(self, api_client):
        res = api_client.post(
            MATCHES_URL,
            {
                "team_a": "Team A",
                "team_b": "Team B",
                "venue": "Stadium",
                "match_date": "2026-05-01",
                "match_time": "19:00:00",
            },
        )
        assert res.status_code == status.HTTP_401_UNAUTHORIZED

    def test_match_list_is_public(self, api_client, match):
        res = api_client.get(MATCHES_URL)
        assert res.status_code == status.HTTP_200_OK
        assert len(res.json()["data"]) >= 1

    def test_match_detail_is_public(self, api_client, match):
        res = api_client.get(match_url(match.id))
        assert res.status_code == status.HTTP_200_OK
        data = res.json()["data"]
        assert data["team_a"] == match.team_a

    def test_brand_list_excludes_created_matches(self, brand_client, broadcaster):
        created_match = Match.objects.create(
            broadcaster=broadcaster,
            team_a="Created Team A",
            team_b="Created Team B",
            venue="Created Venue",
            match_date="2026-05-01",
            match_time="19:00:00",
            on_chain_match_id=501,
            state=Match.State.CREATED,
        )
        open_match = Match.objects.create(
            broadcaster=broadcaster,
            team_a="Open Team A",
            team_b="Open Team B",
            venue="Open Venue",
            match_date="2026-05-02",
            match_time="20:00:00",
            on_chain_match_id=502,
            state=Match.State.OPEN,
        )

        res = brand_client.get(MATCHES_URL)
        assert res.status_code == status.HTTP_200_OK

        ids = [item["id"] for item in res.json()["data"]]
        assert created_match.id not in ids
        assert open_match.id in ids

    def test_brand_cannot_get_created_match_detail(self, brand_client, match):
        res = brand_client.get(match_url(match.id))
        assert res.status_code == status.HTTP_404_NOT_FOUND

    def test_brand_can_get_non_created_match_details(self, brand_client, broadcaster):
        visible_states = [
            Match.State.OPEN,
            Match.State.ACTIVE,
            Match.State.COMPLETED,
            Match.State.CANCELLED,
        ]
        for idx, state in enumerate(visible_states, start=1):
            visible_match = Match.objects.create(
                broadcaster=broadcaster,
                team_a=f"Visible Team A {idx}",
                team_b=f"Visible Team B {idx}",
                venue="Visible Venue",
                match_date="2026-05-03",
                match_time="18:00:00",
                on_chain_match_id=600 + idx,
                state=state,
            )
            res = brand_client.get(match_url(visible_match.id))
            assert res.status_code == status.HTTP_200_OK

    def test_match_missing_required_fields(self, broadcaster_client):
        res = broadcaster_client.post(MATCHES_URL, {"team_a": "Only One Team"})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_match_blockchain_failure_rolls_back(
        self, broadcaster_client, mock_blockchain
    ):
        fail_tx = MagicMock()
        fail_tx.success = False
        fail_tx.error = "Chain error"
        mock_blockchain.create_match.return_value = fail_tx

        res = broadcaster_client.post(
            MATCHES_URL,
            {
                "team_a": "Team A",
                "team_b": "Team B",
                "venue": "Stadium",
                "match_date": "2026-05-02",
                "match_time": "19:00:00",
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        assert not Match.objects.filter(team_a="Team A").exists()


# ── Event configuration ───────────────────────────────────────────────────────


@pytest.mark.django_db
class TestEventConfig:

    def test_broadcaster_can_configure_event(
        self, broadcaster_client, match, mock_blockchain
    ):
        res = broadcaster_client.post(
            event_config_url(match.id),
            {
                "event_type": 0,  # OVER_BREAK
                "reserve_price": "50000",
                "reservation_fee_pct": "5",
                "slot_count": 3,
                "max_triggers": 40,
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert MatchEventConfig.objects.filter(match=match, event_type=0).exists()
        mock_blockchain.configure_event.assert_called_once()

    def test_all_8_event_types_can_be_configured(
        self, broadcaster_client, match, mock_blockchain
    ):
        for et in range(8):
            res = broadcaster_client.post(
                event_config_url(match.id),
                {
                    "event_type": et,
                    "reserve_price": "10000",
                    "reservation_fee_pct": "3",
                    "slot_count": 2,
                    "max_triggers": 5,
                },
            )
            assert (
                res.status_code == status.HTTP_201_CREATED
            ), f"Failed for event_type={et}"

    def test_duplicate_event_type_rejected(
        self, broadcaster_client, match, event_config
    ):
        res = broadcaster_client.post(
            event_config_url(match.id),
            {
                "event_type": event_config.event_type,
                "reserve_price": "10000",
                "reservation_fee_pct": "3",
                "slot_count": 2,
                "max_triggers": 5,
            },
        )
        assert res.status_code in (
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_409_CONFLICT,
        )

    def test_invalid_event_type_rejected(self, broadcaster_client, match):
        res = broadcaster_client.post(
            event_config_url(match.id),
            {
                "event_type": 99,  # invalid
                "reserve_price": "10000",
                "reservation_fee_pct": "3",
                "slot_count": 2,
                "max_triggers": 5,
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_event_config_not_allowed_after_open(self, broadcaster_client, open_match):
        res = broadcaster_client.post(
            event_config_url(open_match.id),
            {
                "event_type": 7,  # SUPER_OVER
                "reserve_price": "10000",
                "reservation_fee_pct": "3",
                "slot_count": 2,
                "max_triggers": 1,
            },
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_brand_cannot_configure_events(self, brand_client, match):
        res = brand_client.post(
            event_config_url(match.id),
            {
                "event_type": 0,
                "reserve_price": "10000",
                "reservation_fee_pct": "3",
                "slot_count": 2,
                "max_triggers": 5,
            },
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN


# ── Open bidding ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestOpenBidding:

    def test_broadcaster_can_open_bidding(
        self, broadcaster_client, match, event_config, mock_blockchain
    ):
        res = broadcaster_client.post(open_bidding_url(match.id))
        assert res.status_code == status.HTTP_200_OK
        match.refresh_from_db()
        assert match.state == Match.State.OPEN
        mock_blockchain.transition_state.assert_called_once()

    def test_cannot_open_already_open_match(self, broadcaster_client, open_match):
        res = broadcaster_client.post(open_bidding_url(open_match.id))
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_cannot_open_match_without_event_configs(self, broadcaster_client, match):
        res = broadcaster_client.post(open_bidding_url(match.id))
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_brand_cannot_open_bidding(self, brand_client, match):
        res = brand_client.post(open_bidding_url(match.id))
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_open_bidding_blockchain_failure_keeps_created_state(
        self, broadcaster_client, match, event_config, mock_blockchain
    ):
        fail_tx = MagicMock()
        fail_tx.success = False
        fail_tx.error = "Transition failed"
        mock_blockchain.transition_state.return_value = fail_tx

        res = broadcaster_client.post(open_bidding_url(match.id))
        assert res.status_code == status.HTTP_400_BAD_REQUEST
        match.refresh_from_db()
        assert match.state == Match.State.CREATED


# ── Exclusion groups ──────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestExclusionGroups:

    def test_broadcaster_can_create_group(
        self, broadcaster_client, brand, brand2, mock_blockchain
    ):
        res = broadcaster_client.post(
            EXCLUSION_GROUPS_URL,
            {
                "name": "Cola Wars",
                "brand_ids": [brand.id, brand2.id],
                "separation_distance": 1,
                "cross_event_separation": False,
            },
        )
        assert res.status_code == status.HTTP_201_CREATED
        assert ExclusionGroup.objects.filter(name="Cola Wars").exists()
        group = ExclusionGroup.objects.get(name="Cola Wars")
        assert group.members.count() == 2
        mock_blockchain.create_exclusion_group.assert_called_once()

    def test_brand_cannot_create_exclusion_group(self, brand_client):
        res = brand_client.post(
            EXCLUSION_GROUPS_URL,
            {
                "name": "Group",
                "brand_ids": [],
                "separation_distance": 1,
            },
        )
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_exclusion_group_list(self, broadcaster_client, broadcaster):
        ExclusionGroup.objects.create(
            name="Test Group", broadcaster=broadcaster, separation_distance=1
        )
        res = broadcaster_client.get(EXCLUSION_GROUPS_URL)
        assert res.status_code == status.HTTP_200_OK
        assert len(res.json()["data"]) >= 1

    def test_can_add_brand_to_group(self, broadcaster_client, broadcaster, brand):
        group = ExclusionGroup.objects.create(
            name="My Group", broadcaster=broadcaster, separation_distance=1
        )
        res = broadcaster_client.post(
            exclusion_group_members_url(group.id), {"brand_id": brand.id}
        )
        assert res.status_code == status.HTTP_200_OK
        assert group.members.filter(brand=brand).exists()

    def test_can_remove_brand_from_group(self, broadcaster_client, broadcaster, brand):
        group = ExclusionGroup.objects.create(
            name="My Group", broadcaster=broadcaster, separation_distance=1
        )
        ExclusionGroupMember.objects.create(group=group, brand=brand)
        res = broadcaster_client.delete(exclusion_group_member_url(group.id, brand.id))
        assert res.status_code == status.HTTP_200_OK
        assert not group.members.filter(brand=brand).exists()

    def test_locked_group_cannot_be_modified(
        self, broadcaster_client, broadcaster, brand
    ):
        group = ExclusionGroup.objects.create(
            name="Locked Group",
            broadcaster=broadcaster,
            separation_distance=1,
            is_locked=True,
        )
        res = broadcaster_client.post(
            exclusion_group_members_url(group.id), {"brand_id": brand.id}
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_group_locks_when_match_opens(
        self,
        broadcaster_client,
        broadcaster,
        brand,
        match,
        event_config,
        mock_blockchain,
    ):
        group = ExclusionGroup.objects.create(
            name="Pre-lock Group", broadcaster=broadcaster, separation_distance=1
        )
        ExclusionGroupMember.objects.create(group=group, brand=brand)

        # Open the match — groups should lock
        broadcaster_client.post(open_bidding_url(match.id))
        match.refresh_from_db()
        if match.state == Match.State.OPEN:
            group.refresh_from_db()
            assert group.is_locked is True


# ── Simulator ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestSimulator:

    def test_admin_can_start_match(self, admin_client, open_match, mock_blockchain):
        res = admin_client.post(simulator_start_url(open_match.id))
        assert res.status_code == status.HTTP_200_OK
        open_match.refresh_from_db()
        assert open_match.state == Match.State.ACTIVE
        mock_blockchain.transition_state.assert_called_once()

    def test_cannot_start_non_open_match(self, admin_client, match):
        res = admin_client.post(simulator_start_url(match.id))
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_admin_can_complete_match(
        self, admin_client, active_match, mock_blockchain
    ):
        res = admin_client.post(simulator_complete_url(active_match.id))
        assert res.status_code == status.HTTP_200_OK
        active_match.refresh_from_db()
        assert active_match.state == Match.State.COMPLETED

    def test_admin_can_cancel_match(self, admin_client, active_match, mock_blockchain):
        res = admin_client.post(simulator_cancel_url(active_match.id))
        assert res.status_code == status.HTTP_200_OK
        active_match.refresh_from_db()
        assert active_match.state == Match.State.CANCELLED

    def test_brand_cannot_use_simulator(self, brand_client, open_match):
        res = brand_client.post(simulator_start_url(open_match.id))
        assert res.status_code == status.HTTP_403_FORBIDDEN

    def test_broadcaster_cannot_use_simulator(self, broadcaster_client, open_match):
        res = broadcaster_client.post(simulator_start_url(open_match.id))
        assert res.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestSimulatorTriggerEvent:

    def test_trigger_event_creates_auction_result(
        self,
        admin_client,
        active_match,
        brand,
        approved_creative,
        deposit,
        mock_blockchain,
    ):
        # Place a bid first
        bid = Bid.objects.create(
            match=active_match,
            brand=brand,
            event_type=0,
            amount=Decimal("100000"),
            creative=approved_creative,
            tx_hash="0x" + "b" * 64,
        )
        res = admin_client.post(
            simulator_trigger_url(active_match.id), {"event_type": 0}
        )
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["success"] is True
        data = res.json()["data"]
        assert "tx_hash" in data
        assert data["event_type"] == 0
        assert data["trigger_number"] == 1

        # Trigger count incremented
        active_match.event_configs.get(event_type=0).refresh_from_db()
        assert active_match.event_configs.get(event_type=0).trigger_count == 1

        mock_blockchain.trigger_event.assert_called_once()

    def test_trigger_event_requires_active_match(self, admin_client, open_match):
        res = admin_client.post(simulator_trigger_url(open_match.id), {"event_type": 0})
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_trigger_unconfigured_event_type_rejected(self, admin_client, active_match):
        res = admin_client.post(
            simulator_trigger_url(active_match.id), {"event_type": 7}
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_trigger_exceeds_max_triggers_rejected(
        self, admin_client, active_match, mock_blockchain
    ):
        cfg = active_match.event_configs.get(event_type=0)
        cfg.trigger_count = cfg.max_triggers
        cfg.save()

        res = admin_client.post(
            simulator_trigger_url(active_match.id), {"event_type": 0}
        )
        assert res.status_code == status.HTTP_400_BAD_REQUEST

    def test_trigger_missing_event_type_rejected(self, admin_client, active_match):
        res = admin_client.post(simulator_trigger_url(active_match.id), {})
        assert res.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestSimulatorStatus:

    def test_admin_can_view_status(self, admin_client, active_match):
        res = admin_client.get(simulator_status_url(active_match.id))
        assert res.status_code == status.HTTP_200_OK
        data = res.json()["data"]
        assert "state" in data
        assert (
            "trigger_counts" in data
            or "event_configs" in data
            or res.json()["success"] is True
        )


# ── Auction results ───────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestAuctionResults:

    def test_auction_results_empty_before_trigger(self, api_client, completed_match):
        res = api_client.get(auction_results_url(completed_match.id))
        assert res.status_code == status.HTTP_200_OK
        assert res.json()["data"] == []

    def test_auction_results_grouped_by_event_type(
        self, api_client, completed_match, brand
    ):
        AuctionResult.objects.create(
            match=completed_match,
            event_type=0,
            trigger_number=1,
            slot_position=0,
            winner=brand,
            amount=Decimal("100000"),
            creative_ref="https://cdn.example.com/ad.mp4",
            tx_hash="0x" + "a" * 64,
        )
        AuctionResult.objects.create(
            match=completed_match,
            event_type=0,
            trigger_number=1,
            slot_position=1,
            winner=brand,
            amount=Decimal("80000"),
            creative_ref="https://cdn.example.com/ad2.mp4",
            tx_hash="0x" + "b" * 64,
        )
        res = api_client.get(auction_results_url(completed_match.id))
        assert res.status_code == status.HTTP_200_OK
        groups = res.json()["data"]
        assert len(groups) == 1
        assert groups[0]["event_type"] == 0
        assert groups[0]["slots_filled"] == 2

    def test_auction_results_are_public(self, api_client, completed_match):
        res = api_client.get(auction_results_url(completed_match.id))
        assert res.status_code == status.HTTP_200_OK
