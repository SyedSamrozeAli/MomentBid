const hre = require("hardhat");
require("dotenv").config();

const { ethers } = hre;

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalAddressList(name) {
  const raw = (process.env[name] || "").trim();
  if (!raw) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function assertAddress(value, name) {
  if (!ethers.isAddress(value)) {
    throw new Error(`Invalid address for ${name}: ${value}`);
  }
  if (value === ethers.ZeroAddress) {
    throw new Error(`Zero address is not allowed for ${name}`);
  }
}

async function grantRoleIfMissing(contract, role, account, description) {
  const hasAlready = await contract.hasRole(role, account);
  if (hasAlready) {
    console.log(`[skip] ${description}: ${account} already has role`);
    return;
  }

  const tx = await contract.grantRole(role, account);
  await tx.wait();
  console.log(`[ok] ${description}: granted to ${account} (tx ${tx.hash})`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const mbtAddress = requireEnv("MBT_CONTRACT_ADDRESS");
  const coreAddress = requireEnv("MOMENTBID_CORE_ADDRESS");
  const oracleControllerAddress = requireEnv("ORACLE_CONTROLLER_ADDRESS");
  const oracleWallet = requireEnv("ORACLE_WALLET");

  assertAddress(mbtAddress, "MBT_CONTRACT_ADDRESS");
  assertAddress(coreAddress, "MOMENTBID_CORE_ADDRESS");
  assertAddress(oracleControllerAddress, "ORACLE_CONTROLLER_ADDRESS");
  assertAddress(oracleWallet, "ORACLE_WALLET");

  const backendMinterWallet = (process.env.BACKEND_MINTER_WALLET || "").trim();
  if (backendMinterWallet) {
    assertAddress(backendMinterWallet, "BACKEND_MINTER_WALLET");
  }

  const broadcasterWallets = optionalAddressList("BROADCASTER_WALLETS");
  const brandWallets = optionalAddressList("BRAND_WALLETS");

  broadcasterWallets.forEach((address, idx) => assertAddress(address, `BROADCASTER_WALLETS[${idx}]`));
  brandWallets.forEach((address, idx) => assertAddress(address, `BRAND_WALLETS[${idx}]`));

  const token = await ethers.getContractAt("MomentBidToken", mbtAddress);
  const core = await ethers.getContractAt("MomentBidCore", coreAddress);
  const oracleCtrl = await ethers.getContractAt("OracleController", oracleControllerAddress);

  const ORACLE_ROLE = ethers.id("ORACLE_ROLE");
  const BROADCASTER_ROLE = ethers.id("BROADCASTER_ROLE");
  const BRAND_ROLE = ethers.id("BRAND_ROLE");
  const MINTER_ROLE = ethers.id("MINTER_ROLE");

  // 1) OracleController contract can resolve auctions on MomentBidCore
  await grantRoleIfMissing(
    core,
    ORACLE_ROLE,
    oracleControllerAddress,
    "MomentBidCore.ORACLE_ROLE -> OracleController"
  );

  // 2) Oracle wallet can trigger events on OracleController
  await grantRoleIfMissing(
    oracleCtrl,
    ORACLE_ROLE,
    oracleWallet,
    "OracleController.ORACLE_ROLE -> Oracle wallet"
  );

  // 3) Optional backend minter wallet role on token
  if (backendMinterWallet) {
    await grantRoleIfMissing(
      token,
      MINTER_ROLE,
      backendMinterWallet,
      "MomentBidToken.MINTER_ROLE -> backend minter"
    );
  }

  // 4) Optional pre-grants for demo bootstrapping
  for (const wallet of broadcasterWallets) {
    await grantRoleIfMissing(core, BROADCASTER_ROLE, wallet, "MomentBidCore.BROADCASTER_ROLE -> broadcaster");
  }

  for (const wallet of brandWallets) {
    await grantRoleIfMissing(core, BRAND_ROLE, wallet, "MomentBidCore.BRAND_ROLE -> brand");
  }

  console.log("Role grant workflow complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
