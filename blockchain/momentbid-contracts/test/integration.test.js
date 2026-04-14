const { expect } = require("chai");
const { ethers } = require("hardhat");

function parseEvents(receipt, contract, eventName) {
  const out = [];
  const target = contract.target.toLowerCase();

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== target) continue;

    try {
      const decoded = contract.interface.parseLog({
        topics: log.topics,
        data: log.data,
      });

      if (decoded && decoded.name === eventName) {
        out.push(decoded.args);
      }
    } catch (_) {
      // Ignore logs that are not from this ABI.
    }
  }

  return out;
}

describe("Full Match Integration", function () {
  let admin;
  let broadcaster;
  let brand1;
  let brand2;
  let brand3;
  let oracleWallet;
  let platformWallet;

  let token;
  let exclusionManager;
  let core;
  let oracleController;

  const BROADCASTER_ROLE = ethers.id("BROADCASTER_ROLE");
  const ORACLE_ROLE = ethers.id("ORACLE_ROLE");
  const BRAND_ROLE = ethers.id("BRAND_ROLE");

  const MATCH_ID = 1;
  const EVENT_OVER_BREAK = 0;
  const EVENT_WICKET_FALL = 1;

  const ONE_MILLION = 1000000n;

  beforeEach(async function () {
    [admin, broadcaster, brand1, brand2, brand3, oracleWallet, platformWallet] = await ethers.getSigners();

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

    // Role wiring across all four contracts.
    await exclusionManager.grantRole(BROADCASTER_ROLE, broadcaster.address);

    await core.grantRole(BROADCASTER_ROLE, broadcaster.address);
    await core.grantRole(BRAND_ROLE, brand1.address);
    await core.grantRole(BRAND_ROLE, brand2.address);
    await core.grantRole(BRAND_ROLE, brand3.address);
    await core.grantRole(ORACLE_ROLE, await oracleController.getAddress());

    await oracleController.grantRole(ORACLE_ROLE, oracleWallet.address);

    // Fund brands for bidding.
    await token.mint(brand1.address, ONE_MILLION);
    await token.mint(brand2.address, ONE_MILLION);
    await token.mint(brand3.address, ONE_MILLION);

    await token.connect(brand1).approve(await core.getAddress(), ethers.MaxUint256);
    await token.connect(brand2).approve(await core.getAddress(), ethers.MaxUint256);
    await token.connect(brand3).approve(await core.getAddress(), ethers.MaxUint256);
  });

  it("complete match lifecycle", async function () {
    // === SETUP ===
    const latestBlock = await ethers.provider.getBlock("latest");
    const matchDate = BigInt(latestBlock.timestamp) + 3600n;

    await core.connect(broadcaster).createMatch(matchDate);

    // OVER_BREAK: reserve=100K, fee=3%, slots=3, maxTriggers=40
    await core.connect(broadcaster).defineEventType(
      MATCH_ID,
      EVENT_OVER_BREAK,
      100000,
      3,
      3,
      40
    );

    // WICKET_FALL: reserve=50K, fee=2%, slots=2, maxTriggers=20
    await core.connect(broadcaster).defineEventType(
      MATCH_ID,
      EVENT_WICKET_FALL,
      50000,
      2,
      2,
      20
    );

    // Configure exclusion group and lock at CREATED -> OPEN.
    // separationDistance=2 enforces the documented expected partial-fill outcome.
    await exclusionManager
      .connect(broadcaster)
      .createExclusionGroup(1, [brand1.address, brand2.address], 2, false);

    await core.connect(broadcaster).registerExclusionGroup(MATCH_ID, 1);
    await core.connect(broadcaster).transitionMatchState(MATCH_ID, 1); // OPEN

    const groupInfo = await exclusionManager.getGroupInfo(1);
    expect(groupInfo.locked).to.equal(true);

    // === BIDDING ===
    await core.connect(brand1).placeBid(MATCH_ID, EVENT_OVER_BREAK, 300000, "creative-over-brand1");
    await core.connect(brand2).placeBid(MATCH_ID, EVENT_OVER_BREAK, 350000, "creative-over-brand2");
    await core.connect(brand3).placeBid(MATCH_ID, EVENT_OVER_BREAK, 200000, "creative-over-brand3");

    await core.connect(brand1).placeBid(MATCH_ID, EVENT_WICKET_FALL, 250000, "creative-wicket-brand1");
    await core.connect(brand2).placeBid(MATCH_ID, EVENT_WICKET_FALL, 150000, "creative-wicket-brand2");

    await core.connect(brand1).increaseBid(MATCH_ID, EVENT_OVER_BREAK, 100000);

    expect(await core.getEscrowBalance(MATCH_ID, brand1.address)).to.equal(650000);
    expect(await core.getEscrowBalance(MATCH_ID, brand2.address)).to.equal(500000);
    expect(await core.getEscrowBalance(MATCH_ID, brand3.address)).to.equal(200000);

    // === MATCH ACTIVE ===
    await core.connect(admin).transitionMatchState(MATCH_ID, 2); // ACTIVE
    expect(await core.getMatchState(MATCH_ID)).to.equal(2);

    // === TRIGGER OVER_BREAK ===
    const overTx = await oracleController.connect(oracleWallet).triggerEvent(MATCH_ID, EVENT_OVER_BREAK);
    const overReceipt = await overTx.wait();

    const overSettled = parseEvents(overReceipt, core, "AuctionSettled");
    expect(overSettled.length).to.equal(2);

    expect(overSettled[0].winner).to.equal(brand1.address);
    expect(overSettled[0].amount).to.equal(400000);
    expect(overSettled[0].slotPosition).to.equal(1);

    expect(overSettled[1].winner).to.equal(brand3.address);
    expect(overSettled[1].amount).to.equal(200000);
    expect(overSettled[1].slotPosition).to.equal(2);

    const overPartialFill = parseEvents(overReceipt, core, "PartialFill");
    expect(overPartialFill.length).to.equal(1);
    expect(overPartialFill[0].slotsFilled).to.equal(2);
    expect(overPartialFill[0].totalSlots).to.equal(3);

    const overNoEligible = parseEvents(overReceipt, core, "NoEligibleBidder");
    expect(overNoEligible.length).to.equal(1);
    expect(overNoEligible[0].slotPosition).to.equal(3);

    // Broadcaster 95%, Platform 5% of 600K
    expect(await token.balanceOf(broadcaster.address)).to.equal(570000);
    expect(await token.balanceOf(platformWallet.address)).to.equal(30000);

    expect(await core.getEscrowBalance(MATCH_ID, brand1.address)).to.equal(250000);
    expect(await core.getEscrowBalance(MATCH_ID, brand2.address)).to.equal(500000);
    expect(await core.getEscrowBalance(MATCH_ID, brand3.address)).to.equal(0);

    // === TRIGGER WICKET_FALL ===
    const wicketTx = await oracleController.connect(oracleWallet).triggerEvent(MATCH_ID, EVENT_WICKET_FALL);
    const wicketReceipt = await wicketTx.wait();

    const wicketSettled = parseEvents(wicketReceipt, core, "AuctionSettled");
    expect(wicketSettled.length).to.equal(1);
    expect(wicketSettled[0].winner).to.equal(brand1.address);
    expect(wicketSettled[0].amount).to.equal(250000);
    expect(wicketSettled[0].slotPosition).to.equal(1);

    const wicketPartialFill = parseEvents(wicketReceipt, core, "PartialFill");
    expect(wicketPartialFill.length).to.equal(1);
    expect(wicketPartialFill[0].slotsFilled).to.equal(1);
    expect(wicketPartialFill[0].totalSlots).to.equal(2);

    const wicketNoEligible = parseEvents(wicketReceipt, core, "NoEligibleBidder");
    expect(wicketNoEligible.length).to.equal(1);
    expect(wicketNoEligible[0].slotPosition).to.equal(2);

    expect(await core.getTotalSpent(MATCH_ID, brand1.address)).to.equal(650000);
    expect(await core.getTotalSpent(MATCH_ID, brand2.address)).to.equal(0);
    expect(await core.getTotalSpent(MATCH_ID, brand3.address)).to.equal(200000);

    // === COMPLETE MATCH ===
    await core.connect(admin).transitionMatchState(MATCH_ID, 3); // COMPLETED

    // === REFUNDS ===
    const refund1Tx = await core.connect(brand1).claimRefund(MATCH_ID);
    const refund1Receipt = await refund1Tx.wait();
    const refund1 = parseEvents(refund1Receipt, core, "RefundProcessed")[0];
    expect(refund1.refundAmount).to.equal(0);
    expect(refund1.reservationFees).to.equal(0);

    const refund2Tx = await core.connect(brand2).claimRefund(MATCH_ID);
    const refund2Receipt = await refund2Tx.wait();
    const refund2 = parseEvents(refund2Receipt, core, "RefundProcessed")[0];
    expect(refund2.refundAmount).to.equal(500000);
    expect(refund2.reservationFees).to.equal(0);

    const refund3Tx = await core.connect(brand3).claimRefund(MATCH_ID);
    const refund3Receipt = await refund3Tx.wait();
    const refund3 = parseEvents(refund3Receipt, core, "RefundProcessed")[0];
    expect(refund3.refundAmount).to.equal(0);
    expect(refund3.reservationFees).to.equal(0);

    // Verify final balances and zero escrow.
    expect(await core.getEscrowBalance(MATCH_ID, brand1.address)).to.equal(0);
    expect(await core.getEscrowBalance(MATCH_ID, brand2.address)).to.equal(0);
    expect(await core.getEscrowBalance(MATCH_ID, brand3.address)).to.equal(0);

    expect(await token.balanceOf(brand1.address)).to.equal(350000);
    expect(await token.balanceOf(brand2.address)).to.equal(1000000);
    expect(await token.balanceOf(brand3.address)).to.equal(800000);

    // Broadcaster total: 570K + 237.5K = 807.5K
    // Platform total: 30K + 12.5K = 42.5K
    expect(await token.balanceOf(broadcaster.address)).to.equal(807500);
    expect(await token.balanceOf(platformWallet.address)).to.equal(42500);
    expect(await token.balanceOf(await core.getAddress())).to.equal(0);
  });

  it("E2E: cancelled match gives full refund on untriggered events", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const matchDate = BigInt(latestBlock.timestamp) + 3600n;

    await core.connect(broadcaster).createMatch(matchDate);
    await core.connect(broadcaster).defineEventType(
      MATCH_ID,
      EVENT_OVER_BREAK,
      1000,
      3,
      1,
      1
    );

    await core.connect(broadcaster).transitionMatchState(MATCH_ID, 1); // OPEN
    await core.connect(brand1).placeBid(MATCH_ID, EVENT_OVER_BREAK, 3000, "creative-brand-1");

    await core.connect(admin).transitionMatchState(MATCH_ID, 4); // CANCELLED
    await core.connect(brand1).claimRefund(MATCH_ID);

    expect(await token.balanceOf(brand1.address)).to.equal(ONE_MILLION);
    expect(await token.balanceOf(broadcaster.address)).to.equal(0);
    expect(await token.balanceOf(await core.getAddress())).to.equal(0);
  });

  it("E2E: OracleController enforces max trigger count", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const matchDate = BigInt(latestBlock.timestamp) + 3600n;

    await core.connect(broadcaster).createMatch(matchDate);
    await core.connect(broadcaster).defineEventType(
      MATCH_ID,
      EVENT_OVER_BREAK,
      1000,
      3,
      1,
      2
    );

    await core.connect(broadcaster).transitionMatchState(MATCH_ID, 1); // OPEN
    await core.connect(brand1).placeBid(MATCH_ID, EVENT_OVER_BREAK, 4000, "creative-brand-1");
    await core.connect(brand2).placeBid(MATCH_ID, EVENT_OVER_BREAK, 3000, "creative-brand-2");

    await core.connect(broadcaster).transitionMatchState(MATCH_ID, 2); // ACTIVE

    await oracleController.connect(oracleWallet).triggerEvent(MATCH_ID, EVENT_OVER_BREAK);
    await oracleController.connect(oracleWallet).triggerEvent(MATCH_ID, EVENT_OVER_BREAK);

    await expect(
      oracleController.connect(oracleWallet).triggerEvent(MATCH_ID, EVENT_OVER_BREAK)
    )
      .to.be.revertedWithCustomError(oracleController, "MaxTriggersReached")
      .withArgs(MATCH_ID, EVENT_OVER_BREAK, 2, 2);
  });

  it("E2E: trigger fails if core ORACLE role wiring is missing", async function () {
    const latestBlock = await ethers.provider.getBlock("latest");
    const matchDate = BigInt(latestBlock.timestamp) + 3600n;

    await core.connect(broadcaster).createMatch(matchDate);
    await core.connect(broadcaster).defineEventType(
      MATCH_ID,
      EVENT_OVER_BREAK,
      1000,
      3,
      1,
      1
    );

    await core.connect(broadcaster).transitionMatchState(MATCH_ID, 1); // OPEN
    await core.connect(brand1).placeBid(MATCH_ID, EVENT_OVER_BREAK, 4000, "creative-brand-1");
    await core.connect(broadcaster).transitionMatchState(MATCH_ID, 2); // ACTIVE

    await core.revokeRole(ORACLE_ROLE, await oracleController.getAddress());

    await expect(
      oracleController.connect(oracleWallet).triggerEvent(MATCH_ID, EVENT_OVER_BREAK)
    ).to.be.revertedWithCustomError(core, "AccessControlUnauthorizedAccount");
  });
});
