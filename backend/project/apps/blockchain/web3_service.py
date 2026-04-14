from __future__ import annotations

import json
import logging
import time
from collections import defaultdict
from pathlib import Path
from threading import Lock

from django.conf import settings
from eth_account import Account
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

from apps.blockchain.service import BlockchainServiceBase, TxResult

logger = logging.getLogger(__name__)

ABI_DIR = Path(__file__).parent / "abis"


def _load_abi(name: str) -> list:
    with open(ABI_DIR / f"{name}.json") as f:
        return json.load(f)


class Web3BlockchainService(BlockchainServiceBase):
    """Production blockchain adapter — WireFluid network via web3.py."""

    def __init__(self) -> None:
        self.web3 = Web3(Web3.HTTPProvider(settings.BLOCKCHAIN_RPC_URL))
        # WireFluid uses CometBFT (PoA-like extra data in block headers)
        self.web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)

        self._nonce_locks: dict[str, Lock] = defaultdict(Lock)

        # Admin account — minting tokens, granting roles
        self._admin_key: str = settings.ADMIN_WALLET_PRIVATE_KEY or ""
        self._admin_address: str | None = (
            Account.from_key(self._admin_key).address if self._admin_key else None
        )

        # Load contracts
        self._mbt = self.web3.eth.contract(
            address=Web3.to_checksum_address(settings.MBT_CONTRACT_ADDRESS),
            abi=_load_abi("MomentBidToken"),
        )
        self._core = self.web3.eth.contract(
            address=Web3.to_checksum_address(settings.MOMENTBID_CORE_ADDRESS),
            abi=_load_abi("MomentBidCore"),
        )
        self._exclusion = self.web3.eth.contract(
            address=Web3.to_checksum_address(settings.EXCLUSION_MANAGER_ADDRESS),
            abi=_load_abi("ExclusionManager"),
        )
        self._oracle_ctrl = self.web3.eth.contract(
            address=Web3.to_checksum_address(settings.ORACLE_CONTROLLER_ADDRESS),
            abi=_load_abi("OracleController"),
        )

    # ── Internal helpers ────────────────────────────────────────────────────

    def _send_tx(self, private_key: str, contract_fn) -> TxResult:
        """Build, sign, broadcast transaction and wait for receipt."""
        try:
            account = Account.from_key(private_key)
            address = account.address

            with self._nonce_locks[address.lower()]:
                nonce = self.web3.eth.get_transaction_count(address, "pending")

                tx = contract_fn.build_transaction(
                    {
                        "from": address,
                        "nonce": nonce,
                        "gas": 500_000,
                        "gasPrice": self.web3.eth.gas_price,
                        "chainId": settings.BLOCKCHAIN_CHAIN_ID,
                    }
                )

                signed = self.web3.eth.account.sign_transaction(tx, private_key)
                tx_hash = self.web3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

                if receipt.status != 1:
                    return TxResult(
                        success=False,
                        tx_hash=tx_hash.hex(),
                        error="Transaction reverted on-chain",
                    )

                return TxResult(
                    success=True,
                    tx_hash=tx_hash.hex(),
                    gas_used=receipt.gasUsed,
                )

        except Exception as exc:
            logger.error("Blockchain tx failed: %s", exc)
            return TxResult(success=False, tx_hash="", error=str(exc))

    def _send_native(self, private_key: str, to: str, value_wei: int) -> TxResult:
        """Send native WIRE token (for gas funding)."""
        try:
            account = Account.from_key(private_key)
            address = account.address

            with self._nonce_locks[address.lower()]:
                nonce = self.web3.eth.get_transaction_count(address, "pending")

                tx = {
                    "to": Web3.to_checksum_address(to),
                    "value": value_wei,
                    "gas": 21_000,
                    "gasPrice": self.web3.eth.gas_price,
                    "nonce": nonce,
                    "chainId": settings.BLOCKCHAIN_CHAIN_ID,
                }

                signed = self.web3.eth.account.sign_transaction(tx, private_key)
                tx_hash = self.web3.eth.send_raw_transaction(signed.raw_transaction)
                receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

                return TxResult(
                    success=receipt.status == 1,
                    tx_hash=tx_hash.hex(),
                    gas_used=receipt.gasUsed,
                    error="" if receipt.status == 1 else "Native transfer reverted",
                )

        except Exception as exc:
            logger.error("Native send failed: %s", exc)
            return TxResult(success=False, tx_hash="", error=str(exc))

    def _parse_event(self, tx_hash: str, contract, event_name: str) -> dict | None:
        """Return first matching event args from a mined transaction."""
        try:
            receipt = self.web3.eth.get_transaction_receipt(tx_hash)
            event = getattr(contract.events, event_name)
            logs = event().process_receipt(receipt)
            return dict(logs[0]["args"]) if logs else None
        except Exception as exc:
            logger.warning("Event parse failed (%s): %s", event_name, exc)
            return None

    def _require_admin(self) -> TxResult | None:
        """Return error TxResult if admin key missing, else None."""
        if not self._admin_key:
            return TxResult(
                success=False, tx_hash="", error="ADMIN_WALLET_PRIVATE_KEY not configured"
            )
        return None

    # ── Wallet & balance ────────────────────────────────────────────────────

    def generate_wallet(self) -> tuple[str, str]:
        account = Account.create()
        return account.address, account.key.hex()

    def get_mbt_balance(self, address: str) -> int:
        try:
            return self._mbt.functions.balanceOf(
                Web3.to_checksum_address(address)
            ).call()
        except Exception as exc:
            logger.error("balanceOf failed for %s: %s", address, exc)
            return 0

    def fund_gas(self, to_address: str, amount_wire: float) -> TxResult:
        err = self._require_admin()
        if err:
            return err
        value_wei = self.web3.to_wei(amount_wire, "ether")
        return self._send_native(self._admin_key, to_address, value_wei)

    # ── Token ───────────────────────────────────────────────────────────────

    def mint_tokens(self, to_address: str, amount: int) -> TxResult:
        err = self._require_admin()
        if err:
            return err
        return self._send_tx(
            self._admin_key,
            self._mbt.functions.mint(Web3.to_checksum_address(to_address), amount),
        )

    def approve_tokens(
        self, owner_private_key: str, spender_address: str, amount: int
    ) -> TxResult:
        return self._send_tx(
            owner_private_key,
            self._mbt.functions.approve(
                Web3.to_checksum_address(spender_address), amount
            ),
        )

    # ── Match lifecycle ─────────────────────────────────────────────────────

    def create_match(self, broadcaster_key: str) -> TxResult:
        match_date = int(time.time())
        result = self._send_tx(
            broadcaster_key,
            self._core.functions.createMatch(match_date),
        )
        if not result.success:
            return result

        event_args = self._parse_event(result.tx_hash, self._core, "MatchCreated")
        match_id = event_args["matchId"] if event_args else None

        return TxResult(
            success=True,
            tx_hash=result.tx_hash,
            gas_used=result.gas_used,
            data={"match_id": match_id},
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
        return self._send_tx(
            broadcaster_key,
            self._core.functions.defineEventType(
                match_id,
                event_type,
                reserve_price,
                reservation_fee_pct,
                slot_count,
                max_triggers,
            ),
        )

    def transition_state(
        self, broadcaster_key: str, match_id: int, new_state: int
    ) -> TxResult:
        return self._send_tx(
            broadcaster_key,
            self._core.functions.transitionMatchState(match_id, new_state),
        )

    # ── Bidding ─────────────────────────────────────────────────────────────

    def place_bid(
        self,
        brand_key: str,
        match_id: int,
        event_type: int,
        amount: int,
        creative_ref: str,
    ) -> TxResult:
        return self._send_tx(
            brand_key,
            self._core.functions.placeBid(match_id, event_type, amount, creative_ref),
        )

    def increase_bid(
        self, brand_key: str, match_id: int, event_type: int, additional_amount: int
    ) -> TxResult:
        return self._send_tx(
            brand_key,
            self._core.functions.increaseBid(match_id, event_type, additional_amount),
        )

    def set_budget_cap(self, brand_key: str, match_id: int, cap: int) -> TxResult:
        return self._send_tx(
            brand_key,
            self._core.functions.setBudgetCap(match_id, cap),
        )

    # ── Auction & refunds ───────────────────────────────────────────────────

    def trigger_event(
        self, oracle_key: str, match_id: int, event_type: int
    ) -> TxResult:
        return self._send_tx(
            oracle_key,
            self._oracle_ctrl.functions.triggerEvent(match_id, event_type),
        )

    def claim_refund(self, brand_key: str, match_id: int) -> TxResult:
        result = self._send_tx(
            brand_key,
            self._core.functions.claimRefund(match_id),
        )
        if not result.success:
            return result

        event_args = self._parse_event(result.tx_hash, self._core, "RefundProcessed")
        refund_amount = event_args["refundAmount"] if event_args else 0

        return TxResult(
            success=True,
            tx_hash=result.tx_hash,
            gas_used=result.gas_used,
            data={"refund_amount": refund_amount},
        )

    # ── Exclusion groups ────────────────────────────────────────────────────

    def create_exclusion_group(
        self,
        broadcaster_key: str,
        group_id: int,
        brand_addresses: list[str],
        separation: int,
        cross_event: bool,
    ) -> TxResult:
        checksum_brands = [Web3.to_checksum_address(a) for a in brand_addresses]
        return self._send_tx(
            broadcaster_key,
            self._exclusion.functions.createExclusionGroup(
                group_id, checksum_brands, separation, cross_event
            ),
        )

    # ── Role management (not in abstract base — call via isinstance check) ──

    def grant_brand_role(self, brand_address: str) -> TxResult:
        """Grant BRAND_ROLE on MomentBidCore to a newly registered brand wallet.
        Called at brand registration time. Admin wallet signs the tx.
        """
        err = self._require_admin()
        if err:
            return err
        brand_role = self._core.functions.BRAND_ROLE().call()
        return self._send_tx(
            self._admin_key,
            self._core.functions.grantRole(
                brand_role, Web3.to_checksum_address(brand_address)
            ),
        )

    def grant_broadcaster_role(self, broadcaster_address: str) -> TxResult:
        """Grant BROADCASTER_ROLE on MomentBidCore + ExclusionManager.
        Called at broadcaster registration time. Admin wallet signs both txs.
        """
        err = self._require_admin()
        if err:
            return err

        checksum_addr = Web3.to_checksum_address(broadcaster_address)

        broadcaster_role_core = self._core.functions.BROADCASTER_ROLE().call()
        result_core = self._send_tx(
            self._admin_key,
            self._core.functions.grantRole(broadcaster_role_core, checksum_addr),
        )
        if not result_core.success:
            return result_core

        broadcaster_role_excl = self._exclusion.functions.BROADCASTER_ROLE().call()
        return self._send_tx(
            self._admin_key,
            self._exclusion.functions.grantRole(broadcaster_role_excl, checksum_addr),
        )
