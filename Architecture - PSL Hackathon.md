# Blockchain vs Backend — Architecture Split

## Context
MomentBid is a **custodial platform** where brands and broadcasters never touch crypto. They use a normal web UI and deal in PKR. The platform handles all blockchain interactions internally. Only the admin and oracle operator use MetaMask directly. The blockchain is a purely internal settlement layer.

**Token model**: Deploy a custom ERC20 token (MomentBidToken / MBT) where **1 MBT = 1 PKR**. When a brand deposits PKR, backend mints equivalent MBT tokens to their wallet on-chain. All bids, escrow, and settlements use MBT (ERC20), NOT native WIRE. WIRE is only used for gas.

---

## The Split — Summary

| Layer | What it does | Who sees it |
|---|---|---|
| **Smart Contracts** | MBT token, escrow, auctions, rules enforcement, settlements | Nobody directly (except admin/oracle via MetaMask) |
| **Django Backend** | Manages wallets, mints tokens on deposit, relays all brand/broadcaster transactions, stores metadata, indexes events, serves API | Brands, broadcasters (through web UI) |
| **React Frontend** | Dashboard UIs for each role | Everyone |

---

## Smart Contracts (Solidity on WireFluid)

### Contracts to build:

**1. MomentBidToken.sol (NEW — not in original SRS)**
- Simple ERC20 with `mint()` function restricted to ADMIN_ROLE
- 1 MBT = 1 PKR (label only, no real exchange)
- Admin/backend mints tokens when brands deposit fiat
- This is the **bidding currency** for all auctions

**2. MomentBidCore.sol** — the auction engine
- Uses ERC20 `transferFrom()` pattern (not `payable` / native token)
- Brand must `approve()` the contract before bidding
- Backend handles both approve + placeBid as a 2-tx sequence

| What | Why on-chain |
|---|---|
| Fund escrow via ERC20 transferFrom | Trustless custody of MBT tokens |
| Bid placement & increase | Verifiable, immutable bid records |
| Budget cap enforcement | Atomic enforcement during auction |
| Match state machine (CREATED→OPEN→ACTIVE→COMPLETED→CANCELLED) | Tamper-proof state transitions |
| Reserve prices, reservation fees, slot counts | Financial parameters enforced during auction |
| Auction resolution (max-iteration winner selection) | Core financial logic — who wins, who pays |
| Atomic settlement (broadcaster 95%, platform 5%) | Trustless money distribution |
| Refund processing | Trustless fund release |

**3. ExclusionManager.sol** — competitor separation
- Exclusion group storage & enforcement
- Locking mechanism tied to match OPEN state
- Admin override for disputes

**4. OracleController.sol** — event trigger validation
- Validates match ACTIVE, event enabled, trigger count < max
- Calls MomentBidCore to resolve auction

**Skip AdInventoryNFT.sol for MVP.**

### Key SRS change: ERC20 instead of native token
The SRS has `placeBid() external payable` — this changes to:
```
placeBid(uint256 matchId, uint8 eventType, uint256 amount, string creativeRef) external
```
Where `amount` of MBT tokens is pulled via `transferFrom()`. Brand's wallet must have called `MBT.approve(momentBidCoreAddress, amount)` first. Backend handles this automatically.

---

## Django Backend (REST + Channels + web3.py)

### 1. Custodial Wallet Management

| Feature | Details |
|---|---|
| **Generate wallets** | Backend creates a unique Ethereum wallet (private key + address) per brand/broadcaster. Keys stored encrypted in Django DB |
| **Fund with gas** | Admin pre-funds each wallet with a small WIRE amount for gas (~0.1 WIRE). Backend tops up if needed |
| **Submit transactions** | Backend uses web3.py to sign and send ALL on-chain txs for brands/broadcasters |
| **Track balances** | Backend shows balances in PKR terms (1 MBT = 1 PKR) |

### 2. Deposit Flow (Real Token Movement)

```
Brand clicks "Deposit 500,000 PKR" in web UI:

  Step 1: Backend calls MBT.mint(brandWallet, 500000)
          → Real on-chain tx: 500K MBT minted to brand's wallet (0xAAA)
          → Brand wallet now holds 500K MBT on-chain

  Step 2: Backend records deposit in Django DB
          → brand_id, amount_pkr=500000, tx_hash, timestamp

  UI shows: "Balance: 500,000 PKR"
  (This IS the conversion — PKR deposited → MBT minted)
```

### 3. Bid Flow (Real Token Movement)

```
Brand clicks "Bid 300K on OVER_BREAK":

  Step 1: Backend calls MBT.approve(MomentBidCore, 300000)
          → Signed with brand's wallet key
          → Allows contract to pull tokens

  Step 2: Backend calls MomentBidCore.placeBid(matchId, OVER_BREAK, 300000, creativeRef)
          → Signed with brand's wallet key
          → Contract calls MBT.transferFrom(brand, contract, 300000)
          → 300K MBT now escrowed in contract

  UI shows: "Escrowed: 300,000 PKR | Available: 200,000 PKR"
  (All real on-chain token movement)
```

### 4. Transaction Relay Table

| User Action (Web UI) | Backend Does | On-Chain Txs |
|---|---|---|
| Brand deposits PKR | Mints MBT to brand wallet | `MBT.mint(brandWallet, amount)` |
| Brand places bid | Approves + places bid | `MBT.approve()` then `placeBid()` |
| Brand increases bid | Approves + increases | `MBT.approve()` then `increaseBid()` |
| Brand sets budget cap | Signs tx | `setBudgetCap()` |
| Brand claims refund | Signs tx | `claimRefund()` |
| Broadcaster creates match | Signs tx | `createMatch()` |
| Broadcaster configs events | Signs tx | Various setters |
| Broadcaster opens bidding | Signs tx | `transitionState(OPEN)` |
| Broadcaster creates exclusion group | Signs tx | `createExclusionGroup()` |

**Admin and Oracle use MetaMask directly — NOT through backend.**

### 5. Data Storage (Django Models)

| Data | Why in Django DB |
|---|---|
| Match metadata (team names, venue, date) | Display data. Contract stores only matchId (SRS NFR-4.2.4) |
| Ad creatives (files, thumbnails) | Only the hash reference goes on-chain |
| User profiles (brand name, logo, contact) | No financial relevance |
| Deposit history (PKR amounts, tx hashes) | Audit trail for fiat↔token mapping |
| Indexed on-chain events | Queryable copy for fast dashboard loads (SRS NFR-4.2.5) |
| Analytics aggregations | Pre-computed stats |
| Wallet-to-user mapping | Links managed wallets to accounts |
| Encrypted private keys | Custodial key storage |

### 6. Event Indexing (web3.py listener)

Background process listening to contract events:
```
Smart Contract emits event (e.g., AuctionSettled)
  → web3.py WebSocket listener catches it
  → Writes to Django DB (indexed, queryable)
  → Django Channels pushes real-time update to browsers
```

### 7. Oracle / Match Simulator

- Django page for team member to trigger events
- Uses oracle wallet via **MetaMask** (not managed by backend)
- Clicking "Trigger OVER_BREAK" prompts MetaMask to send tx to OracleController

### 8. REST API Endpoints

| Endpoint Group | Purpose |
|---|---|
| `/api/auth/` | Login, register (Django auth, not crypto) |
| `/api/deposits/` | Brand deposits PKR → backend mints MBT |
| `/api/matches/` | CRUD for matches |
| `/api/matches/{id}/bids/` | Place bid, increase bid (backend relays to chain) |
| `/api/matches/{id}/events/` | Triggered events + auction results |
| `/api/matches/{id}/refunds/` | Claim refund |
| `/api/brands/` | Profile, balance, spending history |
| `/api/broadcasters/` | Profile, earnings |
| `/api/exclusion-groups/` | CRUD (backend relays to chain) |
| `/ws/matches/{id}/` | WebSocket for real-time updates |

---

## What Each Team Member Builds

| Person | Builds | Tech Stack |
|---|---|---|
| **Person 1 (Solidity)** | MomentBidToken (ERC20), MomentBidCore, ExclusionManager, OracleController, deploy scripts, unit tests | Solidity + Hardhat + OpenZeppelin |
| **Person 2 (Backend)** | Wallet mgmt, token minting, tx relay, event indexer, REST API, WebSocket | Django REST + Django Channels + web3.py |
| **Person 3 (Frontend)** | Brand dashboard, broadcaster dashboard, admin panel, match simulator | React + wagmi/viem (admin/oracle) + REST (brands/broadcasters) |

**Frontend note — two modes:**
- **Brand/Broadcaster pages**: Normal React ↔ Django REST. No MetaMask. No crypto.
- **Admin/Oracle pages**: React + wagmi/viem ↔ MetaMask ↔ Smart Contracts directly.

---

## Data Flow Diagrams

### Brand deposits and bids:
```
Brand (web UI) → "Deposit 500K PKR" → Django API
  → web3.py: MBT.mint(brandWallet, 500000) [real on-chain mint]
  → Django DB: record deposit

Brand (web UI) → "Bid 300K on OVER_BREAK" → Django API
  → web3.py: MBT.approve(contract, 300000) [real on-chain approve]
  → web3.py: MomentBidCore.placeBid(...) [real on-chain escrow]
  → Contract emits BidPlaced event
  → Indexer catches event → Django DB → Django Channels → all browsers
```

### Oracle triggers event:
```
Team member (simulator) → MetaMask → OracleController.triggerEvent()
  → OracleController validates → calls MomentBidCore.resolveAuction()
  → Contract resolves N slots, emits AuctionSettled events
  → Indexer catches events → Django DB
  → Django Channels → Broadcaster sees ad playlist, brands see results
```

### Refund after match:
```
Brand (web UI) → "Claim Refund" → Django API
  → web3.py: MomentBidCore.claimRefund(matchId) [real on-chain refund]
  → MBT tokens return to brand's wallet
  → UI shows: "Refunded: 200,000 PKR"
```

---

## Verification Plan
1. Deploy MBT + all contracts to WireFluid testnet via Hardhat
2. Run Hardhat unit tests for auction/refund/exclusion logic
3. Test MBT minting and approve/transferFrom flow
4. Start Django backend, verify wallet generation and tx relay
5. Full flow test: deposit → bid → trigger event → auction settles → refund
6. Verify real-time updates via Django Channels
