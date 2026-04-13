# Django Backend — End-to-End Implementation Plan

## Context
MomentBid is a custodial platform. Brands/broadcasters use a normal web UI — the backend manages their wallets, mints tokens, and relays all blockchain transactions via web3.py. The backend developer is strong in Django but has zero blockchain experience. Smart contracts are built in parallel by another team member.

**Key design decision**: A mock blockchain service lets the backend developer work independently — no contracts needed until integration.

---

## Project Structure

```
momentbid-backend/
  config/              # Django project settings, urls, asgi, celery
    settings.py
    urls.py
    asgi.py            # Django Channels entry point
    celery.py          # Celery config (optional — can skip for MVP)
  accounts/            # User auth, roles, profiles
  wallets/             # ManagedWallet, deposits, balance tracking
  matches/             # Match CRUD, event configs, exclusion groups
  bidding/             # Bids, auction results, refunds
  blockchain/          # web3.py service layer (NO Django models)
    service.py         # Abstract interface
    mock_service.py    # In-memory mock (dev mode)
    web3_service.py    # Real web3.py (production)
    abis/              # Contract ABI JSONs (from Hardhat artifacts)
  indexer/             # Event listener + WebSocket consumers
  .env
  requirements.txt
```

---

## Phase 1: Project Scaffolding (~1 hour)

### Step 1.1 — Create project + install deps
```bash
mkdir momentbid-backend && cd momentbid-backend
python -m venv venv
venv\Scripts\activate
pip install django djangorestframework djangorestframework-simplejwt django-cors-headers web3 channels channels-redis django-environ cryptography
django-admin startproject config .
python manage.py startapp accounts
python manage.py startapp wallets
python manage.py startapp matches
python manage.py startapp bidding
```

Create `blockchain/` and `indexer/` as Python packages manually (with `__init__.py`).

### Step 1.2 — settings.py configuration
- `AUTH_USER_MODEL = 'accounts.User'`
- DRF with JWT auth (`djangorestframework-simplejwt`)
- `django-cors-headers` for React frontend
- Django Channels with Redis channel layer
- Blockchain config loaded from `.env`:
  - `BLOCKCHAIN_RPC_URL`, `BLOCKCHAIN_CHAIN_ID`
  - `ADMIN_WALLET_PRIVATE_KEY`
  - Contract addresses (MBT, MomentBidCore, ExclusionManager, OracleController)
  - `WALLET_ENCRYPTION_KEY` (Fernet key for encrypting private keys)
  - **`USE_MOCK_BLOCKCHAIN=True`** (default for dev — switches to mock service)

### Step 1.3 — .env template
```
SECRET_KEY=django-secret-key
DEBUG=True
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_CHAIN_ID=31337
ADMIN_WALLET_PRIVATE_KEY=0x...
MBT_CONTRACT_ADDRESS=
MOMENTBID_CORE_ADDRESS=
EXCLUSION_MANAGER_ADDRESS=
ORACLE_CONTROLLER_ADDRESS=
WALLET_ENCRYPTION_KEY=<Fernet.generate_key()>
ORACLE_WALLET_PRIVATE_KEY=0x...
USE_MOCK_BLOCKCHAIN=True
```

---

## Phase 2: Data Models (~2 hours)

### Entity Relationship Overview

```
Brand (org: Pepsi)                    Broadcaster (org: PTV Sports)
  ├── wallet: 0xAAA                     ├── wallet: 0xBBB
  ├── User: ali@pepsi (owner)           ├── User: admin@ptv (owner)
  └── User: sara@pepsi (future)         └── creates Matches
                                              │
  Brand bids on any Match ──────────────────►│ (open marketplace)
```

- **Brand** and **Broadcaster** are organizations with their own wallets
- **User** is a person who logs in and belongs to one org
- **Wallet belongs to the org**, not the user
- Any brand can see and bid on any broadcaster's match (open marketplace)

### accounts/models.py — Brand, Broadcaster, User

```python
class Brand(models.Model):
    """Organization: Pepsi, KFC, Jazz, etc."""
    name = models.CharField(max_length=255, unique=True)
    logo_url = models.URLField(blank=True)
    # Wallet fields (belong to the org, not individual users)
    wallet_address = models.CharField(max_length=42, unique=True, blank=True)
    encrypted_private_key = models.BinaryField(null=True, blank=True)
    wire_funded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Methods: encrypt_private_key(raw_key), decrypt_private_key()

class Broadcaster(models.Model):
    """Organization: PTV Sports, Daraz, etc."""
    name = models.CharField(max_length=255, unique=True)
    logo_url = models.URLField(blank=True)
    # Wallet fields
    wallet_address = models.CharField(max_length=42, unique=True, blank=True)
    encrypted_private_key = models.BinaryField(null=True, blank=True)
    wire_funded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

class User(AbstractUser):
    """Person who logs in. Belongs to one Brand or one Broadcaster."""
    class Role(models.TextChoices):
        BRAND_OWNER = 'brand_owner'
        BRAND_MEMBER = 'brand_member'       # future: team members
        BROADCASTER_OWNER = 'broadcaster_owner'
        BROADCASTER_MEMBER = 'broadcaster_member'  # future
        ADMIN = 'admin'

    role = models.CharField(max_length=25, choices=Role.choices)
    brand = models.ForeignKey(Brand, null=True, blank=True, on_delete=models.CASCADE, related_name='users')
    broadcaster = models.ForeignKey(Broadcaster, null=True, blank=True, on_delete=models.CASCADE, related_name='users')

    def is_brand_user(self):
        return self.brand is not None

    def is_broadcaster_user(self):
        return self.broadcaster is not None

    def get_org(self):
        """Returns the org (Brand or Broadcaster) this user belongs to."""
        return self.brand or self.broadcaster
```

### wallets/models.py — Deposit, Transaction

No separate ManagedWallet model — wallet fields live directly on Brand/Broadcaster.

```python
class Deposit(models.Model):
    """Brand deposits PKR → backend mints MBT to brand's wallet."""
    brand = models.ForeignKey('accounts.Brand', on_delete=models.CASCADE, related_name='deposits')
    amount_pkr = models.DecimalField(max_digits=15, decimal_places=2)
    tx_hash = models.CharField(max_length=66, blank=True)
    status = models.CharField(max_length=20, default='pending')  # pending/confirmed/failed
    created_at = models.DateTimeField(auto_now_add=True)

class Transaction(models.Model):
    """Generic tx log for all on-chain actions."""
    # Polymorphic: either brand or broadcaster initiated the tx
    brand = models.ForeignKey('accounts.Brand', null=True, blank=True, on_delete=models.CASCADE, related_name='transactions')
    broadcaster = models.ForeignKey('accounts.Broadcaster', null=True, blank=True, on_delete=models.CASCADE, related_name='transactions')
    initiated_by = models.ForeignKey('accounts.User', null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=50)  # 'mint', 'approve', 'place_bid', 'create_match', etc.
    tx_hash = models.CharField(max_length=66, blank=True)
    status = models.CharField(max_length=20, default='pending')  # pending/confirmed/failed
    gas_used = models.PositiveIntegerField(null=True)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### matches/models.py — Match, MatchEventConfig, ExclusionGroup

```python
class Match(models.Model):
    class State(models.IntegerChoices):
        CREATED = 0
        OPEN = 1
        ACTIVE = 2
        COMPLETED = 3
        CANCELLED = 4

    on_chain_match_id = models.PositiveIntegerField(unique=True, null=True)
    broadcaster = models.ForeignKey('accounts.Broadcaster', on_delete=models.CASCADE, related_name='matches')
    team_a = models.CharField(max_length=100)
    team_b = models.CharField(max_length=100)
    venue = models.CharField(max_length=200)
    match_date = models.DateTimeField()
    state = models.IntegerField(choices=State.choices, default=State.CREATED)
    create_tx_hash = models.CharField(max_length=66, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class MatchEventConfig(models.Model):
    class EventType(models.IntegerChoices):
        OVER_BREAK = 0
        STRATEGIC_TIMEOUT = 1
        INNINGS_BREAK = 2
        WICKET_FALL = 3
        HIGH_VALUE_WICKET = 4
        LAST_OVER_THRILLER = 5
        HAT_TRICK_BALL = 6
        SUPER_OVER = 7

    match = models.ForeignKey(Match, on_delete=models.CASCADE, related_name='event_configs')
    event_type = models.IntegerField(choices=EventType.choices)
    reserve_price = models.DecimalField(max_digits=15, decimal_places=2)
    reservation_fee_pct = models.DecimalField(max_digits=4, decimal_places=2)
    slot_count = models.PositiveSmallIntegerField(default=3)
    max_triggers = models.PositiveSmallIntegerField(default=40)
    trigger_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        unique_together = ('match', 'event_type')

class ExclusionGroup(models.Model):
    on_chain_group_id = models.PositiveIntegerField(unique=True, null=True)
    name = models.CharField(max_length=100)
    separation_distance = models.PositiveSmallIntegerField(default=1)
    cross_event_separation = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    broadcaster = models.ForeignKey('accounts.Broadcaster', on_delete=models.CASCADE, related_name='exclusion_groups')
    created_at = models.DateTimeField(auto_now_add=True)

class ExclusionGroupMember(models.Model):
    group = models.ForeignKey(ExclusionGroup, on_delete=models.CASCADE, related_name='members')
    brand = models.ForeignKey('accounts.Brand', on_delete=models.CASCADE, related_name='exclusion_memberships')

    class Meta:
        unique_together = ('group', 'brand')
```

### bidding/models.py — Bid, AuctionResult, Refund

```python
class Bid(models.Model):
    match = models.ForeignKey('matches.Match', on_delete=models.CASCADE, related_name='bids')
    brand = models.ForeignKey('accounts.Brand', on_delete=models.CASCADE, related_name='bids')
    event_type = models.IntegerField()
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    creative_ref = models.CharField(max_length=500)
    tx_hash = models.CharField(max_length=66, blank=True)
    is_settled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('match', 'brand', 'event_type')  # one bid per brand per event type

class AuctionResult(models.Model):
    """Populated by event indexer from AuctionSettled events."""
    match = models.ForeignKey('matches.Match', on_delete=models.CASCADE, related_name='auction_results')
    event_type = models.IntegerField()
    trigger_number = models.PositiveSmallIntegerField()
    slot_position = models.PositiveSmallIntegerField()
    winner = models.ForeignKey('accounts.Brand', on_delete=models.CASCADE, related_name='auction_wins')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    creative_ref = models.CharField(max_length=500)
    tx_hash = models.CharField(max_length=66)
    created_at = models.DateTimeField(auto_now_add=True)

class Refund(models.Model):
    match = models.ForeignKey('matches.Match', on_delete=models.CASCADE, related_name='refunds')
    brand = models.ForeignKey('accounts.Brand', on_delete=models.CASCADE, related_name='refunds')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    reservation_fee = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    tx_hash = models.CharField(max_length=66, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

### Run migrations
```bash
python manage.py makemigrations accounts wallets matches bidding
python manage.py migrate
python manage.py createsuperuser
```

Register all models in each app's `admin.py` for debugging.

---

## Phase 3: Blockchain Service Layer (~2 hours)

**This is the architectural linchpin.** All views call one interface — swap mock for real by flipping an env var.

### blockchain/service.py — Abstract interface

```python
@dataclass
class TxResult:
    success: bool
    tx_hash: str
    gas_used: int = 0
    error: str = ''
    data: dict = None

class BlockchainServiceBase(ABC):
    def generate_wallet(self) -> tuple[str, str]: ...           # → (address, private_key)
    def get_mbt_balance(self, address: str) -> int: ...
    def mint_tokens(self, to_address: str, amount: int) -> TxResult: ...
    def approve_tokens(self, owner_private_key, spender_address, amount) -> TxResult: ...
    def place_bid(self, brand_key, match_id, event_type, amount, creative_ref) -> TxResult: ...
    def increase_bid(self, brand_key, match_id, event_type, additional_amount) -> TxResult: ...
    def set_budget_cap(self, brand_key, match_id, cap) -> TxResult: ...
    def create_match(self, broadcaster_key) -> TxResult: ...     # data={'match_id': int}
    def transition_state(self, broadcaster_key, match_id, new_state) -> TxResult: ...
    def configure_event(self, broadcaster_key, match_id, event_type, reserve_price, reservation_fee_pct, slot_count, max_triggers) -> TxResult: ...
    def claim_refund(self, brand_key, match_id) -> TxResult: ...
    def create_exclusion_group(self, broadcaster_key, group_id, brand_addresses, separation, cross_event) -> TxResult: ...
    def trigger_event(self, oracle_key, match_id, event_type) -> TxResult: ...  # Oracle triggers cricket event
    def fund_gas(self, to_address, amount_wire) -> TxResult: ...
```

### blockchain/mock_service.py — Dev mode mock

- Uses `eth_account.Account.create()` for real Ethereum addresses
- Tracks MBT balances in-memory dict
- Returns fake tx hashes for all operations
- Validates balance sufficiency on bid (so deposit→bid flow works end-to-end)
- Module-level singleton so balance state persists across requests

### blockchain/__init__.py — Factory

```python
def get_blockchain_service():
    if settings.USE_MOCK_BLOCKCHAIN:
        # Return singleton mock instance
        ...
    else:
        from .web3_service import Web3BlockchainService
        return Web3BlockchainService()
```

### blockchain/web3_service.py — Real implementation (Phase 8, skeleton now)

- Loads contract ABIs from `blockchain/abis/*.json`
- Generic `_send_tx(tx_func, private_key)` helper: build tx → sign → send → wait receipt
- Each method builds the contract function call and delegates to `_send_tx`
- Nonce lock per wallet address (simple cache lock for hackathon)

---

## Phase 4: Auth + Org Registration + Wallet Creation (~1.5 hours)

### API Endpoints

```
POST /api/auth/register/brand/
  Body: { "username": "ali", "password": "...", "brand_name": "Pepsi", "logo_url": "..." }
  Response: { "user": {...}, "brand": { "id": 1, "name": "Pepsi", "wallet_address": "0xAAA" },
              "tokens": { "access": "...", "refresh": "..." } }

POST /api/auth/register/broadcaster/
  Body: { "username": "admin_ptv", "password": "...", "broadcaster_name": "PTV Sports" }
  Response: { "user": {...}, "broadcaster": { "id": 1, "name": "PTV Sports", "wallet_address": "0xBBB" },
              "tokens": { "access": "...", "refresh": "..." } }

POST /api/auth/login/     → JWT token pair (simplejwt TokenObtainPairView)
POST /api/auth/refresh/   → refresh token (simplejwt TokenRefreshView)
GET  /api/auth/me/        → current user + org details + wallet address + balance
```

### Register Brand flow:
1. Create Brand org with name + logo
2. Call `blockchain_service.generate_wallet()` → get (address, private_key)
3. Set Brand.wallet_address and encrypted_private_key
4. Call `blockchain_service.fund_gas(address, 0.1)` for gas WIRE
5. Create User with role=brand_owner, brand=Brand
6. Return JWT tokens + brand info

### Register Broadcaster flow:
Same pattern — creates Broadcaster org + wallet + User.

### Custom permissions (reused across all apps):
```python
class IsBrandUser(BasePermission):
    """User belongs to a Brand org."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.brand is not None

class IsBroadcasterUser(BasePermission):
    """User belongs to a Broadcaster org."""
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.broadcaster is not None
```

---

## Phase 5: Core REST API (~5 hours)

### 5.1 — Deposits API (wallets app)

```
POST /api/deposits/
  Body: { "amount_pkr": 500000 }
  Flow: validate user is brand_owner → get user.brand → get brand.wallet_address
        → blockchain_service.mint_tokens(brand.wallet_address, amount)
        → create Deposit(brand=user.brand) → create Transaction log → return
  Response: { "id": 1, "amount_pkr": 500000, "tx_hash": "0x...", "status": "confirmed" }

GET /api/deposits/     → list brand's deposits (filtered by user.brand)
GET /api/balance/      → { "balance_pkr": 500000 } (calls get_mbt_balance(brand.wallet_address))
```

### 5.2 — Matches API (matches app)

```
POST /api/matches/
  Body: { "team_a": "Lahore", "team_b": "Islamabad", "venue": "Gaddafi", "match_date": "..." }
  Flow: validate user is broadcaster_owner → save Match(broadcaster=user.broadcaster)
        → blockchain_service.create_match(broadcaster.decrypt_private_key())
        → update on_chain_match_id → return
  Response: { "id": 1, "on_chain_match_id": 1, ... "state": 0, "broadcaster": "PTV Sports" }

GET  /api/matches/                   → list all matches (filterable by state)
GET  /api/matches/{id}/              → match detail + event configs + bid summary

POST /api/matches/{id}/event-configs/
  Body: { "event_type": 0, "reserve_price": 100000, "reservation_fee_pct": 3, "slot_count": 3, "max_triggers": 40 }
  Flow: validate CREATED state → save to DB → blockchain_service.configure_event(...)

POST /api/matches/{id}/open-bidding/
  Flow: validate broadcaster owns this match → validate state is CREATED
        → blockchain_service.transition_state(broadcaster_key, match_id, OPEN)
        → update Match.state=OPEN → lock associated exclusion groups
  (Broadcaster can ONLY do CREATED → OPEN. All other transitions via admin simulator.)
```

### 5.3 — Bids API (bidding app)

```
POST /api/matches/{match_id}/bids/
  Body: { "event_type": 0, "amount": 300000, "creative_ref": "https://cdn.example.com/ad.mp4" }
  Flow: validate OPEN state → validate user is brand_owner → get user.brand
        → brand_key = brand.decrypt_private_key()
        → blockchain_service.approve_tokens(brand_key, core_address, amount)
        → blockchain_service.place_bid(brand_key, on_chain_match_id, event_type, amount, ref)
        → create Bid(match=match, brand=user.brand) → return
  Response: { "id": 1, "brand": "Pepsi", "event_type": 0, "amount": 300000, "tx_hash": "0x..." }

PATCH /api/matches/{match_id}/bids/{id}/increase/
  Body: { "additional_amount": 100000 }
  Flow: validate user.brand owns this bid → approve additional → increase_bid → update Bid.amount

GET /api/matches/{match_id}/bids/
  → all bids for this match (all brands can see each other's amounts per SRS)
  → Response includes brand name for each bid (open leaderboard)

POST /api/matches/{match_id}/budget-cap/
  Body: { "cap": 1000000 }
  Flow: blockchain_service.set_budget_cap(brand_key, ...)
```

### 5.4 — Auction Results API (bidding app)

```
GET /api/matches/{match_id}/auction-results/
  → grouped by (event_type, trigger_number), each with slot results
  Response: [
    { "event_type": 0, "trigger_number": 1,
      "slots": [
        { "position": 1, "winner": "Pepsi", "amount": 350000, "creative_ref": "..." },
        { "position": 2, "winner": "KFC", "amount": 300000, "creative_ref": "..." }
      ],
      "slots_filled": 2, "total_slots": 3
    }
  ]
```
Reads from AuctionResult model (populated by indexer in Phase 6).

### 5.5 — Refunds API (bidding app)

```
POST /api/matches/{match_id}/refunds/claim/
  Flow: validate COMPLETED/CANCELLED → blockchain_service.claim_refund(brand_key, match_id)
        → create Refund record → return

GET /api/matches/{match_id}/refunds/
  → list refunds for this match
```

### 5.6 — Exclusion Groups API (matches app)

```
POST   /api/exclusion-groups/                → create group + relay to chain
GET    /api/exclusion-groups/                → list all groups
PATCH  /api/exclusion-groups/{id}/           → update (only if not locked)
POST   /api/exclusion-groups/{id}/members/   → add brand to group
DELETE /api/exclusion-groups/{id}/members/{brand_id}/  → remove brand
```

### 5.7 — Dashboard Aggregation Endpoints

```
GET /api/brands/me/dashboard/
  → { brand_name, balance_pkr, total_deposited, total_spent, total_refunded, active_bids_count }
  (user.brand aggregated stats)

GET /api/broadcasters/me/dashboard/
  → { broadcaster_name, total_earnings, total_matches, active_matches, earnings_by_event_type }
  (user.broadcaster aggregated stats)

GET /api/brands/                → list all brands (public — for exclusion group management)
GET /api/broadcasters/          → list all broadcasters (public)
```

### 5.8 — Match Simulator / Oracle API (admin only)

The simulator is used by your team (admin role) during the demo to run the live match.
Broadcaster handles match setup; admin handles the live simulation.

Backend manages the oracle wallet. Oracle private key stored in `.env` as `ORACLE_WALLET_PRIVATE_KEY`.

**Who does what:**
| Action | Who | When |
|---|---|---|
| Create match, configure events, exclusion groups | Broadcaster | Before demo / Phase 1 of demo |
| Open bidding (CREATED → OPEN) | Broadcaster | Before match |
| Start match (OPEN → ACTIVE) | Admin (simulator) | Demo begins |
| Trigger events (WICKET_FALL, OVER_BREAK, etc.) | Admin (simulator) | During live demo |
| Complete match (ACTIVE → COMPLETED) | Admin (simulator) | Demo ends |
| Cancel match | Admin (simulator) | If needed |

```
POST /api/simulator/{match_id}/trigger-event/
  Body: { "event_type": 3 }
  Flow: validate admin user → validate match is ACTIVE → validate event enabled
        → validate trigger count < max
        → blockchain_service.trigger_event(oracle_key, on_chain_match_id, event_type)
        → contract resolves auction automatically
        → indexer picks up AuctionSettled events → pushes to WebSocket
  Response: { "tx_hash": "0x...", "event_type": "WICKET_FALL", "trigger_number": 5 }

POST /api/simulator/{match_id}/start/
  Flow: validate admin → transition match OPEN → ACTIVE
        → blockchain_service.transition_state(broadcaster_key, match_id, ACTIVE)

POST /api/simulator/{match_id}/complete/
  Flow: validate admin → transition match ACTIVE → COMPLETED
        → triggers refund processing on-chain

POST /api/simulator/{match_id}/cancel/
  Flow: validate admin → transition match → CANCELLED
        → full refunds for unsettled bids

GET /api/simulator/{match_id}/status/
  → { state, events_enabled, trigger_counts: { "OVER_BREAK": { "triggered": 5, "max": 40 }, ... } }
```

**Permission**: Only `role=admin` users can access `/api/simulator/` endpoints.

---

## Phase 6: Event Indexer (~2 hours)

### Design: Celery periodic task polling every 5 seconds

**Skip Celery if too complex** — can also use a Django management command `python manage.py run_indexer` in a separate terminal.

### indexer/tasks.py (or management command)
```
Every 5 seconds:
  1. Read last_processed_block from DB/cache
  2. Get current block number from chain
  3. For each event type (BidPlaced, AuctionSettled, RefundProcessed, etc.):
     fetch logs from last_block+1 to current_block
  4. For each log entry: call the appropriate handler
  5. Update last_processed_block
```

### indexer/processors.py — Event handlers

| Event | Handler creates |
|---|---|
| `AuctionSettled` | AuctionResult record (maps winner address → Brand via Brand.wallet_address), mark Bid.is_settled |
| `MatchStateChanged` | Update Match.state |
| `RefundProcessed` | Refund record (maps brand address → Brand) |
| `BidPlaced` | Verify/update Bid record (optional — already created by API) |
| `PartialFill` | Logged for dashboard display |

Each handler maps on-chain wallet addresses → Brand/Broadcaster orgs using `Brand.objects.get(wallet_address=address)`.
Each handler also calls `push_to_websocket()` to push real-time update.

### Dev-mode simulate endpoint (for testing without chain)
```
POST /api/dev/simulate-event/
  Body: { "match_id": 1, "event_type": 0 }
  → Directly creates AuctionResult records in DB + pushes WebSocket
  → Only available when USE_MOCK_BLOCKCHAIN=True
```

---

## Phase 7: WebSocket Real-Time Updates (~1.5 hours)

### indexer/consumers.py — MatchConsumer

```python
class MatchConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        match_id = self.scope['url_route']['kwargs']['match_id']
        self.group_name = f'match_{match_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def match_event(self, event):
        await self.send_json(event['data'])
```

### indexer/routing.py
```python
websocket_urlpatterns = [
    re_path(r'ws/matches/(?P<match_id>\d+)/$', MatchConsumer.as_asgi()),
]
```

### indexer/push.py — Called by event processors
```python
def push_to_websocket(match_id, event_name, payload):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'match_{match_id}',
        { 'type': 'match_event', 'data': { 'event': event_name, 'payload': payload } }
    )
```

### WebSocket message types pushed to frontend:
- `bid_placed` — new bid or bid increased
- `auction_settled` — auction result with slot winners (the "ad playlist")
- `match_state_changed` — match transitioned
- `refund_processed` — refund completed

---

## Phase 8: Connect Real Contracts (~2 hours)

When the Solidity developer deploys contracts:

1. Copy ABI files from Hardhat `artifacts/` to `blockchain/abis/`
2. Update `.env` with contract addresses and `USE_MOCK_BLOCKCHAIN=False`
3. Complete `blockchain/web3_service.py` — each method follows pattern:
   ```python
   def place_bid(self, brand_key, match_id, event_type, amount, creative_ref):
       tx_func = self.core_contract.functions.placeBid(match_id, event_type, amount, creative_ref)
       return self._send_tx(tx_func, brand_key)
   ```
4. The generic `_send_tx` handles: nonce → build tx → sign → send → wait receipt
5. Nonce lock per wallet address to prevent collisions on admin wallet

---

## Implementation Order

| # | What | Time | Depends on | Demo impact |
|---|---|---|---|---|
| 1 | Phase 1: Project setup | 1h | — | Foundation |
| 2 | Phase 2: Models + migrations | 2h | Phase 1 | Foundation |
| 3 | Phase 3: Blockchain service (mock) | 2h | Phase 1 | Unlocks all API dev |
| 4 | Phase 4: Auth + wallet creation | 1.5h | Phase 2, 3 | Register/login works |
| 5 | Phase 5.1-5.3: Deposits + Matches + Bids | 3h | Phase 4 | **Core demo flow works** |
| 6 | Phase 5.4-5.7: Results + Refunds + Exclusion + Dashboards | 2h | Phase 5 | Complete flow |
| 7 | Phase 5.8: Simulator/Oracle API | 1.5h | Phase 5 | **Demo event triggering** |
| 8 | Phase 7: WebSocket | 1.5h | Phase 2 | Real-time updates |
| 9 | Phase 6: Event indexer | 2h | Phase 8 | Live auction results |
| 10 | Phase 8: Real web3.py service | 2h | Contracts deployed | Chain integration |

**Total: ~19 hours.** Critical path for demo: Phases 1→2→3→4→5→5.8 (~12h).

---

## Mocking Strategy (Key for Velocity)

- `USE_MOCK_BLOCKCHAIN=True` in `.env` (default)
- MockBlockchainService generates real ETH addresses, tracks balances in-memory
- ALL API endpoints work identically in mock vs real mode
- `/api/simulator/` endpoints work in mock mode too — oracle trigger simulated in-memory
- When contracts ready: flip env var, add ABIs, add addresses → done

---

## Verification Plan

1. Register brand (Pepsi) → Brand org created → wallet assigned → JWT returned
2. Register broadcaster (PTV) → Broadcaster org created → wallet assigned
3. Deposit 500K as Pepsi → MBT minted → balance shows 500,000 PKR
4. Create match as PTV → on_chain_match_id assigned
5. Add event configs (OVER_BREAK, WICKET_FALL, etc.)
6. Transition match CREATED → OPEN
7. Place bid as Pepsi on OVER_BREAK (300K) → approve + placeBid succeed → bid visible
8. Increase bid → amount updated → leaderboard reflects new amount
9. Simulator: start match (OPEN → ACTIVE)
10. Simulator: trigger WICKET_FALL → AuctionResult created → WebSocket pushes to all dashboards
11. Simulator: complete match (ACTIVE → COMPLETED)
12. Claim refund as Pepsi → Refund record created → balance updated
13. Check broadcaster earnings dashboard → shows total revenue
14. Switch to real contracts → repeat full flow on chain
