const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Integration", function () {
  let owner;
  let broadcaster;
  let oracleWallet;
  let brand1;
  let brand2;
  let platformWallet;

  let token;
  let exclusionManager;
  let core;
  let oracleController;

  const BROADCASTER_ROLE = ethers.id("BROADCASTER_ROLE");
  const ORACLE_ROLE = ethers.id("ORACLE_ROLE");
  const BRAND_ROLE = ethers.id("BRAND_ROLE");

  beforeEach(async function () {
    [owner, broadcaster, oracleWallet, brand1, brand2, platformWallet] = await ethers.getSigners();

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

    // Role setup across contracts.
    await exclusionManager.grantRole(BROADCASTER_ROLE, broadcaster.address);

    await core.grantRole(BROADCASTER_ROLE, broadcaster.address);
    await core.grantRole(BRAND_ROLE, brand1.address);
    await core.grantRole(BRAND_ROLE, brand2.address);
    await core.grantRole(ORACLE_ROLE, await oracleController.getAddress());

    await oracleController.grantRole(ORACLE_ROLE, oracleWallet.address);

    // Funding for bidding.
    await token.mint(brand1.address, 50000);
    await token.mint(brand2.address, 50000);

    await token.connect(brand1).approve(await core.getAddress(), ethers.MaxUint256);
    await token.connect(brand2).approve(await core.getAddress(), ethers.MaxUint256);
  });

  it("E2E: full lifecycle works across contracts", async function () {
    // Match setup
    const matchDate = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await core.connect(broadcaster).createMatch(matchDate);
    await core.connect(broadcaster).defineEventType(
      1,
      0,
      1000,
      3,
      1,
      1
    );

    await core.connect(broadcaster).transitionMatchState(1, 1); // OPEN

    // Bids
    await core.connect(brand1).placeBid(1, 0, 5000, "creative-brand-1");
    await core.connect(brand2).placeBid(1, 0, 4000, "creative-brand-2");

    await core.connect(broadcaster).transitionMatchState(1, 2); // ACTIVE

    expect(await core.hasRole(ORACLE_ROLE, await oracleController.getAddress())).to.equal(true);
    expect(await oracleController.hasRole(ORACLE_ROLE, oracleWallet.address)).to.equal(true);
    expect(await core.getMatchState(1)).to.equal(2);

    const cfg = await core.getEventConfig(1, 0);
    expect(cfg.enabled).to.equal(true);
    expect(cfg.maxTriggers).to.equal(1);
    expect(cfg.triggerCount).to.equal(0);

    // Trigger event via OracleController
    await expect(
      oracleController.connect(oracleWallet).triggerEvent(1, 0)
    ).to.emit(oracleController, "EventTriggered").withArgs(1, 0, 1);

    // Match completion and refunds
    await core.connect(owner).transitionMatchState(1, 3); // COMPLETED

    // Losing bidder gets full refund for triggered-and-lost event
    await core.connect(brand2).claimRefund(1);

    // Validate balances after settlement and refund
    expect(await token.balanceOf(platformWallet.address)).to.equal(250);
    expect(await token.balanceOf(broadcaster.address)).to.equal(4750);
    expect(await token.balanceOf(brand1.address)).to.equal(45000);
    expect(await token.balanceOf(brand2.address)).to.equal(50000);
  });

  it("E2E: cancelled match gives full refund on untriggered events", async function () {
    const matchDate = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await core.connect(broadcaster).createMatch(matchDate);
    await core.connect(broadcaster).defineEventType(1, 0, 1000, 3, 1, 1);
    await core.connect(broadcaster).transitionMatchState(1, 1); // OPEN

    await core.connect(brand1).placeBid(1, 0, 3000, "creative-brand-1");

    await core.connect(owner).transitionMatchState(1, 4); // CANCELLED
    await core.connect(brand1).claimRefund(1);

    expect(await token.balanceOf(brand1.address)).to.equal(50000);
    expect(await token.balanceOf(broadcaster.address)).to.equal(0);
  });

  it("E2E: OracleController enforces max trigger count", async function () {
    const matchDate = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await core.connect(broadcaster).createMatch(matchDate);
    await core.connect(broadcaster).defineEventType(1, 0, 1000, 3, 1, 2);
    await core.connect(broadcaster).transitionMatchState(1, 1); // OPEN

    await core.connect(brand1).placeBid(1, 0, 4000, "creative-brand-1");
    await core.connect(brand2).placeBid(1, 0, 3000, "creative-brand-2");

    await core.connect(broadcaster).transitionMatchState(1, 2); // ACTIVE

    await oracleController.connect(oracleWallet).triggerEvent(1, 0);
    await oracleController.connect(oracleWallet).triggerEvent(1, 0);

    await expect(
      oracleController.connect(oracleWallet).triggerEvent(1, 0)
    )
      .to.be.revertedWithCustomError(oracleController, "MaxTriggersReached")
      .withArgs(1, 0, 2, 2);
  });

  it("E2E: trigger fails if cross-contract ORACLE role wiring is missing", async function () {
    const matchDate = (await ethers.provider.getBlock("latest")).timestamp + 3600;
    await core.connect(broadcaster).createMatch(matchDate);
    await core.connect(broadcaster).defineEventType(1, 0, 1000, 3, 1, 1);
    await core.connect(broadcaster).transitionMatchState(1, 1); // OPEN
    await core.connect(brand1).placeBid(1, 0, 4000, "creative-brand-1");
    await core.connect(broadcaster).transitionMatchState(1, 2); // ACTIVE

    await core.revokeRole(ORACLE_ROLE, await oracleController.getAddress());

    await expect(
      oracleController.connect(oracleWallet).triggerEvent(1, 0)
    ).to.be.revertedWithCustomError(core, "AccessControlUnauthorizedAccount");
  });
});
