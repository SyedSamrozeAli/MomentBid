from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass(frozen=True)
class TxResult:
    success: bool
    tx_hash: str
    gas_used: int = 0
    error: str = ""
    data: dict[str, object] = field(default_factory=dict)


class BlockchainServiceBase(ABC):
    @abstractmethod
    def generate_wallet(self) -> tuple[str, str]:
        raise NotImplementedError

    @abstractmethod
    def get_mbt_balance(self, address: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def mint_tokens(self, to_address: str, amount: int) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def approve_tokens(
        self, owner_private_key: str, spender_address: str, amount: int
    ) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def place_bid(
        self,
        brand_key: str,
        match_id: int,
        event_type: int,
        amount: int,
        creative_ref: str,
    ) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def increase_bid(
        self, brand_key: str, match_id: int, event_type: int, additional_amount: int
    ) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def set_budget_cap(self, brand_key: str, match_id: int, cap: int) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def create_match(self, broadcaster_key: str) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def transition_state(
        self, broadcaster_key: str, match_id: int, new_state: int
    ) -> TxResult:
        raise NotImplementedError

    @abstractmethod
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
        raise NotImplementedError

    @abstractmethod
    def claim_refund(self, brand_key: str, match_id: int) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def create_exclusion_group(
        self,
        broadcaster_key: str,
        group_id: int,
        brand_addresses: list[str],
        separation: int,
        cross_event: bool,
    ) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def trigger_event(
        self, oracle_key: str, match_id: int, event_type: int
    ) -> TxResult:
        raise NotImplementedError

    @abstractmethod
    def fund_gas(self, to_address: str, amount_wire: float) -> TxResult:
        raise NotImplementedError
