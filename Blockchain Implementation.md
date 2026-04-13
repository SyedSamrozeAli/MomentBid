## Plan: MomentBid Solidity MVP on WireFluid

Build a simple, production-minded MVP with heavy OpenZeppelin usage and minimal custom complexity: deploy MBT first, then Core, then ExclusionManager, then OracleController, wire addresses, grant roles, and validate the full custodial approve→bid→oracle trigger→settlement→refund lifecycle on local and WireFluid testnet. This plan is intentionally beginner-safe, with explicit storage/function skeletons and phased verification.

**Steps**
1. Phase 0: Repository bootstrap and guardrails (foundation, no business logic) (independent)
1. Create folder structure exactly as requested under momentbid-contracts.
1. Initialize Hardhat v3 project with Ethers + Ignition + OpenZeppelin + dotenv + chai.
1. Set Solidity version to 0.8.24 (or 0.8.20+) and turn optimizer on.
1. Add a shared constants file in contracts (or in Core) for:
1. PLATFORM_FEE_BPS default 500 (5%).
1. MAX_BIDDERS_PER_EVENT 20.
1. Event type enum values 0-7.
1. Add beginner guardrails in README:
1. Always use approve exact amount before placeBid/increaseBid.
1. Never use infinite approvals.
1. Roles must be granted after deploy.
1. Verification checkpoint:
1. Run compile successfully.
1. Confirm no contract has uninitialized critical addresses.

1. Phase 1: MomentBidToken contract (depends on Phase 0)
1. Implement MomentBidToken.sol with inheritance:
1. ERC20.
1. AccessControl.
1. Pausable.
1. Contract skeleton:
1. Roles:
1. DEFAULT_ADMIN_ROLE.
1. ADMIN_ROLE for mint.
1. Custom errors:
1. Unauthorized().
1. ZeroAddress().
1. MintAmountZero().
1. Functions:
1. constructor(address admin).
1. mint(address to, uint256 amount) external onlyRole(ADMIN_ROLE).
1. pause() external onlyRole(DEFAULT_ADMIN_ROLE).
1. unpause() external onlyRole(DEFAULT_ADMIN_ROLE).
1. Optional helper for backend readability:
1. function tokenLabel() external pure returns (string memory) -> MBT pegged 1:1 PKR (display-only note in NatSpec).
1. Event considerations:
1. ERC20 Transfer covers mint transfers.
1. AccessControl role grant/revoke events are automatic.
1. Verification checkpoint:
1. Unit tests for mint authorization, pause behavior, unauthorized revert, and decimals assumptions.

1. Phase 2: ExclusionManager contract (depends on Phase 0, parallel with late Phase 1 tests)
1. Implement ExclusionManager.sol with inheritance:
1. AccessControl.
1. Pausable.
1. Define storage for simple group management without complex nested mapping structs:
1. struct GroupConfig { bool exists; bool locked; uint8 separationDistance; bool crossEventSeparation; }
1. mapping(bytes32 => GroupConfig) groupConfig.
1. mapping(bytes32 => address[]) groupMembers.
1. mapping(bytes32 => mapping(address => bool)) isMember.
1. mapping(address => bytes32) brandToGroup.
1. mapping(bytes32 => address) groupOwnerBroadcaster.
1. Core external functions required:
1. createExclusionGroup(bytes32 groupId, address[] calldata brands, uint8 separationDistance, bool crossEventSeparation).
1. addBrandToGroup(bytes32 groupId, address brand).
1. removeBrandFromGroup(bytes32 groupId, address brand).
1. lockGroup(bytes32 groupId).
1. adminOverride(bytes32 groupId, address[] calldata newBrands, uint8 newSeparationDistance, bool newCrossEventSeparation).
1. isEligible(address brand, address[] calldata recentWinners) external view returns (bool).
1. Add helper views for Core/test use:
1. getGroupMembers(bytes32 groupId) external view returns (address[] memory).
1. getGroupConfig(bytes32 groupId) external view returns (GroupConfig memory).
1. Role policy:
1. BROADCASTER_ROLE can create/manage only before lock.
1. DEFAULT_ADMIN_ROLE can adminOverride anytime.
1. Group lock is one-way for MVP.
1. Exclusion events:
1. ExclusionGroupCreated.
1. BrandAddedToGroup.
1. BrandRemovedFromGroup.
1. SeparationUpdated.
1. GroupLocked.
1. AdminOverride.
1. Verification checkpoint:
1. Unit tests for lock behavior, role restrictions, and isEligible outcomes with sample recent winner arrays.

1. Phase 3: MomentBidCore data model and state machine (depends on Phases 1-2)
1. Implement MomentBidCore.sol with inheritance:
1. AccessControl.
1. Pausable.
1. ReentrancyGuard.
1. Constructor dependencies:
1. IERC20 mbt token address.
1. broadcasterTreasury address (or broadcaster payout through match broadcaster field).
1. platformTreasury address.
1. Optional exclusion manager address (settable once if not known at constructor).
1. Define enums:
1. enum MatchState { CREATED, OPEN, ACTIVE, COMPLETED, CANCELLED }
1. enum EventType { OVER_BREAK, STRATEGIC_TIMEOUT, INNINGS_BREAK, WICKET_FALL, HIGH_VALUE_WICKET, LAST_OVER_THRILLER, HAT_TRICK_BALL, SUPER_OVER }
1. Define structs:
1. struct MatchData { address broadcaster; uint64 matchDate; MatchState state; uint16 platformFeeBps; bool exists; uint256 totalEscrowed; }
1. struct EventConfig { bool enabled; uint128 reservePrice; uint16 reservationFeeBps; uint8 slotCount; uint8 maxTriggers; uint8 triggerCount; uint8 bidderCount; }
1. struct BidData { uint128 bidAmount; uint128 escrowedAmount; string creativeRef; bool active; bool settledAtLeastOnce; }
1. struct SlotSettlement { address winner; uint128 amount; uint8 slotIndex; }
1. Define storage mappings:
1. uint256 nextMatchId.
1. mapping(uint256 => MatchData) matchesData.
1. mapping(uint256 => mapping(uint8 => EventConfig)) matchEventConfig.
1. mapping(uint256 => mapping(uint8 => mapping(address => BidData))) bids.
1. mapping(uint256 => mapping(uint8 => address[])) biddersByEvent.
1. mapping(uint256 => mapping(address => uint256)) brandBudgetCap.
1. mapping(uint256 => mapping(address => uint256)) brandTotalSpent.
1. mapping(uint256 => mapping(address => uint256)) pendingRefunds.
1. mapping(uint256 => mapping(uint8 => address[])) recentWinnersByEvent.
1. External function skeletons:
1. createMatch(address broadcaster, uint64 matchDate, string calldata teamA, string calldata teamB, string calldata venue) external returns (uint256 matchId).
1. defineEventTypes(uint256 matchId, uint8[] calldata enabledEvents, uint256[] calldata reservePrices, uint16[] calldata reservationFeePercents, uint8[] calldata slotCounts, uint8[] calldata maxTriggers) external.
1. transitionMatchState(uint256 matchId, MatchState newState) external.
1. placeBid(uint256 matchId, uint8 eventType, uint256 amount, string calldata creativeRef) external nonReentrant.
1. increaseBid(uint256 matchId, uint8 eventType, uint256 additionalAmount) external nonReentrant.
1. setBudgetCap(uint256 matchId, uint256 cap) external.
1. claimRefund(uint256 matchId) external nonReentrant.
1. batchRefund(uint256 matchId, address[] calldata brands) external nonReentrant.
1. triggerEvent(uint256 matchId, uint8 eventType) external nonReentrant.
1. Internal function skeletons:
1. _validateStateTransition(MatchState fromState, MatchState toState) internal pure.
1. _resolveAuction(uint256 matchId, uint8 eventType) internal returns (uint256 broadcasterAmount, uint256 platformAmount).
1. _isBidEligible(uint256 matchId, uint8 eventType, address brand, uint256 bidAmount, address[] memory selectedWinners) internal view returns (bool).
1. _computeRefund(uint256 matchId, uint8 eventType, address brand) internal view returns (uint256 brandRefund, uint256 broadcasterReservationFee).
1. _recordSettlement(uint256 matchId, uint8 eventType, SlotSettlement memory settlement) internal.
1. _transferEscrowOut(uint256 broadcasterAmount, uint256 platformAmount, address broadcaster) internal.
1. Access control policy in Core:
1. DEFAULT_ADMIN_ROLE: pause/unpause, batchRefund, setPlatformFee.
1. BROADCASTER_ROLE: createMatch, defineEventTypes, transitionMatchState.
1. BRAND_ROLE: placeBid, increaseBid, setBudgetCap, claimRefund.
1. ORACLE_ROLE: triggerEvent (or delegated via OracleController in Phase 4).
1. Verification checkpoint:
1. Compile and unit-test state transitions before writing full auction math.

1. Phase 4: OracleController integration (depends on Phase 3)
1. Implement OracleController.sol with inheritance:
1. AccessControl.
1. Pausable.
1. ReentrancyGuard.
1. Storage:
1. address coreContract.
1. Interface ICoreTrigger with methods for state/event validation and resolve hook.
1. Function skeletons:
1. constructor(address admin, address core).
1. setCoreContract(address newCore) external onlyRole(DEFAULT_ADMIN_ROLE).
1. triggerEvent(uint256 matchId, uint8 eventType) external onlyRole(ORACLE_ROLE) nonReentrant.
1. Behavior:
1. Validate ACTIVE state + event enabled + triggerCount < maxTriggers.
1. Call Core trigger path (either core.triggerEvent or core.resolveAuction exposed to controller only).
1. Keep one trigger entrypoint for backend ABI simplicity.
1. Verification checkpoint:
1. Unit test ORACLE_ROLE-only enforcement and validation reverts.

1. Phase 5: Auction resolution and refund math in Core (depends on Phases 2-4)
1. Implement max-iteration winner selection exactly per requirement:
1. For slot index from 0 to slotCount-1, scan all bidders, choose highest eligible amount.
1. Eligibility checks each candidate:
1. Bid meets reserve price.
1. Escrowed amount is sufficient.
1. Budget cap: brandTotalSpent + bidAmount <= brandBudgetCap (if cap set).
1. ExclusionManager isEligible against current trigger winners and recent winners.
1. Candidate not already selected in same trigger.
1. If no eligible bidder for slot, emit NoEligibleBidder and continue.
1. Settlement design:
1. Accumulate broadcasterTotal and platformTotal in memory across winners.
1. Emit AuctionSettled per slot winner.
1. Emit PartialFill if selectedWinners < slotCount.
1. Execute exactly two ERC20 transfers after loop:
1. transfer broadcasterTotal to match broadcaster.
1. transfer platformTotal to platform treasury.
1. Refund accounting rules:
1. Triggered event, non-winner brand: full refund to pendingRefunds.
1. Event never triggered by completion: refund (100 - reservationFeePercent) to brand, reservation fee to broadcaster.
1. Cancelled match unsettled bids: full refund, no reservation fee.
1. claimRefund and batchRefund transfer from contract to brand(s) using pendingRefunds ledger.
1. Security requirements applied:
1. nonReentrant on all token-moving methods.
1. whenNotPaused on bidding, triggering, refunds.
1. Custom errors for all revert paths (InvalidState, NotEnabledEvent, CapExceeded, ApprovalInsufficient, etc.).
1. Explicitly avoid any generic admin withdraw function.
1. Verification checkpoint:
1. Unit tests for all refund permutations and no-direct-withdraw invariant.

1. Phase 6: Hardhat configuration for WireFluid and deployment modules (depends on Phases 1-5)
1. hardhat.config.js structure:
1. solidity: 0.8.24 with optimizer enabled runs 200.
1. networks.wirefluidTestnet.url from env WIREFLUID_RPC_URL default https://evm.wirefluid.com.
1. networks.wirefluidTestnet.chainId 92533.
1. networks.wirefluidTestnet.accounts from ADMIN_PRIVATE_KEY env.
1. mocha timeout raised for testnet operations.
1. Optional explorer verification config if WireFluid scanner supports API-compatible verification.
1. .env variables:
1. WIREFLUID_RPC_URL=https://evm.wirefluid.com.
1. ADMIN_PRIVATE_KEY.
1. PLATFORM_TREASURY.
1. ORACLE_ADDRESS.
1. BROADCASTER_ADDRESS (for initial role test).
1. BRAND_ADDRESS (for initial role test).
1. ignition/modules/deploy.js structure and order:
1. Deploy MomentBidToken(admin).
1. Deploy MomentBidCore(admin, tokenAddress, platformTreasury, maybe exclusion placeholder).
1. Deploy ExclusionManager(admin).
1. Deploy OracleController(admin, coreAddress).
1. Wire cross-contract references:
1. core.setExclusionManager(exclusionAddress).
1. core.setOracleController(oracleControllerAddress) if using controller-gated trigger path.
1. Grant roles:
1. token.ADMIN_ROLE -> backend mint/admin wallet.
1. core.BROADCASTER_ROLE -> broadcaster wallet(s).
1. core.BRAND_ROLE -> brand wallet(s) for demo.
1. oracle.ORACLE_ROLE -> oracle backend wallet.
1. Verification checkpoint:
1. Deploy to local hardhat network and run smoke script.
1. Deploy to WireFluid testnet and verify role assignments by read calls.

1. Phase 7: Test suite implementation (depends on Phases 1-6)
1. MomentBidToken.test.js cases:
1. Admin can mint, non-admin cannot mint.
1. Pause blocks transfers/mint as expected.
1. Mint zero amount reverts with custom error.
1. MomentBidCore.test.js cases:
1. createMatch emits MatchCreated and starts in CREATED.
1. defineEventTypes only in CREATED.
1. transition CREATED→OPEN→ACTIVE works; invalid transitions revert.
1. placeBid requires OPEN state, non-empty creativeRef, exact allowance approval.
1. increaseBid adds escrow and updates bid amount.
1. setBudgetCap enforced during resolution.
1. Max 20 bidders per event enforced.
1. triggerEvent resolves top N slots by max-iteration without sorting.
1. NoEligibleBidder emitted when all candidates fail.
1. PartialFill emitted when fewer winners than slots.
1. Atomic payout uses 95/5 split with two aggregate transfers.
1. claimRefund handles triggered-lost, never-triggered, and cancelled flows.
1. batchRefund processes multiple brands and skips/handles zero safely.
1. Pausable blocks sensitive functions.
1. Reentrancy protection test on claimRefund using malicious receiver mock.
1. ExclusionManager.test.js cases:
1. Create group, add/remove before lock.
1. lockGroup prevents broadcaster edits.
1. adminOverride works after lock.
1. isEligible false for conflicting winner history, true otherwise.
1. OracleController.test.js cases:
1. Only ORACLE_ROLE can trigger.
1. Trigger fails if match not ACTIVE.
1. Trigger fails when maxTriggers reached.
1. Trigger succeeds and delegates to Core.
1. integration.test.js end-to-end cases:
1. Full lifecycle: mint -> approve -> bid -> OPEN/ACTIVE -> trigger -> settlement -> refunds -> COMPLETED.
1. Cancellation path with full refunds.
1. Cross-event separation behavior with same exclusion group.
1. Budget cap across multiple triggers.
1. Verification checkpoint:
1. All unit and integration tests green locally.
1. Gas report confirms worst-case behavior near expected bounds.

1. Phase 8: Backend integration and ABI contract for web3.py (depends on Phase 7)
1. Export ABIs from artifacts and copy to backend abi directory.
1. Confirm method names and argument types match backend expectations exactly:
1. placeBid(matchId, eventType, amount, creativeRef).
1. increaseBid(matchId, eventType, additionalAmount).
1. setBudgetCap(matchId, cap).
1. claimRefund(matchId).
1. createMatch and event definition functions.
1. triggerEvent(matchId, eventType).
1. Validate event payload fields expected by indexer:
1. BidPlaced includes brand, matchId, eventType, amount, creativeRef.
1. AuctionSettled includes matchId, eventType, slotIndex, winner, amount.
1. RefundProcessed includes matchId, brand, amount.
1. MatchStateChanged includes matchId, oldState, newState.
1. Demo script sequence (manual runbook):
1. Mint MBT for two brands.
1. Approve exact amounts from each brand wallet.
1. Place bids on one event.
1. Oracle trigger and inspect settlement events.
1. Complete match and execute refunds.
1. Verification checkpoint:
1. Backend can execute full two-transaction approve→place flow without ABI mismatches.

**Relevant files**
- d:/PSL Hackathon/Architecture - PSL Hackathon.md — architecture constraints and custody model.
- d:/PSL Hackathon/Backend Implementation.md — web3.py flow, ABI assumptions, operational pitfalls.
- d:/PSL Hackathon/SRS - PSL Hackathon.md — functional requirements, roles, gas and testing targets.
- d:/PSL Hackathon/momentbid-contracts/contracts/MomentBidToken.sol — new ERC20 token contract.
- d:/PSL Hackathon/momentbid-contracts/contracts/MomentBidCore.sol — new auction engine contract.
- d:/PSL Hackathon/momentbid-contracts/contracts/ExclusionManager.sol — new exclusion rules contract.
- d:/PSL Hackathon/momentbid-contracts/contracts/OracleController.sol — new oracle trigger gatekeeper.
- d:/PSL Hackathon/momentbid-contracts/test/MomentBidToken.test.js — token unit tests.
- d:/PSL Hackathon/momentbid-contracts/test/MomentBidCore.test.js — core unit tests.
- d:/PSL Hackathon/momentbid-contracts/test/ExclusionManager.test.js — exclusion unit tests.
- d:/PSL Hackathon/momentbid-contracts/test/OracleController.test.js — oracle unit tests.
- d:/PSL Hackathon/momentbid-contracts/test/integration.test.js — full lifecycle integration tests.
- d:/PSL Hackathon/momentbid-contracts/ignition/modules/deploy.js — deployment and wiring module.
- d:/PSL Hackathon/momentbid-contracts/hardhat.config.js — WireFluid network config.
- d:/PSL Hackathon/momentbid-contracts/package.json — scripts and dependencies.
- d:/PSL Hackathon/momentbid-contracts/.env — deployment/runtime secrets.

**Verification**
1. Phase 0 compile gate: npx hardhat compile.
1. Phase 1 token gate: npx hardhat test test/MomentBidToken.test.js.
1. Phase 2 exclusion gate: npx hardhat test test/ExclusionManager.test.js.
1. Phase 3-5 core gate: npx hardhat test test/MomentBidCore.test.js.
1. Phase 4 oracle gate: npx hardhat test test/OracleController.test.js.
1. End-to-end gate: npx hardhat test test/integration.test.js.
1. Local deployment gate: npx hardhat ignition deploy ignition/modules/deploy.js.
1. WireFluid deployment gate: npx hardhat ignition deploy ignition/modules/deploy.js --network wirefluidTestnet.
1. Post-deploy read checks: role members, token address wiring, exclusion/oracle pointers, platform fee.
1. Demo gate: approve exact amount then placeBid via backend for at least 2 brands; trigger one event and verify expected payouts/refunds.

**Decisions**
- Included scope: 4-contract MVP only (Token, Core, ExclusionManager, OracleController), custodial flow, ERC20 escrow, role-based control, full refund and settlement logic.
- Excluded scope: AdInventoryNFT, upgradeable proxies, meta-transactions, governance modules, advanced gas micro-optimizations, off-chain order books.
- Recommendation: keep all percentages in basis points internally (500 = 5%) to avoid decimal math bugs.
- Recommendation: define one source of truth for role grants in deploy module to avoid manual post-deploy drift.
- Recommendation: prefer controller-mediated oracle triggers so backend has one consistent oracle ABI entrypoint.

**Further Considerations**
1. Recommendation: if timeline gets tight, freeze crossEventSeparation to false in first demo and keep data structures ready; then enable once base auction/refunds are stable.
2. Recommendation: use uint128 for bid/escrow amounts in structs to reduce storage footprint while keeping ample headroom for PKR-pegged amounts.
3. Recommendation: add NatSpec comments for every external function so web3.py integration engineers can consume ABI behavior quickly.