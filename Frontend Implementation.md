# Frontend — Complete Page & Component Plan

## Context
MomentBid frontend is a **pure React app** that communicates entirely with Django REST API + WebSocket. No MetaMask or crypto anywhere in the frontend — the backend manages all wallets and blockchain transactions. This keeps the frontend simple and accessible.

**Three role-based views**: Brand Dashboard, Broadcaster Dashboard, Admin Panel (includes Match Simulator). Each has its own set of pages. A shared auth layer routes users to the correct view based on their role.

**Real-time updates**: WebSocket connection per active match pushes bid updates, auction settlements, state changes, and refund events to all connected clients.

---

## View Summary

| View | Who Uses It | Pages | Purpose |
|---|---|---|---|
| **Auth** | Everyone | 3 | Register, login, route to correct dashboard |
| **Brand Dashboard** | Pepsi, KFC, Jazz, etc. | 5 | Browse matches, place bids, watch live results, claim refunds |
| **Broadcaster Dashboard** | PTV Sports, Daraz, etc. | 5 | Create matches, configure events, manage exclusions, monitor live, view earnings |
| **Admin Panel** | Platform team | 5 | Manage users, configure protocol, simulate matches, monitor transactions |
| **Total** | | **18 pages** | |

---

## Shared / Global

### Layout & Navigation

**Top Navigation Bar** (present on all pages after login)
- MomentBid logo (links to dashboard home)
- Current user name + role badge (Brand / Broadcaster / Admin)
- Wallet balance display (PKR format) — only for Brand users
- Notification bell (unread count for auction results, refunds)
- Logout button

**Sidebar Navigation** (role-specific)
- Collapses on mobile
- Active page highlighted
- Links to all pages within the user's view

**Toast Notifications**
- Real-time popup for: bid placed, auction settled, match state changed, refund processed
- Driven by WebSocket events
- Auto-dismiss after 5 seconds, clickable to navigate to relevant page

**Loading & Error States**
- Skeleton loaders while API data fetches
- Error banners with human-readable messages (never raw blockchain errors)
- Network connectivity indicator

---

## AUTH VIEW (3 pages)

### Page 1: Login
**Purpose**: Authenticate existing users and route them to their role-specific dashboard.

**Functionality**:
- Username + password form
- Submit calls `/api/auth/login/` → returns JWT tokens
- On success: store tokens, fetch `/api/auth/me/` to get user role
- Route to Brand Dashboard, Broadcaster Dashboard, or Admin Panel based on role
- "Don't have an account?" link to registration

**Components**:
- Login form (username, password fields)
- Error message display (invalid credentials)
- Loading spinner on submit
- Link to Register page

---

### Page 2: Register as Brand
**Purpose**: Create a new brand organization account. Backend auto-generates a blockchain wallet.

**Functionality**:
- Brand name (unique), logo URL (optional), username, password, confirm password
- Submit calls `/api/auth/register/brand/` → creates Brand org + wallet + User
- Returns JWT tokens + brand info including wallet address
- Auto-redirects to Brand Dashboard

**Components**:
- Registration form (brand name, logo URL, username, password, confirm password)
- Validation messages (brand name taken, password mismatch)
- Success confirmation with assigned wallet address
- Link to "Register as Broadcaster" and Login

---

### Page 3: Register as Broadcaster
**Purpose**: Create a new broadcaster organization account.

**Functionality**:
- Broadcaster name (unique), logo URL (optional), username, password, confirm password
- Submit calls `/api/auth/register/broadcaster/`
- Returns JWT + broadcaster info
- Auto-redirects to Broadcaster Dashboard

**Components**:
- Registration form (broadcaster name, logo URL, username, password, confirm password)
- Validation messages
- Success confirmation with assigned wallet address
- Link to "Register as Brand" and Login

---

## BRAND DASHBOARD VIEW (5 pages)

### Brand Sidebar Navigation
- Dashboard (home)
- Browse Matches
- My Bids
- Deposit Funds
- History & Refunds

---

### Page 1: Brand Home Dashboard
**Purpose**: At-a-glance overview of the brand's financial position and bidding activity.

**Functionality**:
- Fetch `/api/brands/me/dashboard/` for aggregated stats
- Show key metrics and quick-action cards
- List of active bids across all matches

**Components**:
- **Balance Card**: Current balance in PKR, total deposited, total spent, total refunded
- **Active Bids Summary Card**: Count of active bids, total escrowed amount across all matches
- **Quick Action: Deposit Funds** button → navigates to Deposit page
- **Quick Action: Browse Matches** button → navigates to Match Browser
- **Active Matches Table**: List of matches where brand has active bids, showing match name, state, number of bids placed, total escrowed for that match. Each row clickable → navigates to Match Detail
- **Recent Activity Feed**: Last 10 transactions (bids placed, auctions won/lost, refunds received) with timestamps

---

### Page 2: Browse Matches
**Purpose**: Discover available matches and access bidding interface.

**Functionality**:
- Fetch `/api/matches/` with filters
- Display all matches in card or table layout
- Filter by state (show OPEN matches prominently — these are biddable)
- Click any match → navigates to Match Detail page

**Components**:
- **Filter Bar**: Filter by status (All / Open / Active / Completed), search by team name, sort by date
- **Match Cards Grid** (or table view toggle): Each card shows:
  - Team A vs Team B
  - Match date and venue
  - State badge (color-coded: CREATED=grey, OPEN=green, ACTIVE=yellow, COMPLETED=blue, CANCELLED=red)
  - Number of enabled event types
  - Number of existing bids
  - "Place Bid" button (only visible for OPEN matches)
- **Empty State**: "No matches available" message when no matches exist

---

### Page 3: Match Detail & Bidding
**Purpose**: View match details, see bid leaderboard, place and increase bids. This is the most important brand page.

**Functionality**:
- Fetch `/api/matches/{id}/` for match details + event configs
- Fetch `/api/matches/{id}/bids/` for all bids (open leaderboard)
- WebSocket connection to `ws/matches/{id}/` for real-time updates
- Place bid: POST `/api/matches/{id}/bids/`
- Increase bid: PATCH `/api/matches/{id}/bids/{id}/increase/`
- Set budget cap: POST `/api/matches/{id}/budget-cap/`

**Components**:
- **Match Header**: Team A vs Team B, date, venue, state badge, broadcaster name
- **Budget Cap Section**: Input field to set/update total budget cap for this match. Shows current cap and remaining budget
- **Event Type Tabs or Accordion**: One section per enabled event type (OVER_BREAK, WICKET_FALL, etc.). Each section contains:
  - **Event Info Bar**: Event type name, reserve price, slot count, max triggers, reservation fee %
  - **Bid Leaderboard Table**: Ranked list of all brands' bids for this event type. Columns: Rank, Brand Name, Bid Amount (PKR), Status. Current user's bid highlighted. Shows all competitors' amounts (open bidding)
  - **Place Bid Form** (only when match is OPEN): Amount input (minimum = reserve price), creative reference URL input, "Place Bid" button. If bid already exists: shows current bid amount + "Increase Bid" form with additional amount input
  - **My Bid Status Indicator**: Not yet bid / Bid placed (amount) / Won (slot position) / Lost / Event not triggered
- **Escrow Summary Panel** (sticky sidebar or bottom bar): Total escrowed for this match, total spent, remaining escrow, budget cap usage progress bar
- **Live Auction Results** (visible when match is ACTIVE): Real-time feed of auction settlements as events trigger. Each result shows: event type, trigger number, slot winners with positions and amounts. Partial fill and no-eligible-bidder alerts

---

### Page 4: Deposit Funds
**Purpose**: Add PKR balance to brand account (backend mints MBT tokens).

**Functionality**:
- Show current balance from `/api/balance/`
- Show deposit history from `/api/deposits/`
- Submit deposit: POST `/api/deposits/` with amount

**Components**:
- **Current Balance Card**: Balance in PKR (large, prominent), total deposited lifetime, total spent lifetime
- **Deposit Form**: Amount input field (PKR), "Deposit" button, confirmation dialog ("Deposit 500,000 PKR?")
- **Deposit History Table**: Date, amount, transaction hash (linkable to wirefluidscan.com), status (pending/confirmed/failed). Sorted newest first
- **Transaction Status Indicator**: Pending deposits show spinner until confirmed

---

### Page 5: History & Refunds
**Purpose**: View past match results, spending breakdown, and claim refunds.

**Functionality**:
- Fetch completed/cancelled matches where brand had bids
- Show per-match spending breakdown
- Claim refund: POST `/api/matches/{id}/refunds/claim/`
- Fetch refund history

**Components**:
- **Completed Matches List**: Each match card shows:
  - Team A vs Team B, date, final state (Completed/Cancelled)
  - Total bid amount, total won (spent), total refunded, reservation fees deducted
  - Expandable detail: per-event-type breakdown showing event name, bid amount, triggered (yes/no), result (won slot X / lost / not triggered), refund amount
  - **"Claim Refund" button**: Only visible if match is COMPLETED/CANCELLED and refund not yet claimed. Shows estimated refund amount before clicking
- **Refund History Table**: Date, match name, refund amount, reservation fee deducted, transaction hash, status
- **Lifetime Summary Card**: Total matches participated, total spent, total refunded, net cost, win rate (auctions won / total bids)

---

## BROADCASTER DASHBOARD VIEW (5 pages)

### Broadcaster Sidebar Navigation
- Dashboard (home)
- My Matches
- Exclusion Groups
- Live Monitor
- Earnings

---

### Page 1: Broadcaster Home Dashboard
**Purpose**: Overview of broadcaster's matches, revenue, and activity.

**Functionality**:
- Fetch `/api/broadcasters/me/dashboard/` for aggregated stats
- Show revenue metrics and match summary

**Components**:
- **Revenue Card**: Total earnings (PKR), total from auctions (95% share), total from reservation fees
- **Matches Summary Card**: Total matches, active matches, completed matches
- **Quick Action: Create Match** button → navigates to My Matches
- **Upcoming Matches Table**: Next 5 matches with state, date, teams, bid count. Each row clickable
- **Recent Settlements Feed**: Last 10 auction settlement events with amounts

---

### Page 2: My Matches (List + Create + Configure)
**Purpose**: Create new matches, configure event types, manage match lifecycle.

**Functionality**:
- List all broadcaster's matches from `/api/matches/` (filtered by broadcaster)
- Create match form
- Click match → match configuration panel
- State transition buttons

**Components**:
- **Create Match Form** (collapsible or modal):
  - Team A name, Team B name, venue, match date/time picker
  - "Create Match" button → POST `/api/matches/`
- **Matches Table**: Columns: Match ID, Teams, Date, State, Bid Count, Revenue. Sort by date. State badges color-coded. Each row expandable or clickable
- **Match Configuration Panel** (shown when match selected, only editable in CREATED state):
  - **Event Type Configuration**: Checklist of 8 event types to enable/disable. For each enabled type:
    - Reserve price input (PKR)
    - Reservation fee % input (1-5%)
    - Slot count input (with sensible defaults: OVER_BREAK=3, STRATEGIC_TIMEOUT=5, INNINGS_BREAK=12, WICKET_FALL=2, etc.)
    - Max triggers input (OVER_BREAK=40, STRATEGIC_TIMEOUT=4, INNINGS_BREAK=1, etc.)
  - "Save Event Config" button per event type → POST `/api/matches/{id}/event-configs/`
- **Match Lifecycle Controls** (button bar):
  - "Open Bidding" button: Visible in CREATED state → POST `/api/matches/{id}/open-bidding/`. Confirmation dialog: "This will lock all parameters and exclusion groups. Proceed?"
  - State indicator showing current state and available transitions
  - Note: OPEN→ACTIVE, ACTIVE→COMPLETED, CANCELLED transitions are admin-only (via simulator)
- **Bid Overview Panel** (visible when match is OPEN or later): Summary of bids received per event type. Total escrowed amount. Number of unique brands bidding

---

### Page 3: Exclusion Groups
**Purpose**: Manage competitor separation rules for auctions.

**Functionality**:
- CRUD for exclusion groups via `/api/exclusion-groups/`
- Add/remove brands from groups
- Visual lock status

**Components**:
- **Create Group Form** (collapsible or modal):
  - Group name input
  - Brand selector (multi-select dropdown, fetches brand list from `/api/brands/`)
  - Separation distance input (number, default 1)
  - Cross-event separation toggle (checkbox with explanation: "If enabled, separation applies across different event types, not just within the same event")
  - "Create Group" button
- **Groups List**: Each group card shows:
  - Group name
  - Member brands (listed with names)
  - Separation distance value
  - Cross-event flag (Yes/No)
  - Lock status badge (Unlocked = editable / Locked = read-only)
  - Lock reason: "Locked by Match: Lahore vs Islamabad (OPEN)"
- **Group Detail / Edit Panel** (only when unlocked):
  - Add brand dropdown + "Add" button
  - Remove brand "X" button next to each member
  - Edit separation distance
  - Toggle cross-event flag
  - "Save Changes" button
- **Locked Group View**: Same info but all inputs disabled. Yellow banner: "This group is locked because a match using it is in OPEN state. Contact admin for emergency changes."

---

### Page 4: Live Match Monitor
**Purpose**: Real-time view of active match auction results — the "broadcast control room" view.

**Functionality**:
- WebSocket connection to `ws/matches/{id}/` for live updates
- Displays the ad playlist that the control room needs to execute
- Shows running revenue totals

**Components**:
- **Match Selector**: Dropdown of currently ACTIVE matches (usually just 1 during demo)
- **Match Status Bar**: Team A vs Team B, current state
- **Live Event Feed** (main content, chronological): Each triggered event displayed as a card:
  - Event type name + trigger number (e.g., "OVER_BREAK - Trigger #5")
  - Timestamp
  - **Ad Playlist** (the critical output for broadcast control room):
    - Slot 1: Brand name, bid amount, creative reference link — labeled "Premium / Play First"
    - Slot 2: Brand name, bid amount, creative reference link
    - Slot 3: Brand name, bid amount, creative reference link
    - Or: "HOUSE AD" for unfilled slots
  - Partial fill alert: "2 of 3 slots filled — fill remaining with house ads"
  - No eligible bidder alert: "No eligible bidder for Slot 3"
  - Total settlement amount for this trigger
- **Revenue Running Total Panel** (sidebar): Total revenue this match, broken down by auction settlements vs reservation fees. Per-event-type revenue bars
- **Trigger Counts Display**: For each event type: triggered X of Y max (e.g., "OVER_BREAK: 5/40 triggered")

---

### Page 5: Earnings Dashboard
**Purpose**: Revenue analytics and financial reporting.

**Functionality**:
- Fetch `/api/broadcasters/me/dashboard/` and per-match breakdowns
- Aggregate revenue data

**Components**:
- **Total Revenue Card**: Lifetime earnings in PKR, breakdown: auction revenue (95% share) + reservation fees
- **Revenue by Match Table**: Each match with total revenue, number of events triggered, number of auctions settled, average settlement amount. Expandable to show per-event breakdown
- **Revenue by Event Type Chart**: Bar chart showing which event types generate the most revenue (OVER_BREAK typically highest due to frequency, SUPER_OVER highest per-trigger)
- **Revenue Split Visualization**: Pie or bar chart showing 95% broadcaster / 5% platform split
- **Settlement History Table**: All settlements with date, match, event type, slot position, winning brand, amount, broadcaster share, platform fee. Filterable and sortable
- **Reservation Fee Collection Table**: Match, event type, brand, bid amount, fee %, fee amount (for events that never triggered)

---

## ADMIN PANEL VIEW (5 pages)

### Admin Sidebar Navigation
- System Overview
- User Management
- Protocol Config
- Match Simulator
- Transaction Monitor

---

### Page 1: System Overview
**Purpose**: Platform-wide metrics and health dashboard.

**Functionality**:
- Fetch aggregated platform stats from admin-specific endpoints

**Components**:
- **Key Metrics Row**: Total matches (with breakdown: created/open/active/completed/cancelled), total brands registered, total broadcasters registered, total transaction volume (PKR)
- **Platform Revenue Card**: Total platform fees earned (5% of all settlements)
- **Active Matches Card**: List of currently OPEN or ACTIVE matches with quick-access links
- **Recent Activity Timeline**: Last 20 events across all matches (match created, bid placed, auction settled, refund processed). Each entry shows timestamp, match, actor, action

---

### Page 2: User Management
**Purpose**: Register brands/broadcasters, view all users.

**Functionality**:
- List all users/orgs
- Register new brand or broadcaster (admin creates account)
- View wallet addresses and role assignments

**Components**:
- **Register Brand Form**: Brand name, username, password. "Register Brand" button → admin creates account, wallet auto-generated
- **Register Broadcaster Form**: Broadcaster name, username, password. "Register Broadcaster" button
- **Brands Table**: Name, wallet address (truncated, copyable), total deposited, total spent, registration date
- **Broadcasters Table**: Name, wallet address, match count, total earnings, registration date
- **Role Verification Section**: Shows which addresses have BROADCASTER_ROLE, BRAND_ROLE, ORACLE_ROLE on smart contracts (granted automatically by backend, shown here for verification)

---

### Page 3: Protocol Configuration
**Purpose**: Platform-level settings and emergency controls.

**Functionality**:
- View/update platform fee
- Emergency pause/unpause
- View contract addresses

**Components**:
- **Platform Fee Setting**: Current fee % display, input to change (1-10%), "Update Fee" button with confirmation
- **Emergency Controls Panel**:
  - Pause/Unpause toggle: Red "PAUSE ALL OPERATIONS" button (confirmation dialog required). Current status: Active / Paused
  - When paused: yellow warning banner across entire admin panel
- **Contract Addresses Display**: Read-only table: MomentBidToken, MomentBidCore, ExclusionManager, OracleController addresses. Each linkable to wirefluidscan.com. Copy button
- **Exclusion Group Override Section**: Select group → override form. Yellow warning: "Emergency use only"

---

### Page 4: Match Simulator
**Purpose**: Simulate a live cricket match by triggering events. The demo centerpiece — operated by a team member during presentation.

**Functionality**:
- Select an ACTIVE match
- Simulate cricket progression (cosmetic scoreboard)
- Trigger events which resolve auctions via backend API
- Control match lifecycle (start, complete, cancel)

**Components**:
- **Match Selector & Lifecycle Controls**:
  - Dropdown to select match
  - "Start Match" button (OPEN → ACTIVE) — POST `/api/simulator/{id}/start/`
  - "Complete Match" button (ACTIVE → COMPLETED) — POST `/api/simulator/{id}/complete/`
  - "Cancel Match" button (→ CANCELLED) — POST `/api/simulator/{id}/cancel/`
  - Current state badge prominently displayed

- **Match Scoreboard** (cosmetic cricket scoreboard for demo feel):
  - Team A score / wickets (e.g., "Lahore Qalandars: 156/4")
  - Overs completed (e.g., "18.3 overs")
  - Team B score / wickets (if second innings)
  - Current batsmen + individual scores
  - Current bowler + wickets
  - Required run rate (if second innings)
  - "Next Ball" button: Random outcome (dot, 1, 2, 3, 4, 6, wicket), updates scoreboard locally. Purely cosmetic — makes demo feel realistic

- **Event Trigger Panel** (main control — grid of 8 buttons): Each button shows:
  - Event type name (OVER_BREAK, WICKET_FALL, etc.)
  - Trigger count: "5 / 40"
  - Enabled (green) / Disabled (grey — max reached or not configured)
  - Click → confirmation → POST `/api/simulator/{id}/trigger-event/`
  - After trigger: loading state, then result appears below
  - Auto-highlight: After "Next Ball" results in wicket, WICKET_FALL button pulses to suggest triggering

- **Live Auction Results Feed**: Chronological list of all triggered events and results:
  - Event type + trigger number
  - Timestamp
  - Ad playlist: Slot winners with amounts
  - Partial fill / no eligible alerts
  - Settlement total

- **Match Stats Sidebar**: Total events triggered, total revenue, per-event-type trigger counts

---

### Page 5: Transaction Monitor
**Purpose**: Live feed of all on-chain activity across the platform.

**Functionality**:
- Fetch transaction logs with filtering
- Real-time updates via WebSocket

**Components**:
- **Filter Bar**: Filter by match, brand, broadcaster, action type (bid/settlement/refund/mint), date range
- **Transaction Feed Table**: Timestamp, Match, Action (human-readable), Actor, Amount (PKR), TX Hash (linkable to wirefluidscan.com), Status. Newest first. Auto-updates via WebSocket
- **Transaction Detail Modal**: Full details on click
- **Summary Stats Bar**: Total transactions today, total volume, total gas consumed

---

## PAGE COUNT SUMMARY

| View | Page | Purpose |
|---|---|---|
| **Auth** | Login | Authenticate and route |
| | Register Brand | Create brand org + wallet |
| | Register Broadcaster | Create broadcaster org + wallet |
| **Brand (5)** | Home Dashboard | Balance overview + active bids |
| | Browse Matches | Discover and filter matches |
| | Match Detail & Bidding | Leaderboard + place/increase bids + live results |
| | Deposit Funds | Add PKR balance |
| | History & Refunds | Past results + claim refunds |
| **Broadcaster (5)** | Home Dashboard | Revenue overview + match summary |
| | My Matches | Create, configure, manage match lifecycle |
| | Exclusion Groups | Manage competitor separation rules |
| | Live Monitor | Real-time ad playlist for control room |
| | Earnings | Revenue analytics + reporting |
| **Admin (5)** | System Overview | Platform metrics + health |
| | User Management | Register brands/broadcasters + view roles |
| | Protocol Config | Fee settings + emergency pause |
| | Match Simulator | Cricket simulation + event triggering |
| | Transaction Monitor | Live feed of all on-chain activity |
| **Total** | **18 pages** | |

---

## REAL-TIME (WebSocket) REQUIREMENTS

Each match has a WebSocket channel: `ws/matches/{id}/`

| Event Pushed | Who Cares | What Updates |
|---|---|---|
| `bid_placed` | Brand (leaderboard), Broadcaster (bid count) | Leaderboard re-ranks |
| `bid_increased` | Brand (leaderboard), Broadcaster | Bid amount updates |
| `auction_settled` | Everyone | Ad playlist appears, escrow/balance/revenue updates |
| `match_state_changed` | Everyone | State badge updates, controls enable/disable |
| `refund_processed` | Brand | Balance updates, refund history |
| `partial_fill` | Broadcaster | Alert in live monitor |

**Pages with active WebSocket**:
- Brand → Match Detail (leaderboard + live results)
- Broadcaster → Live Monitor (ad playlist feed)
- Admin → Match Simulator (auction results after trigger)
- Admin → Transaction Monitor (live transaction feed)

---

## DEMO WALKTHROUGH (How Pages Are Used)

**Setup (1 min)**:
1. Admin → User Management: 3 brands + 1 broadcaster registered
2. Broadcaster → My Matches: Create match, configure events
3. Broadcaster → Exclusion Groups: Create Pepsi+KFC group
4. Broadcaster → My Matches: "Open Bidding"

**Bidding (1.5 min)**:
5. Brand (Pepsi) → Browse Matches → Match Detail: Bid on OVER_BREAK (300K) + WICKET_FALL (250K)
6. Brand (KFC) → Match Detail: Bid on OVER_BREAK (350K) — Pepsi sees leaderboard update
7. Brand (Pepsi) → Match Detail: Increase OVER_BREAK to 400K
8. Brand (Jazz) → Match Detail: Bid OVER_BREAK (200K)

**Live Match (3 min)**:
9. Admin → Simulator: "Start Match", click "Next Ball" a few times
10. Admin → Simulator: Trigger OVER_BREAK → Slot 1: Pepsi (400K), Slot 2: Jazz (200K), Slot 3: House Ad. KFC excluded by group
11. Broadcaster → Live Monitor: Ad playlist displayed in real-time
12. Admin → Simulator: Trigger WICKET_FALL → another settlement
13. Admin → Simulator: Trigger LAST_OVER_THRILLER → high-value multi-slot

**Settlement (1 min)**:
14. Admin → Simulator: "Complete Match"
15. Brand (KFC) → History & Refunds: "Claim Refund" → 100% back
16. Broadcaster → Earnings: Revenue breakdown

---

## TECH STACK

- **React** (Vite preferred)
- **React Router** for page routing
- **State management**: React Context or Zustand (lightweight)
- **API calls**: Axios with JWT auth interceptor
- **WebSocket**: Native WebSocket or `reconnecting-websocket`
- **UI library**: Tailwind CSS + shadcn/ui, or Ant Design, or MUI (team choice)
- **Charts**: Recharts or Chart.js (earnings/analytics)
- **No MetaMask / wagmi / viem** — everything through REST API

---

## VERIFICATION PLAN

1. Register brand + broadcaster → verify correct dashboard routing
2. Broadcaster creates match → appears in Brand's match browser
3. Brand deposits → balance updates
4. Brand places bid → leaderboard updates for all connected brands
5. Broadcaster opens bidding → state changes across all views
6. Admin starts match → state updates via WebSocket on all clients
7. Admin triggers event → auction result appears simultaneously in Brand live view + Broadcaster live monitor
8. Brand claims refund → balance updates, history shows refund
9. Full demo flow end-to-end without page refreshes (all WebSocket-driven)
