const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ExclusionManager", function () {
  let manager;
  let owner;
  let broadcaster;
  let admin;
  let brand1;
  let brand2;
  let brand3;
  let brand4;
  let brand5;
  let nonBroadcaster;
  
  const BROADCASTER_ROLE = ethers.id("BROADCASTER_ROLE");
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";

  beforeEach(async function () {
    // Get signers
    [owner, broadcaster, admin, brand1, brand2, brand3, brand4, brand5, nonBroadcaster] = await ethers.getSigners();
    
    // Deploy contract
    const ExclusionManager = await ethers.getContractFactory("ExclusionManager");
    manager = await ExclusionManager.deploy();
    await manager.waitForDeployment();
    
    // Grant BROADCASTER_ROLE to broadcaster account
    await manager.grantRole(BROADCASTER_ROLE, broadcaster.address);
  });

  describe("Deployment", function () {
    it("Should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      expect(await manager.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should have no groups initially", async function () {
      await expect(
        manager.getGroupInfo(1)
      ).to.be.revertedWithCustomError(manager, "GroupDoesNotExist");
    });
  });

  // ──── TEST CASE 1: Broadcaster creates exclusion group with 3 brands ────
  describe("TC1: Broadcaster creates exclusion group with 3 brands", function () {
    it("Should create group with 3 brands", async function () {
      const groupId = 1;
      const brands = [brand1.address, brand2.address, brand3.address];
      const separationDistance = 2;
      const crossEventSeparation = true;
      
      await expect(
        manager.connect(broadcaster).createExclusionGroup(
          groupId,
          brands,
          separationDistance,
          crossEventSeparation
        )
      ).to.emit(manager, "ExclusionGroupCreated")
        .withArgs(groupId, separationDistance, crossEventSeparation, 3);
      
      // Verify group created
      const info = await manager.getGroupInfo(groupId);
      expect(info.separationDistance).to.equal(separationDistance);
      expect(info.crossEventSeparation).to.equal(crossEventSeparation);
      expect(info.locked).to.be.false;
      expect(info.brandCount).to.equal(3);
      
      // Verify brands mapped to group
      expect(await manager.getBrandGroup(brand1.address)).to.equal(groupId);
      expect(await manager.getBrandGroup(brand2.address)).to.equal(groupId);
      expect(await manager.getBrandGroup(brand3.address)).to.equal(groupId);
    });

    it("Should retrieve brands array correctly", async function () {
      const groupId = 1;
      const brands = [brand1.address, brand2.address, brand3.address];
      
      await manager.connect(broadcaster).createExclusionGroup(groupId, brands, 1, false);
      
      const groupBrands = await manager.getGroupBrands(groupId);
      expect(groupBrands).to.have.lengthOf(3);
      expect(groupBrands).to.include.members([brand1.address, brand2.address, brand3.address]);
    });

    it("Should create multiple groups", async function () {
      const group1Brands = [brand1.address, brand2.address];
      const group2Brands = [brand3.address, brand4.address];
      
      await manager.connect(broadcaster).createExclusionGroup(1, group1Brands, 2, true);
      await manager.connect(broadcaster).createExclusionGroup(2, group2Brands, 1, false);
      
      const info1 = await manager.getGroupInfo(1);
      const info2 = await manager.getGroupInfo(2);
      
      expect(info1.brandCount).to.equal(2);
      expect(info2.brandCount).to.equal(2);
      expect(info1.separationDistance).to.equal(2);
      expect(info2.separationDistance).to.equal(1);
    });

    it("Should enforce minimum 2 brands", async function () {
      await expect(
        manager.connect(broadcaster).createExclusionGroup(1, [brand1.address], 1, false)
      ).to.be.revertedWithCustomError(manager, "EmptyBrandsArray");
    });

    it("Should reject zero address in brands array", async function () {
      await expect(
        manager.connect(broadcaster).createExclusionGroup(
          1,
          [brand1.address, ethers.ZeroAddress],
          1,
          false
        )
      ).to.be.revertedWithCustomError(manager, "ZeroAddress");
    });
  });

  // ──── TEST CASE 2: Cannot create group with same ID twice ────
  describe("TC2: Cannot create group with same ID twice", function () {
    it("Should prevent duplicate groupId", async function () {
      const groupId = 1;
      const brands1 = [brand1.address, brand2.address];
      const brands2 = [brand3.address, brand4.address];
      
      // Create first group
      await manager.connect(broadcaster).createExclusionGroup(groupId, brands1, 1, false);
      
      // Try to create with same groupId
      await expect(
        manager.connect(broadcaster).createExclusionGroup(groupId, brands2, 1, false)
      ).to.be.revertedWithCustomError(manager, "GroupAlreadyExists").withArgs(groupId);
    });

    it("Should reject duplicate brands within same creation", async function () {
      await expect(
        manager.connect(broadcaster).createExclusionGroup(
          1,
          [brand1.address, brand1.address, brand2.address],
          1,
          false
        )
      ).to.be.revertedWithCustomError(manager, "DuplicateBrandInBrandsArray");
    });
  });

  // ──── TEST CASE 3: Add brand to existing group ────
  describe("TC3: Add brand to existing group", function () {
    beforeEach(async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
    });

    it("Should add brand to existing group", async function () {
      await expect(
        manager.connect(broadcaster).addBrandToGroup(1, brand3.address)
      ).to.emit(manager, "BrandAddedToGroup")
        .withArgs(1, brand3.address);
      
      expect(await manager.getBrandGroup(brand3.address)).to.equal(1);
      
      const info = await manager.getGroupInfo(1);
      expect(info.brandCount).to.equal(3);
      
      const brands = await manager.getGroupBrands(1);
      expect(brands).to.include(brand3.address);
    });

    it("Should reject adding to non-existent group", async function () {
      await expect(
        manager.connect(broadcaster).addBrandToGroup(999, brand3.address)
      ).to.be.revertedWithCustomError(manager, "GroupDoesNotExist");
    });

    it("Should reject adding brand already in another group", async function () {
      // brand1 is already in group 1
      await expect(
        manager.connect(broadcaster).addBrandToGroup(1, brand1.address)
      ).to.be.revertedWithCustomError(manager, "BrandAlreadyInGroup");
    });

    it("Should reject adding zero address", async function () {
      await expect(
        manager.connect(broadcaster).addBrandToGroup(1, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(manager, "ZeroAddress");
    });

    it("Should allow adding multiple brands sequentially", async function () {
      await manager.connect(broadcaster).addBrandToGroup(1, brand3.address);
      await manager.connect(broadcaster).addBrandToGroup(1, brand4.address);
      await manager.connect(broadcaster).addBrandToGroup(1, brand5.address);
      
      const info = await manager.getGroupInfo(1);
      expect(info.brandCount).to.equal(5);
    });
  });

  // ──── TEST CASE 4: Remove brand from group ────
  describe("TC4: Remove brand from group", function () {
    beforeEach(async function () {
      const brands = [brand1.address, brand2.address, brand3.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
    });

    it("Should remove brand from group", async function () {
      await expect(
        manager.connect(broadcaster).removeBrandFromGroup(1, brand2.address)
      ).to.emit(manager, "BrandRemovedFromGroup")
        .withArgs(1, brand2.address);
      
      expect(await manager.getBrandGroup(brand2.address)).to.equal(0);
      
      const info = await manager.getGroupInfo(1);
      expect(info.brandCount).to.equal(2);
      
      const brands = await manager.getGroupBrands(1);
      expect(brands).to.not.include(brand2.address);
      expect(brands).to.include(brand1.address);
      expect(brands).to.include(brand3.address);
    });

    it("Should reject removing from non-existent group", async function () {
      await expect(
        manager.connect(broadcaster).removeBrandFromGroup(999, brand1.address)
      ).to.be.revertedWithCustomError(manager, "GroupDoesNotExist");
    });

    it("Should reject removing brand not in group", async function () {
      await expect(
        manager.connect(broadcaster).removeBrandFromGroup(1, brand4.address)
      ).to.be.revertedWithCustomError(manager, "BrandNotInGroup");
    });

    it("Should allow multiple removals", async function () {
      await manager.connect(broadcaster).removeBrandFromGroup(1, brand1.address);
      expect(await manager.getBrandGroup(brand1.address)).to.equal(0);
      
      await manager.connect(broadcaster).removeBrandFromGroup(1, brand3.address);
      expect(await manager.getBrandGroup(brand3.address)).to.equal(0);
      
      const info = await manager.getGroupInfo(1);
      expect(info.brandCount).to.equal(1);
    });

    it("Should allow re-adding removed brand", async function () {
      await manager.connect(broadcaster).removeBrandFromGroup(1, brand1.address);
      
      // Can now add to a different group
      const newBrands = [brand4.address, brand5.address];
      await manager.connect(broadcaster).createExclusionGroup(2, newBrands, 1, false);
      
      await manager.connect(broadcaster).addBrandToGroup(2, brand1.address);
      expect(await manager.getBrandGroup(brand1.address)).to.equal(2);
    });
  });

  // ──── TEST CASE 5: Cannot add/remove after group locked ────
  describe("TC5: Cannot add/remove after group locked", function () {
    beforeEach(async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 1, false);
    });

    it("Should prevent adding after lock", async function () {
      await manager.lockGroup(1);
      
      await expect(
        manager.connect(broadcaster).addBrandToGroup(1, brand3.address)
      ).to.be.revertedWithCustomError(manager, "GroupIsLocked");
    });

    it("Should prevent removing after lock", async function () {
      await manager.lockGroup(1);
      
      await expect(
        manager.connect(broadcaster).removeBrandFromGroup(1, brand1.address)
      ).to.be.revertedWithCustomError(manager, "GroupIsLocked");
    });

    it("Should lock group successfully", async function () {
      const [existsBefore, lockedBefore] = await manager.getGroupLockStatus(1);
      expect(existsBefore).to.be.true;
      expect(lockedBefore).to.be.false;
      
      await expect(manager.lockGroup(1))
        .to.emit(manager, "GroupLocked")
        .withArgs(1);
      
      const [existsAfter, lockedAfter] = await manager.getGroupLockStatus(1);
      expect(existsAfter).to.be.true;
      expect(lockedAfter).to.be.true;
    });

    it("Should reject locking non-existent group", async function () {
      await expect(
        manager.lockGroup(999)
      ).to.be.revertedWithCustomError(manager, "GroupDoesNotExist");
    });
  });

  // ──── TEST CASE 6: Admin CAN override even after lock ────
  describe("TC6: Admin can override even after lock", function () {
    beforeEach(async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
      await manager.lockGroup(1);
    });

    it("Should allow admin to override locked group", async function () {
      const newBrands = [brand3.address, brand4.address, brand5.address];
      
      await expect(
        manager.connect(owner).adminOverride(1, newBrands, 1, false)
      ).to.emit(manager, "AdminOverride")
        .withArgs(1, 3, 1);
      
      const info = await manager.getGroupInfo(1);
      expect(info.brandCount).to.equal(3);
      expect(info.separationDistance).to.equal(1);
      expect(info.crossEventSeparation).to.be.false;
      expect(info.locked).to.be.false; // Should be unlocked after override
    });

    it("Should update brand mappings after override", async function () {
      const newBrands = [brand3.address, brand4.address];
      await manager.connect(owner).adminOverride(1, newBrands, 1, false);
      
      // Old brands should no longer be in group
      expect(await manager.getBrandGroup(brand1.address)).to.equal(0);
      expect(await manager.getBrandGroup(brand2.address)).to.equal(0);
      
      // New brands should be in group
      expect(await manager.getBrandGroup(brand3.address)).to.equal(1);
      expect(await manager.getBrandGroup(brand4.address)).to.equal(1);
    });

    it("Should reject non-admin override", async function () {
      const newBrands = [brand3.address, brand4.address];
      
      await expect(
        manager.connect(broadcaster).adminOverride(1, newBrands, 1, false)
      ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    });

    it("Should allow adding/removing after admin override unlocks", async function () {
      const newBrands = [brand3.address, brand4.address];
      await manager.connect(owner).adminOverride(1, newBrands, 1, false);
      
      // Should now be able to add/remove
      await expect(
        manager.connect(broadcaster).addBrandToGroup(1, brand5.address)
      ).to.emit(manager, "BrandAddedToGroup");
      
      expect(await manager.getBrandGroup(brand5.address)).to.equal(1);
    });
  });

  // ──── TEST CASE 7: isEligible returns true when brand not in any group ────
  describe("TC7: isEligible - brand not in any group", function () {
    beforeEach(async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
    });

    it("Should return true for brand not in any group", async function () {
      const recentWinners = [];
      const eligible = await manager.isEligible(brand3.address, recentWinners);
      expect(eligible).to.be.true;
    });

    it("Should return true regardless of recent winners if brand not in group", async function () {
      const recentWinners = [brand1.address, brand2.address, brand1.address];
      const eligible = await manager.isEligible(brand3.address, recentWinners);
      expect(eligible).to.be.true;
    });

    it("Should return true with empty recent winners array", async function () {
      const eligible = await manager.isEligible(brand1.address, []);
      expect(eligible).to.be.true;
    });
  });

  // ──── TEST CASE 8: isEligible returns false when winner in same group within distance ────
  describe("TC8: isEligible - recent winner in same group (within distance)", function () {
    beforeEach(async function () {
      const brands = [brand1.address, brand2.address, brand3.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
    });

    it("Should return false when recent winner in same group within separation", async function () {
      // brand1 and brand2 are in same group, separation distance = 2
      const recentWinners = [brand3.address, brand2.address]; // brand2 is 1 slot back
      
      const eligible = await manager.isEligible(brand1.address, recentWinners);
      expect(eligible).to.be.false;
    });

    it("Should return false when most recent winner in same group", async function () {
      const recentWinners = [brand3.address, brand2.address, brand4.address];
      
      // brand2 is most recent winner, in same group as brand1, within distance
      const eligible = await manager.isEligible(brand1.address, recentWinners);
      expect(eligible).to.be.false;
    });

    it("Should check only within separation distance", async function () {
      // separation = 2, so check last 2 entries of recentWinners
      const recentWinners = [brand1.address, brand2.address, brand3.address]; // brand1 is 2 back, brand2 is 1 back
      
      // brand2 is 1 slot back (within distance 2) → not eligible
      const eligible = await manager.isEligible(brand1.address, recentWinners);
      expect(eligible).to.be.false;
    });

    it("Should return false with array shorter than separation distance", async function () {
      // Group has separation distance 2
      const recentWinners = [brand2.address]; // Only 1 entry, but bran2 is in same group
      
      const eligible = await manager.isEligible(brand1.address, recentWinners);
      expect(eligible).to.be.false;
    });

    it("Should handle multiple competitors", async function () {
      // Create another group
      const group2Brands = [brand4.address, brand5.address];
      await manager.connect(broadcaster).createExclusionGroup(2, group2Brands, 3, false);
      
      // brand1 (group 1), brand4 (group 2), recently won
      // But brand3 is ALSO in group 1, so brand1 should NOT be eligible
      const recentWinners = [brand3.address, brand4.address];
      
      // brand3 is from same group as brand1, within distance 2 → NOT eligible
      const eligible = await manager.isEligible(brand1.address, recentWinners);
      expect(eligible).to.be.false;
      
      // brand5 from group 2 should also not be eligible (brand4 from group 2 is recent)
      expect(await manager.isEligible(brand5.address, recentWinners)).to.be.false;
      
      // brand4 from group 2 but brand5 is also in group 2... wait, let me reconsider
      // Recent winners = [group1_member, group2_member]
      // We want to test cross-group scenario
      // Let's use a brand from neither group
      const thirdGroupBrand = (await ethers.getSigners())[9]; // Get fresh signer
      expect(await manager.isEligible(thirdGroupBrand.address, recentWinners)).to.be.true;
    });
  });

  // ──── TEST CASE 9: isEligible returns true when winner outside separation distance ────
  describe("TC9: isEligible - recent winner in same group but OUTSIDE distance", function () {
    beforeEach(async function () {
      const brands = [brand1.address, brand2.address, brand3.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
    });

    it("Should return true when winner in same group but outside distance", async function () {
      // separation = 2, so winners at positions > 2 don't matter
      const recentWinners = [brand2.address, brand4.address, brand5.address]; // brand2 is 2 back
      
      // brand2 is at position 2 (last - 2), just at boundary
      // Actually, with distance 2: check last 2 = indices [1, 0] = [brand4, brand5]
      // brand2 is at index 0, which is 2 positions back
      
      const eligible = await manager.isEligible(brand1.address, recentWinners);
      expect(eligible).to.be.true; // brand2 is outside the window
    });

    it("Should return true with long recent winners array", async function () {
      // separation = 2: only check last 2 winners (most recent 2 slots)
      const recentWinners = [brand1.address, brand2.address, brand3.address, brand4.address, brand5.address];
      // Check indices [3, 4] (i.e., last 2 entries)
      
      const eligible = await manager.isEligible(brand1.address, recentWinners);
      expect(eligible).to.be.true; // brand1 and brand2 are in positions 0,1, outside check window
    });

    it("Should verify exact boundary condition", async function () {
      // separation = 2
      const recentWinners = [brand3.address, brand4.address, brand2.address]; 
      // Most recent (index 2): brand2
      // 1 back (index 1): brand4
      // 2 back (index 0): brand3
      // Check last 2: indices [1,2] = [brand4, brand2]
      
      const eligible = await manager.isEligible(brand1.address, recentWinners);
      expect(eligible).to.be.false; // brand2 is in check window
    });

    it("Should handle distance of 0", async function () {
      // Create group with distance 0: no recent winners matter
      const brands = [brand4.address, brand5.address];
      await manager.connect(broadcaster).createExclusionGroup(2, brands, 0, false);
      
      const recentWinners = [brand4.address, brand5.address];
      const eligible = await manager.isEligible(brand5.address, recentWinners);
      expect(eligible).to.be.true; // distance 0: check 0 entries (empty window)
    });
  });

  // ──── TEST CASE 10: Brand cannot be in two groups simultaneously ────
  describe("TC10: Brand cannot be in two groups simultaneously", function () {
    beforeEach(async function () {
      const group1Brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, group1Brands, 1, false);
    });

    it("Should reject adding to new group if already in one", async function () {
      const group2Brands = [brand3.address, brand4.address];
      await manager.connect(broadcaster).createExclusionGroup(2, group2Brands, 1, false);
      
      // brand1 is already in group 1
      await expect(
        manager.connect(broadcaster).addBrandToGroup(2, brand1.address)
      ).to.be.revertedWithCustomError(manager, "BrandAlreadyInGroup");
    });

    it("Should reject creating group with brand already in another", async function () {
      // brand1 is in group 1
      const newBrands = [brand1.address, brand3.address];
      
      await expect(
        manager.connect(broadcaster).createExclusionGroup(2, newBrands, 1, false)
      ).to.be.revertedWithCustomError(manager, "BrandAlreadyInGroup");
    });

    it("Should allow adding to new group after removal", async function () {
      await manager.connect(broadcaster).removeBrandFromGroup(1, brand1.address);
      expect(await manager.getBrandGroup(brand1.address)).to.equal(0);
      
      const group2Brands = [brand3.address, brand4.address];
      await manager.connect(broadcaster).createExclusionGroup(2, group2Brands, 1, false);
      
      // Now can add to group 2
      await manager.connect(broadcaster).addBrandToGroup(2, brand1.address);
      expect(await manager.getBrandGroup(brand1.address)).to.equal(2);
    });
  });

  // ──── TEST CASE 11: Non-broadcaster cannot create groups ────
  describe("TC11: Non-broadcaster cannot create groups", function () {
    it("Should reject non-broadcaster creating group", async function () {
      const brands = [brand1.address, brand2.address];
      
      await expect(
        manager.connect(nonBroadcaster).createExclusionGroup(1, brands, 1, false)
      ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    });

    it("Should reject non-broadcaster adding brand", async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 1, false);
      
      await expect(
        manager.connect(nonBroadcaster).addBrandToGroup(1, brand3.address)
      ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    });

    it("Should reject non-broadcaster removing brand", async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 1, false);
      
      await expect(
        manager.connect(nonBroadcaster).removeBrandFromGroup(1, brand1.address)
      ).to.be.revertedWithCustomError(manager, "AccessControlUnauthorizedAccount");
    });

    it("Should allow broadcaster with role", async function () {
      const brands = [brand1.address, brand2.address];
      
      await expect(
        manager.connect(broadcaster).createExclusionGroup(1, brands, 1, false)
      ).to.emit(manager, "ExclusionGroupCreated");
    });

    it("Should allow anyone to call public functions like isEligible", async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 1, false);
      
      const eligible = await manager.connect(nonBroadcaster).isEligible(brand3.address, []);
      expect(eligible).to.be.true;
    });
  });

  // ──── Additional Edge Cases & Comprehensive Coverage ────
  describe("Edge Cases & Additional Tests", function () {
    it("Should handle large separation distances", async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 254, false);
      
      const info = await manager.getGroupInfo(1);
      expect(info.separationDistance).to.equal(254);
    });

    it("Should reject invalid separation distance 255", async function () {
      const brands = [brand1.address, brand2.address];
      
      await expect(
        manager.connect(broadcaster).createExclusionGroup(1, brands, 255, false)
      ).to.be.revertedWithCustomError(manager, "InvalidSeparationDistance");
    });

    it("Should handle complex isEligible scenario with multiple groups", async function () {
      // Create 3 groups
      await manager.connect(broadcaster).createExclusionGroup(1, [brand1.address, brand2.address], 2, true);
      await manager.connect(broadcaster).createExclusionGroup(2, [brand3.address, brand4.address], 1, false);
      const group3Brands = [brand5.address];
      // Can't create group with 1 brand
      
      const recentWinners = [brand1.address, brand3.address];
      
      // brand2 (group 1): brand1 from group 1 is 1 slot back (within distance 2) → not eligible
      expect(await manager.isEligible(brand2.address, recentWinners)).to.be.false;
      
      // brand4 (group 2): brand3 from group 2 is 0 slots back (within distance 1) → not eligible
      expect(await manager.isEligible(brand4.address, recentWinners)).to.be.false;
      
      // brand5 (no group): always eligible
      expect(await manager.isEligible(brand5.address, recentWinners)).to.be.true;
    });

    it("Should handle large recent winners array", async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
      
      // Create large array: 100 entries, with brand2 at position 50
      const largeWinnersArray = new Array(100).fill(brand4.address);
      largeWinnersArray[50] = brand2.address;
      
      // brand2 is at index 50 (50 positions back), way beyond distance of 2
      const eligible = await manager.isEligible(brand1.address, largeWinnersArray);
      expect(eligible).to.be.true;
    });

    it("Should maintain consistency across multiple operations", async function () {
      const brands1 = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands1, 2, true);
      
      // Add brand3
      await manager.connect(broadcaster).addBrandToGroup(1, brand3.address);
      
      // Remove brand1
      await manager.connect(broadcaster).removeBrandFromGroup(1, brand1.address);
      
      // Verify state
      expect(await manager.getBrandGroup(brand1.address)).to.equal(0);
      expect(await manager.getBrandGroup(brand2.address)).to.equal(1);
      expect(await manager.getBrandGroup(brand3.address)).to.equal(1);
      
      const info = await manager.getGroupInfo(1);
      expect(info.brandCount).to.equal(2);
      
      const groupBrands = await manager.getGroupBrands(1);
      expect(groupBrands).to.have.lengthOf(2);
      expect(groupBrands).not.to.include(brand1.address);
    });

    it("Should support separation distance changes via admin override", async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
      
      const infoBefore = await manager.getGroupInfo(1);
      expect(infoBefore.separationDistance).to.equal(2);
      
      const newBrands = [brand1.address, brand2.address];
      await manager.connect(owner).adminOverride(1, newBrands, 5, false);
      
      const infoAfter = await manager.getGroupInfo(1);
      expect(infoAfter.separationDistance).to.equal(5);
      expect(infoAfter.crossEventSeparation).to.be.false;
    });

    it("Should reject admin override with invalid params", async function () {
      const brands = [brand1.address, brand2.address];
      await manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true);
      
      // Try to override with only 1 brand
      await expect(
        manager.connect(owner).adminOverride(1, [brand3.address], 2, false)
      ).to.be.revertedWithCustomError(manager, "EmptyBrandsArray");
    });

    it("Should emit events on all operations", async function () {
      const brands = [brand1.address, brand2.address];
      
      // Create
      await expect(
        manager.connect(broadcaster).createExclusionGroup(1, brands, 2, true)
      ).to.emit(manager, "ExclusionGroupCreated");
      
      // Add
      await expect(
        manager.connect(broadcaster).addBrandToGroup(1, brand3.address)
      ).to.emit(manager, "BrandAddedToGroup");
      
      // Lock
      await expect(
        manager.lockGroup(1)
      ).to.emit(manager, "GroupLocked");
    });
  });
});
