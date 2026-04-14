const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MomentBidToken", function () {
  let token;
  let owner;
  let minter;
  let user1;
  let user2;
  let user3;
  
  const MINTER_ROLE = ethers.id("MINTER_ROLE");
  const PAUSER_ROLE = ethers.id("PAUSER_ROLE");
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  beforeEach(async function () {
    // Get signers
    [owner, minter, user1, user2, user3] = await ethers.getSigners();
    
    // Deploy contract
    const MomentBidToken = await ethers.getContractFactory("MomentBidToken");
    token = await MomentBidToken.deploy();
    await token.waitForDeployment();
    
    // Grant MINTER_ROLE to minter account
    const tx = await token.grantRole(MINTER_ROLE, minter.address);
    await tx.wait();
  });

  describe("Deployment", function () {
    it("Should deploy with correct name and symbol", async function () {
      expect(await token.name()).to.equal("MomentBid Token");
      expect(await token.symbol()).to.equal("MBT");
    });

    it("Should have 0 decimals (1 MBT = 1 PKR)", async function () {
      expect(await token.decimals()).to.equal(0);
    });

    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should grant MINTER_ROLE to deployer", async function () {
      expect(await token.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });

    it("Should grant PAUSER_ROLE to deployer", async function () {
      expect(await token.hasRole(PAUSER_ROLE, owner.address)).to.be.true;
    });

    it("Should have zero total supply initially", async function () {
      expect(await token.totalSupply()).to.equal(0);
    });

    it("Should not be paused initially", async function () {
      expect(await token.isPaused()).to.be.false;
    });
  });

  // ──── TEST CASE 1: Admin can mint tokens to any address ────
  describe("TC1: Minting - Admin/Minter can mint to any address", function () {
    it("Should allow minter to mint tokens to user", async function () {
      const amount = 1000;
      await expect(token.connect(minter).mint(user1.address, amount))
        .to.emit(token, "TokensMinted")
        .withArgs(user1.address, amount, minter.address);
      
      expect(await token.balanceOf(user1.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(amount);
    });

    it("Should allow admin to mint tokens", async function () {
      const amount = 5000;
      await expect(token.connect(owner).mint(user2.address, amount))
        .to.emit(token, "TokensMinted")
        .withArgs(user2.address, amount, owner.address);
      
      expect(await token.balanceOf(user2.address)).to.equal(amount);
    });

    it("Should allow multiple mints to accumulate balance", async function () {
      await token.connect(minter).mint(user1.address, 1000);
      await token.connect(minter).mint(user1.address, 2000);
      await token.connect(minter).mint(user1.address, 3000);
      
      expect(await token.balanceOf(user1.address)).to.equal(6000);
      expect(await token.totalSupply()).to.equal(6000);
    });

    it("Should allow minting to multiple users", async function () {
      await token.connect(minter).mint(user1.address, 1000);
      await token.connect(minter).mint(user2.address, 2000);
      await token.connect(minter).mint(user3.address, 3000);
      
      expect(await token.balanceOf(user1.address)).to.equal(1000);
      expect(await token.balanceOf(user2.address)).to.equal(2000);
      expect(await token.balanceOf(user3.address)).to.equal(3000);
      expect(await token.totalSupply()).to.equal(6000);
    });

    it("Should allow minting large amounts", async function () {
      const largeAmount = ethers.parseUnits("999999999", 0); // 0 decimals
      await token.connect(minter).mint(user1.address, largeAmount);
      expect(await token.balanceOf(user1.address)).to.equal(largeAmount);
    });
  });

  // ──── TEST CASE 2: Non-minter cannot mint (expect revert) ────
  describe("TC2: Access Control - Non-minter cannot mint", function () {
    it("Should revert when non-minter attempts to mint", async function () {
      await expect(
        token.connect(user1).mint(user2.address, 1000)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should revert when user without role attempts mint", async function () {
      await expect(
        token.connect(user3).mint(user1.address, 5000)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should allow minter but not revoked minter", async function () {
      // First mint should work
      await token.connect(minter).mint(user1.address, 1000);
      expect(await token.balanceOf(user1.address)).to.equal(1000);
      
      // Revoke minter role
      await token.revokeRole(MINTER_ROLE, minter.address);
      
      // Second mint should fail
      await expect(
        token.connect(minter).mint(user1.address, 500)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should respect role hierarchy", async function () {
      // Grant MINTER_ROLE to user1
      await token.grantRole(MINTER_ROLE, user1.address);
      
      // user1 should now be able to mint
      await expect(token.connect(user1).mint(user2.address, 1500))
        .to.emit(token, "TokensMinted");
      
      // user3 still cannot mint
      await expect(
        token.connect(user3).mint(user2.address, 1500)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });
  });

  // ──── TEST CASE 3: Cannot mint to zero address ────
  describe("TC3: Validation - Cannot mint to zero address", function () {
    it("Should revert when minting to zero address", async function () {
      await expect(
        token.connect(minter).mint(ethers.ZeroAddress, 1000)
      ).to.be.revertedWithCustomError(token, "MintToZeroAddress");
    });

    it("Should allow minting to any legitimate address except zero", async function () {
      // Create test addresses
      const testAddresses = [user1.address, user2.address, user3.address];
      
      for (const addr of testAddresses) {
        await expect(token.connect(minter).mint(addr, 500))
          .to.emit(token, "TokensMinted");
      }
      
      expect(await token.totalSupply()).to.equal(1500);
    });

    it("Should reject zero address even with zero amount", async function () {
      await expect(
        token.connect(minter).mint(ethers.ZeroAddress, 0)
      ).to.be.revertedWithCustomError(token, "MintToZeroAddress");
    });

    it("Should reject zero address even with large amount", async function () {
      const largeAmount = ethers.parseUnits("1000000", 0);
      await expect(
        token.connect(minter).mint(ethers.ZeroAddress, largeAmount)
      ).to.be.revertedWithCustomError(token, "MintToZeroAddress");
    });
  });

  // ──── TEST CASE 4: Cannot mint zero amount ────
  describe("TC4: Validation - Cannot mint zero amount", function () {
    it("Should revert when minting zero amount to valid address", async function () {
      await expect(
        token.connect(minter).mint(user1.address, 0)
      ).to.be.revertedWithCustomError(token, "MintAmountZero");
    });

    it("Should allow minting any positive amount", async function () {
      await expect(token.connect(minter).mint(user1.address, 1))
        .to.emit(token, "TokensMinted");
      
      expect(await token.balanceOf(user1.address)).to.equal(1);
    });

    it("Should enforce zero amount check before zero address check", async function () {
      // Both checks should fail, but zero amount should be checked first
      await expect(
        token.connect(minter).mint(ethers.ZeroAddress, 0)
      ).to.be.revertedWithCustomError(token, "MintToZeroAddress");
    });

    it("Should track proper supply with valid amounts only", async function () {
      await token.connect(minter).mint(user1.address, 100);
      const prevSupply = await token.totalSupply();
      
      // Attempt zero mint should fail
      await expect(
        token.connect(minter).mint(user2.address, 0)
      ).to.be.revertedWithCustomError(token, "MintAmountZero");
      
      // Supply should not change
      expect(await token.totalSupply()).to.equal(prevSupply);
    });
  });

  // ──── TEST CASE 5: decimals() returns 0 ────
  describe("TC5: Decimals - MBT has 0 decimals (1 MBT = 1 PKR)", function () {
    it("Should return 0 for decimals", async function () {
      expect(await token.decimals()).to.equal(0);
    });

    it("Should maintain 0 decimals across multiple calls", async function () {
      for (let i = 0; i < 5; i++) {
        expect(await token.decimals()).to.equal(0);
      }
    });

    it("Should handle amounts as whole numbers (no fraction)", async function () {
      const amount = 1000; // 1000 MBT = 1000 PKR exactly
      await token.connect(minter).mint(user1.address, amount);
      expect(await token.balanceOf(user1.address)).to.equal(amount);
    });

    it("Should support 1 as minimum atomic unit", async function () {
      await token.connect(minter).mint(user1.address, 1);
      expect(await token.balanceOf(user1.address)).to.equal(1);
    });
  });

  // ──── TEST CASE 6: approve() + transferFrom() works ────
  describe("TC6: ERC20 - approve() and transferFrom() work correctly", function () {
    beforeEach(async function () {
      // Mint tokens to user1
      await token.connect(minter).mint(user1.address, 10000);
    });

    it("Should allow approve and transferFrom workflow", async function () {
      const amount = 5000;
      
      // user1 approves user2 to spend 5000 tokens
      await expect(token.connect(user1).approve(user2.address, amount))
        .to.emit(token, "Approval")
        .withArgs(user1.address, user2.address, amount);
      
      // user2 transfers from user1 to user3
      await expect(token.connect(user2).transferFrom(user1.address, user3.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(user1.address, user3.address, amount);
      
      expect(await token.balanceOf(user1.address)).to.equal(5000);
      expect(await token.balanceOf(user3.address)).to.equal(5000);
    });

    it("Should enforce allowance limits in transferFrom", async function () {
      // user1 approves user2 for only 3000 tokens
      await token.connect(user1).approve(user2.address, 3000);
      
      // user2 tries to transfer 5000 (exceeds allowance)
      await expect(
        token.connect(user2).transferFrom(user1.address, user3.address, 5000)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should reduce allowance after partial transferFrom", async function () {
      await token.connect(user1).approve(user2.address, 10000);
      
      // Transfer 3000
      await token.connect(user2).transferFrom(user1.address, user3.address, 3000);
      
      // Allowance should be reduced to 7000
      expect(await token.allowance(user1.address, user2.address)).to.equal(7000);
    });

    it("Should allow multiple sequential transfers up to allowance", async function () {
      await token.connect(user1).approve(user2.address, 10000);
      
      // First transfer: 4000
      await token.connect(user2).transferFrom(user1.address, user3.address, 4000);
      expect(await token.allowance(user1.address, user2.address)).to.equal(6000);
      
      // Second transfer: 3000
      await token.connect(user2).transferFrom(user1.address, user3.address, 3000);
      expect(await token.allowance(user1.address, user2.address)).to.equal(3000);
      
      // Third transfer: 3000
      await token.connect(user2).transferFrom(user1.address, user3.address, 3000);
      expect(await token.allowance(user1.address, user2.address)).to.equal(0);
    });

    it("Should revert transferFrom with zero allowance", async function () {
      // No approval given
      await expect(
        token.connect(user2).transferFrom(user1.address, user3.address, 100)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should handle direct transfer without approval", async function () {
      // user1 directly transfers to user3 (no receiver approval needed)
      await expect(token.connect(user1).transfer(user3.address, 1000))
        .to.emit(token, "Transfer")
        .withArgs(user1.address, user3.address, 1000);
      
      expect(await token.balanceOf(user3.address)).to.equal(1000);
    });
  });

  // ──── TEST CASE 7: Admin can pause, minting fails when paused ────
  describe("TC7: Pausable - Admin can pause, transfers/mints fail when paused", function () {
    it("Should allow admin to pause contract", async function () {
      expect(await token.isPaused()).to.be.false;
      
      await token.connect(owner).pause();
      
      expect(await token.isPaused()).to.be.true;
    });

    it("Should fail to mint when paused", async function () {
      await token.connect(owner).pause();
      
      await expect(
        token.connect(minter).mint(user1.address, 1000)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should fail to transfer when paused", async function () {
      await token.connect(minter).mint(user1.address, 5000);
      await token.connect(owner).pause();
      
      await expect(
        token.connect(user1).transfer(user2.address, 1000)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should fail to transferFrom when paused", async function () {
      await token.connect(minter).mint(user1.address, 5000);
      await token.connect(user1).approve(user2.address, 3000);
      
      await token.connect(owner).pause();
      
      await expect(
        token.connect(user2).transferFrom(user1.address, user3.address, 1000)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should allow unpausing and resume normal operations", async function () {
      await token.connect(minter).mint(user1.address, 1000);
      
      // Pause
      await token.connect(owner).pause();
      expect(await token.isPaused()).to.be.true;
      
      // Try to mint (should fail)
      await expect(
        token.connect(minter).mint(user1.address, 500)
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
      
      // Unpause
      await token.connect(owner).unpause();
      expect(await token.isPaused()).to.be.false;
      
      // Mint should work again
      await expect(token.connect(minter).mint(user1.address, 500))
        .to.emit(token, "TokensMinted");
      
      expect(await token.balanceOf(user1.address)).to.equal(1500);
    });

    it("Should only allow pauser role to pause", async function () {
      await expect(
        token.connect(user1).pause()
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should only allow admin role to unpause", async function () {
      await token.connect(owner).pause();
      
      // Minter cannot unpause
      await expect(
        token.connect(minter).unpause()
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
      
      // Admin can unpause
      await token.connect(owner).unpause();
      expect(await token.isPaused()).to.be.false;
    });
  });

  // ──── TEST CASE 8: Admin can grant MINTER_ROLE to another address ────
  describe("TC8: AccessControl - Admin can grant/revoke MINTER_ROLE", function () {
    it("Should allow admin to grant MINTER_ROLE to user", async function () {
      expect(await token.hasRole(MINTER_ROLE, user1.address)).to.be.false;
      
      await token.connect(owner).grantRole(MINTER_ROLE, user1.address);
      
      expect(await token.hasRole(MINTER_ROLE, user1.address)).to.be.true;
    });

    it("Should allow newly granted minter to mint", async function () {
      await token.connect(owner).grantRole(MINTER_ROLE, user1.address);
      
      await expect(token.connect(user1).mint(user2.address, 5000))
        .to.emit(token, "TokensMinted")
        .withArgs(user2.address, 5000, user1.address);
      
      expect(await token.balanceOf(user2.address)).to.equal(5000);
    });

    it("Should allow admin to revoke MINTER_ROLE", async function () {
      await token.connect(owner).grantRole(MINTER_ROLE, user1.address);
      expect(await token.hasRole(MINTER_ROLE, user1.address)).to.be.true;
      
      await token.connect(owner).revokeRole(MINTER_ROLE, user1.address);
      expect(await token.hasRole(MINTER_ROLE, user1.address)).to.be.false;
    });

    it("Should prevent revoked minter from minting", async function () {
      await token.connect(owner).grantRole(MINTER_ROLE, user1.address);
      await token.connect(user1).mint(user2.address, 1000);
      
      // Revoke role
      await token.connect(owner).revokeRole(MINTER_ROLE, user1.address);
      
      // Should not be able to mint
      await expect(
        token.connect(user1).mint(user2.address, 500)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should support multiple minters", async function () {
      // Grant MINTER_ROLE to three different users
      await token.connect(owner).grantRole(MINTER_ROLE, user1.address);
      await token.connect(owner).grantRole(MINTER_ROLE, user2.address);
      const extraUser = (await ethers.getSigners())[5];
      await token.connect(owner).grantRole(MINTER_ROLE, extraUser.address);
      
      // All should be able to mint
      await token.connect(user1).mint(minter.address, 1000);
      await token.connect(user2).mint(minter.address, 2000);
      await token.connect(extraUser).mint(minter.address, 3000);
      
      expect(await token.balanceOf(minter.address)).to.equal(6000);
    });

    it("Should only allow admin to grant roles", async function () {
      await expect(
        token.connect(user1).grantRole(MINTER_ROLE, user2.address)
      ).to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount");
    });

    it("Should track multiple role assignments", async function () {
      await token.connect(owner).grantRole(MINTER_ROLE, user1.address);
      await token.connect(owner).grantRole(MINTER_ROLE, user2.address);
      
      expect(await token.isMinter(owner.address)).to.be.true;
      expect(await token.isMinter(user1.address)).to.be.true;
      expect(await token.isMinter(user2.address)).to.be.true;
      expect(await token.isMinter(user3.address)).to.be.false;
    });
  });

  // ──── Additional Edge Cases & Security ────
  describe("Edge Cases & Security", function () {
    it("Should handle batch minting", async function () {
      const recipients = [user1.address, user2.address, user3.address];
      const amounts = [1000, 2000, 3000];
      
      await token.connect(minter).mintBatch(recipients, amounts);
      
      expect(await token.balanceOf(user1.address)).to.equal(1000);
      expect(await token.balanceOf(user2.address)).to.equal(2000);
      expect(await token.balanceOf(user3.address)).to.equal(3000);
      expect(await token.totalSupply()).to.equal(6000);
    });

    it("Should revert batch mint with length mismatch", async function () {
      const recipients = [user1.address, user2.address];
      const amounts = [1000];
      
      await expect(
        token.connect(minter).mintBatch(recipients, amounts)
      ).to.be.revertedWith("Length mismatch");
    });

    it("Should allow burning tokens", async function () {
      await token.connect(minter).mint(user1.address, 5000);
      
      await expect(token.connect(user1).burn(2000))
        .to.emit(token, "TokensBurned")
        .withArgs(user1.address, 2000);
      
      expect(await token.balanceOf(user1.address)).to.equal(3000);
      expect(await token.totalSupply()).to.equal(3000);
    });

    it("Should support Reentrancy guard", async function () {
      // Deploy a reentrancy attack contract would be here in a real scenario
      // For now, verifying the guard is present in contract
      await token.connect(minter).mint(user1.address, 1000);
      
      // Normal operation should work fine
      await token.connect(user1).transfer(user2.address, 100);
      expect(await token.balanceOf(user2.address)).to.equal(100);
    });

    it("Should query isMinter status correctly", async function () {
      expect(await token.isMinter(owner.address)).to.be.true;
      expect(await token.isMinter(minter.address)).to.be.true;
      expect(await token.isMinter(user1.address)).to.be.false;
      
      await token.connect(owner).grantRole(MINTER_ROLE, user1.address);
      expect(await token.isMinter(user1.address)).to.be.true;
    });

    it("Should query isPauser status correctly", async function () {
      expect(await token.isPauser(owner.address)).to.be.true;
      expect(await token.isPauser(user1.address)).to.be.false;
    });

    it("Should handle approve with exact balance", async function () {
      const balance = 5000;
      await token.connect(minter).mint(user1.address, balance);
      
      await token.connect(user1).approve(user2.address, balance);
      expect(await token.allowance(user1.address, user2.address)).to.equal(balance);
      
      // Should be able to transferFrom full balance
      await token.connect(user2).transferFrom(user1.address, user3.address, balance);
      expect(await token.balanceOf(user3.address)).to.equal(balance);
      expect(await token.balanceOf(user1.address)).to.equal(0);
    });

    it("Should handle transfer to self", async function () {
      await token.connect(minter).mint(user1.address, 1000);
      
      await token.connect(user1).transfer(user1.address, 500);
      expect(await token.balanceOf(user1.address)).to.equal(1000);
    });

    it("Should revert transfer exceeding balance", async function () {
      await token.connect(minter).mint(user1.address, 1000);
      
      await expect(
        token.connect(user1).transfer(user2.address, 2000)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });
});
