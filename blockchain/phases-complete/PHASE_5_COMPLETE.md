# Phase 5 Completion Report: Deployment and Role Provisioning

Status: COMPLETE
Date: April 14, 2026
Scope: Production deployment module + post-deploy role grant automation

---

## What Was Implemented

### 1) Ignition Deployment Module

Implemented a full Hardhat Ignition module in [blockchain/momentbid-contracts/ignition/modules/deploy.js](../momentbid-contracts/ignition/modules/deploy.js).

Deployment order is plan-aligned:
1. MomentBidToken
2. ExclusionManager
3. MomentBidCore (depends on token + exclusion manager + platform wallet + platform fee)
4. OracleController (depends on core)

Module outputs all deployed contract instances for traceable deployment results.

### 2) Role Grant Script

Implemented a production-safe role grant workflow in [blockchain/momentbid-contracts/scripts/grantRoles.js](../momentbid-contracts/scripts/grantRoles.js).

Capabilities:
- Validates required environment variables before any state-changing call
- Validates all configured addresses and rejects zero-address values
- Performs idempotent role grants (skips if role already exists)
- Grants required cross-contract oracle wiring:
  - ORACLE_ROLE on MomentBidCore to OracleController contract
  - ORACLE_ROLE on OracleController to oracle wallet
- Supports optional operational grants:
  - MINTER_ROLE on token to BACKEND_MINTER_WALLET
  - Optional comma-separated BROADCASTER_WALLETS and BRAND_WALLETS pre-grants
- Emits clear logs for applied and skipped grants, with tx hashes for auditability

### 3) Workflow and Developer Command Updates

Updated [blockchain/momentbid-contracts/package.json](../momentbid-contracts/package.json):
- deploy:local -> uses hardhat ignition deploy
- deploy:wirefluid -> uses hardhat ignition deploy
- grant:roles:local -> role automation on localhost
- grant:roles:wirefluid -> role automation on wirefluid

Updated [blockchain/momentbid-contracts/.env.example](../momentbid-contracts/.env.example):
- Added BACKEND_MINTER_WALLET
- Added BROADCASTER_WALLETS
- Added BRAND_WALLETS

Updated [blockchain/momentbid-contracts/README.md](../momentbid-contracts/README.md):
- Added end-to-end Phase 5 local and wirefluid command sequence
- Added parameter override example for Ignition deployment

---

## Verification Performed

### A) Compilation
Command:
- npx hardhat compile

Result:
- Build success

### B) Real Ignition Deployment Run (Validated)
Command:
- npx hardhat ignition deploy ignition/modules/deploy.js --network hardhat

Result:
- Successful deployment of all four contracts
- Address output confirmed for each deployed contract

### C) Full Test Regression
Command:
- npx hardhat test

Result:
- 166 passing
- 0 failing

### D) End-to-End Role Script Validation on Localhost
Commands:
1. Start local node:
   - npx hardhat node
2. Deploy on localhost:
   - npx hardhat ignition deploy ignition/modules/deploy.js --network localhost
3. Run role grants with real deployed addresses:
   - npx hardhat run scripts/grantRoles.js --network localhost

Result:
- Required oracle wiring granted successfully
- Optional backend minter role grant succeeded
- Script completed with clear tx audit logs

### E) Fail-Fast Safety Validation
Command:
- Run role script without required env vars

Result:
- Correctly failed fast with explicit message:
  - Missing required environment variable: MBT_CONTRACT_ADDRESS

---

## Plan Compliance (Phase 5)

Phase 5 required deliverables are satisfied:
- Deploy module implemented for all 4 contracts
- Dependency order and constructor wiring implemented correctly
- Role grant automation implemented for post-deploy setup
- Commands and docs updated for reproducible operation

---

## Operational Notes

Required environment variables for grant script:
- MBT_CONTRACT_ADDRESS
- MOMENTBID_CORE_ADDRESS
- ORACLE_CONTROLLER_ADDRESS
- ORACLE_WALLET

Optional environment variables:
- BACKEND_MINTER_WALLET
- BROADCASTER_WALLETS (comma-separated)
- BRAND_WALLETS (comma-separated)

---

## Phase Outcome

Phase 5 is complete and production-ready.

You can now proceed with deployment execution on WireFluid using:
1. npm run deploy:wirefluid
2. Set deployed addresses in .env
3. npm run grant:roles:wirefluid

Then move to final network smoke checks and backend ABI/address synchronization.
