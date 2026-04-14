# Blockchain Coding Context (MomentBid)

## 1. Scope And Ownership
- You own blockchain only (Solidity contracts, tests, deployment scripts, ABIs).
- Teammates own backend (Django + web3.py relay) and frontend (React).
- Brands and broadcasters are custodial users in product UX; they do not use MetaMask directly.
- Admin and Oracle can use MetaMask directly.

## 2. Network And Token Model
- Network: WireFluid testnet.
- Chain ID: 92533.
- RPC: https://evm.wirefluid.com.
- Native token WIRE is gas only.
- Bidding currency is custom ERC20 token MBT.
- Monetary mapping: 1 MBT = 1 PKR.
- MBT should use 0 decimals for simple PKR-like accounting.

## 3. Canonical Contract Set For MVP
- MomentBidToken.sol
- ExclusionManager.sol
- MomentBidCore.sol
- OracleController.sol
- Skip AdInventoryNFT for MVP.

## 4. Role Model (AccessControl)
- DEFAULT_ADMIN_ROLE: platform control, pause/unpause, emergency overrides.
- BROADCASTER_ROLE: creates matches, configures event rules, opens bidding.
- BRAND_ROLE: places/increases bids, sets budget cap, claims refunds.
- ORACLE_ROLE: triggers live events during ACTIVE match state.

## 5. Match Lifecycle State Machine
- CREATED -> OPEN -> ACTIVE -> COMPLETED
- CREATED -> CANCELLED
- OPEN -> CANCELLED
- ACTIVE -> CANCELLED

Rules:
- Bids accepted only in OPEN.
- Oracle triggers accepted only in ACTIVE.
- Config changes are allowed in CREATED, then locked at OPEN.

## 6. Event Type IDs (keep stable for all systems)
- 0 OVER_BREAK
- 1 STRATEGIC_TIMEOUT
- 2 INNINGS_BREAK
- 3 WICKET_FALL
- 4 HIGH_VALUE_WICKET
- 5 LAST_OVER_THRILLER
- 6 HAT_TRICK_BALL
- 7 SUPER_OVER

## 7. Core Financial Rules
- Bid flow uses ERC20 approval + transferFrom escrow.
- placeBid stores escrow immediately.
- increaseBid only increases; no decrease, no withdraw during OPEN.
- Reserve price filter: bids below reserve are ineligible.
- Budget cap filter: if settlement would exceed cap, bidder is ineligible.
- Slot assignment: highest eligible bidder gets slotPosition 1, next highest gets slotPosition 2, etc.
- A brand should not win multiple slots in the same single trigger resolution.
- Settlement split per winning slot:
  - broadcaster: 95%
  - platform: 5% (configurable by admin)
- Use batched transfer totals per trigger resolution (one transfer to broadcaster, one to platform) for gas efficiency.

## 8. Exclusion Rules
- Exclusion groups managed by broadcaster in CREATED.
- Group config locks when relevant match opens.
- During auction resolution, candidate winner must pass exclusion checks:
  - against winners already chosen in the current trigger
  - against recent winners history (same-event or cross-event depending on flag)
- If no eligible bidder for a slot, emit NoEligibleBidder and continue.
- If filled slots < configured slots, emit PartialFill.

## 9. Refund Rules
- COMPLETED:
  - Unspent escrow for never-triggered events: refund = amount - reservation fee.
  - Reservation fee goes to broadcaster.
- CANCELLED:
  - Already settled wins stay final (no clawback).
  - Unsettled and untriggered bids refunded 100% (no reservation fee).

## 10. Events Backend Must Index
- MatchCreated
- MatchStateChanged
- EventConfigured
- BidPlaced
- BidIncreased
- BudgetCapSet
- AuctionSettled
- PartialFill
- NoEligibleBidder
- RefundProcessed

Keep event payloads explicit for backend indexing:
- include matchId
- include eventType where relevant
- include slotPosition and triggerNumber for settlements
- include winner, amount, creativeRef for playlist rendering

## 11. Security And Reliability Baseline
- Use OpenZeppelin AccessControl, Pausable, ReentrancyGuard, SafeERC20.
- Use custom errors, not long require strings.
- Protect all token-moving external functions with nonReentrant.
- Do not include admin withdrawal path for escrowed brand funds.
- Add explicit upper bounds where needed (for example max bidders per event).

## 12. Coding Order (recommended)
1. MomentBidToken + tests
2. ExclusionManager + tests
3. MomentBidCore (match lifecycle, config, bid escrow, resolution, refunds) + tests
4. OracleController + tests
5. Integration test: deposit/mint -> approve -> bid -> trigger -> settle -> refund

## 13. Definition Of Done For Blockchain
- All 4 contracts compile with no warnings.
- Unit tests pass for access control, state guards, exclusion, resolution, refunds.
- Integration test covers happy path and cancellation path.
- Deployment script outputs all contract addresses.
- Role-grant script runs cleanly.
- ABI artifacts ready for backend teammate.

## 14. Clarifications To Follow During Build
- SRS summary mentions sealed bids, but functional sections require open visible bids. Implement open visible bids.
- Earlier drafts mention native payable bidding, but implementation plans switch to ERC20 MBT. Implement ERC20 MBT flow only.
- Keep logic generic and event-type-driven; avoid hardcoding cricket-specific semantics inside settlement logic.
