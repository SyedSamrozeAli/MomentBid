# Blockchain Smart Contracts — End-to-End Implementation Plan

## Context
MomentBid is a custodial auction platform on **WireFluid Network** (EVM-compatible, CometBFT consensus). Brands/broadcasters never touch crypto — the Django backend manages wallets and relays all transactions via web3.py. The Solidity developer is a **beginner** — this plan uses simple patterns, heavy OpenZeppelin usage, and avoids advanced optimization (no proxies, no assembly, no complex inheritance).

**4 contracts to build**: MomentBidToken (ERC20), ExclusionManager (competitor separation), MomentBidCore (auction engine), OracleController (event validation). Skip AdInventoryNFT for MVP.

**Token model**: Custom ERC20 (MBT, 0 decimals, 1 MBT = 1 PKR). Backend mints MBT when brand deposits fiat. All bids/escrow/settlements use MBT via `transferFrom()` pattern, NOT native WIRE. WIRE is only for gas.

---

## WireFluid Network Configuration

| Setting | Value |
|---|---|
| **Testnet Chain ID** | 92533 |
| **Testnet RPC** | https://evm.wirefluid.com |
| **Block Explorer** | wirefluidscan.com |
| **Faucet** | faucet.wirefluid.com (10 WIRE/request, 1 request/12hrs) |
| **Native Token** | WIRE (gas only) |
| **Block Time** | ~5 seconds, instant finality |
| **Gas Cost** | 100-1000x cheaper than Ethereum |
| **EVM Compatibility** | Full — standard Solidity, OpenZeppelin, Hardhat all work |

---

## Project Structure

```
momentbid-contracts/
  contracts/
    MomentBidToken.sol       # ERC20 token (1 MBT = 1 PKR)
    ExclusionManager.sol     # Competitor separation rules
    MomentBidCore.sol        # Main auction engine
    OracleController.sol     # Event trigger validation
  test/
    MomentBidToken.test.js
    ExclusionManager.test.js
    MomentBidCore.test.js
    OracleController.test.js
    integration.test.js      # Full match lifecycle
  ignition/modules/
    deploy.js                # Hardhat Ignition deployment
  scripts/
    grantRoles.js            # Post-deploy role setup
  hardhat.config.js
  package.json
  .env
  .gitignore
```

---

## Phase 0: Environment Setup (~30 min)

### Step 0.1 — Install Prerequisites

```bash
mkdir momentbid-contracts && cd momentbid-contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox dotenv
npm install @openzeppelin/contracts
npx hardhat init    # Select "Create a JavaScript project"
```

### Step 0.2 — hardhat.config.js

```javascript
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  networks: {
    wirefluid: {
      url: "https://evm.wirefluid.com",
      chainId: 92533,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      gasPrice: 10000000000  // 10 Gwei minimum
    },
    localhost: {
      url: "http://127.0.0.1:8545"
    }
  },
  etherscan: {
    apiUrl: "https://wirefluidscan.com",
    apiKey: process.env.EXPLORER_API_KEY || "placeholder"
  }
};
```

### Step 0.3 — .env

```
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY_HERE
PLATFORM_WALLET=0xYOUR_PLATFORM_FEE_WALLET
ORACLE_WALLET=0xORACLE_WALLET_ADDRESS
MBT_CONTRACT_ADDRESS=
MOMENTBID_CORE_ADDRESS=
EXCLUSION_MANAGER_ADDRESS=
ORACLE_CONTROLLER_ADDRESS=
```

**PITFALL**: Never commit `.env` to git. Add to `.gitignore` immediately.

### Step 0.4 — Verify Setup

```bash
npx hardhat compile      # Should succeed (empty contracts dir is fine)
npx hardhat node         # Starts local Hardhat node for testing
```

---

## Phase 1: MomentBidToken.sol — The ERC20 Token (~1-2 hours)

Simplest contract. Perfect starting point to build confidence.

### What It Does
MBT is the bidding currency. 1 MBT = 1 PKR. Backend calls `mint()` when brand deposits fiat. Standard ERC20 gives `transfer`, `approve`, `transferFrom`, `balanceOf` for free.

### Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract MomentBidToken is ERC20, AccessControl, Pausable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    error MintToZeroAddress();
    error MintAmountZero();

    event TokensMinted(address indexed to, uint256 amount);

    constructor() ERC20("MomentBid Token", "MBT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (to == address(0)) revert MintToZeroAddress();
        if (amount == 0) revert MintAmountZero();
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 0;  // 1 MBT = 1 PKR, no decimals needed
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
```

### Beginner Notes
- **`decimals() returns 0`**: Most ERC20s use 18 decimals. We use 0 because 1 MBT = 1 PKR exactly. `amount = 300000` means 300,000 PKR.
- **`MINTER_ROLE`**: Deployer gets it. Later, grant to backend's admin wallet so web3.py can call `mint()`.
- **Custom errors**: `if (x == 0) revert MintAmountZero();` costs less gas than `require(x > 0, "Amount must be > 0");`. Always use custom errors.
- **OpenZeppelin handles everything**: `ERC20` gives transfer/approve/transferFrom/balanceOf. `AccessControl` gives role-based permissions. `Pausable` gives emergency stop.

### Test Cases (test/MomentBidToken.test.js)
1. Admin can mint tokens to any address
2. Non-minter cannot mint (expect revert)
3. Cannot mint to zero address
4. Cannot mint zero amount
5. `decimals()` returns 0
6. `approve()` + `transferFrom()` works (critical for bid flow)
7. Admin can pause — minting fails when paused
8. Admin can grant MINTER_ROLE to another address

---

## Phase 2: ExclusionManager.sol — Competitor Separation (~2-3 hours)

### Why Build Before MomentBidCore
MomentBidCore calls ExclusionManager during auction resolution. Building it first means the core contract can reference a deployed address.

### What It Does
Broadcasters group competing brands (Pepsi + Coca-Cola). During auction resolution, MomentBidCore asks: "Is this brand eligible given who already won?" ExclusionManager checks separation distance and returns true/false.

### Storage Layout & Functions

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract ExclusionManager is AccessControl {

    // ──── Structs ────
    struct ExclusionGroup {
        address[] brands;
        uint8 separationDistance;     // min slots between group members
        bool crossEventSeparation;   // if true, counts across event types
        bool locked;                 // locked when match goes OPEN
        bool exists;
    }

    // ──── Storage ────
    mapping(uint256 => ExclusionGroup) public groups;          // groupId => group
    mapping(address => uint256) public brandToGroup;           // brand => groupId (0 = none)

    // ──── Roles ────
    bytes32 public constant BROADCASTER_ROLE = keccak256("BROADCASTER_ROLE");

    // ──── Custom Errors ────
    error GroupAlreadyExists(uint256 groupId);
    error GroupDoesNotExist(uint256 groupId);
    error GroupIsLocked(uint256 groupId);
    error BrandAlreadyInGroup(address brand);
    error BrandNotInGroup(address brand);
    error InvalidSeparationDistance();
    error ZeroAddress();

    // ──── Events ────
    event ExclusionGroupCreated(uint256 indexed groupId, uint8 separationDistance, bool crossEventSeparation);
    event BrandAddedToGroup(uint256 indexed groupId, address indexed brand);
    event BrandRemovedFromGroup(uint256 indexed groupId, address indexed brand);
    event SeparationUpdated(uint256 indexed groupId, uint8 newDistance);
    event GroupLocked(uint256 indexed groupId);
    event AdminOverride(uint256 indexed groupId);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // ──── Functions to Implement ────

    function createExclusionGroup(
        uint256 groupId, address[] calldata brands,
        uint8 separationDistance, bool crossEventSeparation
    ) external onlyRole(BROADCASTER_ROLE);
    // Creates group, adds each brand, sets separation. Reverts if groupId exists.

    function addBrandToGroup(uint256 groupId, address brand) external onlyRole(BROADCASTER_ROLE);
    // Requires: group exists, not locked, brand not already in a group

    function removeBrandFromGroup(uint256 groupId, address brand) external onlyRole(BROADCASTER_ROLE);
    // Requires: group exists, not locked, brand is in this group

    function lockGroup(uint256 groupId) external;
    // Called by MomentBidCore when match transitions CREATED→OPEN

    function adminOverride(
        uint256 groupId, address[] calldata newBrands,
        uint8 newSeparation, bool newCrossEvent
    ) external onlyRole(DEFAULT_ADMIN_ROLE);
    // Emergency override — works even when locked

    function isEligible(address brand, address[] calldata recentWinners)
        external view returns (bool);
    // Called by MomentBidCore during auction resolution
    // Logic:
    //   1. Get brand's groupId (if 0, not in any group → return true)
    //   2. Get group's separationDistance
    //   3. Check recentWinners from end backwards (up to separationDistance entries)
    //   4. If any recent winner is in the same group → return false
    //   5. Otherwise → return true

    // ──── Views ────
    function getGroupBrands(uint256 groupId) external view returns (address[] memory);
    function getGroupInfo(uint256 groupId) external view returns (
        uint8 separationDistance, bool crossEventSeparation, bool locked, uint256 brandCount
    );
}
```

### Beginner Notes
- **`calldata` vs `memory`**: Use `calldata` for external function array params (cheaper, read-only). Use `memory` for internal functions.
- **`isEligible` logic**: Walks backward through `recentWinners`, checks if any winner shares same exclusion group. The `recentWinners` array is maintained by MomentBidCore — not stored here.
- **`crossEventSeparation`**: When true, MomentBidCore passes winners from ALL event types. When false, only same event type. ExclusionManager just checks the array it receives.
- **Brand can only be in ONE group**: Simplifies lookup via `brandToGroup` mapping.

### Test Cases (test/ExclusionManager.test.js)
1. Broadcaster creates exclusion group with 3 brands
2. Cannot create group with same ID twice
3. Add brand to existing group
4. Remove brand from group
5. Cannot add/remove after group is locked
6. Admin CAN override even after lock
7. `isEligible` returns true when brand not in any group
8. `isEligible` returns false when recent winner is in same group within separation distance
9. `isEligible` returns true when winner is in same group but OUTSIDE separation distance
10. Brand cannot be in two groups simultaneously
11. Non-broadcaster cannot create groups

---

## Phase 3: MomentBidCore.sol — The Main Auction Engine (~5-7 hours)

Build incrementally in sub-phases. This is the largest contract.

### Sub-Phase 3A: Storage Layout (~30 min)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract MomentBidCore is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ──── Enums ────
    enum MatchState { CREATED, OPEN, ACTIVE, COMPLETED, CANCELLED }

    // ──── Structs ────
    struct Match {
        address broadcaster;
        MatchState state;
        uint256 matchDate;
        bool exists;
    }

    struct EventConfig {
        bool enabled;
        uint256 reservePrice;
        uint8 reservationFeePercent;   // 1-5
        uint8 slotCount;               // ads per break
        uint8 maxTriggers;
        uint8 triggerCount;
    }

    struct Bid {
        address brand;
        uint256 amount;
        string creativeRef;
        bool exists;
    }

    // ──── Roles ────
    bytes32 public constant BROADCASTER_ROLE = keccak256("BROADCASTER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant BRAND_ROLE = keccak256("BRAND_ROLE");

    // ──── Immutables ────
    IERC20 public immutable mbtToken;
    address public immutable exclusionManager;
    address public platformWallet;
    uint8 public platformFeePercent;            // default 5

    // ──── State ────
    uint256 public nextMatchId;

    mapping(uint256 => Match) public matches;
    mapping(uint256 => mapping(uint8 => EventConfig)) public eventConfigs;
    mapping(uint256 => mapping(uint8 => Bid[])) internal bids;                      // max 20 per event
    mapping(uint256 => mapping(address => uint256)) public escrowBalance;            // brand's escrowed MBT
    mapping(uint256 => mapping(address => uint256)) public totalSpent;               // won auction totals
    mapping(uint256 => mapping(address => uint256)) public budgetCap;                // 0 = no cap
    mapping(uint256 => address[]) public recentWinnersGlobal;                        // for cross-event separation
    mapping(uint256 => mapping(uint8 => address[])) public recentWinnersPerEvent;    // for same-event separation
    mapping(uint256 => mapping(address => mapping(uint8 => bool))) public hasBid;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;
    mapping(uint256 => mapping(uint8 => bool)) public eventTriggered;
    mapping(uint256 => address[]) internal matchBidders;                             // for batch refund

    // ──── Custom Errors ────
    error MatchDoesNotExist(uint256 matchId);
    error InvalidStateTransition(MatchState current, MatchState requested);
    error MatchNotInState(uint256 matchId, MatchState required);
    error EventTypeNotEnabled(uint256 matchId, uint8 eventType);
    error BidBelowReserve(uint256 bid, uint256 reserve);
    error BidAlreadyPlaced(uint256 matchId, address brand, uint8 eventType);
    error MaxBiddersReached(uint256 matchId, uint8 eventType);
    error InsufficientAllowance(uint256 required, uint256 actual);
    error BudgetCapExceeded(uint256 cap, uint256 totalAfter);
    error NoBidToIncrease(uint256 matchId, address brand, uint8 eventType);
    error RefundAlreadyClaimed(uint256 matchId, address brand);
    error MatchNotSettled(uint256 matchId);
    error MaxTriggersReached(uint256 matchId, uint8 eventType);
    error ZeroAmount();
    error NotBroadcasterOfMatch(uint256 matchId);

    // ──── Events ────
    event MatchCreated(uint256 indexed matchId, address indexed broadcaster, uint256 matchDate);
    event MatchStateChanged(uint256 indexed matchId, MatchState newState);
    event EventConfigured(uint256 indexed matchId, uint8 indexed eventType, uint256 reservePrice, uint8 slotCount);
    event BidPlaced(uint256 indexed matchId, uint8 indexed eventType, address indexed brand, uint256 amount, string creativeRef);
    event BidIncreased(uint256 indexed matchId, uint8 indexed eventType, address indexed brand, uint256 newTotal);
    event BudgetCapSet(uint256 indexed matchId, address indexed brand, uint256 cap);
    event FundsEscrowed(uint256 indexed matchId, address indexed brand, uint256 amount);
    event AuctionSettled(uint256 indexed matchId, uint8 eventType, address winner, uint256 amount, string creativeRef, uint8 slotPosition, uint8 triggerNumber);
    event PartialFill(uint256 indexed matchId, uint8 eventType, uint8 slotsFilled, uint8 totalSlots);
    event NoEligibleBidder(uint256 indexed matchId, uint8 eventType, uint8 slotPosition);
    event RefundProcessed(uint256 indexed matchId, address indexed brand, uint256 refundAmount, uint256 reservationFee);

    constructor(address _mbtToken, address _exclusionManager, address _platformWallet, uint8 _platformFeePercent) {
        mbtToken = IERC20(_mbtToken);
        exclusionManager = _exclusionManager;
        platformWallet = _platformWallet;
        platformFeePercent = _platformFeePercent;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
```

### Sub-Phase 3B: Match Lifecycle (~1 hour)

```solidity
    function createMatch(uint256 matchDate)
        external onlyRole(BROADCASTER_ROLE) whenNotPaused returns (uint256)
    {
        uint256 matchId = nextMatchId++;
        matches[matchId] = Match(msg.sender, MatchState.CREATED, matchDate, true);
        emit MatchCreated(matchId, msg.sender, matchDate);
        return matchId;
    }

    function defineEventType(
        uint256 matchId, uint8 eventType, uint256 reservePrice,
        uint8 reservationFeePercent, uint8 slotCount, uint8 maxTriggers
    ) external onlyRole(BROADCASTER_ROLE) whenNotPaused {
        // Requires: match exists, CREATED state, caller is match broadcaster
        // Requires: reservationFeePercent 1-5, eventType 0-7
        // Stores: eventConfigs[matchId][eventType] = EventConfig(...)
    }

    function transitionMatchState(uint256 matchId, MatchState newState) external whenNotPaused {
        // State machine validation:
        //   CREATED → OPEN:      broadcaster of this match or admin
        //   OPEN → ACTIVE:       broadcaster of this match or admin
        //   ACTIVE → COMPLETED:  admin only
        //   ACTIVE → CANCELLED:  admin only
        //   CREATED/OPEN → CANCELLED: admin only
        // Side effect on CREATED → OPEN: lock relevant exclusion groups
    }

    // Helper: validate state transition
    function _validateTransition(MatchState current, MatchState next) internal pure returns (bool) {
        if (current == MatchState.CREATED && (next == MatchState.OPEN || next == MatchState.CANCELLED)) return true;
        if (current == MatchState.OPEN && (next == MatchState.ACTIVE || next == MatchState.CANCELLED)) return true;
        if (current == MatchState.ACTIVE && (next == MatchState.COMPLETED || next == MatchState.CANCELLED)) return true;
        return false;
    }
```

### Sub-Phase 3C: Bidding Functions (~1.5 hours)

```solidity
    function placeBid(
        uint256 matchId, uint8 eventType, uint256 amount, string calldata creativeRef
    ) external onlyRole(BRAND_ROLE) nonReentrant whenNotPaused {
        // STEP 1: Validate
        //   - Match exists, OPEN state
        //   - Event type enabled, amount >= reservePrice, amount > 0
        //   - Brand hasn't already bid on this event, bids array < 20 entries
        // STEP 2: Transfer tokens
        //   mbtToken.safeTransferFrom(msg.sender, address(this), amount);
        //   (Requires brand wallet called mbtToken.approve(this, amount) first — backend handles)
        // STEP 3: Record
        //   bids[matchId][eventType].push(Bid(msg.sender, amount, creativeRef, true));
        //   escrowBalance[matchId][msg.sender] += amount;
        //   hasBid[matchId][msg.sender][eventType] = true;
        // STEP 4: Track bidder (if first bid on this match, add to matchBidders)
        // STEP 5: Emit BidPlaced + FundsEscrowed
    }

    function increaseBid(
        uint256 matchId, uint8 eventType, uint256 additionalAmount
    ) external onlyRole(BRAND_ROLE) nonReentrant whenNotPaused {
        // Validate: match OPEN, brand has existing bid, additionalAmount > 0
        // Find bid: iterate bids[matchId][eventType] for msg.sender
        // Transfer additional: mbtToken.safeTransferFrom(...)
        // Update bid.amount and escrowBalance
        // Emit BidIncreased
    }

    function setBudgetCap(uint256 matchId, uint256 cap)
        external onlyRole(BRAND_ROLE) whenNotPaused
    {
        // Validate: match exists, OPEN or ACTIVE state
        budgetCap[matchId][msg.sender] = cap;
        emit BudgetCapSet(matchId, msg.sender, cap);
    }

    // Helper: find brand's bid index in array
    function _findBidIndex(uint256 matchId, uint8 eventType, address brand)
        internal view returns (uint256)
    {
        Bid[] storage eventBids = bids[matchId][eventType];
        for (uint256 i = 0; i < eventBids.length; i++) {
            if (eventBids[i].brand == brand) return i;
        }
        revert NoBidToIncrease(matchId, brand, eventType);
    }
```

**PITFALL**: Always use `SafeERC20` via `using SafeERC20 for IERC20;`. Then `mbtToken.safeTransferFrom(...)` instead of raw `transferFrom`. It's a best practice that costs nothing extra.

### Sub-Phase 3D: Auction Resolution — Core Algorithm (~2-3 hours)

This is the most complex function. **Max-iteration approach** (NOT sorting) for gas efficiency.

```solidity
    function resolveAuction(uint256 matchId, uint8 eventType)
        external nonReentrant whenNotPaused
    {
        // Caller: only OracleController contract address (grant ORACLE_ROLE to OracleController)

        // Mark event as triggered + increment trigger count
        eventTriggered[matchId][eventType] = true;
        EventConfig storage config = eventConfigs[matchId][eventType];
        config.triggerCount++;

        Bid[] storage eventBids = bids[matchId][eventType];
        uint8 slotCount = config.slotCount;
        uint8 slotsFilled = 0;
        bool[] memory alreadyWon = new bool[](eventBids.length);  // track per-trigger wins
        uint256 totalBroadcasterShare = 0;
        uint256 totalPlatformShare = 0;

        // For each slot: find highest eligible bidder
        for (uint8 slot = 0; slot < slotCount; slot++) {
            uint256 highestAmount = 0;
            uint256 highestIndex = type(uint256).max;  // sentinel = "not found"

            for (uint256 i = 0; i < eventBids.length; i++) {
                Bid storage bid = eventBids[i];

                if (alreadyWon[i]) continue;                                          // already won this trigger
                if (bid.amount < config.reservePrice) continue;                       // below reserve
                if (escrowBalance[matchId][bid.brand] < bid.amount) continue;         // insufficient escrow
                uint256 cap = budgetCap[matchId][bid.brand];
                if (cap > 0 && totalSpent[matchId][bid.brand] + bid.amount > cap) continue;  // budget cap
                if (!_checkExclusionEligibility(matchId, eventType, bid.brand)) continue;     // exclusion rules

                if (bid.amount > highestAmount) {
                    highestAmount = bid.amount;
                    highestIndex = i;
                }
            }

            if (highestIndex == type(uint256).max) {
                emit NoEligibleBidder(matchId, eventType, slot + 1);
            } else {
                slotsFilled++;
                Bid storage winnerBid = eventBids[highestIndex];
                alreadyWon[highestIndex] = true;

                escrowBalance[matchId][winnerBid.brand] -= winnerBid.amount;
                totalSpent[matchId][winnerBid.brand] += winnerBid.amount;

                uint256 platformShare = (winnerBid.amount * platformFeePercent) / 100;
                uint256 broadcasterShare = winnerBid.amount - platformShare;
                totalPlatformShare += platformShare;
                totalBroadcasterShare += broadcasterShare;

                recentWinnersGlobal[matchId].push(winnerBid.brand);
                recentWinnersPerEvent[matchId][eventType].push(winnerBid.brand);

                emit AuctionSettled(matchId, eventType, winnerBid.brand,
                    winnerBid.amount, winnerBid.creativeRef, slot + 1, config.triggerCount);
            }
        }

        // Batched transfers: exactly 2 instead of 2N
        address broadcaster = matches[matchId].broadcaster;
        if (totalBroadcasterShare > 0) mbtToken.safeTransfer(broadcaster, totalBroadcasterShare);
        if (totalPlatformShare > 0) mbtToken.safeTransfer(platformWallet, totalPlatformShare);

        if (slotsFilled < slotCount) {
            emit PartialFill(matchId, eventType, slotsFilled, slotCount);
        }
    }
```

**Exclusion eligibility bridge** — connects MomentBidCore to ExclusionManager:

```solidity
    function _checkExclusionEligibility(
        uint256 matchId, uint8 eventType, address brand
    ) internal view returns (bool) {
        IExclusionManager em = IExclusionManager(exclusionManager);
        uint256 groupId = em.brandToGroup(brand);
        if (groupId == 0) return true;  // brand not in any group

        (, bool crossEvent, ,) = em.getGroupInfo(groupId);

        address[] memory winners;
        if (crossEvent) {
            winners = recentWinnersGlobal[matchId];
        } else {
            winners = recentWinnersPerEvent[matchId][eventType];
        }

        return em.isEligible(brand, winners);
    }
```

**Gas budget**: Worst-case SUPER_OVER (8 slots, 20 bidders) = ~283K gas = ~0.00283 WIRE. Typical OVER_BREAK (3 slots, 15 bidders) = ~120K gas. Negligible cost.

### Sub-Phase 3E: Refund Functions (~1 hour)

```solidity
    function claimRefund(uint256 matchId) external onlyRole(BRAND_ROLE) nonReentrant whenNotPaused {
        // Validate: COMPLETED or CANCELLED, not already claimed
        // Calculate reservation fees for untriggered events
        // refundAmount = escrowBalance[matchId][msg.sender] - totalReservationFees
        // Set escrowBalance = 0, refundClaimed = true BEFORE transfers (reentrancy protection)
        // Transfer refundAmount to brand
        // Transfer totalReservationFees to broadcaster
        // Emit RefundProcessed
    }

    function batchRefund(uint256 matchId, address[] calldata brands)
        external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant whenNotPaused
    {
        // Same logic as claimRefund, loops over brands[] array
    }

    // Helper: calculate reservation fees
    function _calculateReservationFees(uint256 matchId, address brand)
        internal view returns (uint256 totalFees)
    {
        if (matches[matchId].state == MatchState.CANCELLED) return 0; // cancelled = no fees

        for (uint8 et = 0; et < 8; et++) {
            if (!hasBid[matchId][brand][et]) continue;
            if (eventTriggered[matchId][et]) continue;  // event triggered = no fee

            // Event never triggered → reservation fee applies
            Bid storage bid = bids[matchId][et][_findBidIndex(matchId, et, brand)];
            totalFees += (bid.amount * eventConfigs[matchId][et].reservationFeePercent) / 100;
        }
    }
```

**Refund Rules Summary:**

| Scenario | Refund | Reservation Fee |
|---|---|---|
| Event triggered, brand WON | Already settled (escrow deducted) | 0 |
| Event triggered, brand LOST | 100% of bid | 0 |
| Event NEVER triggered | (100% - fee%) of bid | fee% to broadcaster |
| Match CANCELLED (unsettled) | 100% of bid | 0 |
| Match CANCELLED (already settled) | No refund — settlement is final | 0 |

**CRITICAL PITFALL**: Set `refundClaimed = true` and `escrowBalance = 0` BEFORE calling `safeTransfer`. State changes before external calls = reentrancy safe. The `nonReentrant` modifier is an additional safety net.

### Sub-Phase 3F: View Functions (~30 min)

```solidity
    function getMatchState(uint256 matchId) external view returns (MatchState);
    function getEventConfig(uint256 matchId, uint8 eventType) external view returns (
        bool enabled, uint256 reservePrice, uint8 reservationFeePercent,
        uint8 slotCount, uint8 maxTriggers, uint8 triggerCount
    );
    function getBids(uint256 matchId, uint8 eventType) external view returns (Bid[] memory);
    function getEscrowBalance(uint256 matchId, address brand) external view returns (uint256);
    function getBudgetCap(uint256 matchId, address brand) external view returns (uint256);
    function getTotalSpent(uint256 matchId, address brand) external view returns (uint256);
    function getMatchBidders(uint256 matchId) external view returns (address[] memory);
```

### MomentBidCore Test Cases (test/MomentBidCore.test.js)

**Match Management:**
- T1: createMatch emits MatchCreated, returns incrementing matchId
- T2: Non-broadcaster cannot create match
- T3: defineEventType stores config correctly
- T4: Cannot define events after OPEN state
- T5: State transitions follow machine rules (CREATED→OPEN→ACTIVE→COMPLETED)
- T6: Invalid transitions revert (e.g., CREATED→ACTIVE)

**Bidding:**
- T7: Brand places bid, tokens transferred to contract
- T8: Bid below reserve price reverts
- T9: Second bid on same event type reverts
- T10: Bid during non-OPEN state reverts
- T11: increaseBid adds to existing bid amount
- T12: setBudgetCap stores correctly
- T13: 21st bidder on same event type reverts (max 20 cap)
- T14: Non-brand cannot place bid

**Auction Resolution:**
- T15: 3 bids, 3 slots — everyone wins
- T16: 5 bids, 3 slots — top 3 win, 2 lose
- T17: Slot 1 → highest bidder, Slot 2 → second, etc.
- T18: Bid below reserve skipped
- T19: Brand with insufficient escrow (from previous win) skipped
- T20: Budget cap enforcement — brand skipped when totalSpent + bid > cap
- T21: Exclusion group enforcement — competing brand skipped
- T22: PartialFill emitted when fewer winners than slots
- T23: NoEligibleBidder emitted when no bids
- T24: Broadcaster receives 95%, platform receives 5%
- T25: Exactly 2 token transfers per resolution (batched)
- T26: Same brand cannot win 2 slots in same trigger
- T27: Multiple triggers of same event type work independently

**Refunds:**
- T28: After COMPLETED, losing brand gets 100% refund (event triggered, lost)
- T29: Untriggered event gets (100% - reservationFee)
- T30: After CANCELLED, untriggered events get 100%, 0 fee
- T31: Already-settled wins NOT refunded on cancellation
- T32: Cannot claim refund twice
- T33: batchRefund processes multiple brands (admin only)

**Security:**
- T34: Reentrancy on claimRefund fails (ReentrancyGuard)
- T35: Pausing blocks all operations
- T36: No function allows direct withdrawal of escrowed funds

---

## Phase 4: OracleController.sol — Event Trigger Validation (~1 hour)

Thin validation layer. Oracle wallet → OracleController → MomentBidCore.resolveAuction().

### Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IMomentBidCore {
    function getEventConfig(uint256 matchId, uint8 eventType) external view returns (
        bool enabled, uint256 reservePrice, uint8 reservationFeePercent,
        uint8 slotCount, uint8 maxTriggers, uint8 triggerCount
    );
    function getMatchState(uint256 matchId) external view returns (uint8);
    function resolveAuction(uint256 matchId, uint8 eventType) external;
}

contract OracleController is AccessControl, Pausable {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    IMomentBidCore public immutable core;

    error MatchNotActive(uint256 matchId);
    error EventNotEnabled(uint256 matchId, uint8 eventType);
    error MaxTriggersReached(uint256 matchId, uint8 eventType, uint8 current, uint8 max);

    event EventTriggered(uint256 indexed matchId, uint8 indexed eventType, uint8 triggerNumber);

    constructor(address _coreAddress) {
        core = IMomentBidCore(_coreAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function triggerEvent(uint256 matchId, uint8 eventType)
        external onlyRole(ORACLE_ROLE) whenNotPaused
    {
        // Step 1: Match must be ACTIVE (state == 2)
        uint8 state = core.getMatchState(matchId);
        if (state != 2) revert MatchNotActive(matchId);

        // Step 2: Event enabled + not over max triggers
        (bool enabled, , , , uint8 maxTriggers, uint8 triggerCount) = core.getEventConfig(matchId, eventType);
        if (!enabled) revert EventNotEnabled(matchId, eventType);
        if (triggerCount >= maxTriggers) revert MaxTriggersReached(matchId, eventType, triggerCount, maxTriggers);

        // Step 3: Resolve auction
        core.resolveAuction(matchId, eventType);

        // Step 4: Emit
        emit EventTriggered(matchId, eventType, triggerCount + 1);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
}
```

### Beginner Notes
- **Interface pattern**: `IMomentBidCore` declares only the functions we call. Constructor takes deployed address.
- **Two separate role grants needed**: Oracle wallet gets ORACLE_ROLE on OracleController. OracleController contract address gets ORACLE_ROLE on MomentBidCore (so it can call `resolveAuction`). These are on DIFFERENT contracts — common mistake.
- **Trigger count checked here, incremented in MomentBidCore**: Avoids race conditions.

### Test Cases (test/OracleController.test.js)
1. Oracle triggers event successfully, resolveAuction called
2. Non-oracle cannot trigger events
3. Cannot trigger on non-ACTIVE match
4. Cannot trigger disabled event type
5. Cannot trigger beyond maxTriggers
6. Admin can pause/unpause

---

## Phase 5: Deployment (~1 hour)

### Deployment Order (dependencies flow downward)

```
1. MomentBidToken          ← no dependencies
2. ExclusionManager        ← no dependencies
3. MomentBidCore           ← needs MBT address + ExclusionManager address
4. OracleController        ← needs MomentBidCore address
```

### Hardhat Ignition Script (ignition/modules/deploy.js)

```javascript
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("MomentBidDeploy", (m) => {
  const platformWallet = m.getParameter("platformWallet");
  const platformFeePercent = m.getParameter("platformFeePercent", 5);

  const token = m.contract("MomentBidToken");
  const exclusionMgr = m.contract("ExclusionManager");
  const core = m.contract("MomentBidCore", [token, exclusionMgr, platformWallet, platformFeePercent]);
  const oracleCtrl = m.contract("OracleController", [core]);

  return { token, exclusionMgr, core, oracleCtrl };
});
```

### Post-Deploy Role Grants (scripts/grantRoles.js)

After deploying all 4 contracts, grant roles:

```javascript
async function main() {
  const [deployer] = await ethers.getSigners();

  // Load deployed addresses from .env
  const token = await ethers.getContractAt("MomentBidToken", process.env.MBT_CONTRACT_ADDRESS);
  const core = await ethers.getContractAt("MomentBidCore", process.env.MOMENTBID_CORE_ADDRESS);
  const exclusionMgr = await ethers.getContractAt("ExclusionManager", process.env.EXCLUSION_MANAGER_ADDRESS);
  const oracleCtrl = await ethers.getContractAt("OracleController", process.env.ORACLE_CONTROLLER_ADDRESS);

  const ORACLE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"));
  const BROADCASTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BROADCASTER_ROLE"));
  const BRAND_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BRAND_ROLE"));
  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

  // 1. OracleController can call resolveAuction on MomentBidCore
  await core.grantRole(ORACLE_ROLE, process.env.ORACLE_CONTROLLER_ADDRESS);

  // 2. Oracle wallet can trigger events on OracleController
  await oracleCtrl.grantRole(ORACLE_ROLE, process.env.ORACLE_WALLET);

  // 3. Backend admin wallet can mint MBT (for deposit flow)
  // (deployer already has MINTER_ROLE, but grant to backend admin if different wallet)

  // 4. Brand/Broadcaster roles granted dynamically by backend when users register
  // For demo: can hardcode initial addresses here

  console.log("All roles granted.");
}

main().catch(console.error);
```

**Deploy commands:**
```bash
# Local test
npx hardhat ignition deploy ignition/modules/deploy.js --network localhost

# WireFluid testnet
npx hardhat ignition deploy ignition/modules/deploy.js --network wirefluid \
  --parameters '{"platformWallet": "0xPLATFORM", "platformFeePercent": 5}'

# Grant roles
npx hardhat run scripts/grantRoles.js --network wirefluid
```

---

## Phase 6: Integration Test — Full Match Lifecycle (~2 hours)

File: `test/integration.test.js` — The most important test. Simulates the complete demo.

```javascript
describe("Full Match Integration", function () {
  let token, core, exclusionMgr, oracleCtrl;
  let admin, broadcaster, brand1, brand2, brand3, oracle, platform;

  beforeEach(async function () {
    // Deploy all 4 contracts, grant all roles
    // Mint 1,000,000 MBT to each brand
  });

  it("complete match lifecycle", async function () {
    // === SETUP ===
    // 1. Broadcaster creates match
    // 2. Define OVER_BREAK (reserve=100K, fee=3%, 3 slots, max 40)
    // 3. Define WICKET_FALL (reserve=50K, fee=2%, 2 slots, max 20)
    // 4. Create exclusion group: brand1 + brand2, separation=1
    // 5. Transition CREATED → OPEN (locks exclusion groups)

    // === BIDDING ===
    // 6. Brand1: approve + bid OVER_BREAK 300K
    // 7. Brand2: approve + bid OVER_BREAK 350K
    // 8. Brand3: approve + bid OVER_BREAK 200K
    // 9. Brand1: approve + bid WICKET_FALL 250K
    // 10. Brand2: approve + bid WICKET_FALL 150K
    // 11. Brand1: increase OVER_BREAK bid by 100K → 400K total

    // Verify escrow: brand1=650K, brand2=500K, brand3=200K

    // === MATCH ACTIVE ===
    // 12. Admin transitions OPEN → ACTIVE

    // === TRIGGER OVER_BREAK ===
    // 13. Oracle triggers OVER_BREAK
    //   Slot 1: brand1 (400K) — highest
    //   Slot 2: brand2 (350K) — BUT in exclusion group with brand1 → SKIPPED
    //           brand3 (200K) — next eligible → wins
    //   Slot 3: no more eligible → NoEligibleBidder
    //   PartialFill(2/3)
    //
    //   Broadcaster receives: (400K + 200K) * 95% = 570K
    //   Platform receives: (400K + 200K) * 5% = 30K
    //   brand1 escrow: 650K - 400K = 250K
    //   brand3 escrow: 200K - 200K = 0

    // === TRIGGER WICKET_FALL ===
    // 14. Oracle triggers WICKET_FALL (crossEventSeparation=false)
    //   Slot 1: brand1 (250K)
    //   Slot 2: brand2 (150K) — in exclusion group, but intra-trigger exclusion → SKIPPED
    //           NoEligibleBidder
    //   PartialFill(1/2)

    // === COMPLETE MATCH ===
    // 15. Admin transitions ACTIVE → COMPLETED

    // === REFUNDS ===
    // 16. brand1: escrow 250K - 250K (won WICKET_FALL) = 0, nothing to refund
    // 17. brand2: escrow 500K, OVER_BREAK triggered (lost=0% fee), WICKET_FALL triggered (lost=0% fee)
    //     → 100% refund = 500K
    // 18. brand3: escrow 0, nothing to refund

    // Verify final balances
  });
});
```

---

## Phase 7: Deploy to WireFluid Testnet (~30 min)

### Prerequisites
1. Get WIRE from faucet: faucet.wirefluid.com (10 WIRE, enough for hundreds of deploys)
2. Set deployer private key in `.env`
3. All tests pass on local Hardhat node

### Deploy & Verify
```bash
npx hardhat ignition deploy ignition/modules/deploy.js --network wirefluid \
  --parameters '{"platformWallet": "0x...", "platformFeePercent": 5}'

npx hardhat run scripts/grantRoles.js --network wirefluid
```

### Post-Deploy Checklist
1. All 4 contract addresses printed in console
2. Verify on wirefluidscan.com — search each address
3. Copy ABIs from `artifacts/contracts/*/` to Django backend `blockchain/abis/`
4. Update Django `.env` with contract addresses + `USE_MOCK_BLOCKCHAIN=False`
5. Smoke test via Hardhat console:

```bash
npx hardhat console --network wirefluid
```
```javascript
const token = await ethers.getContractAt("MomentBidToken", "0xDEPLOYED_ADDR");
await token.mint("0xTEST_WALLET", 1000);
const bal = await token.balanceOf("0xTEST_WALLET");
console.log(bal); // should print 1000n
```

---

## ABI Export for Django Backend

After `npx hardhat compile`, Hardhat generates:
```
artifacts/contracts/MomentBidToken.sol/MomentBidToken.json
artifacts/contracts/MomentBidCore.sol/MomentBidCore.json
artifacts/contracts/ExclusionManager.sol/ExclusionManager.json
artifacts/contracts/OracleController.sol/OracleController.json
```

Each JSON has an `"abi"` field — that's what the Django backend's `web3_service.py` loads. Copy these 4 files to `backend/blockchain/abis/` after every recompile.

---

## Common Beginner Pitfalls

1. **Forgetting `approve()` before `transferFrom()`**: ERC20 requires `approve(spender, amount)` BEFORE `transferFrom`. Backend handles this as 2-tx sequence. Without it, transferFrom reverts with cryptic error.

2. **Storage vs memory vs calldata**: `storage` for contract state reads/writes. `memory` for temporary copies. `calldata` for external function params (cheapest, read-only). Never use `storage` for function parameters.

3. **Integer division truncation**: `(amount * 5) / 100` truncates. For 333 tokens at 5%, gives 16 not 16.65. Fine since MBT has 0 decimals.

4. **State changes BEFORE external calls**: In `claimRefund`, set `refundClaimed = true` and `escrowBalance = 0` BEFORE `safeTransfer`. The `nonReentrant` modifier is backup.

5. **Role hash matching**: `keccak256("ORACLE_ROLE")` in Solidity = `ethers.keccak256(ethers.toUtf8Bytes("ORACLE_ROLE"))` in JavaScript. Must match exactly.

6. **Struct with mapping**: Solidity doesn't allow structs with mappings in memory. That's why `EventConfig` is a separate mapping, not inside `Match` struct.

7. **Array deletion**: No dynamic array deletion with shift. Mark as inactive (`exists = false`) instead.

8. **Gas limit on loops**: The 20-bidder cap per event bounds worst-case gas to ~283K. Without it, attacker could add thousands of tiny bids and make `resolveAuction` run out of gas.

---

## Implementation Timeline

| Phase | What | Time | Depends On | Backend Unblocked |
|-------|------|------|------------|-------------------|
| 0 | Environment setup | 30 min | — | — |
| 1 | MomentBidToken.sol + tests | 1-2h | Phase 0 | Backend can test minting |
| 2 | ExclusionManager.sol + tests | 2-3h | Phase 0 | — |
| 3A-3C | MomentBidCore: match + bidding | 3-4h | Phase 1, 2 | Backend can test bids |
| 3D | Auction resolution + tests | 2-3h | Phase 3A-3C | **Backend can do full integration** |
| 3E-3F | Refunds + views + tests | 1-2h | Phase 3D | — |
| 4 | OracleController.sol + tests | 1h | Phase 3 | — |
| 5 | Deploy script | 1h | Phase 1-4 | — |
| 6 | Integration test | 2h | Phase 1-4 | — |
| 7 | WireFluid testnet deploy | 30 min | Phase 5-6 | **Full chain live** |
| **Total** | | **14-19h** | | |

**Critical path for backend integration**: Phases 0→1→2→3A-3D (~8-12h). Backend developer uses mock service until then.

---

## Verification Plan

1. `npx hardhat test` — all unit tests pass on local Hardhat node
2. `npx hardhat test test/integration.test.js` — full match lifecycle passes
3. Deploy to WireFluid testnet, verify contracts on wirefluidscan.com
4. Smoke test: mint MBT, check balance on explorer
5. Copy ABIs to Django backend, switch `USE_MOCK_BLOCKCHAIN=False`
6. Full end-to-end: register brand → deposit (mint MBT) → create match → bid → trigger event → auction resolves → refund
7. Verify event logs on wirefluidscan.com match what Django indexer captures
