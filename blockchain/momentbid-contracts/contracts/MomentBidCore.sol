// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IExclusionManager.sol";

/**
 * @title MomentBidCore
 * @dev Main auction engine for MomentBid
 * 
 * Functionality:
 * - Broadcasters create matches and define event types (ads in TV breaks)
 * - Brands place bids in MBT (1 MBT = 1 PKR) to compete for ad slots
 * - Oracle triggers auction resolution per event type per match
 * - Settlement: winners pay, losers get refunds, broadcasters get proceeds
 * 
 * Flow:
 * 1. Broadcaster creates match, defines event types (reserve price, slots, fees)
 * 2. Match transitions CREATED → OPEN (brands can now bid)
 * 3. Brands place/increase bids, escrowed in contract
 * 4. Oracle calls resolveAuction when ad break occurs
 * 5. Settlement: top N bidders win slots, funds distributed
 * 6. After match COMPLETED/CANCELLED, brands claim refunds
 */
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
        uint8 reservationFeePercent;   // 1-5: fee if event never triggered
        uint8 slotCount;               // ads per break/event
        uint8 maxTriggers;             // max times this event can resolve
        uint8 triggerCount;            // current trigger count
    }
    
    struct Bid {
        address brand;
        uint256 amount;
        string creativeRef;
    }
    
    // ──── Constants ────
    bytes32 public constant BROADCASTER_ROLE = keccak256("BROADCASTER_ROLE");
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    bytes32 public constant BRAND_ROLE = keccak256("BRAND_ROLE");
    uint8 public constant MAX_EVENT_TYPES = 8;
    uint8 public constant MAX_BIDS_PER_EVENT = 20;
    
    // ──── Immutables ────
    IERC20 public immutable mbtToken;
    address public immutable exclusionManager;
    address public platformWallet;
    uint8 public platformFeePercent;
    
    // ──── State ────
    uint256 public nextMatchId;
    
    mapping(uint256 => Match) public matches;
    mapping(uint256 => mapping(uint8 => EventConfig)) public eventConfigs;
    mapping(uint256 => mapping(uint8 => Bid[])) internal bids;
    mapping(uint256 => mapping(address => uint256)) public escrowBalance;
    mapping(uint256 => mapping(address => uint256)) public totalSpent;
    mapping(uint256 => mapping(address => uint256)) public budgetCap;
    mapping(uint256 => address[]) public recentWinnersGlobal;
    mapping(uint256 => mapping(uint8 => address[])) public recentWinnersPerEvent;
    mapping(uint256 => mapping(address => mapping(uint8 => bool))) public hasBid;
    mapping(uint256 => mapping(address => bool)) public refundClaimed;
    mapping(uint256 => mapping(uint8 => bool)) public eventTriggered;
    mapping(uint256 => address[]) internal matchBidders;
    mapping(uint256 => uint256[]) internal registeredExclusionGroups;
    mapping(uint256 => mapping(uint256 => bool)) internal isExclusionGroupRegistered;
    
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
    error InvalidEventType(uint8 eventType);
    error InvalidReservationFeePercent(uint8 percent);
    error InvalidPlatformFeePercent(uint8 percent);
    error AdminOnly();
    error BroadcasterOrAdminRequired();
    error InvalidGroupId(uint256 groupId);
    
    // ──── Events ────
    event MatchCreated(uint256 indexed matchId, address indexed broadcaster, uint256 matchDate);
    event MatchStateChanged(uint256 indexed matchId, MatchState newState);
    event EventConfigured(
        uint256 indexed matchId,
        uint8 indexed eventType,
        uint256 reservePrice,
        uint8 slotCount,
        uint8 reservationFeePercent,
        uint8 maxTriggers
    );
    event BidPlaced(
        uint256 indexed matchId,
        uint8 indexed eventType,
        address indexed brand,
        uint256 amount,
        string creativeRef
    );
    event BidIncreased(uint256 indexed matchId, uint8 indexed eventType, address indexed brand, uint256 newTotal);
    event BudgetCapSet(uint256 indexed matchId, address indexed brand, uint256 cap);
    event FundsEscrowed(uint256 indexed matchId, address indexed brand, uint256 amount);
    event AuctionSettled(
        uint256 indexed matchId,
        uint8 indexed eventType,
        address indexed winner,
        uint256 amount,
        string creativeRef,
        uint8 slotPosition,
        uint8 triggerNumber
    );
    event PartialFill(uint256 indexed matchId, uint8 indexed eventType, uint8 slotsFilled, uint8 totalSlots);
    event NoEligibleBidder(uint256 indexed matchId, uint8 indexed eventType, uint8 slotPosition);
    event RefundProcessed(
        uint256 indexed matchId,
        address indexed brand,
        uint256 refundAmount,
        uint256 reservationFees
    );
    event ExclusionGroupLocked(uint256 indexed matchId, uint256 groupId);
    
    // ──── Constructor ────
    constructor(
        address _mbtToken,
        address _exclusionManager,
        address _platformWallet,
        uint8 _platformFeePercent
    ) {
        if (_platformFeePercent > 100) revert InvalidPlatformFeePercent(_platformFeePercent);
        
        mbtToken = IERC20(_mbtToken);
        exclusionManager = _exclusionManager;
        platformWallet = _platformWallet;
        platformFeePercent = _platformFeePercent;
        nextMatchId = 1;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    // ──── Match Creation ────
    
    /**
     * @dev Creates a new match
     * @param matchDate Timestamp of the match
     * @return matchId Unique match identifier
     */
    function createMatch(uint256 matchDate)
        external
        onlyRole(BROADCASTER_ROLE)
        whenNotPaused
        returns (uint256)
    {
        uint256 matchId = nextMatchId++;
        matches[matchId] = Match(msg.sender, MatchState.CREATED, matchDate, true);
        emit MatchCreated(matchId, msg.sender, matchDate);
        return matchId;
    }
    
    /**
     * @dev Configures an event type within a match
     * @param matchId Match identifier
     * @param eventType Event type (0-7, e.g., 0=INTRO, 1=BREAK1)
     * @param reservePrice Minimum bid price in MBT
     * @param reservationFeePercent Fee if event triggered=false (1-5%)
     * @param slotCount Number of ad slots available
     * @param maxTriggers Maximum times this event can resolve
     */
    function defineEventType(
        uint256 matchId,
        uint8 eventType,
        uint256 reservePrice,
        uint8 reservationFeePercent,
        uint8 slotCount,
        uint8 maxTriggers
    ) external whenNotPaused {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        if (matches[matchId].state != MatchState.CREATED) {
            revert MatchNotInState(matchId, MatchState.CREATED);
        }
        if (msg.sender != matches[matchId].broadcaster) {
            revert NotBroadcasterOfMatch(matchId);
        }
        if (eventType >= MAX_EVENT_TYPES) revert InvalidEventType(eventType);
        if (reservationFeePercent < 1 || reservationFeePercent > 5) {
            revert InvalidReservationFeePercent(reservationFeePercent);
        }
        if (slotCount == 0 || maxTriggers == 0) revert ZeroAmount();
        
        eventConfigs[matchId][eventType] = EventConfig(
            true,
            reservePrice,
            reservationFeePercent,
            slotCount,
            maxTriggers,
            0
        );
        
        emit EventConfigured(
            matchId,
            eventType,
            reservePrice,
            slotCount,
            reservationFeePercent,
            maxTriggers
        );
    }

    /**
     * @dev Registers an exclusion group to be locked when match transitions CREATED -> OPEN.
     * @param matchId Match identifier
     * @param groupId Exclusion group identifier in ExclusionManager
     */
    function registerExclusionGroup(uint256 matchId, uint256 groupId)
        external
        whenNotPaused
    {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        if (matches[matchId].state != MatchState.CREATED) {
            revert MatchNotInState(matchId, MatchState.CREATED);
        }

        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool isBroadcaster = msg.sender == matches[matchId].broadcaster;
        if (!isBroadcaster && !isAdmin) revert BroadcasterOrAdminRequired();

        if (groupId == 0) revert InvalidGroupId(groupId);
        if (isExclusionGroupRegistered[matchId][groupId]) return;

        isExclusionGroupRegistered[matchId][groupId] = true;
        registeredExclusionGroups[matchId].push(groupId);
    }
    
    /**
     * @dev Transitions match between states
     * @param matchId Match identifier
     * @param newState Target state
     * 
     * State Machine:
     * CREATED → OPEN (broadcaster or admin)
     * OPEN → ACTIVE (broadcaster or admin)
     * ACTIVE → COMPLETED (admin only)
     * ACTIVE → CANCELLED (admin only)
     * CREATED/OPEN → CANCELLED (admin only)
     */
    function transitionMatchState(uint256 matchId, MatchState newState) external whenNotPaused {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        
        MatchState currentState = matches[matchId].state;
        
        // Check permissions
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        bool isBroadcaster = msg.sender == matches[matchId].broadcaster;
        
        if (!_validateTransition(currentState, newState)) {
            revert InvalidStateTransition(currentState, newState);
        }
        
        // Permission checks
        if (newState == MatchState.COMPLETED || newState == MatchState.CANCELLED) {
            if (!isAdmin) revert AdminOnly();
        } else if (!isBroadcaster && !isAdmin) {
            revert BroadcasterOrAdminRequired();
        }
        
        // Side effect: lock registered exclusion groups on CREATED -> OPEN.
        if (currentState == MatchState.CREATED && newState == MatchState.OPEN) {
            if (exclusionManager != address(0)) {
                IExclusionManager em = IExclusionManager(exclusionManager);
                uint256[] storage groupIds = registeredExclusionGroups[matchId];

                for (uint256 i = 0; i < groupIds.length; i++) {
                    em.lockGroup(groupIds[i]);
                    emit ExclusionGroupLocked(matchId, groupIds[i]);
                }
            }
        }
        
        matches[matchId].state = newState;
        emit MatchStateChanged(matchId, newState);
    }
    
    /**
     * @dev Validates state machine transition
     */
    function _validateTransition(MatchState current, MatchState next) internal pure returns (bool) {
        if (current == MatchState.CREATED && (next == MatchState.OPEN || next == MatchState.CANCELLED)) {
            return true;
        }
        if (current == MatchState.OPEN && (next == MatchState.ACTIVE || next == MatchState.CANCELLED)) {
            return true;
        }
        if (current == MatchState.ACTIVE && (next == MatchState.COMPLETED || next == MatchState.CANCELLED)) {
            return true;
        }
        return false;
    }
    
    // ──── Bidding Functions ────
    
    /**
     * @dev Places a new bid
     * @param matchId Match identifier
     * @param eventType Event type (0-7)
     * @param amount Bid amount in MBT
     * @param creativeRef Reference to ad creative
     * 
     * Requires:
     * - Match in OPEN state
     * - Amount >= reserve price
     * - Brand hasn't bid on this event
     * - < 20 bids already on this event
     * - Brand approved MomentBidCore to spend MBT
     */
    function placeBid(
        uint256 matchId,
        uint8 eventType,
        uint256 amount,
        string calldata creativeRef
    ) external onlyRole(BRAND_ROLE) nonReentrant whenNotPaused {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        if (matches[matchId].state != MatchState.OPEN) {
            revert MatchNotInState(matchId, MatchState.OPEN);
        }
        if (eventType >= MAX_EVENT_TYPES) revert InvalidEventType(eventType);
        if (!eventConfigs[matchId][eventType].enabled) {
            revert EventTypeNotEnabled(matchId, eventType);
        }
        if (amount == 0) revert ZeroAmount();
        if (amount < eventConfigs[matchId][eventType].reservePrice) {
            revert BidBelowReserve(amount, eventConfigs[matchId][eventType].reservePrice);
        }
        if (hasBid[matchId][msg.sender][eventType]) {
            revert BidAlreadyPlaced(matchId, msg.sender, eventType);
        }
        if (bids[matchId][eventType].length >= MAX_BIDS_PER_EVENT) {
            revert MaxBiddersReached(matchId, eventType);
        }
        
        // Transfer tokens from brand to contract
        mbtToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Record bid
        bids[matchId][eventType].push(Bid(msg.sender, amount, creativeRef));
        escrowBalance[matchId][msg.sender] += amount;
        hasBid[matchId][msg.sender][eventType] = true;
        
        // Track bidder if first bid on this match
        if (escrowBalance[matchId][msg.sender] == amount) {
            matchBidders[matchId].push(msg.sender);
        }
        
        emit BidPlaced(matchId, eventType, msg.sender, amount, creativeRef);
        emit FundsEscrowed(matchId, msg.sender, amount);
    }
    
    /**
     * @dev Increases an existing bid
     * @param matchId Match identifier
     * @param eventType Event type
     * @param additionalAmount Additional amount to bid
     */
    function increaseBid(
        uint256 matchId,
        uint8 eventType,
        uint256 additionalAmount
    ) external onlyRole(BRAND_ROLE) nonReentrant whenNotPaused {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        if (matches[matchId].state != MatchState.OPEN) {
            revert MatchNotInState(matchId, MatchState.OPEN);
        }
        if (additionalAmount == 0) revert ZeroAmount();
        if (!hasBid[matchId][msg.sender][eventType]) {
            revert NoBidToIncrease(matchId, msg.sender, eventType);
        }
        
        // Find bid
        uint256 bidIndex = _findBidIndex(matchId, eventType, msg.sender);
        Bid storage bid = bids[matchId][eventType][bidIndex];
        
        // Transfer additional amount
        mbtToken.safeTransferFrom(msg.sender, address(this), additionalAmount);
        
        // Update bid
        bid.amount += additionalAmount;
        escrowBalance[matchId][msg.sender] += additionalAmount;
        
        emit BidIncreased(matchId, eventType, msg.sender, bid.amount);
        emit FundsEscrowed(matchId, msg.sender, additionalAmount);
    }
    
    /**
     * @dev Sets a budget cap for a brand on a match
     * @param matchId Match identifier
     * @param cap Budget cap in MBT (0 = no cap)
     */
    function setBudgetCap(uint256 matchId, uint256 cap)
        external
        onlyRole(BRAND_ROLE)
        whenNotPaused
    {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        
        // Can set budget cap in OPEN or ACTIVE state
        MatchState state = matches[matchId].state;
        if (state != MatchState.OPEN && state != MatchState.ACTIVE) {
            revert MatchNotInState(matchId, MatchState.OPEN);
        }
        
        budgetCap[matchId][msg.sender] = cap;
        emit BudgetCapSet(matchId, msg.sender, cap);
    }
    
    /**
     * @dev Finds bid index for a brand in event type
     */
    function _findBidIndex(
        uint256 matchId,
        uint8 eventType,
        address brand
    ) internal view returns (uint256) {
        Bid[] storage eventBids = bids[matchId][eventType];
        for (uint256 i = 0; i < eventBids.length; i++) {
            if (eventBids[i].brand == brand) return i;
        }
        revert NoBidToIncrease(matchId, brand, eventType);
    }
    
    // ──── Auction Resolution ────
    
    /**
     * @dev Resolves auction for an event:settles winners, distributes funds
     * @param matchId Match identifier
     * @param eventType Event type to resolve
     * 
     * Called by: OracleController (via ORACLE_ROLE)
     * Logic: For each slot, finds highest eligible bidder
     * Eligibility checks:
     * - Bid >= reserve price
     * - Sufficient escrow balance
     * - Within budget cap (if set)
     * - Not excluded by group rules
     * - Hasn't won this slot already this trigger
     */
    function resolveAuction(uint256 matchId, uint8 eventType)
        external
        onlyRole(ORACLE_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        if (!eventConfigs[matchId][eventType].enabled) {
            revert EventTypeNotEnabled(matchId, eventType);
        }
        
        EventConfig storage config = eventConfigs[matchId][eventType];
        
        if (config.triggerCount >= config.maxTriggers) {
            revert MaxTriggersReached(matchId, eventType);
        }
        
        // Mark as triggered and increment
        eventTriggered[matchId][eventType] = true;
        config.triggerCount++;
        
        Bid[] storage eventBids = bids[matchId][eventType];
        uint8 slotCount = config.slotCount;
        uint8 slotsFilled = 0;
        bool[] memory alreadyWon = new bool[](eventBids.length);
        
        uint256 totalBroadcasterShare = 0;
        uint256 totalPlatformShare = 0;
        address broadcaster = matches[matchId].broadcaster;
        
        // For each slot, find highest eligible bidder
        for (uint8 slot = 0; slot < slotCount; slot++) {
            uint256 highestAmount = 0;
            uint256 highestIndex = type(uint256).max;
            
            for (uint256 i = 0; i < eventBids.length; i++) {
                Bid storage bid = eventBids[i];
                
                if (alreadyWon[i]) continue;
                if (bid.amount < config.reservePrice) continue;
                if (escrowBalance[matchId][bid.brand] < bid.amount) continue;
                
                // Check budget cap
                uint256 cap = budgetCap[matchId][bid.brand];
                if (cap > 0 && totalSpent[matchId][bid.brand] + bid.amount > cap) continue;
                
                // Check exclusion eligibility
                if (!_checkExclusionEligibility(matchId, eventType, bid.brand)) continue;
                
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
                
                // Update escrow and spending
                escrowBalance[matchId][winnerBid.brand] -= winnerBid.amount;
                totalSpent[matchId][winnerBid.brand] += winnerBid.amount;
                
                // Calculate fees
                uint256 platformShare = (winnerBid.amount * platformFeePercent) / 100;
                uint256 broadcasterShare = winnerBid.amount - platformShare;
                totalBroadcasterShare += broadcasterShare;
                totalPlatformShare += platformShare;
                
                // Track winners for exclusion
                recentWinnersGlobal[matchId].push(winnerBid.brand);
                recentWinnersPerEvent[matchId][eventType].push(winnerBid.brand);
                
                emit AuctionSettled(
                    matchId,
                    eventType,
                    winnerBid.brand,
                    winnerBid.amount,
                    winnerBid.creativeRef,
                    slot + 1,
                    config.triggerCount
                );
            }
        }
        
        // Batched transfers (exactly 2 instead of N)
        if (totalBroadcasterShare > 0) {
            mbtToken.safeTransfer(broadcaster, totalBroadcasterShare);
        }
        if (totalPlatformShare > 0) {
            mbtToken.safeTransfer(platformWallet, totalPlatformShare);
        }
        
        if (slotsFilled < slotCount) {
            emit PartialFill(matchId, eventType, slotsFilled, slotCount);
        }
    }
    
    /**
     * @dev Checks if brand is eligible via exclusion rules
     * Ensures competitor brands don't win same event/match based on separation rules
     */
    function _checkExclusionEligibility(
        uint256 matchId,
        uint8 eventType,
        address brand
    ) internal view returns (bool) {
        if (exclusionManager == address(0)) return true;
        
        // Get exclusion manager reference
        IExclusionManager em = IExclusionManager(exclusionManager);
        
        // Get brand's exclusion group (0 = not in any group)
        uint256 groupId = em.brandToGroup(brand);
        if (groupId == 0) return true;  // Brand not in any exclusion group
        
        // Get group info
        (,bool crossEvent,,) = em.getGroupInfo(groupId);
        
        // Get winners based on separation scope (cross-event vs per-event)
        address[] memory winners = crossEvent 
            ? recentWinnersGlobal[matchId]
            : recentWinnersPerEvent[matchId][eventType];
        
        // Check eligibility using ExclusionManager logic
        return em.isEligible(brand, winners);
    }
    
    // ──── Refund Functions ────
    
    /**
     * @dev Claims refund after match is settled
     * 
     * Refund Logic:
     * - Event triggered + Brand won: Already settled, no refund
     * - Event triggered + Brand lost: 100% of bid back
     * - Event NOT triggered: (100% - reservationFee%) back
     * - Match CANCELLED: 100% back, 0 fees
     */
    function claimRefund(uint256 matchId)
        external
        onlyRole(BRAND_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        if (matches[matchId].state != MatchState.COMPLETED && matches[matchId].state != MatchState.CANCELLED) {
            revert MatchNotSettled(matchId);
        }
        if (refundClaimed[matchId][msg.sender]) {
            revert RefundAlreadyClaimed(matchId, msg.sender);
        }
        
        uint256 refundAmount = escrowBalance[matchId][msg.sender];
        uint256 reservationFees = _calculateReservationFees(matchId, msg.sender);
        uint256 finalRefund = refundAmount - reservationFees;
        
        // State changes BEFORE external calls (reentrancy safe)
        refundClaimed[matchId][msg.sender] = true;
        escrowBalance[matchId][msg.sender] = 0;
        
        // Transfer refund to brand
        if (finalRefund > 0) {
            mbtToken.safeTransfer(msg.sender, finalRefund);
        }
        
        // Transfer fees to broadcaster (if any)
        if (reservationFees > 0) {
            mbtToken.safeTransfer(matches[matchId].broadcaster, reservationFees);
        }
        
        emit RefundProcessed(matchId, msg.sender, finalRefund, reservationFees);
    }
    
    /**
     * @dev Batch refund for multiple brands (admin only)
     */
    function batchRefund(uint256 matchId, address[] calldata brands)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
        nonReentrant
        whenNotPaused
    {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        if (matches[matchId].state != MatchState.COMPLETED && matches[matchId].state != MatchState.CANCELLED) {
            revert MatchNotSettled(matchId);
        }
        
        uint256 totalBroadcasterFees = 0;
        
        for (uint256 i = 0; i < brands.length; i++) {
            address brand = brands[i];
            
            if (refundClaimed[matchId][brand]) continue;
            
            uint256 refundAmount = escrowBalance[matchId][brand];
            uint256 reservationFees = _calculateReservationFees(matchId, brand);
            uint256 finalRefund = refundAmount - reservationFees;
            
            refundClaimed[matchId][brand] = true;
            escrowBalance[matchId][brand] = 0;
            totalBroadcasterFees += reservationFees;
            
            if (finalRefund > 0) {
                mbtToken.safeTransfer(brand, finalRefund);
            }
            
            emit RefundProcessed(matchId, brand, finalRefund, reservationFees);
        }
        
        if (totalBroadcasterFees > 0) {
            mbtToken.safeTransfer(matches[matchId].broadcaster, totalBroadcasterFees);
        }
    }
    
    /**
     * @dev Calculates reservation fees for a brand
     * Fees apply to untriggered events (brand bid but event didn't occur)
     */
    function _calculateReservationFees(uint256 matchId, address brand)
        internal
        view
        returns (uint256 totalFees)
    {
        if (matches[matchId].state == MatchState.CANCELLED) return 0;
        
        for (uint8 et = 0; et < MAX_EVENT_TYPES; et++) {
            if (!hasBid[matchId][brand][et]) continue;
            if (eventTriggered[matchId][et]) continue;
            
            // Event never triggered → reservation fee applies
            uint256 bidIndex = _findBidIndex(matchId, et, brand);
            uint256 bidAmount = bids[matchId][et][bidIndex].amount;
            uint8 feePercent = eventConfigs[matchId][et].reservationFeePercent;
            totalFees += (bidAmount * feePercent) / 100;
        }
    }
    
    // ──── View Functions ────
    
    /**
     * @dev Returns current match state
     */
    function getMatchState(uint256 matchId) external view returns (MatchState) {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        return matches[matchId].state;
    }
    
    /**
     * @dev Returns event config
     */
    function getEventConfig(uint256 matchId, uint8 eventType)
        external
        view
        returns (
            bool enabled,
            uint256 reservePrice,
            uint8 reservationFeePercent,
            uint8 slotCount,
            uint8 maxTriggers,
            uint8 triggerCount
        )
    {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        EventConfig storage config = eventConfigs[matchId][eventType];
        return (
            config.enabled,
            config.reservePrice,
            config.reservationFeePercent,
            config.slotCount,
            config.maxTriggers,
            config.triggerCount
        );
    }
    
    /**
     * @dev Returns all bids for an event
     */
    function getBids(uint256 matchId, uint8 eventType)
        external
        view
        returns (Bid[] memory)
    {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        return bids[matchId][eventType];
    }
    
    /**
     * @dev Returns escrow balance for brand on match
     */
    function getEscrowBalance(uint256 matchId, address brand)
        external
        view
        returns (uint256)
    {
        return escrowBalance[matchId][brand];
    }
    
    /**
     * @dev Returns all bidders on a match
     */
    function getMatchBidders(uint256 matchId) external view returns (address[] memory) {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        return matchBidders[matchId];
    }

    /**
     * @dev Returns exclusion groups registered for lock-on-open behavior.
     */
    function getRegisteredExclusionGroups(uint256 matchId)
        external
        view
        returns (uint256[] memory)
    {
        if (!matches[matchId].exists) revert MatchDoesNotExist(matchId);
        return registeredExclusionGroups[matchId];
    }
    
    /**
     * @dev Returns budget cap for a brand on a match
     */
    function getBudgetCap(uint256 matchId, address brand) external view returns (uint256) {
        return budgetCap[matchId][brand];
    }
    
    /**
     * @dev Returns total spent by a brand on a match
     */
    function getTotalSpent(uint256 matchId, address brand) external view returns (uint256) {
        return totalSpent[matchId][brand];
    }
}
