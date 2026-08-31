# TrackerX Production Architecture Rules & Scale Directives

## 1. Zero-Glitch Grid & Sheet Persistence (High Concurrency Directives)
- **Isolated User Documents**: Every trader's journal data is strictly siloed under their own document path (`users/{cleanEmailKey}`). Never batch query entire user trading grids into memory or cross-pollute streams.
- **Atomic Local-First Mutations**:
  - UI inputs (trade descriptions, profit/loss states, sub-trades, starting capital) must update locally in memory and write to `localStorage` immediately (0ms latency).
  - Cloud synchronization to Firestore and Express `/api/user/data` MUST be debounced (minimum 400ms-600ms) with deep equality checks (`JSON.stringify(prev) !== JSON.stringify(incoming)`) to prevent Firestore write storms and cascading re-render loops when thousands of traders are logging simultaneously.
- **Dynamic Auto-Expanding Text Inputs**:
  - Trade descriptions, setup notes, and confluences must ALWAYS use `AutoExpandingTextarea` with downward auto-height growth and text wrapping (`break-words whitespace-pre-wrap`).
  - Never clip, cut off, or truncate trader notes inside fixed-height input fields.

## 2. Hard Reset Protocol
- Reset actions must execute across all 4 tiers simultaneously:
  1. React Component State
  2. Browser LocalStorage keys (`trading_store_*`, `sngx_trading_data_*`, `trading_settings_*`, `trading_capital_*`)
  3. Express Server Memory & Disk Database (`/api/user/data` with `force: true`)
  4. Firestore Cloud Document (`users/{email}` with explicit `tradingData: {}`)
- Always use high-contrast UI modals for confirmation rather than iframe-blocked `window.confirm()`.

## 3. High-Throughput Server Scalability
- Ensure CORS (`Access-Control-Allow-Origin: *`) remains enabled for multi-app / Host Admin portal topologies.
- Firestore Security Rules must strictly authenticate user ownership to prevent race-condition overwrites.

## 4. Strict Data Preservation & Non-Destructive Update Invariant
- **Zero Data Loss on Updates**: No code update, refactor, styling change, or feature rollout may ever overwrite, wipe, reset, drop, or corrupt user data across:
  1. **Trading Grids & Logs**: Trade descriptions, sub-trades, starting capital, risk parameters, and journal state.
  2. **Community & Channel Chats**: Public community messages, media attachments, and pinned announcements.
  3. **Signal Groups & Signals**: Signal groups, published signals, historical vote outcomes, VIP configurations, and member rosters.
  4. **Direct Messages (DMs)**: 1-on-1 private conversations, shared photos, and unread counters.
- **Backward-Compatible Schema Merging**: When reading or writing user state, always deep-merge with defaults rather than replacing with blank or partial objects.
- **Explicit User-Only Deletion**: Data can ONLY be deleted or cleared if the user explicitly triggers a verified, multi-step confirmation in the UI (e.g., Hard Reset modal). No automated reset during app startup, migrations, or version upgrades.
