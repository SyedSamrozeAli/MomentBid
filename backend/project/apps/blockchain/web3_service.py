from __future__ import annotations

from collections import defaultdict
from threading import Lock

from django.conf import settings
from web3 import Web3

from apps.blockchain.service import BlockchainServiceBase, TxResult


class Web3BlockchainService(BlockchainServiceBase):
    """Production blockchain adapter using web3.py contracts."""

    def __init__(self) -> None:
        self.web3 = Web3(Web3.HTTPProvider(settings.BLOCKCHAIN_RPC_URL))
        self._nonce_locks: dict[str, Lock] = defaultdict(Lock)

    def _not_implemented(self, method_name: str) -> TxResult:
        return TxResult(
            success=False, tx_hash="", error=f"{method_name} is not implemented yet"
        )

    def generate_wallet(self) -> tuple[str, str]:
        account = self.web3.eth.account.create()
        return account.address, account.key.hex()

    def get_mbt_balance(self, address: str) -> int:
        return 0

    def mint_tokens(self, to_address: str, amount: int) -> TxResult:
        return self._not_implemented("mint_tokens")

    def approve_tokens(
        self, owner_private_key: str, spender_address: str, amount: int
    ) -> TxResult:
        return self._not_implemented("approve_tokens")

    def place_bid(
        self,
        brand_key: str,
        match_id: int,
        event_type: int,
        amount: int,
        creative_ref: str,
    ) -> TxResult:
        return self._not_implemented("place_bid")

    def increase_bid(
        self, brand_key: str, match_id: int, event_type: int, additional_amount: int
    ) -> TxResult:
        return self._not_implemented("increase_bid")

    def set_budget_cap(self, brand_key: str, match_id: int, cap: int) -> TxResult:
        return self._not_implemented("set_budget_cap")

    def create_match(self, broadcaster_key: str) -> TxResult:
        return self._not_implemented("create_match")

    def transition_state(
        self, broadcaster_key: str, match_id: int, new_state: int
    ) -> TxResult:
        return self._not_implemented("transition_state")

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
        return self._not_implemented("configure_event")

    def claim_refund(self, brand_key: str, match_id: int) -> TxResult:
        return self._not_implemented("claim_refund")

    def create_exclusion_group(
        self,
        broadcaster_key: str,
        group_id: int,
        brand_addresses: list[str],
        separation: int,
        cross_event: bool,
    ) -> TxResult:
        return self._not_implemented("create_exclusion_group")

    def trigger_event(
        self, oracle_key: str, match_id: int, event_type: int
    ) -> TxResult:
        return self._not_implemented("trigger_event")

    def fund_gas(self, to_address: str, amount_wire: float) -> TxResult:
        return self._not_implemented("fund_gas")
