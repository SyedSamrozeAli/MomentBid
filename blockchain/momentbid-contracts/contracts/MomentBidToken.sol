// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title MomentBidToken
 * @dev ERC20 token representing bidding currency (1 MBT = 1 PKR)
 * 
 * Key Features:
 * - 0 decimals: 1 MBT = 1 PKR (no fractional units needed)
 * - Minting restricted to MINTER_ROLE (backend admin wallet)
 * - Pausable: Emergency stop capability for all transfers
 * - AccessControl: Role-based permission management
 * 
 * Usage Flow:
 * 1. Brand deposits PKR fiat → backend calls mint(brandAddress, amount)
 * 2. Brand approves MomentBidCore to spend MBT
 * 3. MomentBidCore calls transferFrom during auction settlement
 */
contract MomentBidToken is ERC20, AccessControl, Pausable, ReentrancyGuard {
    
    // ──── Constants ────
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    // ──── Custom Errors ────
    error MintToZeroAddress();
    error MintAmountZero();
    error BurnFromZeroAddress();
    error BurnAmountZero();
    error BurnAmountExceedsBalance();
    
    // ──── Events ────
    event TokensMinted(address indexed to, uint256 amount, address indexed minter);
    event TokensBurned(address indexed from, uint256 amount);
    event MinterRoleGranted(address indexed account, address indexed grantedBy);
    event MinterRoleRevoked(address indexed account, address indexed revokedBy);
    
    // ──── Constructor ────
    constructor() ERC20("MomentBid Token", "MBT") {
        // Grant DEFAULT_ADMIN_ROLE to deployer
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        
        // Grant MINTER_ROLE to deployer (for initial setup)
        _grantRole(MINTER_ROLE, msg.sender);
        
        // Grant PAUSER_ROLE to deployer (for emergency stops)
        _grantRole(PAUSER_ROLE, msg.sender);
    }
    
    // ──── ERC20 Overrides ────
    
    /**
     * @dev Returns 0 decimals (1 MBT = 1 PKR exactly)
     * Overrides ERC20 default of 18 decimals
     */
    function decimals() public pure override returns (uint8) {
        return 0;
    }
    
    /**
     * @dev Hook that enforces Pausable during transfers
     * Called by transfer() and transferFrom()
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._update(from, to, amount);
    }
    
    // ──── Minting ────
    
    /**
     * @dev Mints tokens to address (only MINTER_ROLE)
     * @param to Recipient address (cannot be zero)
     * @param amount Amount to mint (cannot be zero, 0 decimals = actual PKR)
     * 
     * Access: MINTER_ROLE only
     * Pausable: Fails when paused
     * Emits: TokensMinted
     */
    function mint(address to, uint256 amount) 
        external 
        onlyRole(MINTER_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        if (to == address(0)) revert MintToZeroAddress();
        if (amount == 0) revert MintAmountZero();
        
        _mint(to, amount);
        emit TokensMinted(to, amount, msg.sender);
    }
    
    /**
     * @dev Batch mint to multiple addresses (optimized for backend bulk operations)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint (must match recipients length)
     * 
     * Access: MINTER_ROLE only
     * Pausable: Fails when paused
     * Emits: TokensMinted for each recipient
     */
    function mintBatch(address[] calldata recipients, uint256[] calldata amounts)
        external
        onlyRole(MINTER_ROLE)
        whenNotPaused
        nonReentrant
    {
        if (recipients.length != amounts.length) revert("Length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert MintToZeroAddress();
            if (amounts[i] == 0) revert MintAmountZero();
            
            _mint(recipients[i], amounts[i]);
            emit TokensMinted(recipients[i], amounts[i], msg.sender);
        }
    }
    
    // ──── Burning ────
    
    /**
     * @dev Burns tokens from caller's balance
     * @param amount Amount to burn
     * 
     * Access: Public (any holder)
     * Emits: TokensBurned
     */
    function burn(uint256 amount) external nonReentrant {
        if (msg.sender == address(0)) revert BurnFromZeroAddress();
        if (amount == 0) revert BurnAmountZero();
        if (balanceOf(msg.sender) < amount) revert BurnAmountExceedsBalance();
        
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @dev Burns tokens from specific address (allowance-based)
     * @param account Account to burn from
     * @param amount Amount to burn
     * 
     * Access: Public (respects caller's allowance)
     * Emits: TokensBurned
     */
    function burnFrom(address account, uint256 amount) 
        external 
        nonReentrant 
    {
        if (account == address(0)) revert BurnFromZeroAddress();
        if (amount == 0) revert BurnAmountZero();
        if (balanceOf(account) < amount) revert BurnAmountExceedsBalance();
        
        // Check and reduce allowance
        uint256 currentAllowance = allowance(account, msg.sender);
        if (currentAllowance < amount) revert("Insufficient allowance");
        
        _approve(account, msg.sender, currentAllowance - amount);
        _burn(account, amount);
        emit TokensBurned(account, amount);
    }
    
    // ──── Pause/Unpause ────
    
    /**
     * @dev Pauses all token transfers (emergency only)
     * Access: PAUSER_ROLE
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    /**
     * @dev Resumes token transfers after pause
     * Access: DEFAULT_ADMIN_ROLE
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    // ──── Query Functions ────
    
    /**
     * @dev Returns whether an address has MINTER_ROLE
     */
    function isMinter(address account) external view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }
    
    /**
     * @dev Returns whether an address has PAUSER_ROLE
     */
    function isPauser(address account) external view returns (bool) {
        return hasRole(PAUSER_ROLE, account);
    }
    
    /**
     * @dev Returns whether contract is paused
     */
    function isPaused() external view returns (bool) {
        return paused();
    }
}
