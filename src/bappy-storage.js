// bappy-storage.js — reliable dual-write storage layer
//
// PRIMARY:  IndexedDB  (gigabyte capacity, survives cache clears, async)
// BACKUP:   localStorage (5 MB cap, synchronous — used for fast initial render)
//
// Both stores are written on every save. On load we compare timestamps and
// return whichever copy is newer, so a failed write to one store never causes
// data loss as long as the other store succeeded.

const DB_NAME  = 'bappy-db'
const DB_VER   = 1
const STORE    = 'state'
const IDB_KEY  = 'v1'
const LS_KEY   = 'bappy.state.v4'   // keep the same key so existing LS data is picked up

// ─── IndexedDB helpers ─────────────────────────────────────────────────────

let _dbPromise = null

function openDB() {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('IndexedDB is not available in this environment'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VER)
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE)
    }
    req.onsuccess = (e) => resolve(e.target.result)
    req.onerror   = (e) => {
      _dbPromise = null   // allow retry
      reject(e.target.error)
    }
    req.onblocked = () => {
      _dbPromise = null
      reject(new Error('IndexedDB blocked — close other tabs and retry'))
    }
  })
  return _dbPromise
}

async function idbGet() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(IDB_KEY)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror   = () => reject(req.error)
  })
}

async function idbPut(record) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record, IDB_KEY)
    tx.oncomplete = resolve
    tx.onerror    = () => reject(tx.error)
    tx.onabort    = () => reject(tx.error ?? new Error('IDB transaction aborted'))
  })
}

// ─── localStorage helpers ──────────────────────────────────────────────────

function lsGet() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    const rec = JSON.parse(raw)
    // Accept both the new wrapped format { data, savedAt } and the legacy bare state
    if (rec && typeof rec === 'object') {
      if (Array.isArray(rec.accounts)) return { data: rec, savedAt: 0 }   // legacy
      if (rec.data && Array.isArray(rec.data.accounts)) return rec         // new format
    }
    return null
  } catch {
    return null
  }
}

function lsPut(record) {
  localStorage.setItem(LS_KEY, JSON.stringify(record))
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Synchronous fast-path load — only reads localStorage.
 * Used as the `useReducer` initializer so the UI renders immediately with
 * whatever data was last saved to localStorage, without waiting for IDB.
 *
 * Returns the raw state object, or null if nothing is stored.
 */
export function loadSync() {
  const rec = lsGet()
  return rec?.data ?? null
}

/**
 * Full async load — reads both stores and returns whichever copy is newer.
 * Call this once after mount to upgrade from the synchronous initial state.
 *
 * Returns { state, source } where source is 'idb' | 'ls' | 'none'.
 */
export async function load() {
  let idbRec = null
  let lsRec  = lsGet()

  try {
    idbRec = await idbGet()
  } catch (e) {
    console.warn('[bappy-storage] IDB load failed:', e)
  }

  const idbTime = idbRec?.savedAt ?? 0
  const lsTime  = lsRec?.savedAt  ?? 0

  if (!idbRec && !lsRec) return { state: null, source: 'none' }
  if (!idbRec) return { state: lsRec.data,  source: 'ls'  }
  if (!lsRec)  return { state: idbRec.data, source: 'idb' }

  // Both exist — pick whichever was saved more recently
  return idbTime >= lsTime
    ? { state: idbRec.data, source: 'idb' }
    : { state: lsRec.data,  source: 'ls'  }
}

/**
 * Save state to both stores.
 *
 * Strategy:
 *  - Write IDB first (primary, larger capacity)
 *  - Write LS second (backup, fast sync read)
 *  - If LS fails due to quota, that's OK as long as IDB succeeded
 *  - If BOTH fail, throw so the caller can surface an error to the user
 *
 * Returns { idbOk, lsOk }.
 */
export async function save(state) {
  const savedAt = Date.now()
  const record  = { data: state, savedAt }

  let idbOk = false
  let lsOk  = false
  let idbErr = null
  let lsErr  = null

  try {
    await idbPut(record)
    idbOk = true
  } catch (e) {
    idbErr = e
    console.warn('[bappy-storage] IDB save failed:', e)
  }

  try {
    lsPut(record)
    lsOk = true
  } catch (e) {
    lsErr = e
    if (e?.name === 'QuotaExceededError' || e?.code === 22) {
      console.warn('[bappy-storage] localStorage quota exceeded — IDB is the active store')
      // Not fatal if IDB succeeded
    } else {
      console.warn('[bappy-storage] localStorage save failed:', e)
    }
  }

  if (!idbOk && !lsOk) {
    const msg = [idbErr?.message, lsErr?.message].filter(Boolean).join(' / ')
    throw new Error(
      `Storage write failed — your data was not saved. ` +
      `Try freeing up disk space or clearing old browser data. (${msg})`
    )
  }

  return { idbOk, lsOk }
}

/**
 * Migrate any existing bare-state localStorage record (pre-storage-layer)
 * into the new wrapped format and seed IndexedDB from it.
 * Call once on first load; safe to call repeatedly (no-op if already migrated).
 */
export async function migrateIfNeeded() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    // If it's already the new format, nothing to do
    if (parsed?.data && parsed?.savedAt) return
    // It's the old bare-state format — wrap it and write both stores
    if (parsed && Array.isArray(parsed.accounts)) {
      console.info('[bappy-storage] Migrating legacy localStorage format → IDB')
      await save(parsed)
    }
  } catch (e) {
    console.warn('[bappy-storage] Migration failed (non-fatal):', e)
  }
}
