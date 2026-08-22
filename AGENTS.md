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
