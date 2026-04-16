// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

interface IMomentBidCore {
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
        );

    function getMatchState(uint256 matchId) external view returns (uint8);
    function resolveAuction(uint256 matchId, uint8 eventType) external;
}

contract OracleController is AccessControl, Pausable {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");
    uint8 private constant MATCH_STATE_ACTIVE = 2;

    IMomentBidCore public immutable core;

    error InvalidCoreAddress();
    error MatchNotActive(uint256 matchId);
    error EventNotEnabled(uint256 matchId, uint8 eventType);
    error MaxTriggersReached(uint256 matchId, uint8 eventType, uint8 current, uint8 max);

    event EventTriggered(uint256 indexed matchId, uint8 indexed eventType, uint8 triggerNumber);

    constructor(address coreAddress) {
        if (coreAddress == address(0)) revert InvalidCoreAddress();

        core = IMomentBidCore(coreAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function triggerEvent(uint256 matchId, uint8 eventType)
        external
        onlyRole(ORACLE_ROLE)
        whenNotPaused
    {
        uint8 state = core.getMatchState(matchId);
        if (state != MATCH_STATE_ACTIVE) revert MatchNotActive(matchId);

        (bool enabled, , , , uint8 maxTriggers, uint8 triggerCount) = core.getEventConfig(matchId, eventType);
        if (!enabled) revert EventNotEnabled(matchId, eventType);
        if (triggerCount >= maxTriggers) {
            revert MaxTriggersReached(matchId, eventType, triggerCount, maxTriggers);
        }

        core.resolveAuction(matchId, eventType);
        emit EventTriggered(matchId, eventType, triggerCount + 1);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
