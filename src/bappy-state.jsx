import React from 'react'
import { BAPPY_SEED } from './bappy-data.js'
import { signInWithGoogle, signInWithEmail, signOut as fbSignOut, onAuthChange, normaliseUser } from './firebase-auth.js'
import { readUserState, writeUserState, subscribeUserState } from './firebase-db.js'
import * as Storage from './bappy-storage.js'

// ─── Internal helpers ─────────────────────────────────────────

// Deduplicate transaction IDs.
// The old import loop called ADD_TRANSACTION in a tight synchronous loop; every
// row in a batch got the same Date.now() value as its ID because JS runs faster
// than 1 ms. This function fixes any collisions by minting fresh IDs for all
// but the first occurrence. Called both at loadState() AND inside MERGE_REMOTE
// so that stale Sheets data cannot restore the duplicates after a pull.
function dedupeTransactionIds(transactions) {
  if (!transactions?.length) return transactions || []
  const seen = new Set()
  let hasDupes = false
  transactions.forEach(t => {
    if (seen.has(t.id)) hasDupes = true
    seen.add(t.id)
  })
  if (!hasDupes) return transactions   // fast path — no allocations needed

  const base = Date.now()
  let counter = 0
  const assigned = new Set()
  const fixed = transactions.map(t => {
    if (!assigned.has(t.id)) { assigned.add(t.id); return t }
    return { ...t, id: 'tx-m' + (base + counter++) }
  })
  console.info(`[bappy] Repaired ${counter} duplicate transaction IDs.`)
  return fixed
}

function fixDuplicateTransactionIds(state) {
  const fixed = dedupeTransactionIds(state.transactions)
  if (fixed === state.transactions) return state   // nothing changed
  return { ...state, transactions: fixed }
}

function loadStateSync() {
  const saved = Storage.loadSync()
  if (saved && Array.isArray(saved.accounts)) return fixDuplicateTransactionIds(saved)
  return JSON.parse(JSON.stringify(BAPPY_SEED))
}

// ─── Utilities ────────────────────────────────────────────────
export const BappyUtil = {
  today: () => new Date(),

  fmtGBP: (n, opts = {}) => {
    const { sign = false, abs = false } = opts
    const v = abs ? Math.abs(n) : n
    const s = new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP',
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(Math.abs(v))
    if (sign) return (v < 0 ? '−' : '+') + s
    if (v < 0) return '−' + s
    return s
  },

  fmtGBPCompact: (n) => {
    const abs = Math.abs(n)
    if (abs >= 1000) return (n < 0 ? '−' : '') + '£' + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'k'
    return (n < 0 ? '−' : '') + '£' + Math.round(abs)
  },

  fmtDateShort: (d) => {
    const date = typeof d === 'string' ? new Date(d) : d
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(date)
  },

  fmtDateLong: (d) => {
    const date = typeof d === 'string' ? new Date(d) : d
    return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
  },

  fmtRelativeDate: (d) => {
    const date  = typeof d === 'string' ? new Date(d) : d
    const today = BappyUtil.today()
    const diff  = Math.round((date - today) / 86400000)
    if (diff === 0)  return 'Today'
    if (diff === 1)  return 'Tomorrow'
    if (diff === -1) return 'Yesterday'
    if (diff > 1  && diff < 7)  return 'In ' + diff + ' days'
    if (diff < -1 && diff > -7) return (diff * -1) + ' days ago'
    return BappyUtil.fmtDateShort(date)
  },

  daysUntil: (dateStr) => {
    const t = BappyUtil.today()
    const d = new Date(dateStr)
    return Math.round((d - t) / 86400000)
  },

  nextPayday: (settings) => {
    const t = BappyUtil.today()
    if (settings.payFrequency === 'weekly' || settings.payFrequency === 'biweekly') {
      const target = settings.payAnchorWeekday ?? 5
      const d      = new Date(t)
      let diff     = (target - t.getUTCDay() + 7) % 7
      if (diff === 0) diff = 7
      d.setUTCDate(d.getUTCDate() + diff)
      return d
    }
    const d = new Date(t)
    d.setUTCDate(settings.payAnchorDay)
    if (d < t) d.setUTCMonth(d.getUTCMonth() + 1)
    return d
  },

  projectRecurring: (recurring, days) => {
    const out     = []
    const t       = BappyUtil.today()
    const horizon = new Date(t.getTime() + days * 86400000)
    recurring.forEach(rec => {
      if (!rec.active) return
      let cursor = new Date(rec.nextDue)
      while (cursor <= horizon) {
        out.push({
          templateId: rec.id, date: cursor.toISOString().slice(0, 10),
          amount: rec.amount, direction: rec.direction,
          accountId: rec.accountId, categoryId: rec.categoryId, payee: rec.payee,
        })
        if      (rec.frequency === 'monthly')  cursor.setUTCMonth(cursor.getUTCMonth() + 1)
        else if (rec.frequency === 'weekly')   cursor.setUTCDate(cursor.getUTCDate() + 7)
        else if (rec.frequency === 'annually') cursor.setUTCFullYear(cursor.getUTCFullYear() + 1)
        else break
      }
    })
    return out.sort((a, b) => a.date.localeCompare(b.date))
  },

  primaryAccount: (state) =>
    state.accounts.find(a => a.type === 'current' || a.type === 'checking') || null,

  availableToSpend: (state) => {
    const current = BappyUtil.primaryAccount(state)
    if (!current) return 0
    const pd   = BappyUtil.nextPayday(state.settings)
    const days = Math.max(0, BappyUtil.daysUntil(pd.toISOString().slice(0, 10)))
    const proj = BappyUtil.projectRecurring(state.recurring, days)
    let committed = 0
    proj.forEach(p => {
      if (p.accountId !== current.id) return
      if (p.direction === 'expense' || p.direction === 'transfer') committed += p.amount
    })
    return current.balance - committed
  },

  simulateDebt: (balance, apr, monthlyPayment, monthsCap = 600) => {
    let bal = Math.abs(balance)
    const rate = apr / 100 / 12
    let months = 0, interestPaid = 0
    const curve = [{ month: 0, balance: bal }]
    while (bal > 0.01 && months < monthsCap) {
      const interest  = bal * rate
      const principal = Math.max(0, monthlyPayment - interest)
      if (principal <= 0) return { payoffMonths: Infinity, interestPaid: Infinity, curve, neverClears: true }
      bal = Math.max(0, bal - principal)
      interestPaid += interest
      months++
      curve.push({ month: months, balance: bal })
    }
    return { payoffMonths: months, interestPaid, curve, neverClears: false }
  },

  projectCashFlow: (state, days = 90) => {
    const current = BappyUtil.primaryAccount(state)
    if (!current) return []
    const t    = BappyUtil.today()
    const proj = BappyUtil.projectRecurring(state.recurring, days)
    const out  = []
    let bal    = current.balance
    for (let i = 0; i <= days; i++) {
      const d  = new Date(t.getTime() + i * 86400000)
      const ds = d.toISOString().slice(0, 10)
      proj.forEach(p => {
        if (p.date === ds && p.accountId === current.id) {
          if (p.direction === 'income') bal += p.amount
          else bal -= p.amount
        }
      })
      out.push({ date: ds, balance: bal })
    }
    return out
  },
}

// ─── Reducer (core — no timestamp side-effects) ───────────────
// bappyReducerCore handles every action. The public bappyReducer wrapper
// stamps lastModifiedAt on any action that actually changes state, so we
// never have to remember to do it in individual cases.
function bappyReducerCore(state, action) {
  switch (action.type) {

    case 'RESET':
      return JSON.parse(JSON.stringify(BAPPY_SEED))

    // Restore a previously-saved full state (used by the async storage layer
    // to upgrade the synchronous initial load with a newer copy from IndexedDB).
    case 'RESTORE':
      if (!action.state || !Array.isArray(action.state.accounts)) return state
      return fixDuplicateTransactionIds(action.state)

    // Merge data loaded from Google Sheets.
    // Only called when remote is confirmed newer (see loadFromSheets) OR the
    // user explicitly forces a pull.  Remote wins for every non-empty collection;
    // dedupeTransactionIds is applied to guard against stale duplicate IDs.
    // lastModifiedAt is set to the remote timestamp so subsequent auto-pulls
    // don't immediately trigger another merge.
    case 'MERGE_REMOTE': {
      const r = action.remote
      const remoteModifiedAt = r.Settings?.__remoteModifiedAt || 0
      // Strip the transport-only field before merging into state.settings
      const { __remoteModifiedAt: _drop, ...cleanRemoteSettings } = r.Settings || {}
      const rawTxns = (r.Transactions && r.Transactions.length) ? r.Transactions : state.transactions
      return {
        ...state,
        categories:     (r.Categories   && r.Categories.length)   ? r.Categories   : state.categories,
        accounts:       (r.Accounts     && r.Accounts.length)     ? r.Accounts     : state.accounts,
        transactions:   dedupeTransactionIds(rawTxns),
        recurring:      (r.Recurring    && r.Recurring.length)    ? r.Recurring    : state.recurring,
        budgets:        (r.Budgets      && r.Budgets.length)      ? r.Budgets      : state.budgets,
        nudgeRules:     (r.NudgeRules   && r.NudgeRules.length)   ? r.NudgeRules   : state.nudgeRules,
        settings:       r.Settings ? { ...state.settings, ...cleanRemoteSettings } : state.settings,
        // Keep the remote timestamp so the next auto-pull sees no diff and skips
        lastModifiedAt: remoteModifiedAt || state.lastModifiedAt || 0,
      }
    }

    case 'ADD_ACCOUNT': {
      const id = 'acc-' + Date.now()
      return { ...state, accounts: [...state.accounts, { ...action.account, id }] }
    }
    case 'UPDATE_ACCOUNT':
      return { ...state, accounts: state.accounts.map(a => a.id === action.id ? { ...a, ...action.patch } : a) }
    case 'DELETE_ACCOUNT':
      return {
        ...state,
        accounts: state.accounts.filter(a => a.id !== action.id),
        transactions: state.transactions.filter(t => t.accountId !== action.id && t.transferToId !== action.id),
      }

    // Bulk import — records group for rollback
    case 'IMPORT_BATCH': {
      const now = Date.now()
      // Honour pre-assigned IDs (set by handleRunImport so auto-link pairs can reference them)
      const tagged = action.txns.map((t, i) => ({ ...t, id: t.id || ('tx-' + (now + i)) }))
      const deltas = {}
      tagged.forEach(t => {
        const d = t.direction === 'income' ? t.amount : -t.amount
        deltas[t.accountId] = (deltas[t.accountId] || 0) + d
      })
      // Apply exact-match auto-link pairs supplied by the import UI.
      // Direction changes don't affect balance — deltas above already reflect the correct
      // income/expense net per account, and transfer/transfer-in have the same net effect.
      let finalTxns = [...state.transactions, ...tagged]
      if (action.autoLinkPairs?.length) {
        const usedIds = new Set()
        action.autoLinkPairs.forEach(({ outId, inId }) => {
          if (usedIds.has(outId) || usedIds.has(inId)) return
          const outTxn = finalTxns.find(t => t.id === outId)
          const inTxn  = finalTxns.find(t => t.id === inId)
          if (!outTxn || !inTxn) return
          usedIds.add(outId); usedIds.add(inId)
          finalTxns = finalTxns.map(t => {
            if (t.id === outId) return { ...t, direction: 'transfer',    transferToId: inTxn.accountId,  categoryId: 'cat-transfer', transferLinked: true }
            if (t.id === inId)  return { ...t, direction: 'transfer-in', transferToId: outTxn.accountId, categoryId: 'cat-transfer', transferLinked: true }
            return t
          })
        })
      }
      return {
        ...state,
        transactions: finalTxns,
        accounts: state.accounts.map(a =>
          deltas[a.id] !== undefined ? { ...a, balance: +(a.balance + deltas[a.id]).toFixed(2) } : a),
        lastImport: { ids: tagged.map(t => t.id), count: tagged.length, date: new Date().toISOString().slice(0, 10), filename: action.filename || '' },
      }
    }

    // Undo the most recent import batch
    case 'ROLLBACK_IMPORT': {
      if (!state.lastImport) return state
      const idSet = new Set(state.lastImport.ids)
      const removed = state.transactions.filter(t => idSet.has(t.id))
      const deltas = {}
      removed.forEach(t => {
        const reverse = t.direction === 'income' ? -t.amount : t.amount
        deltas[t.accountId] = (deltas[t.accountId] || 0) + reverse
      })
      return {
        ...state,
        transactions: state.transactions.filter(t => !idSet.has(t.id)),
        accounts: state.accounts.map(a =>
          deltas[a.id] !== undefined ? { ...a, balance: +(a.balance + deltas[a.id]).toFixed(2) } : a),
        lastImport: null,
      }
    }

    case 'ADD_TRANSACTION': {
      const t  = action.txn
      const id = 'tx-' + Date.now()
      const accounts = state.accounts.map(a => {
        if (a.id !== t.accountId) return a
        const delta = t.direction === 'income' ? t.amount : -t.amount
        return { ...a, balance: +(a.balance + delta).toFixed(2) }
      })
      let txns = [...state.transactions, { ...t, id }]
      if (t.direction === 'transfer' && t.transferToId) {
        txns.push({ ...t, id: 'tx-' + (Date.now() + 1), accountId: t.transferToId, transferToId: t.accountId, direction: 'transfer-in' })
        return {
          ...state, transactions: txns,
          accounts: accounts.map(a => a.id === t.transferToId
            ? { ...a, balance: +(a.balance + t.amount).toFixed(2) } : a),
        }
      }
      return { ...state, transactions: txns, accounts }
    }

    case 'DELETE_TRANSACTION': {
      const tx = state.transactions.find(t => t.id === action.id)
      if (!tx) return state
      // For a transfer-out, also delete the paired transfer-in and reverse both balance effects
      const isTransferOut = tx.direction === 'transfer'
      const pairedId = isTransferOut
        ? state.transactions.find(t => t.direction === 'transfer-in' && t.transferToId === tx.accountId && t.accountId === tx.transferToId && t.amount === tx.amount)?.id
        : null
      let accounts = state.accounts.map(a => {
        if (a.id === tx.accountId) {
          const delta = tx.direction === 'income' ? -tx.amount : tx.amount
          return { ...a, balance: +(a.balance + delta).toFixed(2) }
        }
        if (isTransferOut && a.id === tx.transferToId) {
          return { ...a, balance: +(a.balance - tx.amount).toFixed(2) }
        }
        return a
      })
      const idsToRemove = new Set([action.id, ...(pairedId ? [pairedId] : [])])
      return { ...state, accounts, transactions: state.transactions.filter(t => !idsToRemove.has(t.id)) }
    }

    // Link two imported transfer-category transactions retroactively.
    // No balance recalculation needed: the import already applied correct income/expense
    // deltas, and transfer/transfer-in have the identical net balance effect.
    case 'LINK_TRANSFER': {
      const outTxn = state.transactions.find(t => t.id === action.outId)
      const inTxn  = state.transactions.find(t => t.id === action.inId)
      if (!outTxn || !inTxn) return state
      return {
        ...state,
        transactions: state.transactions.map(t => {
          if (t.id === action.outId) return { ...t, direction: 'transfer',    transferToId: inTxn.accountId,  categoryId: 'cat-transfer', transferLinked: true }
          if (t.id === action.inId)  return { ...t, direction: 'transfer-in', transferToId: outTxn.accountId, categoryId: 'cat-transfer', transferLinked: true }
          return t
        }),
      }
    }

    case 'UPDATE_TRANSACTION': {
      const old = state.transactions.find(t => t.id === action.id)
      if (!old) return state
      const updated = { ...old, ...action.patch }
      // Reverse old balance effect on old account
      let accounts = state.accounts.map(a => {
        if (a.id !== old.accountId) return a
        const reverse = old.direction === 'income' ? -old.amount : old.amount
        return { ...a, balance: +(a.balance + reverse).toFixed(2) }
      })
      // Apply new balance effect on new account (may differ if account changed)
      accounts = accounts.map(a => {
        if (a.id !== updated.accountId) return a
        const apply = updated.direction === 'income' ? updated.amount : -updated.amount
        return { ...a, balance: +(a.balance + apply).toFixed(2) }
      })
      return { ...state, accounts, transactions: state.transactions.map(t => t.id === action.id ? updated : t) }
    }

    case 'ADD_RECURRING': {
      const id = 'rec-' + Date.now()
      return { ...state, recurring: [...state.recurring, { ...action.rec, id }] }
    }
    case 'TOGGLE_RECURRING':
      return { ...state, recurring: state.recurring.map(r => r.id === action.id ? { ...r, active: !r.active } : r) }
    case 'UPDATE_RECURRING':
      return { ...state, recurring: state.recurring.map(r => r.id === action.id ? { ...r, ...action.patch } : r) }
    case 'DELETE_RECURRING':
      return { ...state, recurring: state.recurring.filter(r => r.id !== action.id) }

    // Mark a recurring template as paid for the current period:
    // - posts a transaction dated today
    // - advances nextDue by one period
    case 'MARK_RECURRING_PAID': {
      const rec = state.recurring.find(r => r.id === action.id)
      if (!rec) return state
      const today = BappyUtil.today().toISOString().slice(0, 10)
      // Advance nextDue by one period
      const next = new Date(rec.nextDue)
      if (rec.frequency === 'monthly')  next.setUTCMonth(next.getUTCMonth() + 1)
      else if (rec.frequency === 'weekly')   next.setUTCDate(next.getUTCDate() + 7)
      else if (rec.frequency === 'annually') next.setUTCFullYear(next.getUTCFullYear() + 1)
      const nextDue = next.toISOString().slice(0, 10)
      const txnId = 'tx-' + Date.now()
      const newTxn = {
        id: txnId,
        date: today,
        description: rec.payee,
        amount: rec.amount,
        direction: rec.direction || 'expense',
        accountId: rec.accountId,
        categoryId: rec.categoryId,
        status: 'cleared',
        templateId: rec.id,
      }
      // Update account balance
      const delta = newTxn.direction === 'income' ? newTxn.amount : -newTxn.amount
      const accounts = state.accounts.map(a =>
        a.id === rec.accountId ? { ...a, balance: (a.balance || 0) + delta } : a
      )
      return {
        ...state,
        recurring: state.recurring.map(r => r.id === rec.id ? { ...r, nextDue } : r),
        transactions: [...state.transactions, newTxn],
        accounts,
      }
    }

    case 'ADD_BUDGET': {
      const id = 'bud-' + Date.now()
      return { ...state, budgets: [...state.budgets, { ...action.budget, id }] }
    }
    case 'UPDATE_BUDGET':
      return { ...state, budgets: state.budgets.map(b => b.id === action.id ? { ...b, ...action.patch } : b) }
    case 'DELETE_BUDGET':
      return { ...state, budgets: state.budgets.filter(b => b.id !== action.id) }

    case 'ACCEPT_SUGGESTION': {
      const sug = state.suggestions.find(s => s.id === action.id)
      if (!sug) return state
      const id = 'rec-' + Date.now()
      return {
        ...state,
        recurring: [...state.recurring, {
          id, payee: sug.payee, accountId: sug.accountId, amount: sug.amount,
          direction: 'expense', frequency: sug.frequency, anchorDay: sug.anchorDay,
          categoryId: sug.categoryId, active: true, source: 'detected',
          nextDue: BappyUtil.today().toISOString().slice(0, 10), baseline: sug.amount,
        }],
        suggestions: state.suggestions.map(s => s.id === action.id ? { ...s, status: 'accepted' } : s),
      }
    }

    case 'DISMISS_SUGGESTION':
      return { ...state, suggestions: state.suggestions.map(s => s.id === action.id ? { ...s, status: 'dismissed' } : s) }

    case 'UPDATE_NUDGE':
      return { ...state, nudges: state.nudges.map(n => n.id === action.id ? { ...n, ...action.patch } : n) }
    case 'UPDATE_NUDGE_TYPES':
      return { ...state, nudgeTypePrefs: action.patch }
    case 'ADD_DEVICE':
      return { ...state, pushDevices: [...(state.pushDevices || []), action.device] }
    case 'REMOVE_DEVICE':
      return { ...state, pushDevices: (state.pushDevices || []).filter(d => d.id !== action.id) }

    case 'TOGGLE_RULE':
      return { ...state, nudgeRules: state.nudgeRules.map(r => r.id === action.id ? { ...r, active: !r.active } : r) }
    case 'UPDATE_RULE':
      return { ...state, nudgeRules: state.nudgeRules.map(r => r.id === action.id ? { ...r, ...action.patch } : r) }
    case 'ADD_RULE': {
      const id = action.axis[0].toUpperCase() + (Date.now() % 10000)
      return { ...state, nudgeRules: [...state.nudgeRules, { id, axis: action.axis, priority: 50, name: 'New rule', when: {}, then: {}, active: true }] }
    }

    case 'UPDATE_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.patch } }

    case 'ADD_CATEGORY': {
      const id = 'cat-' + Date.now()
      return { ...state, categories: [...state.categories, { id, ...action.cat }] }
    }
    case 'UPDATE_CATEGORY':
      return { ...state, categories: state.categories.map(c => c.id === action.id ? { ...c, ...action.patch } : c) }
    case 'DELETE_CATEGORY':
      return { ...state, categories: state.categories.filter(c => c.id !== action.id) }

    default:
      return state
  }
}

// Wrapper: stamps lastModifiedAt on every action that produces a new state
// object, so individual cases never need to remember to do it.
// RESTORE and MERGE_REMOTE are exempt — they carry their own timestamps.
const NO_TIMESTAMP_ACTIONS = new Set(['RESTORE', 'MERGE_REMOTE'])

function bappyReducer(state, action) {
  const next = bappyReducerCore(state, action)
  if (next === state) return state                        // no-op — nothing changed
  if (NO_TIMESTAMP_ACTIONS.has(action.type)) return next // exempt — carries its own ts
  return { ...next, lastModifiedAt: Date.now() }
}

// ─── Main app context ─────────────────────────────────────────
export const BappyContext = React.createContext(null)
export const useBappy     = () => React.useContext(BappyContext)

export function BappyProvider({ children }) {
  // Synchronous init from localStorage so the UI renders immediately with saved data.
  // The useEffect below upgrades from IndexedDB once the async open resolves.
  const [state, dispatch]           = React.useReducer(bappyReducer, null, loadStateSync)
  const [syncStatus, setSyncStatus] = React.useState('idle')  // idle | syncing | error
  const [syncError,  setSyncError]  = React.useState(null)
  const [lastSynced, setLastSynced] = React.useState(null)    // ISO timestamp of last successful sync
  const [storageError, setStorageError] = React.useState(null) // local storage write error
  const uidRef       = React.useRef(null)    // Firebase UID — set by BappyAuthProvider on sign-in
  const writeTimer   = React.useRef(null)
  const saveTimer    = React.useRef(null)
  const skipNextSync = React.useRef(false)   // prevent write-back after a remote merge
  const lastWriteRef = React.useRef(0)       // timestamp of last successful Firestore write
  // Always-current state ref — used by push/pull callbacks so they never close over stale state
  const stateRef     = React.useRef(state)
  React.useEffect(() => { stateRef.current = state }, [state])

  // ── One-time startup: migrate legacy format, then load the newest copy ──
  // Runs after first render so the UI is already visible with localStorage data.
  React.useEffect(() => {
    Storage.migrateIfNeeded().then(() => Storage.load()).then(({ state: saved, source }) => {
      if (!saved) return
      // Only upgrade if IDB has data that differs from what localStorage gave us
      // (IDB may be newer if a previous localStorage write failed silently)
      if (source === 'idb') {
        const cur = stateRef.current
        const idbIsNewer =
          (saved.accounts?.length     || 0) > (cur.accounts?.length     || 0) ||
          (saved.transactions?.length || 0) > (cur.transactions?.length || 0) ||
          (saved.categories?.length   || 0) > (cur.categories?.length   || 0)
        if (idbIsNewer) {
          console.info('[bappy] IndexedDB has more data than localStorage — restoring')
          dispatch({ type: 'RESTORE', state: saved })
        }
      }
    }).catch(err => console.warn('[bappy] Startup storage load failed (non-fatal):', err))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Persist to both IndexedDB and localStorage on every state change ──
  // Debounced 250 ms to batch rapid sequential dispatches (e.g. import batch).
  // Storage errors are surfaced to the user rather than silently swallowed.
  React.useEffect(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      Storage.save(stateRef.current).then(({ idbOk, lsOk }) => {
        if (idbOk) setStorageError(null)   // clear any previous error once IDB succeeds
        if (!lsOk && idbOk) {
          // localStorage is full but IndexedDB is fine — gentle warning, not blocking
          console.warn('[bappy] localStorage is full; data is safe in IndexedDB')
        }
      }).catch(err => {
        // Both stores failed — tell the user
        setStorageError(err?.message || String(err))
      })
    }, 250)
    return () => clearTimeout(saveTimer.current)
  }, [state])

  // ── Debounced write to Firestore on every state change ──
  // Only fires when a user is signed in (uidRef.current is set).
  // Debounced 1.5 s to batch rapid sequential dispatches (e.g. import).
  React.useEffect(() => {
    if (!uidRef.current) return
    if (skipNextSync.current) { skipNextSync.current = false; return }
    clearTimeout(writeTimer.current)
    writeTimer.current = setTimeout(async () => {
      setSyncStatus('syncing')
      try {
        await writeUserState(uidRef.current, stateRef.current)
        setSyncStatus('idle')
        setSyncError(null)
        setLastSynced(new Date().toISOString())
        lastWriteRef.current = Date.now()
      } catch (err) {
        console.warn('[bappy] Firestore write error:', err)
        setSyncStatus('error')
        setSyncError(err?.message || String(err))
      }
    }, 1500)
    return () => clearTimeout(writeTimer.current)
  }, [state])

  // Load from Firestore and merge — used at sign-in and on manual pull.
  //
  // Conflict resolution (unless force=true):
  //  • remote newer  → apply MERGE_REMOTE (remote wins)
  //  • local newer   → push local to Firestore (local wins); no state change
  //  • no remote doc → push local so Firestore is seeded with current data
  //
  // force=true skips the comparison and always applies whatever Firestore has
  // (used by the explicit "Pull from cloud" button in Backup screen).
  const loadFromFirebase = React.useCallback(async (uid, { force = false } = {}) => {
    const remote = await readUserState(uid)

    if (!remote) {
      // User has no Firestore document yet — push local state to seed it
      if ((stateRef.current.accounts?.length || 0) > 0 || stateRef.current.lastModifiedAt > 0) {
        console.info('[bappy] No Firestore document — seeding from local state')
        try {
          await writeUserState(uid, stateRef.current)
          setLastSynced(new Date().toISOString())
          lastWriteRef.current = Date.now()
        } catch (pushErr) {
          console.warn('[bappy] Seed push failed:', pushErr)
        }
      }
      return
    }

    if (!force) {
      const remoteModifiedAt = remote.lastModifiedAt || 0
      const localModifiedAt  = stateRef.current.lastModifiedAt || 0
      const localHasData     = (stateRef.current.accounts?.length || 0) > 0

      if (localModifiedAt >= remoteModifiedAt && (localHasData || localModifiedAt > 0)) {
        // Local is newer or equal — push to Firestore, skip merge
        console.info('[bappy] Local state is newer than Firestore (local=%d remote=%d) — pushing local', localModifiedAt, remoteModifiedAt)
        try {
          await writeUserState(uid, stateRef.current)
          setLastSynced(new Date().toISOString())
          lastWriteRef.current = Date.now()
        } catch (pushErr) {
          console.warn('[bappy] Push-instead-of-pull failed:', pushErr)
        }
        return
      }
    }

    // Remote is newer (or force=true) — apply MERGE_REMOTE
    skipNextSync.current = true   // don't echo back what we just read
    dispatch({ type: 'MERGE_REMOTE', remote })
    setLastSynced(new Date().toISOString())
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // Immediately push current local state to Firestore (manual "push to cloud").
  const pushToSheets = React.useCallback(async () => {
    if (!uidRef.current) throw new Error('Not signed in. Sign in first to sync to cloud.')
    setSyncStatus('syncing')
    try {
      await writeUserState(uidRef.current, stateRef.current)
      setSyncStatus('idle')
      setSyncError(null)
      setLastSynced(new Date().toISOString())
      lastWriteRef.current = Date.now()
    } catch (err) {
      setSyncStatus('error')
      setSyncError(err?.message || String(err))
      throw err
    }
  }, [])  // stateRef / uidRef are refs — always current, no dep needed

  // Manually pull the latest data from Firestore (manual "pull from cloud").
  // Always applies remote data regardless of version — the user explicitly requested a pull.
  const pullFromSheets = React.useCallback(async () => {
    if (!uidRef.current) throw new Error('Not signed in. Sign in first to sync from cloud.')
    setSyncStatus('syncing')
    try {
      await loadFromFirebase(uidRef.current, { force: true })
      setSyncStatus('idle')
      setSyncError(null)
    } catch (err) {
      setSyncStatus('error')
      setSyncError(err?.message || String(err))
      throw err
    }
  }, [loadFromFirebase])

  // ── Real-time snapshot handler ──────────────────────────────
  // Called by BappyAuthProvider's Firestore onSnapshot listener whenever
  // another device writes to the user's Firestore document.
  // Guards:
  //  • Ignores snapshots within 5 s of a local write (likely an echo of our own write)
  //  • Ignores snapshots where remote timestamp ≤ local (no new data)
  //  • Sets skipNextSync so the resulting state change doesn't write back to Firestore
  const onRemoteUpdate = React.useCallback((remoteState) => {
    if (Date.now() - lastWriteRef.current < 5_000) {
      console.info('[bappy] Snapshot skipped — possible echo of recent local write')
      return
    }
    const remoteTs = remoteState.lastModifiedAt || 0
    const localTs  = stateRef.current.lastModifiedAt || 0
    if (remoteTs <= localTs) {
      console.info('[bappy] Snapshot skipped — remote (%d) not newer than local (%d)', remoteTs, localTs)
      return
    }
    console.info('[bappy] Real-time update — applying remote state (remote=%d > local=%d)', remoteTs, localTs)
    skipNextSync.current = true   // don't echo the merge back to Firestore
    dispatch({ type: 'MERGE_REMOTE', remote: remoteState })
    setLastSynced(new Date().toISOString())
  }, [])  // all accessed via stable refs — no deps needed

  const value = React.useMemo(() => ({
    state, dispatch, syncStatus, syncError, lastSynced, storageError,
    pushToSheets, pullFromSheets,
    cat:    (id) => state.categories.find(c => c.id === id),
    acc:    (id) => state.accounts.find(a => a.id === id),
    rec:    (id) => state.recurring.find(r => r.id === id),
    budget: (id) => state.budgets.find(b => b.id === id),
    // exposed so BappyAuthProvider can drive sync
    _setUid:           (uid) => { uidRef.current = uid },
    _setSyncStatus:    setSyncStatus,
    _loadFromFirebase: loadFromFirebase,
    _onRemoteUpdate:   onRemoteUpdate,  // for the real-time Firestore listener
    _lastWriteAt:      lastWriteRef,    // ref — stable, no extra dep needed
  }), [state, syncStatus, syncError, lastSynced, storageError, pushToSheets, pullFromSheets, loadFromFirebase, onRemoteUpdate])

  return React.createElement(BappyContext.Provider, { value }, children)
}

// ─── Auth context ─────────────────────────────────────────────
export const BappyAuthContext = React.createContext(null)
export const useBappyAuth     = () => React.useContext(BappyAuthContext)

const AUTH_KEY = 'bappy.auth.v1'

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (raw) {
      const p = JSON.parse(raw)
      if (p?.signedIn) return p
    }
  } catch {}
  return { signedIn: false, user: null }
}
function saveAuth(a) {
  try { localStorage.setItem(AUTH_KEY, JSON.stringify(a)) } catch {}
}

// BappyAuthProvider must be a CHILD of BappyProvider so it can read its context.
export function BappyAuthProvider({ children }) {
  const { _setUid, _setSyncStatus, _loadFromFirebase, _lastWriteAt, _onRemoteUpdate } = useBappy()
  const [auth,    setAuth]    = React.useState(loadAuth)
  const [fbReady, setFbReady] = React.useState(false)
  // Initialise to Date.now() so the first auto-pull is deferred by the full
  // throttle window from page load, not fired immediately on the first focus event.
  const lastAutoSyncRef  = React.useRef(Date.now())
  const snapshotUnsubRef = React.useRef(null)   // holds active Firestore listener teardown fn

  React.useEffect(() => { saveAuth(auth) }, [auth])

  // ── Firebase Auth state observer ─────────────────────────────
  // Fires immediately with the current user (auto-restores sessions),
  // then on every sign-in/sign-out.
  React.useEffect(() => {
    const unsub = onAuthChange(async (fbUser) => {
      setFbReady(true)   // Firebase SDK is ready once we get the first event

      if (!fbUser) {
        // Signed out — stop writes and kill the real-time listener
        _setUid(null)
        if (snapshotUnsubRef.current) {
          snapshotUnsubRef.current()
          snapshotUnsubRef.current = null
        }
        return
      }

      // Signed in (either a new sign-in or an auto-restored session)
      const user = normaliseUser(fbUser)
      _setUid(fbUser.uid)
      setAuth({ signedIn: true, user })

      // One-time sync at sign-in with version check (local wins if newer)
      _setSyncStatus('syncing')
      try {
        await _loadFromFirebase(fbUser.uid)
        _setSyncStatus('idle')
        lastAutoSyncRef.current = Date.now()
      } catch (err) {
        _setSyncStatus('error')
        console.warn('[bappy] Auto-restore sync failed:', err)
      }

      // ── Start real-time Firestore listener ──────────────────
      // Tear down any previous listener (e.g. uid change) before starting a new one.
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current()
      }
      snapshotUnsubRef.current = subscribeUserState(
        fbUser.uid,
        _onRemoteUpdate,
        (err) => console.warn('[bappy] Real-time listener error:', err)
      )
    })
    return unsub  // unsubscribe auth observer on unmount
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clean up Firestore listener on unmount ──────────────────
  React.useEffect(() => {
    return () => {
      if (snapshotUnsubRef.current) {
        snapshotUnsubRef.current()
        snapshotUnsubRef.current = null
      }
    }
  }, [])

  // ── Auto-pull on tab focus ─────────────────────────────────
  // Throttled to once per 2 minutes. The version check in loadFromFirebase
  // ensures local data is only overwritten when the remote is genuinely newer.
  const AUTO_PULL_THROTTLE = 120_000  // 2 minutes
  React.useEffect(() => {
    if (!auth.signedIn) return
    const uid = auth.user?.uid
    if (!uid) return
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastAutoSyncRef.current < AUTO_PULL_THROTTLE) return
      if (Date.now() - (_lastWriteAt?.current || 0) < 10_000) return
      lastAutoSyncRef.current = Date.now()
      _loadFromFirebase(uid).catch(err => console.warn('[bappy] Auto-pull on focus failed:', err))
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [auth.signedIn, auth.user?.uid, _loadFromFirebase, _lastWriteAt])

  const value = React.useMemo(() => ({
    signedIn: auth.signedIn,
    user:     auth.user,
    gisReady: fbReady,   // kept as gisReady so LoginScreen / bappy-app.jsx need no changes

    // Google Sign-In via Firebase popup
    googleSignIn: async () => {
      _setSyncStatus('syncing')
      try {
        // signInWithPopup triggers onAuthChange above, which handles the sync.
        // We just await it so the caller (LoginScreen) gets a result / error.
        const fbUser = await signInWithGoogle()
        // onAuthChange will fire and set auth state — nothing more needed here.
        return normaliseUser(fbUser)
      } catch (err) {
        _setSyncStatus('error')
        throw err
      }
    },

    // Email sign-in — backed by Firebase email/password.
    // The 6-digit code is used as the password (demo UX).
    // On first use the account is created; subsequent sign-ins require the same code.
    signIn: async ({ email, method = 'email', name, code }) => {
      if (method === 'email' && email && code) {
        // Firebase email/password — the 6-digit code IS the password (demo).
        _setSyncStatus('syncing')
        try {
          const fbUser = await signInWithEmail(email, code)
          // onAuthChange fires and handles sync — nothing extra needed.
          return normaliseUser(fbUser)
        } catch (err) {
          _setSyncStatus('error')
          throw err
        }
      }
      // Fallback: local-only sign-in (no Firebase UID, no Firestore sync)
      const inferredName = name ||
        (email?.includes('@')
          ? email.split('@')[0].split(/[.\-_]/).map(s => s[0].toUpperCase() + s.slice(1)).join(' ')
          : 'User')
      setAuth({
        signedIn: true,
        user: { email: email || '', method, name: inferredName, signedInAt: new Date().toISOString() },
      })
    },

    signOut: async () => {
      await fbSignOut()
      _setUid(null)
      localStorage.removeItem(AUTH_KEY)
      setAuth({ signedIn: false, user: null })
    },

    updateUser: (patch) => setAuth(a => ({ ...a, user: { ...(a.user || {}), ...patch } })),
  }), [auth, fbReady, _setUid, _setSyncStatus, _loadFromFirebase])

  return React.createElement(BappyAuthContext.Provider, { value }, children)
}

// Kept for screen imports
export { BAPPY_SEED }
