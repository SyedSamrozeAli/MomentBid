# MomentBid — Frontend API Reference

**Base URL:** `http://localhost:8000/api`  
**WebSocket:** `ws://localhost:8000/ws/matches/{match_id}/`

---

## Global Patterns

### Authentication
Store tokens in memory or `localStorage` after login. Send on every protected request:
```
Authorization: Bearer <access_token>
```

Refresh before expiry:
```
POST /api/auth/refresh/   { "refresh": "<refresh_token>" }
→ { "access": "eyJ..." }
```

### Response Envelope
Every response (success and error) wraps data in:
```json
{
  "success": true,
  "message": "Human readable",
  "data": { ... },
  "error": null
}
```
On error: `"success": false`, `"data": null`, `"error": "reason string"`.  
Always read `success` first, then read `data` or show `error`.

### Auth Errors
| Status | Meaning | What to do |
|---|---|---|
| 401 | No/invalid/expired token | Redirect to login |
| 403 | Wrong role | Show "Access denied" |
| 400 | Validation failed | Show `error` field to user |

---

## Match State Reference
```
0 = CREATED   → broadcaster configures, not yet open for bids
1 = OPEN      → brands can place/increase bids
2 = ACTIVE    → match is live, no new bids, events trigger auctions
3 = COMPLETED → match over, brands can claim refunds
4 = CANCELLED → match cancelled, full refunds available
```

---

## Role Reference
| Role value | Who |
|---|---|
| `brand_owner` | Brand user |
| `broadcaster_owner` | Broadcaster user |
| `admin` | Admin/platform |

---

---

# AUTH PAGES

---

## Page: Login

**Call on form submit:**

### `POST /api/auth/login/`
**Auth:** None

```json
Request:
{ "username": "ali_pepsi", "password": "securepass123" }

Response data:
{
  "username": "ali_pepsi",
  "email": "ali@pepsi.com",
  "logo": "http://localhost:8000/media/...",
  "brand_name": "Pepsi",
  "broadcaster_name": null,
  "org_type": "brand",
  "tokens": {
    "access": "eyJ...",
    "refresh": "eyJ..."
  }
}
```

After login:
1. Store `tokens.access` and `tokens.refresh`
2. Check `org_type`:
   - `"brand"` → redirect to Brand Dashboard
   - `"broadcaster"` → redirect to Broadcaster Dashboard
   - `null` + role from `/api/auth/me/` = admin → redirect to Admin Panel

---

## Page: Register as Brand

**Call on form submit:**

### `POST /api/auth/register/brand/`
**Auth:** None  
**Content-Type:** `multipart/form-data` (if sending logo file), else `application/json`

```json
Request:
{
  "brand_name": "Pepsi Pakistan",
  "username": "pepsi_user",
  "password": "SecurePass123!",
  "email": "admin@pepsi.com",
  "logo": "<file optional>"
}

Response data:
{
  "user": { "id": 1, "username": "pepsi_user", "email": "admin@pepsi.com", "role": "brand_owner" },
  "brand": { "id": 1, "name": "Pepsi Pakistan", "wallet_address": "0xABC..." },
  "tokens": { "access": "eyJ...", "refresh": "eyJ..." }
}
```

Store tokens, redirect to Brand Dashboard.

---

## Page: Register as Broadcaster

**Call on form submit:**

### `POST /api/auth/register/broadcaster/`
**Auth:** None  
**Content-Type:** `multipart/form-data`

```json
Request:
{
  "broadcaster_name": "PTV Sports",
  "username": "ptv_user",
  "password": "SecurePass123!",
  "email": "admin@ptvsports.com",
  "logo": "<file optional>"
}

Response data:
{
  "user": { "id": 2, "username": "ptv_user", "role": "broadcaster_owner" },
  "broadcaster": { "id": 1, "name": "PTV Sports", "wallet_address": "0xBBB..." },
  "tokens": { "access": "eyJ...", "refresh": "eyJ..." }
}
```

---

---

# BRAND DASHBOARD

---

## Page: Brand Home Dashboard

**Call on page mount:**

### `GET /api/brands/me/dashboard/`
**Auth:** Brand user

```json
Response data:
{
  "brand_name": "Pepsi Pakistan",
  "wallet_address": "0xABC...",
  "balance_pkr": 200000,
  "total_deposited": "500000.00",
  "total_spent": "300000.00",
  "total_refunded": "0.00",
  "active_bids_count": 2,
  "escrowed_total": "300000.00"
}
```

Show: balance card, active bids count, escrowed total.

---

## Page: Browse Matches

**Call on page mount (and when filter changes):**

### `GET /api/matches/`
**Auth:** Brand user

```json
Query params (all optional):
?state=1          → only OPEN matches (biddable)
?state=2          → only ACTIVE matches (live)

Response data: [
  {
    "id": 1,
    "on_chain_match_id": 1,
    "broadcaster": "PTV Sports",
    "team_a": "Lahore Qalandars",
    "team_b": "Karachi Kings",
    "venue": "Gaddafi Stadium",
    "match_date": "2026-04-20",
    "match_time": "19:00:00",
    "state": 1,
    "state_label": "Open",
    "event_configs": [
      {
        "id": 1,
        "event_type": 0,
        "event_type_label": "Over Break",
        "reserve_price": "100000.00",
        "reservation_fee_pct": "3.00",
        "slot_count": 3,
        "max_triggers": 40
      }
    ]
  }
]
```

Show "Place Bid" button only when `state === 1` (OPEN).

---

## Page: Match Detail & Bidding

**Call on page mount:**

### `GET /api/matches/{match_id}/`
**Auth:** Brand user

Returns same shape as the list item above, plus full event configs. Use to build event type tabs.

---

**Call on page mount (for leaderboard):**

### `GET /api/matches/{match_id}/bids/leaderboard/`
**Auth:** Brand user  

```json
Query params (optional):
?event_type=0     → only Over Break group

Response data: [
  {
    "event_type": 0,
    "event_type_label": "Over Break",
    "total_escrowed": 900000,
    "bids": [
      { "id": 3, "brand": "Pepsi",  "amount": "400000.00", "is_settled": false },
      { "id": 5, "brand": "Jazz",   "amount": "300000.00", "is_settled": false },
      { "id": 1, "brand": "KFC",    "amount": "200000.00", "is_settled": false }
    ]
  }
]
```

Highlight the current brand's row. Refresh this after placing or increasing a bid.  
Also connect WebSocket — re-fetch leaderboard on `bid_placed` / `bid_increased` events.

---

**Call on "Place Bid" form submit:**

### `POST /api/matches/{match_id}/bids/`
**Auth:** Brand user  
**Match must be state 1 (OPEN)**

```json
Request:
{
  "event_type": 0,
  "amount": "300000",
  "creative_id": 1
}

Response data (201):
{
  "id": 1,
  "brand": "Pepsi",
  "event_type": 0,
  "event_type_label": "Over Break",
  "amount": "300000.00",
  "creative": {
    "id": 1,
    "title": "Pepsi Summer 2026",
    "ad_url": "https://cdn.example.com/pepsi-summer-2026.mp4",
    "status": "approved"
  },
  "tx_hash": "0xabc...",
  "is_settled": false
}
```

> **Pre-requisite:** brand must have a creative with `status = "approved"` to pass as `creative_id`.  
> **One bid per brand per event type.** If bid exists → use Increase Bid instead.  
> **Amount must be ≥ reserve_price** for that event type.

---

**Call on "Increase Bid" form submit:**

### `PATCH /api/matches/{match_id}/bids/{bid_id}/increase/`
**Auth:** Brand user (must own the bid)

```json
Request:
{ "additional_amount": "100000" }

Response data: updated bid object (same shape as POST /bids/ response)
```

---

**Call on "Cancel Bid" button click:**

### `DELETE /api/matches/{match_id}/bids/{bid_id}/cancel/`
**Auth:** Brand user (must own the bid)  
**Match must be state 1 (OPEN)**

```json
Request: empty body

Response (200):
{ "success": true, "message": "Bid cancelled. Balance restored.", "data": null }
```

> Balance is restored immediately in the DB — `GET /api/balance/` will reflect the freed amount.  
> Show "Cancel Bid" button only when `match.state === 1` (OPEN) and bid is not yet settled or cancelled.  
> After cancel, re-fetch `/api/balance/` and leaderboard. WebSocket pushes `bid_cancelled` to all clients.  
> Brand can place a **new bid** on the same event type after cancelling.

---

**Call on "Set Budget Cap" form submit:**

### `POST /api/matches/{match_id}/budget-cap/`
**Auth:** Brand user

```json
Request:
{ "cap": "800000" }

Response data:
{ "cap": "800000" }
```

---

**Connect on page mount, disconnect on unmount:**

### WebSocket `ws://localhost:8000/ws/matches/{match_id}/`

```json
Messages received:
{ "event": "bid_placed",    "payload": { "brand": "KFC", "event_type": 0, "amount": 350000 } }
{ "event": "bid_increased", "payload": { "brand": "Pepsi", "event_type": 0, "amount": 400000 } }
{ "event": "auction_settled","payload": { "event_type": 0, "trigger_number": 1, "tx_hash": "0x..." } }
{ "event": "match_state_changed", "payload": { "state": 2 } }
```

On `auction_settled` → re-fetch `/api/matches/{match_id}/auction-results/` and show results.  
On `match_state_changed` → update state badge, disable "Place Bid" if state ≠ 1.

---

**Call after WebSocket `auction_settled` event:**

### `GET /api/matches/{match_id}/auction-results/`
**Auth:** Brand user

```json
Response data: [
  {
    "event_type": 0,
    "event_type_label": "Over Break",
    "trigger_number": 1,
    "slots_filled": 2,
    "slots": [
      {
        "slot_position": 1,
        "winner": "Pepsi",
        "amount": "400000.00",
        "creative_ref": "https://cdn.example.com/pepsi-ad.mp4",
        "tx_hash": "0xabc..."
      },
      {
        "slot_position": 2,
        "winner": "Jazz",
        "amount": "300000.00",
        "creative_ref": "https://cdn.example.com/jazz-ad.mp4",
        "tx_hash": "0xdef..."
      }
    ]
  }
]
```

---

## Page: Deposit Funds

**Call on page mount:**

### `GET /api/balance/`
**Auth:** Brand user

```json
Response data:
{ "balance_pkr": 200000 }
```

### `GET /api/deposits/`
**Auth:** Brand user

```json
Response data: [
  {
    "id": 1,
    "amount_pkr": "500000.00",
    "tx_hash": "0xabc123...",
    "status": "confirmed",
    "created_at": "2026-04-14T10:00:00Z"
  }
]
```

Sorted newest first. Show `tx_hash` as a link.

---

**Call on "Deposit" form submit:**

### `POST /api/deposits/`
**Auth:** Brand user

```json
Request:
{ "amount_pkr": "500000" }

Response (201):
{
  "id": 2,
  "amount_pkr": "500000.00",
  "tx_hash": "0xabc...",
  "status": "confirmed",
  "created_at": "..."
}
```

Re-fetch `/api/balance/` and `/api/deposits/` after success.

---

## Page: Creatives (Upload & Manage)

**Call on page mount:**

### `GET /api/creatives/`
**Auth:** Brand user

```json
Query params:
?status=pending|approved|rejected    → filter by status
?search=keyword                      → search title (case-insensitive)
?ordering=-created_at                → newest first (default)

Response data: [
  {
    "id": 1,
    "title": "Pepsi Summer 2026",
    "ad_url": "https://cdn.example.com/pepsi-summer-2026.mp4",
    "status": "approved",
    "rejection_reason": "",
    "created_at": "2026-04-14T09:00:00Z"
  }
]
```

---

**Call on "Upload Creative" form submit:**

### `POST /api/creatives/`
**Auth:** Brand user

```json
Request:
{
  "title": "Pepsi Summer 2026",
  "description": "30-second PSL season ad",
  "ad_url": "https://cdn.example.com/pepsi-summer-2026.mp4"
}

Response (201): creative object with status = "pending"
```

> Creative starts as `pending`. Admin must approve it in Django Admin before it can be used in bids.  
> Show a banner: "Your creative is pending admin approval before it can be used in bids."

---

**Call on creative card click:**

### `GET /api/creatives/{creative_id}/`
**Auth:** Brand user (must own the creative)

---

## Page: History & Refunds

**Call on page mount:**

### `GET /api/matches/`
**Auth:** Brand user

Filter to `?state=3` (COMPLETED) and `?state=4` (CANCELLED) separately, or fetch all and filter client-side by state.

---

**Call per completed/cancelled match to show refund status:**

### `GET /api/matches/{match_id}/refunds/`
**Auth:** Brand user

```json
Response data: [
  {
    "id": 1,
    "brand": "Pepsi",
    "amount": "300000",
    "tx_hash": "0xabc...",
    "created_at": "2026-04-14T22:00:00Z"
  }
]
```

If array is empty → "Claim Refund" button is available.  
If array has entry → refund already claimed, show amount.

---

**Call on "Claim Refund" button click:**

### `POST /api/matches/{match_id}/refunds/claim/`
**Auth:** Brand user  
**Match must be state 3 (COMPLETED) or 4 (CANCELLED)**

```json
Request: empty body {}

Response (201):
{
  "id": 1,
  "brand": "Pepsi",
  "amount": "300000",
  "tx_hash": "0xabc...",
  "created_at": "2026-04-14T22:00:00Z"
}
```

Re-fetch `/api/balance/` after success to update wallet balance display.

---

---

# BROADCASTER DASHBOARD

---

## Page: Broadcaster Home Dashboard

**Call on page mount:**

### `GET /api/broadcasters/me/dashboard/`
**Auth:** Broadcaster user

```json
Response data:
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

## Page: My Matches (Create + Configure + Lifecycle)

**Call on page mount:**

### `GET /api/matches/`
**Auth:** Broadcaster user

Returns all matches. Filter client-side by `broadcaster` name, or use `?state=` to show by status.

---

**Call on "Create Match" form submit:**

### `POST /api/matches/`
**Auth:** Broadcaster user

```json
Request:
{
  "team_a": "Lahore Qalandars",
  "team_b": "Islamabad United",
  "venue": "Gaddafi Stadium, Lahore",
  "match_date": "2026-04-20",
  "match_time": "19:00:00"
}

Response (201):
{
  "id": 1,
  "on_chain_match_id": 1,
  "broadcaster": "PTV Sports",
  "team_a": "Lahore Qalandars",
  "team_b": "Islamabad United",
  "venue": "Gaddafi Stadium, Lahore",
  "match_date": "2026-04-20",
  "match_time": "19:00:00",
  "state": 0,
  "state_label": "Created",
  "event_configs": []
}
```

---

**Call for each event type the broadcaster enables (match must be state 0 = CREATED):**

### `GET /api/matches/{match_id}/event-configs/`
**Auth:** Broadcaster user (must own the match)

```json
Response data: [
  {
    "id": 1,
    "event_type": 0,
    "event_type_label": "Over Break",
    "reserve_price": "100000.00",
    "reservation_fee_pct": "3.00",
    "slot_count": 3,
    "max_triggers": 40,
    "trigger_count": 0
  },
  {
    "id": 2,
    "event_type": 3,
    "event_type_label": "Wicket Fall",
    "reserve_price": "50000.00",
    "reservation_fee_pct": "5.00",
    "slot_count": 2,
    "max_triggers": 20,
    "trigger_count": 0
  }
]
```

Sorted by `event_type` ascending. Use this to populate the event config list/edit UI on My Matches page.

---

**Call on each event type "Add" form submit:**

### `POST /api/matches/{match_id}/event-configs/`
**Auth:** Broadcaster user (must own the match)

```json
Request:
{
  "event_type": 0,
  "reserve_price": "100000",
  "reservation_fee_pct": "3.00",
  "slot_count": 3,
  "max_triggers": 40
}

Response (201): event config object
```

**Event type values:**
| Value | Name | Suggested slot_count | Suggested max_triggers |
|---|---|---|---|
| 0 | OVER_BREAK | 3 | 40 |
| 1 | STRATEGIC_TIMEOUT | 5 | 4 |
| 2 | INNINGS_BREAK | 12 | 1 |
| 3 | WICKET_FALL | 2 | 20 |
| 4 | HIGH_VALUE_WICKET | 3 | 5 |
| 5 | LAST_OVER_THRILLER | 5 | 2 |
| 6 | HAT_TRICK_BALL | 3 | 2 |
| 7 | SUPER_OVER | 8 | 1 |

> Cannot configure events after match is OPEN (state ≥ 1). Show event config form only when `state === 0`.

---

**Call to view a single event config:**

### `GET /api/matches/{match_id}/event-configs/{event_type}/`
**Auth:** Broadcaster user (must own the match)

```json
Response data:
{
  "id": 1,
  "event_type": 0,
  "event_type_label": "Over Break",
  "reserve_price": "100000.00",
  "reservation_fee_pct": "3.00",
  "slot_count": 3,
  "max_triggers": 40,
  "trigger_count": 0
}
```

---

**Call on "Save Changes" in event config edit form (match must be state 0 = CREATED):**

### `PATCH /api/matches/{match_id}/event-configs/{event_type}/`
**Auth:** Broadcaster user (must own the match)  
**Match must be state 0 (CREATED)**

```json
Request (any subset — event_type cannot be changed):
{
  "reserve_price": "150000",
  "slot_count": 5
}

Response data: updated event config object (same shape as GET above)
```

> `event_type` in the URL is the identifier — cannot be changed via PATCH.  
> Returns 400 if match state is not CREATED.

---

**Call on "Delete" button on event config (match must be state 0 = CREATED):**

### `DELETE /api/matches/{match_id}/event-configs/{event_type}/`
**Auth:** Broadcaster user (must own the match)  
**Match must be state 0 (CREATED)**

```json
Request: empty body
Response (200): { "success": true, "message": "Event config deleted" }
```

---

**Call on "Open Bidding" button click (match must be state 0 = CREATED):**

### `POST /api/matches/{match_id}/open-bidding/`
**Auth:** Broadcaster user (must own the match)  
**Request:** empty body

Transitions match CREATED → OPEN. Locks all exclusion groups linked to this match.  
Show confirmation dialog: "This will open bidding and lock all exclusion groups. You cannot change them after this."

---

**Call per match to see live bid activity:**

### `GET /api/matches/{match_id}/bids/all/`
**Auth:** Broadcaster user

```json
Query params:
?event_type=0     → filter to one event type
?ordering=-amount → highest first (default)

Response data: flat list of all bids for the match
```

---

## Page: Exclusion Groups

**Call on page mount:**

### `GET /api/exclusion-groups/`
**Auth:** Broadcaster user

```json
Response data: [
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

When `is_locked: true` → disable all edit controls. Show "Locked — match is OPEN".

---

**Call to populate brand picker when creating a group:**

### `GET /api/brands/`
**Auth:** Broadcaster user

Returns list of all registered brands to pick from.

---

**Call on "Create Group" form submit:**

### `POST /api/exclusion-groups/`
**Auth:** Broadcaster user

```json
Request:
{
  "name": "Cola Brands",
  "separation_distance": 1,
  "cross_event_separation": false,
  "brand_ids": [1, 2]
}

Response (201): group object
```

`separation_distance: 1` = brands cannot hold adjacent slots.  
`cross_event_separation: true` = separation enforced across different event types in same settlement.

---

**Call on "Add Brand" button:**

### `POST /api/exclusion-groups/{group_id}/members/`
**Auth:** Broadcaster user  
**Only when `is_locked: false`**

```json
Request: { "brand_id": 3 }
```

---

**Call on "Remove Brand" button:**

### `DELETE /api/exclusion-groups/{group_id}/members/{brand_id}/`
**Auth:** Broadcaster user  
**Only when `is_locked: false`**

---

**Call on "Save" after editing group settings:**

### `PATCH /api/exclusion-groups/{group_id}/`
**Auth:** Broadcaster user  
**Only when `is_locked: false`**

```json
Request (any subset):
{
  "name": "Cola & Fast Food",
  "separation_distance": 2,
  "cross_event_separation": true
}
```

---

**Call on "Delete Group" button:**

### `DELETE /api/exclusion-groups/{group_id}/`
**Auth:** Broadcaster user  
**Only when `is_locked: false`**

---

## Page: Live Match Monitor

**Call on page mount:**

### `GET /api/matches/?state=2`
**Auth:** Broadcaster user

Fetch ACTIVE matches to populate match selector.

---

**Call when match is selected:**

### `GET /api/matches/{match_id}/auction-results/`
**Auth:** Broadcaster user

Fetch all auction results settled so far. This is the ad playlist history.

---

**Connect on match select, disconnect on match change:**

### WebSocket `ws://localhost:8000/ws/matches/{match_id}/`

```json
On "auction_settled" event → append new result to feed:
{
  "event": "auction_settled",
  "payload": {
    "event_type": 0,
    "trigger_number": 5,
    "tx_hash": "0xabc..."
  }
}
```

After receiving `auction_settled` → re-fetch `/api/matches/{match_id}/auction-results/` to get the new slot winners and show ad playlist.

---

## Page: Earnings

**Call on page mount:**

### `GET /api/broadcasters/me/dashboard/`
**Auth:** Broadcaster user

Use `total_earnings`, `total_auction_revenue` for summary cards.

---

### `GET /api/matches/`
**Auth:** Broadcaster user

Fetch all matches. Filter client-side to completed ones. Per completed match, fetch auction results to show per-match revenue breakdown.

---

---

# ADMIN PANEL

> Admin user: create via Django Admin or `python manage.py createsuperuser` then set `role = "admin"` in DB.

---

## Page: System Overview

**Call on page mount:**

### `GET /api/matches/`
**Auth:** Admin

Fetch all matches. Count by state client-side for metrics.

### `GET /api/brands/`
**Auth:** Admin

Count total registered brands.

### `GET /api/broadcasters/`
**Auth:** Admin

Count total registered broadcasters.

---

## Page: User Management

**Call on page mount:**

### `GET /api/brands/`
**Auth:** Admin

```json
Response data: [
  { "id": 1, "name": "Pepsi", "wallet_address": "0xABC...", "logo": "http://..." },
  { "id": 2, "name": "KFC",   "wallet_address": "0xDEF...", "logo": "http://..." }
]
```

### `GET /api/broadcasters/`
**Auth:** Admin

```json
Response data: [
  { "id": 1, "name": "PTV Sports", "wallet_address": "0xBBB...", "logo": "http://..." }
]
```

---

**Register new brand (admin creates on behalf):**

### `POST /api/auth/register/brand/`
**Auth:** None (or admin — no auth required)

Same payload as Brand Registration page.

---

**Register new broadcaster:**

### `POST /api/auth/register/broadcaster/`
**Auth:** None

Same payload as Broadcaster Registration page.

---

## Page: Match Simulator ← DEMO CENTERPIECE

**Call on page mount:**

### `GET /api/matches/?state=1`
**Auth:** Admin

Fetch OPEN matches (ready to start).

### `GET /api/matches/?state=2`
**Auth:** Admin

Fetch ACTIVE matches (running, can trigger events).

---

**Call on match select — get trigger counts and current state:**

### `GET /api/simulator/{match_id}/status/`
**Auth:** Admin

```json
Response data:
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

Use `trigger_counts` to show "5 / 40" on each event button. Disable button when `triggered >= max`.

---

**Call on "Start Match" button (match must be OPEN = state 1):**

### `POST /api/simulator/{match_id}/start/`
**Auth:** Admin  
**Request:** empty body

Transitions OPEN → ACTIVE. WebSocket pushes `match_state_changed { state: 2 }` to all clients.

---

**Call on event trigger button click (match must be ACTIVE = state 2):**

### `POST /api/simulator/{match_id}/trigger-event/`
**Auth:** Admin

```json
Request:
{ "event_type": 0 }

Response data:
{
  "tx_hash": "0xabc...",
  "event_type": 0,
  "event_type_label": "Over Break",
  "trigger_number": 6
}
```

After success:
1. Re-fetch `/api/simulator/{match_id}/status/` to update trigger counts
2. Re-fetch `/api/matches/{match_id}/auction-results/` to show new slot winners
3. WebSocket pushes `auction_settled` to all connected clients automatically

---

**Call on "Complete Match" button (match must be ACTIVE = state 2):**

### `POST /api/simulator/{match_id}/complete/`
**Auth:** Admin  
**Request:** empty body

Transitions ACTIVE → COMPLETED. Brands can now claim refunds.

---

**Call on "Cancel Match" button:**

### `POST /api/simulator/{match_id}/cancel/`
**Auth:** Admin  
**Request:** empty body

Cancels match at any non-terminal state. Brands get full refunds.

---

**Connect on match select:**

### WebSocket `ws://localhost:8000/ws/matches/{match_id}/`

```json
Events received:
{ "event": "auction_settled",      "payload": { "event_type": 0, "trigger_number": 6, "tx_hash": "0x..." } }
{ "event": "match_state_changed",  "payload": { "state": 3 } }
{ "event": "refund_processed",     "payload": { "brand": "KFC", "amount": 300000 } }
```
upar jo events die we inmein se koi ek event aayega
---

---

# CURRENT USER

**Call after login and on every page load to get profile info:**

### `GET /api/auth/me/`
**Auth:** Any authenticated user

```json
Response data:
{
  "id": 1,
  "username": "pepsi_user",
  "email": "admin@pepsi.com",
  "role": "brand_owner"
}
```

Use `role` to determine which dashboard to render:
- `brand_owner` → Brand Dashboard
- `broadcaster_owner` → Broadcaster Dashboard  
- `admin` → Admin Panel

---

### `PATCH /api/auth/me/update/`
**Auth:** Any authenticated user  
**Content-Type:** `multipart/form-data`

```json
Request (any subset):
{
  "username": "new_username",
  "email": "new@email.com",
  "profile_image": "<file>"
}
```

---

### `PATCH /api/brands/me/`
**Auth:** Brand user  
**Content-Type:** `multipart/form-data`

```json
Request (any subset):
{ "name": "Pepsi Pakistan HD", "logo": "<file>" }
```

### `PATCH /api/broadcasters/me/`
**Auth:** Broadcaster user  
**Content-Type:** `multipart/form-data`

```json
Request (any subset):
{ "name": "PTV Sports HD", "logo": "<file>" }
```

---

---

# WEBSOCKET REFERENCE

```
ws://localhost:8000/ws/matches/{match_id}/
```

No auth header on WebSocket connection. Connect per active match page.

| Event name | Sent when | Who needs it | What to do |
|---|---|---|---|
| `bid_placed` | Brand places new bid | Brand (leaderboard), Broadcaster (bid count) | Re-fetch leaderboard |
| `bid_increased` | Brand increases bid | Brand (leaderboard) | Re-fetch leaderboard |
| `bid_cancelled` | Brand cancels bid | Brand (leaderboard + balance), Broadcaster | Re-fetch leaderboard, update balance |
| `auction_settled` | Admin triggers event | Everyone | Re-fetch auction-results, update revenue |
| `match_state_changed` | Match state transitions | Everyone | Update state badge, enable/disable controls |
| `refund_processed` | Brand claims refund | Brand | Update balance display |

**Reconnect on disconnect** — use exponential backoff or `reconnecting-websocket` library.

---

---

# DEMO FLOW (end-to-end sequence for presentation)

```
── SETUP ──────────────────────────────────────────────────────────────────────

1.  POST /api/auth/register/broadcaster/      → PTV Sports
2.  POST /api/auth/register/brand/            → Pepsi
3.  POST /api/auth/register/brand/            → KFC
4.  POST /api/auth/register/brand/            → Jazz
5.  POST /api/deposits/                       → Pepsi deposits 500,000 PKR
6.  POST /api/deposits/                       → KFC deposits 500,000 PKR
7.  POST /api/deposits/                       → Jazz deposits 300,000 PKR

── CREATIVE UPLOAD ────────────────────────────────────────────────────────────

8.  POST /api/creatives/                      → Pepsi uploads ad URL
9.  POST /api/creatives/                      → KFC uploads ad URL
10. POST /api/creatives/                      → Jazz uploads ad URL
    [Admin: Django Admin → Bidding → Creatives → select all → "Approve"]

── MATCH SETUP ────────────────────────────────────────────────────────────────

11. POST /api/matches/                        → broadcaster creates match
12. POST /api/matches/1/event-configs/        → configure OVER_BREAK   (event_type=0, reserve=100000, slots=3, triggers=40)
13. POST /api/matches/1/event-configs/        → configure WICKET_FALL  (event_type=3, reserve=50000,  slots=2, triggers=20)
14. POST /api/exclusion-groups/              → "Cola Brands" group { brand_ids: [Pepsi.id, KFC.id], separation_distance: 1 }
15. POST /api/matches/1/open-bidding/        → open bidding (state → OPEN, groups locked)

── BIDDING ────────────────────────────────────────────────────────────────────

16. POST /api/matches/1/bids/                → Pepsi: OVER_BREAK, 300,000, creative_id=1
17. POST /api/matches/1/bids/                → KFC:   OVER_BREAK, 350,000, creative_id=2
18. PATCH /api/matches/1/bids/1/increase/   → Pepsi increases by 100,000 (now 400,000)
19. POST /api/matches/1/bids/                → Jazz:  OVER_BREAK, 200,000, creative_id=3
    GET  /api/matches/1/bids/leaderboard/    → show: Pepsi 400K, KFC 350K, Jazz 200K

── LIVE MATCH ─────────────────────────────────────────────────────────────────

20. POST /api/simulator/1/start/             → match goes ACTIVE
21. POST /api/simulator/1/trigger-event/     → { event_type: 0 } OVER_BREAK trigger #1
    Result: Slot 1 = Pepsi (400K), Slot 2 = Jazz (200K), KFC excluded by group
    WebSocket pushes auction_settled to all connected clients
22. GET  /api/matches/1/auction-results/     → verify ad playlist
23. POST /api/simulator/1/trigger-event/     → { event_type: 3 } WICKET_FALL trigger #1

── SETTLEMENT ─────────────────────────────────────────────────────────────────

24. POST /api/simulator/1/complete/          → match COMPLETED
25. POST /api/matches/1/refunds/claim/       → KFC claims refund (excluded from all slots → full refund)
26. GET  /api/balance/                       → KFC balance restored
27. GET  /api/broadcasters/me/dashboard/     → PTV Sports sees revenue
```

---

# QUICK ROLE-ACCESS MATRIX

| Endpoint | Brand | Broadcaster | Admin | Public |
|---|---|---|---|---|
| `POST /auth/register/*` | — | — | — | ✅ |
| `POST /auth/login/` | — | — | — | ✅ |
| `GET /auth/me/` | ✅ | ✅ | ✅ | — |
| `GET /brands/` | ✅ | ✅ | ✅ | — |
| `GET /broadcasters/` | ✅ | ✅ | ✅ | — |
| `GET /matches/` | ✅ | ✅ | ✅ | — |
| `GET /matches/{id}/` | ✅ | ✅ | ✅ | — |
| `POST /matches/` | — | ✅ | — | — |
| `GET /matches/{id}/event-configs/` | — | ✅ | — | — |
| `POST /matches/{id}/event-configs/` | — | ✅ | — | — |
| `GET/PATCH/DELETE /matches/{id}/event-configs/{event_type}/` | — | ✅ | — | — |
| `POST /matches/{id}/open-bidding/` | — | ✅ | — | — |
| `POST /exclusion-groups/` | — | ✅ | — | — |
| `GET /exclusion-groups/` | — | ✅ | — | — |
| `POST /deposits/` | ✅ | — | — | — |
| `GET /deposits/` | ✅ | — | — | — |
| `GET /balance/` | ✅ | — | — | — |
| `GET /brands/me/dashboard/` | ✅ | — | — | — |
| `GET /broadcasters/me/dashboard/` | — | ✅ | — | — |
| `POST /creatives/` | ✅ | — | — | — |
| `GET /creatives/` | ✅ | — | — | — |
| `POST /matches/{id}/bids/` | ✅ | — | — | — |
| `GET /matches/{id}/bids/leaderboard/` | ✅ | ✅ | ✅ | — |
| `PATCH /matches/{id}/bids/{id}/increase/` | ✅ | — | — | — |
| `POST /matches/{id}/budget-cap/` | ✅ | — | — | — |
| `GET /matches/{id}/auction-results/` | ✅ | ✅ | ✅ | — |
| `POST /matches/{id}/refunds/claim/` | ✅ | — | — | — |
| `GET /matches/{id}/refunds/` | ✅ | ✅ | ✅ | — |
| `POST /simulator/{id}/start/` | — | — | ✅ | — |
| `POST /simulator/{id}/complete/` | — | — | ✅ | — |
| `POST /simulator/{id}/cancel/` | — | — | ✅ | — |
| `POST /simulator/{id}/trigger-event/` | — | — | ✅ | — |
| `GET /simulator/{id}/status/` | — | — | ✅ | — |
