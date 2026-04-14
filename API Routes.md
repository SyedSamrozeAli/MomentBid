# MomentBid API Routes — Test Reference

**Base URL:** `http://localhost:8000/api`

All protected routes require:
```
Authorization: Bearer <access_token>
```

All responses follow the envelope:
```json
{
  "success": true,
  "message": "...",
  "data": { ... },
  "error": null
}
```

---

## AUTH

### POST `/api/auth/register/brand/`
Register a new brand org + wallet. Returns JWT tokens.

**Auth:** None

**Payload:**
```json
{
  "username": "ali_pepsi",
  "password": "securepass123",
  "email": "ali@pepsi.com",
  "brand_name": "Pepsi",
  "logo_url": "https://example.com/pepsi-logo.png"
}
```

**Response:**
```json
{
  "user": { "id": 1, "username": "ali_pepsi", "email": "ali@pepsi.com", "role": "brand_owner" },
  "brand": { "id": 1, "name": "Pepsi", "wallet_address": "0xABC..." },
  "tokens": { "access": "eyJ...", "refresh": "eyJ..." }
}
```

---

### POST `/api/auth/register/broadcaster/`
Register a new broadcaster org + wallet.

**Auth:** None

**Payload:**
```json
{
  "username": "admin_ptv",
  "password": "securepass123",
  "email": "admin@ptvsports.com",
  "broadcaster_name": "PTV Sports",
  "logo_url": "https://example.com/ptv-logo.png"
}
```

---

### POST `/api/auth/login/`
Login. Returns JWT access + refresh tokens.

**Auth:** None

**Payload:**
```json
{
  "username": "ali_pepsi",
  "password": "securepass123"
}
```

**Response:**
```json
{
  "access": "eyJ...",
  "refresh": "eyJ..."
}
```

---

### POST `/api/auth/refresh/`
Refresh an expired access token.

**Auth:** None

**Payload:**
```json
{
  "refresh": "eyJ..."
}
```

---

### GET `/api/auth/me/`
Get current user profile, org details, and wallet balance.

**Auth:** Any authenticated user

**Response:**
```json
{
  "user": { "id": 1, "username": "ali_pepsi", "role": "brand_owner" },
  "org": {
    "type": "brand",
    "id": 1,
    "name": "Pepsi",
    "wallet_address": "0xABC..."
  },
  "balance": 500000
}
```

---

## BRANDS & BROADCASTERS

### GET `/api/brands/`
List all registered brands (used by broadcaster to build exclusion groups).

**Auth:** Any authenticated user

**Response:**
```json
[
  { "id": 1, "name": "Pepsi", "wallet_address": "0xABC..." },
  { "id": 2, "name": "KFC",   "wallet_address": "0xDEF..." }
]
```

---

### GET `/api/broadcasters/`
List all registered broadcasters.

**Auth:** Any authenticated user

---

### GET `/api/brands/me/dashboard/`
Brand's financial summary dashboard.

**Auth:** Brand user

**Response:**
```json
{
  "brand_name": "Pepsi",
  "wallet_address": "0xABC...",
  "balance_pkr": 200000,
  "total_deposited": "500000.00",
  "total_spent": "300000.00",
  "total_refunded": "0.00",
  "active_bids_count": 2,
  "escrowed_total": "300000.00"
}
```

---

### GET `/api/broadcasters/me/dashboard/`
Broadcaster's revenue summary dashboard.

**Auth:** Broadcaster user

**Response:**
```json
{
  "broadcaster_name": "PTV Sports",
  "wallet_address": "0xBBB...",
  "total_earnings": "142500.00",
  "total_auction_revenue": "150000.00",
  "total_matches": 3,
  "active_matches": 1,
  "completed_matches": 2
}
```

---

## WALLETS & DEPOSITS

### POST `/api/deposits/`
Deposit PKR — backend mints equivalent MBT to brand's wallet.

**Auth:** Brand user

**Payload:**
```json
{
  "amount_pkr": "500000"
}
```

**Response:**
```json
{
  "id": 1,
  "amount_pkr": "500000.00",
  "tx_hash": "0xabc123...",
  "status": "confirmed",
  "created_at": "2026-04-14T10:00:00Z"
}
```

---

### GET `/api/deposits/`
List all deposits made by the authenticated brand.

**Auth:** Brand user

---

### GET `/api/balance/`
Get current MBT balance of the authenticated brand's wallet.

**Auth:** Brand user

**Response:**
```json
{
  "balance_pkr": 200000
}
```

---

## MATCHES

### POST `/api/matches/`
Create a new match. Also registers match on-chain.

**Auth:** Broadcaster owner

**Payload:**
```json
{
  "team_a": "Lahore Qalandars",
  "team_b": "Islamabad United",
  "venue": "Gaddafi Stadium, Lahore",
  "match_date": "2026-04-20T19:00:00Z"
}
```

**Response:**
```json
{
  "id": 1,
  "on_chain_match_id": 1,
  "broadcaster": "PTV Sports",
  "team_a": "Lahore Qalandars",
  "team_b": "Islamabad United",
  "venue": "Gaddafi Stadium, Lahore",
  "match_date": "2026-04-20T19:00:00Z",
  "state": 0,
  "state_label": "Created",
  "event_configs": []
}
```

---

### GET `/api/matches/`
List all matches. Optionally filter by state.

**Auth:** Any authenticated user

**Query params:**
- `?state=0` → CREATED
- `?state=1` → OPEN
- `?state=2` → ACTIVE
- `?state=3` → COMPLETED
- `?state=4` → CANCELLED

---

### GET `/api/matches/{match_id}/`
Full match detail including event configs and bids summary per event type.

**Auth:** Any authenticated user

---

### POST `/api/matches/{match_id}/event-configs/`
Configure an event type for a match. Match must be in CREATED state.

**Auth:** Broadcaster owner (must own the match)

**Event type values:**
| Value | Name |
|---|---|
| 0 | OVER_BREAK |
| 1 | STRATEGIC_TIMEOUT |
| 2 | INNINGS_BREAK |
| 3 | WICKET_FALL |
| 4 | HIGH_VALUE_WICKET |
| 5 | LAST_OVER_THRILLER |
| 6 | HAT_TRICK_BALL |
| 7 | SUPER_OVER |

**Payload:**
```json
{
  "event_type": 0,
  "reserve_price": "100000",
  "reservation_fee_pct": "3.00",
  "slot_count": 3,
  "max_triggers": 40
}
```

**Suggested defaults per event type:**
```
OVER_BREAK          → slot_count: 3,  max_triggers: 40
STRATEGIC_TIMEOUT   → slot_count: 5,  max_triggers: 4
INNINGS_BREAK       → slot_count: 12, max_triggers: 1
WICKET_FALL         → slot_count: 2,  max_triggers: 20
HIGH_VALUE_WICKET   → slot_count: 3,  max_triggers: 5
LAST_OVER_THRILLER  → slot_count: 5,  max_triggers: 2
HAT_TRICK_BALL      → slot_count: 3,  max_triggers: 2
SUPER_OVER          → slot_count: 8,  max_triggers: 1
```

---

### POST `/api/matches/{match_id}/open-bidding/`
Transition match CREATED → OPEN. Locks all broadcaster exclusion groups.

**Auth:** Broadcaster owner (must own the match)

**Payload:** None (empty body)

---

## EXCLUSION GROUPS

### POST `/api/exclusion-groups/`
Create an exclusion group (brands that cannot hold adjacent ad slots).

**Auth:** Broadcaster user

**Payload:**
```json
{
  "name": "Cola Brands",
  "separation_distance": 1,
  "cross_event_separation": false,
  "brand_ids": [1, 2]
}
```

**`separation_distance`:** minimum number of slots between competing brands (1 = cannot be adjacent).

**`cross_event_separation`:** if true, separation applies across different event types in the same settlement.

---

### GET `/api/exclusion-groups/`
List all exclusion groups owned by the authenticated broadcaster.

**Auth:** Broadcaster user

**Response:**
```json
[
  {
    "id": 1,
    "name": "Cola Brands",
    "broadcaster": "PTV Sports",
    "separation_distance": 1,
    "cross_event_separation": false,
    "is_locked": false,
    "on_chain_group_id": 1,
    "members": [
      { "brand_id": 1, "brand_name": "Pepsi", "wallet_address": "0xABC..." },
      { "brand_id": 2, "brand_name": "KFC",   "wallet_address": "0xDEF..." }
    ],
    "created_at": "2026-04-14T10:00:00Z"
  }
]
```

---

### PATCH `/api/exclusion-groups/{group_id}/`
Update group name / separation settings. Only works when group is **not locked**.

**Auth:** Broadcaster user (must own the group)

**Payload:**
```json
{
  "name": "Cola & Fast Food",
  "separation_distance": 2
}
```

---

### DELETE `/api/exclusion-groups/{group_id}/`
Delete a group. Only works when group is **not locked**.

**Auth:** Broadcaster user (must own the group)

---

### POST `/api/exclusion-groups/{group_id}/members/`
Add a brand to an exclusion group. Only when group is unlocked.

**Auth:** Broadcaster user

**Payload:**
```json
{
  "brand_id": 3
}
```

---

### DELETE `/api/exclusion-groups/{group_id}/members/{brand_id}/`
Remove a brand from an exclusion group. Only when group is unlocked.

**Auth:** Broadcaster user

---

## BIDDING

### POST `/api/matches/{match_id}/bids/`
Place a bid on an event type. Match must be OPEN. One bid per brand per event type.

**Auth:** Brand user

**Payload:**
```json
{
  "event_type": 0,
  "amount": "300000",
  "creative_ref": "https://cdn.example.com/pepsi-ad-v1.mp4"
}
```

**Response:**
```json
{
  "id": 1,
  "brand": "Pepsi",
  "event_type": 0,
  "amount": "300000.00",
  "creative_ref": "https://cdn.example.com/pepsi-ad-v1.mp4",
  "tx_hash": "0xabc...",
  "is_settled": false,
  "created_at": "2026-04-14T10:05:00Z"
}
```

---

### GET `/api/matches/{match_id}/bids/`
List all bids for a match (open leaderboard — all brands visible to everyone).

**Auth:** Any authenticated user

---

### PATCH `/api/matches/{match_id}/bids/{bid_id}/increase/`
Increase an existing bid by an additional amount.

**Auth:** Brand user (must own the bid)

**Payload:**
```json
{
  "additional_amount": "100000"
}
```

---

### POST `/api/matches/{match_id}/budget-cap/`
Set a total budget cap for the brand across all event types in a match.

**Auth:** Brand user

**Payload:**
```json
{
  "cap": "800000"
}
```

---

## AUCTION RESULTS

### GET `/api/matches/{match_id}/auction-results/`
All settled auction results for a match, grouped by event trigger.

**Auth:** Any authenticated user

**Response:**
```json
[
  {
    "event_type": 0,
    "trigger_number": 1,
    "slots_filled": 2,
    "slots": [
      {
        "id": 1,
        "event_type": 0,
        "trigger_number": 1,
        "slot_position": 1,
        "winner": "Pepsi",
        "amount": "400000.00",
        "creative_ref": "https://cdn.example.com/pepsi-ad.mp4",
        "tx_hash": "0xabc...",
        "created_at": "2026-04-14T20:00:00Z"
      },
      {
        "id": 2,
        "slot_position": 2,
        "winner": "Jazz",
        "amount": "200000.00",
        ...
      }
    ]
  }
]
```

---

## REFUNDS

### POST `/api/matches/{match_id}/refunds/claim/`
Claim refund for unsettled bids after match COMPLETED or CANCELLED.

**Auth:** Brand user

**Payload:** None (empty body)

**Response:**
```json
{
  "id": 1,
  "brand": "Pepsi",
  "amount": "300000",
  "reservation_fee": "0.00",
  "tx_hash": "0xabc...",
  "created_at": "2026-04-14T22:00:00Z"
}
```

---

### GET `/api/matches/{match_id}/refunds/`
List refunds for a match. Brand users see only their own refunds.

**Auth:** Any authenticated user

---

## SIMULATOR (Admin only)

> Create an admin user via Django admin panel or `python manage.py createsuperuser` then set `role = "admin"` in the DB.

### POST `/api/simulator/{match_id}/start/`
Transition match OPEN → ACTIVE. Signals match has started.

**Auth:** Admin

**Payload:** None

---

### POST `/api/simulator/{match_id}/complete/`
Transition match ACTIVE → COMPLETED. Triggers refund eligibility.

**Auth:** Admin

**Payload:** None

---

### POST `/api/simulator/{match_id}/cancel/`
Cancel a match at any non-terminal state. Full refunds become claimable.

**Auth:** Admin

**Payload:** None

---

### POST `/api/simulator/{match_id}/trigger-event/`
Trigger a cricket event — resolves the auction for that event type. Pushes `auction_settled` via WebSocket.

**Auth:** Admin

**Payload:**
```json
{
  "event_type": 0
}
```

**Response:**
```json
{
  "tx_hash": "0xabc...",
  "event_type": 0,
  "trigger_number": 1
}
```

---

### GET `/api/simulator/{match_id}/status/`
View current trigger counts per event type.

**Auth:** Admin

**Response:**
```json
{
  "match_id": 1,
  "state": 2,
  "state_label": "Active",
  "events_enabled": ["OVER_BREAK", "WICKET_FALL", "INNINGS_BREAK"],
  "trigger_counts": {
    "OVER_BREAK":    { "triggered": 5, "max": 40 },
    "WICKET_FALL":   { "triggered": 2, "max": 20 },
    "INNINGS_BREAK": { "triggered": 0, "max": 1  }
  }
}
```

---

## WEBSOCKET

Connect to a match channel to receive real-time events:

```
ws://localhost:8000/ws/matches/{match_id}/
```

**Requires:** Django Channels + Redis running (`redis-server` on port 6379).

**Message format received:**
```json
{
  "event": "auction_settled",
  "payload": {
    "event_type": 0,
    "trigger_number": 1,
    "tx_hash": "0xabc..."
  }
}
```

**Event types pushed:**

| Event | Triggered by | Payload |
|---|---|---|
| `auction_settled` | Simulator trigger-event | `event_type`, `trigger_number`, `tx_hash` |
| `match_state_changed` | Simulator start/complete/cancel | `state` (int) |
| `refund_processed` | Brand claims refund | `brand`, `amount` |

---

## DEMO FLOW (end-to-end sequence)

```
1.  POST /api/auth/register/broadcaster/   → get broadcaster JWT
2.  POST /api/auth/register/brand/         → get brand JWT (repeat for Pepsi, KFC, Jazz)
3.  POST /api/deposits/                    → deposit 500,000 PKR as Pepsi
4.  POST /api/matches/                     → create match as broadcaster
5.  POST /api/matches/1/event-configs/     → configure OVER_BREAK (event_type=0)
6.  POST /api/matches/1/event-configs/     → configure WICKET_FALL (event_type=3)
7.  POST /api/exclusion-groups/            → create "Cola Brands" group with Pepsi + KFC
8.  POST /api/matches/1/open-bidding/      → open bidding (locks exclusion groups)
9.  POST /api/matches/1/bids/              → Pepsi bids 300,000 on OVER_BREAK
10. POST /api/matches/1/bids/              → KFC bids 350,000 on OVER_BREAK
11. PATCH /api/matches/1/bids/1/increase/  → Pepsi increases by 100,000 (now 400,000)
12. POST /api/simulator/1/start/           → admin starts match (→ ACTIVE)
13. POST /api/simulator/1/trigger-event/   → trigger OVER_BREAK  { "event_type": 0 }
14. GET  /api/matches/1/auction-results/   → see slot winners
15. POST /api/simulator/1/complete/        → admin completes match
16. POST /api/matches/1/refunds/claim/     → KFC claims refund (excluded from slots)
17. GET  /api/broadcasters/me/dashboard/   → view revenue
```

---

## QUICK STATE REFERENCE

**Match states:**
| Int | Label | Biddable | Triggerable |
|---|---|---|---|
| 0 | Created | No | No |
| 1 | Open | Yes | No |
| 2 | Active | No | Yes |
| 3 | Completed | No | No |
| 4 | Cancelled | No | No |

**Who can do what:**
| Action | Role |
|---|---|
| Register brand/broadcaster | Anyone (no auth) |
| Create match, configure events, open bidding | Broadcaster owner |
| Deposit funds, place bids, claim refunds | Brand user |
| Start/complete/cancel match, trigger events | Admin |
| View matches, bids, results | Any authenticated user |
