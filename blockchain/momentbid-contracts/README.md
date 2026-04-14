# momentbid-contracts

Scaffolded from the blockchain implementation plan.

## Quick start

1. Copy .env.example to .env and fill values.
2. Install dependencies.
3. Compile contracts.

## Commands

- npm run compile
- npm test
- npm run node
- npm run deploy:local
- npm run deploy:wirefluid
- npm run grant:roles:local
- npm run grant:roles:wirefluid
- npm run demo:flow
- npm run demo:flow:local

## Deployment (Phase 5)

### Local

1. Start local node:
	- npm run node
2. Deploy contracts:
	- npm run deploy:local
3. Set deployed addresses in .env, then grant roles:
	- npm run grant:roles:local

### WireFluid

1. Populate .env with deployer key + wallets.
2. Deploy contracts:
	- npm run deploy:wirefluid
3. Set deployed addresses in .env, then grant roles:
	- npm run grant:roles:wirefluid

### Optional Parameter Overrides for Ignition Deploy

You can override deployment parameters in command line:

- npx hardhat ignition deploy ignition/modules/deploy.js --network wirefluid --parameters '{"platformWallet":"0x...","platformFeePercent":5}'

If no platformWallet parameter is provided, deploy module defaults to deployer account.

## Structure

- contracts/: Solidity contracts
- test/: Hardhat test files
- ignition/modules/: deployment scripts
- scripts/: operational scripts (roles, maintenance)
