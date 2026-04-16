const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OracleController", function () {
  let owner;
  let broadcaster;
  let oracleWallet;
  let brand1;
  let brand2;
  let outsider;
  let platformWallet;

  let token;
  let exclusionManager;
  let core;
  let oracleController;

  const BROADCASTER_ROLE = ethers.id("BROADCASTER_ROLE");
  const ORACLE_ROLE = ethers.id("ORACLE_ROLE");
  const BRAND_ROLE = ethers.id("BRAND_ROLE");

  async function deploySystem() {
    [owner, broadcaster, oracleWallet, brand1, brand2, outsider, platformWallet] = await ethers.getSigners();

    const MomentBidToken = await ethers.getContractFactory("MomentBidToken");
    token = await MomentBidToken.deploy();
    await token.waitForDeployment();

    const ExclusionManager = await ethers.getContractFactory("ExclusionManager");
    exclusionManager = await ExclusionManager.deploy();
    await exclusionManager.waitForDeployment();

    const MomentBidCore = await ethers.getContractFactory("MomentBidCore");
    core = await MomentBidCore.deploy(
      await token.getAddress(),
      await exclusionManager.getAddress(),
      platformWallet.address,
      5
    );
    await core.waitForDeployment();

    const OracleController = await ethers.getContractFactory("OracleController");
    oracleController = await OracleController.deploy(await core.getAddress());
    await oracleController.waitForDeployment();

    await core.grantRole(BROADCASTER_ROLE, broadcaster.address);
    await core.grantRole(BRAND_ROLE, brand1.address);
    await core.grantRole(BRAND_ROLE, brand2.address);

    // Required cross-contract role wiring:
    // - Oracle wallet can trigger on OracleController
    // - OracleController contract can resolve on MomentBidCore
    await oracleController.grantRole(ORACLE_ROLE, oracleWallet.address);
    await core.grantRole(ORACLE_ROLE, await oracleController.getAddress());

    await token.mint(brand1.address, 50000);
    await token.mint(brand2.address, 50000);

    await token.connect(brand1).approve(await core.getAddress(), ethers.MaxUint256);
    await token.connect(brand2).approve(await core.getAddress(), ethers.MaxUint256);
  }

  async function setupMatch(options = {}) {
    const {
      eventType = 0,
      reservePrice = 1000,
      reservationFeePercent = 3,
      slotCount = 1,
      maxTriggers = 2,
      active = true,
      placeBids = true
    } = options;

    const matchDate = (await ethers.provider.getBlock("latest")).timestamp + 3600;

    await core.connect(broadcaster).createMatch(matchDate);
    await core
      .connect(broadcaster)
      .defineEventType(1, eventType, reservePrice, reservationFeePercent, slotCount, maxTriggers);

    await core.connect(broadcaster).transitionMatchState(1, 1); // OPEN

    if (placeBids) {
      await core.connect(brand1).placeBid(1, eventType, reservePrice + 1000, "creative-1");
      await core.connect(brand2).placeBid(1, eventType, reservePrice + 500, "creative-2");
    }

    if (active) {
      await core.connect(broadcaster).transitionMatchState(1, 2); // ACTIVE
    }
  }

  beforeEach(async function () {
    await deploySystem();
  });

  it("TC1: Oracle triggers event successfully and resolveAuction executes", async function () {
    await setupMatch({ maxTriggers: 2 });

    const tx = await oracleController.connect(oracleWallet).triggerEvent(1, 0);

    await expect(tx)
      .to.emit(oracleController, "EventTriggered")
      .withArgs(1, 0, 1);

    const config = await core.getEventConfig(1, 0);
    expect(config.triggerCount).to.equal(1);

    const spentByWinner = await core.getTotalSpent(1, brand1.address);
    expect(spentByWinner).to.equal(2000);
  });

  it("TC2: Non-oracle cannot trigger events", async function () {
    await setupMatch({ maxTriggers: 2 });

    await expect(
      oracleController.connect(outsider).triggerEvent(1, 0)
    ).to.be.revertedWithCustomError(oracleController, "AccessControlUnauthorizedAccount");
  });

  it("TC3: Cannot trigger on non-ACTIVE match", async function () {
    await setupMatch({ active: false });

    await expect(
      oracleController.connect(oracleWallet).triggerEvent(1, 0)
    ).to.be.revertedWithCustomError(oracleController, "MatchNotActive").withArgs(1);
  });

  it("TC4: Cannot trigger disabled event type", async function () {
    await setupMatch({ eventType: 0 });

    // eventType 1 is never configured for this match, so enabled=false
    await expect(
      oracleController.connect(oracleWallet).triggerEvent(1, 1)
    ).to.be.revertedWithCustomError(oracleController, "EventNotEnabled").withArgs(1, 1);
  });

  it("TC5: Cannot trigger beyond maxTriggers", async function () {
    await setupMatch({ maxTriggers: 1 });

    await oracleController.connect(oracleWallet).triggerEvent(1, 0);

    await expect(
      oracleController.connect(oracleWallet).triggerEvent(1, 0)
    )
      .to.be.revertedWithCustomError(oracleController, "MaxTriggersReached")
      .withArgs(1, 0, 1, 1);
  });

  it("TC6: Admin can pause and unpause", async function () {
    await setupMatch({ maxTriggers: 2 });

    await oracleController.connect(owner).pause();
    expect(await oracleController.paused()).to.equal(true);

    await expect(
      oracleController.connect(oracleWallet).triggerEvent(1, 0)
    ).to.be.revertedWithCustomError(oracleController, "EnforcedPause");

    await oracleController.connect(owner).unpause();
    expect(await oracleController.paused()).to.equal(false);
  });

  it("Reverts when core address is zero", async function () {
    const OracleController = await ethers.getContractFactory("OracleController");

    await expect(
      OracleController.deploy(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(OracleController, "InvalidCoreAddress");
  });

  it("Non-admin cannot pause or unpause", async function () {
    await expect(
      oracleController.connect(oracleWallet).pause()
    ).to.be.revertedWithCustomError(oracleController, "AccessControlUnauthorizedAccount");

    await oracleController.connect(owner).pause();

    await expect(
      oracleController.connect(oracleWallet).unpause()
    ).to.be.revertedWithCustomError(oracleController, "AccessControlUnauthorizedAccount");
  });

  it("Trigger fails if OracleController lacks ORACLE_ROLE on MomentBidCore", async function () {
    await setupMatch({ maxTriggers: 2 });

    await core.revokeRole(ORACLE_ROLE, await oracleController.getAddress());

    await expect(
      oracleController.connect(oracleWallet).triggerEvent(1, 0)
    ).to.be.revertedWithCustomError(core, "AccessControlUnauthorizedAccount");
  });
});
