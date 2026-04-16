// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IExclusionManager
 * @dev Interface for ExclusionManager contract
 * Manages competitor brand separation rules for MomentBidCore auctions
 */
interface IExclusionManager {
    
    /**
     * @dev Returns group info for a group ID
     * @param groupId Group identifier
     * @return separationDistance Minimum slots between group members
     * @return crossEventSeparation Whether separation applies cross-event
     * @return locked Whether group is locked
     * @return brandCount Number of brands in the group
     */
    function getGroupInfo(uint256 groupId) 
        external view 
        returns (uint8, bool, bool, uint256);
    
    /**
     * @dev Returns which group a brand belongs to (0 = no group)
     * @param brand Brand address
     * @return groupId Group identifier (0 if not in any group)
     */
    function brandToGroup(address brand) external view returns (uint256);
    
    /**
     * @dev Checks if a brand is eligible to win given recent winners
     * @param brand Brand address to check
     * @param recentWinnersArray Recent winners array to check against
     * @return eligible True if brand can win, false if excluded
     */
    function isEligible(address brand, address[] calldata recentWinnersArray) 
        external view 
        returns (bool);
    
    /**
     * @dev Returns all brands in a group
     * @param groupId Group identifier
     * @return brands Array of brand addresses in the group
     */
    function getGroupBrands(uint256 groupId) 
        external view 
        returns (address[] memory);
    
    /**
     * @dev Locks a group to prevent further modifications
     * @param groupId Group identifier
     */
    function lockGroup(uint256 groupId) external;
}
