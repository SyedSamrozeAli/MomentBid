from __future__ import annotations

import hashlib
import itertools
from collections.abc import Iterable

from eth_account import Account

from apps.blockchain.service import BlockchainServiceBase, TxResult


class MockBlockchainService(BlockchainServiceBase):
    """In-memory blockchain adapter used for local development."""

    def __init__(self) -> None:
        self._mbt_balances: dict[str, int] = {}
        self._bid_reservations: dict[tuple[str, int, int], int] = {}
        self._budget_caps: dict[tuple[str, int], int] = {}
        self._event_configs: dict[tuple[int, int], dict[str, int]] = {}
        self._match_states: dict[int, int] = {}
        self._exclusion_groups: dict[int, dict[str, object]] = {}
        self._counter = itertools.count(start=1)
        self._match_id_counter = itertools.count(start=1)

    def _generate_tx_hash(self, parts: Iterable[object]) -> str:
        payload = "|".join(str(part) for part in parts)
        digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
        return f"0x{digest}"

    def _next_hash(self, action: str, *args: object) -> str:
        seq = next(self._counter)
        return self._generate_tx_hash((action, seq, *args))

    @staticmethod
    def _address_from_private_key(private_key: str) -> str:
        return Account.from_key(private_key).address.lower()

    def generate_wallet(self) -> tuple[str, str]:
        account = Account.create()
        return account.address, account.key.hex()

    def get_mbt_balance(self, address: str) -> int:
        return self._mbt_balances.get(address.lower(), 0)

    def mint_tokens(self, to_address: str, amount: int) -> TxResult:
        address = to_address.lower()
        self._mbt_balances[address] = self._mbt_balances.get(address, 0) + amount
        return TxResult(success=True, tx_hash=self._next_hash("mint", address, amount))

    def approve_tokens(
        self, owner_private_key: str, spender_address: str, amount: int
    ) -> TxResult:
        owner_address = self._address_from_private_key(owner_private_key)
        return TxResult(
            success=True,
            tx_hash=self._next_hash("approve", owner_address, spender_address, amount),
        )

    def place_bid(
        self,
        brand_key: str,
        match_id: int,
        event_type: int,
        amount: int,
        creative_ref: str,
    ) -> TxResult:
        brand_address = self._address_from_private_key(brand_key)
        current_balance = self._mbt_balances.get(brand_address, 0)
        if current_balance < amount:
            return TxResult(success=False, tx_hash="", error="Insufficient MBT balance")

        self._mbt_balances[brand_address] = current_balance - amount
        self._bid_reservations[(brand_address, match_id, event_type)] = amount

        return TxResult(
            success=True,
            tx_hash=self._next_hash(
                "place_bid", brand_address, match_id, event_type, amount, creative_ref
            ),
        )

    def increase_bid(
        self, brand_key: str, match_id: int, event_type: int, additional_amount: int
    ) -> TxResult:
        brand_address = self._address_from_private_key(brand_key)
        current_balance = self._mbt_balances.get(brand_address, 0)
        if current_balance < additional_amount:
            return TxResult(success=False, tx_hash="", error="Insufficient MBT balance")

        self._mbt_balances[brand_address] = current_balance - additional_amount
        reservation_key = (brand_address, match_id, event_type)
        self._bid_reservations[reservation_key] = (
            self._bid_reservations.get(reservation_key, 0) + additional_amount
        )

        return TxResult(
            success=True,
            tx_hash=self._next_hash(
                "increase_bid",
                brand_address,
                match_id,
                event_type,
                additional_amount,
            ),
        )

    def set_budget_cap(self, brand_key: str, match_id: int, cap: int) -> TxResult:
        brand_address = self._address_from_private_key(brand_key)
        self._budget_caps[(brand_address, match_id)] = cap
        return TxResult(
            success=True,
            tx_hash=self._next_hash("set_budget_cap", brand_address, match_id, cap),
        )

    def create_match(self, broadcaster_key: str) -> TxResult:
        broadcaster_address = self._address_from_private_key(broadcaster_key)
        match_id = next(self._match_id_counter)
        self._match_states[match_id] = 0
        return TxResult(
            success=True,
            tx_hash=self._next_hash("create_match", broadcaster_address, match_id),
            data={"match_id": match_id},
        )

    def transition_state(
        self, broadcaster_key: str, match_id: int, new_state: int
    ) -> TxResult:
        broadcaster_address = self._address_from_private_key(broadcaster_key)
        self._match_states[match_id] = new_state
        return TxResult(
            success=True,
            tx_hash=self._next_hash(
                "transition_state", broadcaster_address, match_id, new_state
            ),
        )

    def configure_event(
        self,
        broadcaster_key: str,
        match_id: int,
        event_type: int,
        reserve_price: int,
        reservation_fee_pct: int,
        slot_count: int,
        max_triggers: int,
    ) -> TxResult:
        broadcaster_address = self._address_from_private_key(broadcaster_key)
        self._event_configs[(match_id, event_type)] = {
            "reserve_price": reserve_price,
            "reservation_fee_pct": reservation_fee_pct,
            "slot_count": slot_count,
            "max_triggers": max_triggers,
        }
        return TxResult(
            success=True,
            tx_hash=self._next_hash(
                "configure_event", broadcaster_address, match_id, event_type
            ),
        )

    def claim_refund(self, brand_key: str, match_id: int) -> TxResult:
        brand_address = self._address_from_private_key(brand_key)
        refund_total = sum(
            amount
            for (
                address,
                reservation_match_id,
                _,
            ), amount in self._bid_reservations.items()
            if address == brand_address and reservation_match_id == match_id
        )
        self._mbt_balances[brand_address] = (
            self._mbt_balances.get(brand_address, 0) + refund_total
        )

        for reservation_key in [
            key
            for key in self._bid_reservations
            if key[0] == brand_address and key[1] == match_id
        ]:
            self._bid_reservations.pop(reservation_key)

        return TxResult(
            success=True,
            tx_hash=self._next_hash(
                "claim_refund", brand_address, match_id, refund_total
            ),
            data={"refund_amount": refund_total},
        )

    def create_exclusion_group(
        self,
        broadcaster_key: str,
        group_id: int,
        brand_addresses: list[str],
        separation: int,
        cross_event: bool,
    ) -> TxResult:
        broadcaster_address = self._address_from_private_key(broadcaster_key)
        self._exclusion_groups[group_id] = {
            "brand_addresses": [address.lower() for address in brand_addresses],
            "separation": separation,
            "cross_event": cross_event,
        }
        return TxResult(
            success=True,
            tx_hash=self._next_hash(
                "create_exclusion_group", broadcaster_address, group_id
            ),
        )

    def trigger_event(
        self, oracle_key: str, match_id: int, event_type: int
    ) -> TxResult:
        oracle_address = self._address_from_private_key(oracle_key)
        return TxResult(
            success=True,
            tx_hash=self._next_hash(
                "trigger_event", oracle_address, match_id, event_type
            ),
            data={"match_id": match_id, "event_type": event_type},
        )

    def fund_gas(self, to_address: str, amount_wire: float) -> TxResult:
        return TxResult(
            success=True,
            tx_hash=self._next_hash("fund_gas", to_address.lower(), amount_wire),
        )
