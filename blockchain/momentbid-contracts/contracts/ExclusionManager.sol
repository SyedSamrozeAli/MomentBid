// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ExclusionManager
 * @dev Manages competitor brand separation rules for auctions
 * 
 * Purpose:
 * - Broadcasters group competing brands (e.g., Pepsi + Coca-Cola)
 * - During auction resolution, checks if a brand is eligible to win
 * - Eligibility based on recent winners and separation distance
 * 
 * Model:
 * - Each brand can be in exactly ONE exclusion group
 * - groupId 0 = no group (brand has no competitors)
 * - separationDistance = minimum slots between group members
 * - crossEventSeparation = whether separation applies across event types
 */
contract ExclusionManager is AccessControl {
    
    // ──── Constants ────
    bytes32 public constant BROADCASTER_ROLE = keccak256("BROADCASTER_ROLE");
    
    // ──── Structs ────
    struct ExclusionGroup {
        address[] brands;
        uint8 separationDistance;      // min slots between group members (0-255)
        bool crossEventSeparation;     // if true, counts across all event types
        bool locked;                   // locked when match goes OPEN
        bool exists;                   // true if group was ever created
    }
    
    // ──── Storage ────
    mapping(uint256 => ExclusionGroup) public groups;     // groupId → ExclusionGroup
    mapping(address => uint256) public brandToGroup;      // brand address → groupId (0=none)
    
    // ──── Custom Errors ────
    error GroupAlreadyExists(uint256 groupId);
    error GroupDoesNotExist(uint256 groupId);
    error GroupIsLocked(uint256 groupId);
    error BrandAlreadyInGroup(address brand);
    error BrandNotInGroup(address brand);
    error InvalidSeparationDistance();
    error ZeroAddress();
    error EmptyBrandsArray();
    error DuplicateBrandInBrandsArray();
    
    // ──── Events ────
    event ExclusionGroupCreated(
        uint256 indexed groupId,
        uint8 separationDistance,
        bool crossEventSeparation,
        uint256 brandCount
    );
    event BrandAddedToGroup(uint256 indexed groupId, address indexed brand);
    event BrandRemovedFromGroup(uint256 indexed groupId, address indexed brand);
    event SeparationDistanceUpdated(uint256 indexed groupId, uint8 newDistance);
    event GroupLocked(uint256 indexed groupId);
    event AdminOverride(uint256 indexed groupId, uint256 newBrandCount, uint8 newSeparation);
    
    // ──── Constructor ────
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }
    
    // ──── Broadcaster Functions ────
    
    /**
     * @dev Creates a new exclusion group with initial brands
     * @param groupId Unique group identifier
     * @param brands Array of brand addresses (2+ brands required)
     * @param separationDistance Minimum slots between group members
     * @param crossEventSeparation If true, separation applies across event types
     * 
     * Access: BROADCASTER_ROLE
     * Reverts: If groupId exists, if brands array empty/duplicate, if zero address
     */
    function createExclusionGroup(
        uint256 groupId,
        address[] calldata brands,
        uint8 separationDistance,
        bool crossEventSeparation
    ) external onlyRole(BROADCASTER_ROLE) {
        if (groups[groupId].exists) revert GroupAlreadyExists(groupId);
        if (brands.length < 2) revert EmptyBrandsArray();
        if (separationDistance == 255) revert InvalidSeparationDistance();
        
        // Validate no duplicate brands and no zero addresses
        for (uint256 i = 0; i < brands.length; i++) {
            if (brands[i] == address(0)) revert ZeroAddress();
            
            // Check for duplicates
            for (uint256 j = i + 1; j < brands.length; j++) {
                if (brands[i] == brands[j]) revert DuplicateBrandInBrandsArray();
            }
            
            // Check brand not already in another group
            if (brandToGroup[brands[i]] != 0) revert BrandAlreadyInGroup(brands[i]);
        }
        
        // Create group
        groups[groupId].separationDistance = separationDistance;
        groups[groupId].crossEventSeparation = crossEventSeparation;
        groups[groupId].locked = false;
        groups[groupId].exists = true;
        
        // Add brands to group
        for (uint256 i = 0; i < brands.length; i++) {
            groups[groupId].brands.push(brands[i]);
            brandToGroup[brands[i]] = groupId;
        }
        
        emit ExclusionGroupCreated(groupId, separationDistance, crossEventSeparation, brands.length);
    }
    
    /**
     * @dev Adds a brand to an existing exclusion group
     * @param groupId Group identifier
     * @param brand Brand address to add
     * 
     * Access: BROADCASTER_ROLE
     * Reverts: If group doesn't exist, is locked, or brand already in a group
     */
    function addBrandToGroup(uint256 groupId, address brand)
        external
        onlyRole(BROADCASTER_ROLE)
    {
        if (!groups[groupId].exists) revert GroupDoesNotExist(groupId);
        if (groups[groupId].locked) revert GroupIsLocked(groupId);
        if (brand == address(0)) revert ZeroAddress();
        if (brandToGroup[brand] != 0) revert BrandAlreadyInGroup(brand);
        
        groups[groupId].brands.push(brand);
        brandToGroup[brand] = groupId;
        
        emit BrandAddedToGroup(groupId, brand);
    }
    
    /**
     * @dev Removes a brand from an existing exclusion group
     * @param groupId Group identifier
     * @param brand Brand address to remove
     * 
     * Access: BROADCASTER_ROLE
     * Reverts: If group doesn't exist, is locked, or brand not in group
     */
    function removeBrandFromGroup(uint256 groupId, address brand)
        external
        onlyRole(BROADCASTER_ROLE)
    {
        if (!groups[groupId].exists) revert GroupDoesNotExist(groupId);
        if (groups[groupId].locked) revert GroupIsLocked(groupId);
        if (brandToGroup[brand] != groupId) revert BrandNotInGroup(brand);
        
        // Find and remove brand from array
        address[] storage groupBrands = groups[groupId].brands;
        for (uint256 i = 0; i < groupBrands.length; i++) {
            if (groupBrands[i] == brand) {
                // Swap with last element and pop
                groupBrands[i] = groupBrands[groupBrands.length - 1];
                groupBrands.pop();
                break;
            }
        }
        
        brandToGroup[brand] = 0;
        
        emit BrandRemovedFromGroup(groupId, brand);
    }
    
    /**
     * @dev Locks a group when match transitions to OPEN state
     * @param groupId Group identifier
     * 
     * Access: Public (called by MomentBidCore)
     * Reverts: If group doesn't exist or already locked
     */
    function lockGroup(uint256 groupId) external {
        if (!groups[groupId].exists) revert GroupDoesNotExist(groupId);
        
        groups[groupId].locked = true;
        emit GroupLocked(groupId);
    }
    
    // ──── Admin Functions ────
    
    /**
     * @dev Admin override: replaces group members and settings even when locked
     * @param groupId Group identifier
     * @param newBrands New array of brand addresses
     * @param newSeparation New separation distance
     * @param newCrossEvent New crossEventSeparation setting
     * 
     * Access: DEFAULT_ADMIN_ROLE
     * Use Case: Emergency correction of group configuration
     */
    function adminOverride(
        uint256 groupId,
        address[] calldata newBrands,
        uint8 newSeparation,
        bool newCrossEvent
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (!groups[groupId].exists) revert GroupDoesNotExist(groupId);
        if (newBrands.length < 2) revert EmptyBrandsArray();
        if (newSeparation == 255) revert InvalidSeparationDistance();
        
        // Validate new brands
        for (uint256 i = 0; i < newBrands.length; i++) {
            if (newBrands[i] == address(0)) revert ZeroAddress();
            
            for (uint256 j = i + 1; j < newBrands.length; j++) {
                if (newBrands[i] == newBrands[j]) revert DuplicateBrandInBrandsArray();
            }
        }
        
        // Remove old brands from mapping
        address[] memory oldBrands = groups[groupId].brands;
        for (uint256 i = 0; i < oldBrands.length; i++) {
            brandToGroup[oldBrands[i]] = 0;
        }
        
        // Replace group
        delete groups[groupId].brands;
        for (uint256 i = 0; i < newBrands.length; i++) {
            groups[groupId].brands.push(newBrands[i]);
            brandToGroup[newBrands[i]] = groupId;
        }
        
        groups[groupId].separationDistance = newSeparation;
        groups[groupId].crossEventSeparation = newCrossEvent;
        groups[groupId].locked = false; // Unlock after override
        
        emit AdminOverride(groupId, newBrands.length, newSeparation);
    }
    
    // ──── Core Logic: Eligibility Check ────
    
    /**
     * @dev Determines if a brand is eligible to win given recent winners
     * @param brand Brand to check eligibility for
     * @param recentWinnersArray Array of recent winners (from MomentBidCore)
     * 
     * Returns: true if brand can win, false if brand has competing recent winner
     * 
     * Logic:
     * 1. If brand not in any group → always eligible (return true)
     * 2. Get brand's group and separation distance
     * 3. Walk backward through recentWinnersArray up to separationDistance entries
     * 4. If ANY recent winner is in same group → return false (conflict)
     * 5. Otherwise → return true (eligible)
     */
    function isEligible(address brand, address[] calldata recentWinnersArray)
        external
        view
        returns (bool)
    {
        uint256 brandGroupId = brandToGroup[brand];
        
        // Brand not in any group → always eligible
        if (brandGroupId == 0) return true;
        
        ExclusionGroup memory brandGroup = groups[brandGroupId];
        uint8 separationDistance = brandGroup.separationDistance;
        
        // Check recentWinnersArray from end backwards
        // Look at most separationDistance entries
        uint256 checkCount = separationDistance < recentWinnersArray.length
            ? separationDistance
            : recentWinnersArray.length;
        
        for (uint256 i = 0; i < checkCount; i++) {
            // Access from end backwards: winners[length - 1 - i]
            address recentWinner = recentWinnersArray[recentWinnersArray.length - 1 - i];
            
            // If recent winner is in same group → not eligible
            if (brandToGroup[recentWinner] == brandGroupId) {
                return false;
            }
        }
        
        // No conflict found → eligible
        return true;
    }
    
    // ──── View Functions ────
    
    /**
     * @dev Returns array of all brands in a group
     * @param groupId Group identifier
     * @return Array of brand addresses
     */
    function getGroupBrands(uint256 groupId)
        external
        view
        returns (address[] memory)
    {
        if (!groups[groupId].exists) revert GroupDoesNotExist(groupId);
        return groups[groupId].brands;
    }
    
    /**
     * @dev Returns detailed information about a group
     * @param groupId Group identifier
     * @return separationDistance Minimum slots between group members
     * @return crossEventSeparation Whether separation applies across event types
     * @return locked Whether group is locked
     * @return brandCount Number of brands in group
     */
    function getGroupInfo(uint256 groupId)
        external
        view
        returns (
            uint8 separationDistance,
            bool crossEventSeparation,
            bool locked,
            uint256 brandCount
        )
    {
        if (!groups[groupId].exists) revert GroupDoesNotExist(groupId);
        
        ExclusionGroup memory group = groups[groupId];
        return (
            group.separationDistance,
            group.crossEventSeparation,
            group.locked,
            group.brands.length
        );
    }
    
    /**
     * @dev Returns the group ID for a brand
     * @param brand Brand address
     * @return groupId (0 = not in any group)
     */
    function getBrandGroup(address brand) external view returns (uint256) {
        return brandToGroup[brand];
    }
    
    /**
     * @dev Checks if a group exists and is locked
     * @param groupId Group identifier
     * @return exists Whether group exists
     * @return locked Whether group is locked
     */
    function getGroupLockStatus(uint256 groupId)
        external
        view
        returns (bool exists, bool locked)
    {
        ExclusionGroup memory group = groups[groupId];
        return (group.exists, group.locked);
    }
}
