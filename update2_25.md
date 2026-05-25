1. Reliable Data Storage
Problem: Data (transactions, accounts, categories, etc.) wasn't persisting between sessions because localStorage has a ~5 MB cap and the old code silently swallowed write failures — no error, no warning, data just vanished on reload.

Files changed:

New: src/bappy-storage.js — brand new dual-write storage layer
IndexedDB as primary store (gigabyte capacity, no quota issues)
localStorage as fast synchronous backup (for instant first render)
Both stores written on every save with timestamp tracking — whichever copy is newer wins on load
If both stores fail, a real error is thrown instead of being swallowed
migrateIfNeeded() automatically upgrades existing localStorage data into IndexedDB on first run
Modified: src/bappy-state.jsx
Replaced the old loadState() / saveState() functions with bappy-storage.js
App still initialises instantly from localStorage (no blank flash), then checks IndexedDB on mount for any newer data
Saves debounced 250 ms after each state change — with real error handling
Added RESTORE reducer action (lets the async IDB load upgrade the initial state)
storageError exposed on context so the UI can show it
Modified: src/bappy-app.jsx
SyncBanner extended to show a yellow warning banner if local storage writes fail (instead of silent data loss)

2. Add New Budget
Problem: The "New budget" button in Plan → Budgets existed visually but had no onClick handler — it did nothing.

Files changed:

Modified: src/bappy-screens-plan.jsx
New AddBudgetSheet component — a bottom sheet form with:
Category picker — 4-column icon grid; automatically excludes Income, Transfer, and any category already budgeted
Period selector — Monthly / Weekly / Annually (Segmented control)
Amount input — £-prefixed numeric field; shows monthly equivalent hint for Weekly/Annual budgets (e.g. "≈ £67/mo")
Add budget button stays disabled until both category and amount > 0 are set
On save dispatches ADD_BUDGET and closes the sheet
BudgetsScreen updated:
"New budget" button now opens the sheet via local addOpen state
Empty state added (📊 "No budgets yet") when list is empty
Subtitle is now dynamic — shows actual current month/year instead of hardcoded text
Deployment Status
All changes are built (dist/ is up to date — 50 modules, zero errors) but not yet live on bappy-app.web.app. Firebase credentials expired during the session. To deploy, open PowerShell and run:

cd "C:\Users\paula\Documents\Dev\MyBudgetApp v1"
firebase login --reauth
firebase deploy --only hosting