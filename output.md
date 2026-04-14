
PS D:\MomentBid\blockchain\momentbid-contracts> npm run demo:flow:local

> momentbid-contracts@0.1.0 demo:flow:local
> hardhat run scripts/demoFullFlow.js --network localhost

=== Phase Demo: End-to-End On-Chain Flow ===
Admin: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Broadcaster: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
OracleWallet: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
Brand1: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
Brand2: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
Platform: 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc

[1/10] Deploy contracts...
Token: 0x5FbDB2315678afecb367f032d93F642f64180aa3
ExclusionManager: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
MomentBidCore: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
OracleController: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9

[2/10] Grant required roles...
Core.BROADCASTER_ROLE for broadcaster: true
Core.BRAND_ROLE for brand1: true
Core.BRAND_ROLE for brand2: true
Core.ORACLE_ROLE for oracleController: true
OracleController.ORACLE_ROLE for oracleWallet: true

[3/10] Client uploads fiat amount -> backend mints MBT...
Minted -> to: 0x90F79bf6EB2c4f870365E785982E1f101E93b906, amount: 10000, minter: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Minted -> to: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65, amount: 9000, minter: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

=== Balances After Mint ===
Brand1: 10000 MBT
Brand2: 9000 MBT
Broadcaster: 0 MBT
Platform: 0 MBT

[4/10] Broadcaster creates a match and event config...
Match created -> matchId: 1, broadcaster: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8, matchDate: 1776188117
EventConfig -> enabled=true, reserve=1000, slotCount=2, maxTriggers=1

[5/10] Configure exclusion group and lock on OPEN transition...
Group lock events emitted: 1
Group info -> separationDistance=1, crossEvent=false, locked=true

[6/10] Brands approve token spending and place bids...
Allowance brand1->core: 10000
Allowance brand2->core: 9000
Placed bids from chain state:
  Bid#1 -> brand=0x90F79bf6EB2c4f870365E785982E1f101E93b906, amount=3700, creativeRef=creative-brand-1
  Bid#2 -> brand=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65, amount=2800, creativeRef=creative-brand-2
Escrow brand1: 3700
Escrow brand2: 2800

[7/10] Transition match OPEN -> ACTIVE...
Match state: 2 (2 means ACTIVE)

[8/10] Oracle triggers event; settlement happens in core...
EventTriggered -> matchId=1, eventType=0, triggerNumber=1
AuctionSettled events: 1
  Winner -> brand=0x90F79bf6EB2c4f870365E785982E1f101E93b906, amount=3700, slot=1, trigger=1
PartialFill -> slotsFilled=1, totalSlots=2
NoEligibleBidder -> slotPosition=2
TotalSpent brand1: 3700
TotalSpent brand2: 0

=== Balances After Settlement ===
Brand1: 6300 MBT
Brand2: 6200 MBT
Broadcaster: 3515 MBT
Platform: 185 MBT
CoreContract: 2800 MBT

[9/10] Complete match and process refunds...
Match state: 3 (3 means COMPLETED)
Refund brand1 -> refund=0, reservationFees=0
Refund brand2 -> refund=2800, reservationFees=0
[10/10] Final on-chain balances and escrow checks...
Escrow brand1: 0
Escrow brand2: 0

=== Final Balances ===
Brand1: 6300 MBT
Brand2: 9000 MBT
Broadcaster: 3515 MBT
Platform: 185 MBT
CoreContract: 0 MBT

Demo flow complete. Every printed value was read from contract state/events.
PS D:\MomentBid\blockchain\momentbid-contracts> npm test

> momentbid-contracts@0.1.0 testhardhat test

  ExclusionManager
    Deployment
      ✔ Should grant DEFAULT_ADMIN_ROLE to deployer
      ✔ Should have no groups initially
    TC1: Broadcaster creates exclusion group with 3 brands
      ✔ Should create group with 3 brands (63ms)
      ✔ Should retrieve brands array correctly
      ✔ Should create multiple groups
      ✔ Should enforce minimum 2 brands
      ✔ Should reject zero address in brands array
    TC2: Cannot create group with same ID twice
      ✔ Should prevent duplicate groupId
      ✔ Should reject duplicate brands within same creation
    TC3: Add brand to existing group
      ✔ Should add brand to existing group
      ✔ Should reject adding to non-existent group
      ✔ Should reject adding brand already in another group
      ✔ Should reject adding zero address
      ✔ Should allow adding multiple brands sequentially
    TC4: Remove brand from group
      ✔ Should remove brand from group
      ✔ Should reject removing from non-existent group
      ✔ Should reject removing brand not in group
      ✔ Should allow multiple removals
      ✔ Should allow re-adding removed brand
    TC5: Cannot add/remove after group locked
      ✔ Should prevent adding after lock
      ✔ Should prevent removing after lock
      ✔ Should lock group successfully
      ✔ Should reject locking non-existent group
    TC6: Admin can override even after lock
      ✔ Should allow admin to override locked group
      ✔ Should update brand mappings after override
      ✔ Should reject non-admin override
      ✔ Should allow adding/removing after admin override unlocks
    TC7: isEligible - brand not in any group
      ✔ Should return true for brand not in any group
      ✔ Should return true regardless of recent winners if brand not in group
      ✔ Should return true with empty recent winners array
    TC8: isEligible - recent winner in same group (within distance)
      ✔ Should return false when recent winner in same group within separation
      ✔ Should return false when most recent winner in same group
      ✔ Should check only within separation distance
      ✔ Should return false with array shorter than separation distance
      ✔ Should handle multiple competitors
    TC9: isEligible - recent winner in same group but OUTSIDE distance
      ✔ Should return true when winner in same group but outside distance
      ✔ Should return true with long recent winners array
      ✔ Should verify exact boundary condition
      ✔ Should handle distance of 0
    TC10: Brand cannot be in two groups simultaneously
      ✔ Should reject adding to new group if already in one
      ✔ Should reject creating group with brand already in another
      ✔ Should allow adding to new group after removal
    TC11: Non-broadcaster cannot create groups
      ✔ Should reject non-broadcaster creating group
      ✔ Should reject non-broadcaster adding brand
      ✔ Should reject non-broadcaster removing brand
      ✔ Should allow broadcaster with role
      ✔ Should allow anyone to call public functions like isEligible
    Edge Cases & Additional Tests
      ✔ Should handle large separation distances
      ✔ Should reject invalid separation distance 255
      ✔ Should handle complex isEligible scenario with multiple groups
      ✔ Should handle large recent winners array
      ✔ Should maintain consistency across multiple operations
      ✔ Should support separation distance changes via admin override
      ✔ Should reject admin override with invalid params
      ✔ Should reject admin override when a brand belongs to another group
      ✔ Should emit events on all operations

  Integration
    ✔ E2E: full lifecycle works across contracts (45ms)
    ✔ E2E: cancelled match gives full refund on untriggered events
    ✔ E2E: OracleController enforces max trigger count
    ✔ E2E: trigger fails if cross-contract ORACLE role wiring is missing

  MomentBidCore
    Match Management
      ✔ T1: createMatch emits MatchCreated, returns incrementing matchId
      ✔ T2: Non-broadcaster cannot create match
      ✔ T3: defineEventType stores config correctly
      ✔ T4: Cannot define events after OPEN state
      ✔ T4A: Registered exclusion groups lock on CREATED -> OPEN
      ✔ T5: State transitions follow machine rules
      ✔ T6: Invalid transitions revert
    Bidding
      ✔ T7: Brand places bid, tokens transferred to contract
      ✔ T8: Bid below reserve price reverts
      ✔ T9: Second bid on same event type reverts
      ✔ T10: Bid during non-OPEN state reverts
      ✔ T11: increaseBid adds to existing bid amount
      ✔ T12: setBudgetCap stores correctly
      ✔ T13: 21st bidder on same event type reverts (38ms)
      ✔ T14: Non-brand cannot place bid
    Auction Resolution
      ✔ T15: 3 bids, 3 slots — everyone wins
      ✔ T16: 5 bids, 3 slots — top 3 win, 2 lose
      ✔ T17: Slot 1 → highest, Slot 2 → second, etc
      ✔ T18: Bids below reserve cannot be placed
      ✔ T19: Insufficient escrow skipped in multi-event auction
      ✔ T20: Budget cap enforcement
      ✔ T21: Exclusion group enforcement
      ✔ T22: PartialFill emitted when fewer winners than slots
      ✔ T23: NoEligibleBidder emitted when no bids
      ✔ T24: Broadcaster receives 95%, platform 5%
      ✔ T25: Exactly 2 token transfers per resolution
      ✔ T26: Same brand cannot win 2 slots in same trigger
      ✔ T27: Multiple triggers of same event type work independently
    Refunds
      ✔ T28: Losing brand gets refund after COMPLETED
      ✔ T29: Untriggered event gets (100% - fee%)
      ✔ T30: CANCELLED match gets 100%, 0 fees
      ✔ T31: Already-settled wins NOT refunded on cancellation
      ✔ T32: Cannot claim refund twice
      ✔ T33: batchRefund processes multiple brands (admin only)
    Security
      ✔ T34: Reentrancy on claimRefund fails
      ✔ T35: Contract enforces pause guard on state-changing operations
      ✔ T36: No direct withdrawal of escrowed funds
    Edge Cases
      ✔ Should handle zero escrow refund
      ✔ Should handle complex multi-event scenarios

  MomentBidToken
    Deployment
      ✔ Should deploy with correct name and symbol
      ✔ Should have 0 decimals (1 MBT = 1 PKR)
      ✔ Should grant DEFAULT_ADMIN_ROLE to deployer
      ✔ Should grant MINTER_ROLE to deployer
      ✔ Should grant PAUSER_ROLE to deployer
      ✔ Should have zero total supply initially
      ✔ Should not be paused initially
    TC1: Minting - Admin/Minter can mint to any address
      ✔ Should allow minter to mint tokens to user
      ✔ Should allow admin to mint tokens
      ✔ Should allow multiple mints to accumulate balance
      ✔ Should allow minting to multiple users
      ✔ Should allow minting large amounts
    TC2: Access Control - Non-minter cannot mint
      ✔ Should revert when non-minter attempts to mint
      ✔ Should revert when user without role attempts mint
      ✔ Should allow minter but not revoked minter
      ✔ Should respect role hierarchy
    TC3: Validation - Cannot mint to zero address
      ✔ Should revert when minting to zero address
      ✔ Should allow minting to any legitimate address except zero
      ✔ Should reject zero address even with zero amount
      ✔ Should reject zero address even with large amount
    TC4: Validation - Cannot mint zero amount
      ✔ Should revert when minting zero amount to valid address
      ✔ Should allow minting any positive amount
      ✔ Should enforce zero amount check before zero address check
      ✔ Should track proper supply with valid amounts only
    TC5: Decimals - MBT has 0 decimals (1 MBT = 1 PKR)
      ✔ Should return 0 for decimals
      ✔ Should maintain 0 decimals across multiple calls
      ✔ Should handle amounts as whole numbers (no fraction)
      ✔ Should support 1 as minimum atomic unit
    TC6: ERC20 - approve() and transferFrom() work correctly
      ✔ Should allow approve and transferFrom workflow
      ✔ Should enforce allowance limits in transferFrom
      ✔ Should reduce allowance after partial transferFrom
      ✔ Should allow multiple sequential transfers up to allowance
      ✔ Should revert transferFrom with zero allowance
      ✔ Should handle direct transfer without approval
    TC7: Pausable - Admin can pause, transfers/mints fail when paused
      ✔ Should allow admin to pause contract
      ✔ Should fail to mint when paused
      ✔ Should fail to transfer when paused
      ✔ Should fail to transferFrom when paused
      ✔ Should allow unpausing and resume normal operations
      ✔ Should only allow pauser role to pause
      ✔ Should only allow admin role to unpause
    TC8: AccessControl - Admin can grant/revoke MINTER_ROLE
      ✔ Should allow admin to grant MINTER_ROLE to user
      ✔ Should allow newly granted minter to mint
      ✔ Should allow admin to revoke MINTER_ROLE
      ✔ Should prevent revoked minter from minting
      ✔ Should support multiple minters
      ✔ Should only allow admin to grant roles
      ✔ Should track multiple role assignments
    Edge Cases & Security
      ✔ Should handle batch minting
      ✔ Should revert batch mint with length mismatch
      ✔ Should allow burning tokens
      ✔ Should support Reentrancy guard
      ✔ Should query isMinter status correctly
      ✔ Should query isPauser status correctly
      ✔ Should handle approve with exact balance
      ✔ Should handle transfer to self
      ✔ Should revert transfer exceeding balance
      ✔ Should revert burnFrom when allowance is insufficient

  OracleController
    ✔ TC1: Oracle triggers event successfully and resolveAuction executes
    ✔ TC2: Non-oracle cannot trigger events
    ✔ TC3: Cannot trigger on non-ACTIVE match
    ✔ TC4: Cannot trigger disabled event type
    ✔ TC5: Cannot trigger beyond maxTriggers
    ✔ TC6: Admin can pause and unpause
    ✔ Reverts when core address is zero
    ✔ Non-admin cannot pause or unpause
    ✔ Trigger fails if OracleController lacks ORACLE_ROLE on MomentBidCore

  166 passing (8s)

PS D:\MomentBid\blockchain\momentbid-contracts>
