const hre = require("hardhat");

const { ethers } = hre;

function parseEvents(receipt, contract, eventName) {
  const target = contract.target.toLowerCase();
  const parsed = [];

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== target) continue;

    try {
      const decoded = contract.interface.parseLog({
        topics: log.topics,
        data: log.data,
      });

      if (decoded && decoded.name === eventName) {
        parsed.push(decoded);
      }
    } catch (_) {
      // Ignore logs that do not belong to this contract ABI.
    }
  }

  return parsed;
}

function fmt(value) {
  if (typeof value === "bigint") return value.toString();
  return String(value);
}

async function printTokenBalances(token, label, accounts) {
  console.log(`\n=== ${label} ===`);

  for (const account of accounts) {
    const balance = await token.balanceOf(account.address);
    console.log(`${account.name}: ${fmt(balance)} MBT`);
  }
}

async function main() {
  const [admin, broadcaster, oracleWallet, brand1, brand2, platformWallet] = await ethers.getSigners();

  const accounts = {
    admin: { name: "Admin", address: admin.address },
    broadcaster: { name: "Broadcaster", address: broadcaster.address },
    oracleWallet: { name: "OracleWallet", address: oracleWallet.address },
    brand1: { name: "Brand1", address: brand1.address },
    brand2: { name: "Brand2", address: brand2.address },
    platformWallet: { name: "Platform", address: platformWallet.address },
  };

  console.log("\n=== Phase Demo: End-to-End On-Chain Flow ===");
  console.log(`Admin: ${accounts.admin.address}`);
  console.log(`Broadcaster: ${accounts.broadcaster.address}`);
  console.log(`OracleWallet: ${accounts.oracleWallet.address}`);
  console.log(`Brand1: ${accounts.brand1.address}`);
  console.log(`Brand2: ${accounts.brand2.address}`);
  console.log(`Platform: ${accounts.platformWallet.address}`);

  console.log("\n[1/10] Deploy contracts...");
  const MomentBidToken = await ethers.getContractFactory("MomentBidToken");
  const token = await MomentBidToken.deploy();
  await token.waitForDeployment();

  const ExclusionManager = await ethers.getContractFactory("ExclusionManager");
  const exclusionManager = await ExclusionManager.deploy();
  await exclusionManager.waitForDeployment();

  const MomentBidCore = await ethers.getContractFactory("MomentBidCore");
  const core = await MomentBidCore.deploy(
    await token.getAddress(),
    await exclusionManager.getAddress(),
    accounts.platformWallet.address,
    5
  );
  await core.waitForDeployment();

  const OracleController = await ethers.getContractFactory("OracleController");
  const oracleController = await OracleController.deploy(await core.getAddress());
  await oracleController.waitForDeployment();

  console.log(`Token: ${await token.getAddress()}`);
  console.log(`ExclusionManager: ${await exclusionManager.getAddress()}`);
  console.log(`MomentBidCore: ${await core.getAddress()}`);
  console.log(`OracleController: ${await oracleController.getAddress()}`);

  console.log("\n[2/10] Grant required roles...");
  const BROADCASTER_ROLE = ethers.id("BROADCASTER_ROLE");
  const ORACLE_ROLE = ethers.id("ORACLE_ROLE");
  const BRAND_ROLE = ethers.id("BRAND_ROLE");

  await exclusionManager.grantRole(BROADCASTER_ROLE, accounts.broadcaster.address);

  await core.grantRole(BROADCASTER_ROLE, accounts.broadcaster.address);
  await core.grantRole(BRAND_ROLE, accounts.brand1.address);
  await core.grantRole(BRAND_ROLE, accounts.brand2.address);
  await core.grantRole(ORACLE_ROLE, await oracleController.getAddress());

  await oracleController.grantRole(ORACLE_ROLE, accounts.oracleWallet.address);

  console.log(`Core.BROADCASTER_ROLE for broadcaster: ${await core.hasRole(BROADCASTER_ROLE, accounts.broadcaster.address)}`);
  console.log(`Core.BRAND_ROLE for brand1: ${await core.hasRole(BRAND_ROLE, accounts.brand1.address)}`);
  console.log(`Core.BRAND_ROLE for brand2: ${await core.hasRole(BRAND_ROLE, accounts.brand2.address)}`);
  console.log(`Core.ORACLE_ROLE for oracleController: ${await core.hasRole(ORACLE_ROLE, await oracleController.getAddress())}`);
  console.log(`OracleController.ORACLE_ROLE for oracleWallet: ${await oracleController.hasRole(ORACLE_ROLE, accounts.oracleWallet.address)}`);

  console.log("\n[3/10] Client uploads fiat amount -> backend mints MBT...");
  const uploadBrand1 = 10000n;
  const uploadBrand2 = 9000n;

  const mintTx1 = await token.mint(accounts.brand1.address, uploadBrand1);
  const mintReceipt1 = await mintTx1.wait();
  const minted1 = parseEvents(mintReceipt1, token, "TokensMinted")[0];

  const mintTx2 = await token.mint(accounts.brand2.address, uploadBrand2);
  const mintReceipt2 = await mintTx2.wait();
  const minted2 = parseEvents(mintReceipt2, token, "TokensMinted")[0];

  console.log(`Minted -> to: ${minted1.args.to}, amount: ${fmt(minted1.args.amount)}, minter: ${minted1.args.minter}`);
  console.log(`Minted -> to: ${minted2.args.to}, amount: ${fmt(minted2.args.amount)}, minter: ${minted2.args.minter}`);

  await printTokenBalances(token, "Balances After Mint", [
    accounts.brand1,
    accounts.brand2,
    accounts.broadcaster,
    accounts.platformWallet,
  ]);

  console.log("\n[4/10] Broadcaster creates a match and event config...");
  const latestBlock = await ethers.provider.getBlock("latest");
  const matchDate = BigInt(latestBlock.timestamp) + 3600n;

  const createTx = await core.connect(broadcaster).createMatch(matchDate);
  const createReceipt = await createTx.wait();
  const created = parseEvents(createReceipt, core, "MatchCreated")[0];
  const matchId = created.args.matchId;

  console.log(`Match created -> matchId: ${fmt(matchId)}, broadcaster: ${created.args.broadcaster}, matchDate: ${fmt(created.args.matchDate)}`);

  await core.connect(broadcaster).defineEventType(
    matchId,
    0,
    1000,
    3,
    2,
    1
  );

  const eventConfig = await core.getEventConfig(matchId, 0);
  console.log(
    `EventConfig -> enabled=${eventConfig.enabled}, reserve=${fmt(eventConfig.reservePrice)}, slotCount=${fmt(eventConfig.slotCount)}, maxTriggers=${fmt(eventConfig.maxTriggers)}`
  );

  console.log("\n[5/10] Configure exclusion group and lock on OPEN transition...");
  await exclusionManager
    .connect(broadcaster)
    .createExclusionGroup(1, [accounts.brand1.address, accounts.brand2.address], 1, false);

  await core.connect(broadcaster).registerExclusionGroup(matchId, 1);

  const openTx = await core.connect(broadcaster).transitionMatchState(matchId, 1);
  const openReceipt = await openTx.wait();
  const groupLocked = parseEvents(openReceipt, exclusionManager, "GroupLocked");
  const groupInfo = await exclusionManager.getGroupInfo(1);

  console.log(`Group lock events emitted: ${groupLocked.length}`);
  console.log(`Group info -> separationDistance=${fmt(groupInfo.separationDistance)}, crossEvent=${groupInfo.crossEventSeparation}, locked=${groupInfo.locked}`);

  console.log("\n[6/10] Brands approve token spending and place bids...");
  await token.connect(brand1).approve(await core.getAddress(), uploadBrand1);
  await token.connect(brand2).approve(await core.getAddress(), uploadBrand2);

  console.log(`Allowance brand1->core: ${fmt(await token.allowance(accounts.brand1.address, await core.getAddress()))}`);
  console.log(`Allowance brand2->core: ${fmt(await token.allowance(accounts.brand2.address, await core.getAddress()))}`);

  await core.connect(brand1).placeBid(matchId, 0, 3200, "creative-brand-1");
  await core.connect(brand2).placeBid(matchId, 0, 2800, "creative-brand-2");
  await core.connect(brand1).increaseBid(matchId, 0, 500);

  const bids = await core.getBids(matchId, 0);
  console.log("Placed bids from chain state:");
  for (let i = 0; i < bids.length; i++) {
    console.log(
      `  Bid#${i + 1} -> brand=${bids[i].brand}, amount=${fmt(bids[i].amount)}, creativeRef=${bids[i].creativeRef}`
    );
  }

  console.log(`Escrow brand1: ${fmt(await core.getEscrowBalance(matchId, accounts.brand1.address))}`);
  console.log(`Escrow brand2: ${fmt(await core.getEscrowBalance(matchId, accounts.brand2.address))}`);

  console.log("\n[7/10] Transition match OPEN -> ACTIVE...");
  await core.connect(broadcaster).transitionMatchState(matchId, 2);
  console.log(`Match state: ${fmt(await core.getMatchState(matchId))} (2 means ACTIVE)`);

  console.log("\n[8/10] Oracle triggers event; settlement happens in core...");
  const triggerTx = await oracleController.connect(oracleWallet).triggerEvent(matchId, 0);
  const triggerReceipt = await triggerTx.wait();

  const triggered = parseEvents(triggerReceipt, oracleController, "EventTriggered")[0];
  console.log(
    `EventTriggered -> matchId=${fmt(triggered.args.matchId)}, eventType=${fmt(triggered.args.eventType)}, triggerNumber=${fmt(triggered.args.triggerNumber)}`
  );

  const settled = parseEvents(triggerReceipt, core, "AuctionSettled");
  const partialFill = parseEvents(triggerReceipt, core, "PartialFill");
  const noEligible = parseEvents(triggerReceipt, core, "NoEligibleBidder");

  console.log(`AuctionSettled events: ${settled.length}`);
  for (const s of settled) {
    console.log(
      `  Winner -> brand=${s.args.winner}, amount=${fmt(s.args.amount)}, slot=${fmt(s.args.slotPosition)}, trigger=${fmt(s.args.triggerNumber)}`
    );
  }

  if (partialFill.length > 0) {
    console.log(
      `PartialFill -> slotsFilled=${fmt(partialFill[0].args.slotsFilled)}, totalSlots=${fmt(partialFill[0].args.totalSlots)}`
    );
  }

  if (noEligible.length > 0) {
    for (const e of noEligible) {
      console.log(`NoEligibleBidder -> slotPosition=${fmt(e.args.slotPosition)}`);
    }
  }

  console.log(`TotalSpent brand1: ${fmt(await core.getTotalSpent(matchId, accounts.brand1.address))}`);
  console.log(`TotalSpent brand2: ${fmt(await core.getTotalSpent(matchId, accounts.brand2.address))}`);

  await printTokenBalances(token, "Balances After Settlement", [
    accounts.brand1,
    accounts.brand2,
    accounts.broadcaster,
    accounts.platformWallet,
    { name: "CoreContract", address: await core.getAddress() },
  ]);

  console.log("\n[9/10] Complete match and process refunds...");
  await core.connect(admin).transitionMatchState(matchId, 3);
  console.log(`Match state: ${fmt(await core.getMatchState(matchId))} (3 means COMPLETED)`);

  const refundBrand1Tx = await core.connect(brand1).claimRefund(matchId);
  const refundBrand1Receipt = await refundBrand1Tx.wait();
  const refundBrand1Event = parseEvents(refundBrand1Receipt, core, "RefundProcessed")[0];

  const refundBrand2Tx = await core.connect(brand2).claimRefund(matchId);
  const refundBrand2Receipt = await refundBrand2Tx.wait();
  const refundBrand2Event = parseEvents(refundBrand2Receipt, core, "RefundProcessed")[0];

  console.log(
    `Refund brand1 -> refund=${fmt(refundBrand1Event.args.refundAmount)}, reservationFees=${fmt(refundBrand1Event.args.reservationFees)}`
  );
  console.log(
    `Refund brand2 -> refund=${fmt(refundBrand2Event.args.refundAmount)}, reservationFees=${fmt(refundBrand2Event.args.reservationFees)}`
  );

  console.log("\n[10/10] Final on-chain balances and escrow checks...");
  console.log(`Escrow brand1: ${fmt(await core.getEscrowBalance(matchId, accounts.brand1.address))}`);
  console.log(`Escrow brand2: ${fmt(await core.getEscrowBalance(matchId, accounts.brand2.address))}`);

  await printTokenBalances(token, "Final Balances", [
    accounts.brand1,
    accounts.brand2,
    accounts.broadcaster,
    accounts.platformWallet,
    { name: "CoreContract", address: await core.getAddress() },
  ]);

  console.log("\nDemo flow complete. Every printed value was read from contract state/events.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
