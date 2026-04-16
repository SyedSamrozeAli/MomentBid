# MomentBid

**On-chain ad auction platform for live cricket broadcasts.**

Broadcasters auction real-time ad slots during PSL match events (wicket falls, over breaks, innings breaks) to brands via transparent blockchain bidding. Brands operate entirely in PKR — no crypto wallet or MetaMask required.

Built on the **WireFluid Network** for ENTANGLED 2026.

---

## How It Works

```
Broadcaster creates match → configures event types → opens bidding
Brands deposit PKR → backend mints MBT tokens → brands place bids on event slots
Match goes ACTIVE → Oracle triggers events → auction resolves on-chain
Winners' creatives air → losers get refunds → broadcaster receives 95% settlement
```

**Token model:** 1 MBT (MomentBidToken) = 1 PKR. Backend mints MBT on deposit, handles all on-chain transactions. Brands never see a private key.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  React / Next.js                    │
│     Brand Dashboard │ Broadcaster Dashboard │ Admin │
└────────────────────────┬────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼────────────────────────────┐
│              Django REST Framework                  │
│  Custodial Wallet Manager │ Auction Logic │ Auth    │
│  Celery + RabbitMQ (async jobs)                     │
│  Django Channels + Daphne (WebSocket)               │
└────────────────────────┬────────────────────────────┘
                         │ web3.py
┌────────────────────────▼────────────────────────────┐
│           WireFluid Testnet (Chain ID: 92533)       │
│  MomentBidToken │ MomentBidCore │ ExclusionManager  │
│  OracleController                                   │
└─────────────────────────────────────────────────────┘
```

---

## Deployed Contracts (WireFluid Testnet)

| Contract | Address |
|---|---|
| MomentBidToken (MBT) | `0x5651ae02aDaB7574e55350AE26914c24f66547Fe` |
| MomentBidCore | `0xB264e45004520FeA69220a6d6E44B04F40848DF2` |
| ExclusionManager | `0x272118d466aBC0c98C26271d6837EBbe48A2d163` |
| OracleController | `0x5EFADadd95e6bD15CFB096B2E2205aeC8da8D5b6` |

---

## Repository Structure

```
MomentBid/
├── backend/                        # Django REST API
│   └── project/
│       ├── apps/
│       │   ├── accounts/           # Auth, user roles (brand/broadcaster/admin)
│       │   ├── bidding/            # Bids, creatives, auction results, refunds
│       │   ├── blockchain/         # web3.py service + mock for testing
│       │   ├── indexer/            # WebSocket event push
│       │   ├── matches/            # Match CRUD, event configs, simulator
│       │   └── wallets/            # Deposits, transactions, balance
│       └── config/                 # Django settings, ASGI, URLs
│
├── blockchain/                     # Solidity contracts
│   └── momentbid-contracts/
│       ├── contracts/              # 4 Solidity contracts
│       ├── ignition/modules/       # Hardhat Ignition deploy scripts
│       ├── scripts/                # Role grants, demo flow
│       └── test/                   # Contract test suites
│
└── frontend/                       # Next.js 16 / React 19
    ├── app/                        # App Router pages
    └── lib/                        # API client, hooks, stores
```

---

## Smart Contracts

### MomentBidToken.sol
ERC20 token. 0 decimals. 1 MBT = 1 PKR. Backend admin mints on deposit, burns on withdrawal. Uses OpenZeppelin `ERC20`, `AccessControl`, `Pausable`.

### MomentBidCore.sol
Auction engine. Manages match state machine (`CREATED → OPEN → ACTIVE → COMPLETED / CANCELLED`), bid escrow via ERC20 `transferFrom`, auction resolution (slot-based winner selection), 95/5 broadcaster/platform settlement, and refund processing.

### ExclusionManager.sol
Competitor separation rules. Broadcasters define exclusion groups (e.g., Pepsi + KFC cannot win adjacent slots). Groups lock when match opens. Admin override available for disputes.

### OracleController.sol
Event trigger gateway. Backend oracle wallet calls `triggerEvent(matchId, eventType)` which validates state and calls `MomentBidCore.resolveAuction()` internally.

**OpenZeppelin dependencies:** `ERC20`, `AccessControl`, `ReentrancyGuard`, `Pausable`, `SafeERC20`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.20, Hardhat, OpenZeppelin 5.x |
| Backend | Django 6.0, Django REST Framework, Django Channels |
| Async Queue | Celery + RabbitMQ |
| WebSocket Server | Daphne (ASGI) |
| Blockchain Client | web3.py 7.x |
| Database | PostgreSQL |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| State Management | Zustand |
| Data Fetching | TanStack React Query |

---

## Local Development Setup

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL
- RabbitMQ
- Redis

### Backend

```bash
cd backend

# Create virtualenv and install dependencies
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r dev.requirements.txt

# Configure environment
cp .env.example .env             # edit with your values

# Run migrations
cd project
python manage.py migrate

# Start server (ASGI)
daphne -p 8000 config.asgi:application

# Start Celery worker (separate terminal)
celery -A config worker -l info
```

### Blockchain (Local)

```bash
cd blockchain/momentbid-contracts
npm install

# Run local Hardhat node
npx hardhat node

# Deploy contracts locally
npm run deploy:local

# Grant roles
npm run grant:roles:local

# Run demo flow
npm run demo:flow:local
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables (Backend `.env`)

```env
SECRET_KEY=your-django-secret
DEBUG=True
DATABASE_URL=postgres://user:pass@localhost:5432/momentbid
REDIS_URL=redis://localhost:6379/1
RABBITMQ_URL=amqp://guest:guest@localhost:5672//

# Blockchain
USE_MOCK_BLOCKCHAIN=False
BLOCKCHAIN_RPC_URL=https://evm.wirefluid.com
BLOCKCHAIN_CHAIN_ID=92533
MBT_CONTRACT_ADDRESS=0x5651ae02aDaB7574e55350AE26914c24f66547Fe
MOMENTBID_CORE_ADDRESS=0xB264e45004520FeA69220a6d6E44B04F40848DF2
EXCLUSION_MANAGER_ADDRESS=0x272118d466aBC0c98C26271d6837EBbe48A2d163
ORACLE_CONTROLLER_ADDRESS=0x5EFADadd95e6bD15CFB096B2E2205aeC8da8D5b6

# Wallet keys
ORACLE_WALLET_PRIVATE_KEY=
PLATFORM_WALLET_PRIVATE_KEY=
WALLET_ENCRYPTION_KEY=          # Fernet key for stored brand/broadcaster keys

# Set to True to use mock blockchain (no RPC calls, for unit testing)
USE_MOCK_BLOCKCHAIN=True
```

---

## Running Tests

```bash
# Backend tests
cd backend/project
pytest

# Contract tests
cd blockchain/momentbid-contracts
npx hardhat test

# Contract coverage
npx hardhat coverage
```

---

## Key Roles

| Role | Wallet | Capabilities |
|---|---|---|
| Admin | Platform wallet | Mint MBT, grant roles, pause contracts |
| Oracle | Oracle wallet | Trigger match events via OracleController |
| Broadcaster | Auto-generated per org | Create matches, configure event types |
| Brand | Auto-generated per org | Place bids, increase bids, claim refunds |

All broadcaster and brand wallets are **custodial** — generated and managed by the Django backend. Users interact only through the web UI.

---

## API Overview

Base URL: `/api/`

| Domain | Endpoints |
|---|---|
| Auth | `POST /auth/login/` `POST /auth/register/brand/` `POST /auth/register/broadcaster/` |
| Matches | `GET/POST /matches/` `GET/PATCH /matches/{id}/` `POST /matches/{id}/open-bidding/` |
| Event Configs | `GET/POST /matches/{id}/event-configs/` `GET/PATCH/DELETE /matches/{id}/event-configs/{type}/` |
| Bidding | `GET/POST /matches/{id}/bids/` `PATCH /matches/{id}/bids/{id}/increase/` `DELETE /matches/{id}/bids/{id}/cancel/` |
| Wallet | `GET /balance/` `POST /deposits/` `POST /matches/{id}/refunds/claim/` |
| Simulator (admin) | `POST /simulator/{id}/start/` `POST /simulator/{id}/trigger-event/` `POST /simulator/{id}/complete/` |
| Exclusion Groups | `GET/POST /exclusion-groups/` `PATCH /exclusion-groups/{id}/` `POST/DELETE /exclusion-groups/{id}/members/{brand_id}/` |

Full API docs: [`API Routes.md`](API%20Routes.md)

---

## WebSocket

Connect: `ws://<host>/ws/matches/<match_id>/`

| Event | Triggered When |
|---|---|
| `bid_placed` | Brand places new bid |
| `bid_increased` | Brand increases existing bid |
| `bid_cancelled` | Brand cancels bid |
| `auction_settled` | Oracle triggers event, auction resolves |
| `match_state_changed` | Match transitions state |
| `refund_processed` | Brand claims refund |

---

## Demo Flow

1. **Admin** registers 3 brands + 1 broadcaster
2. **Broadcaster** creates match, configures event types, sets exclusion groups, opens bidding
3. **Brands** deposit PKR, place bids on event slots, increase bids (live leaderboard updates via WebSocket)
4. **Admin** starts match (OPEN → ACTIVE)
5. **Admin Simulator** triggers events — auctions resolve on-chain, ad playlists appear in Broadcaster live monitor
6. **Admin** completes match
7. **Brands** claim refunds for lost/untriggered bids

---

## License

MIT
