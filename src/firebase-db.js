// firebase-db.js — Firestore data layer (replaces gsheets.js)
//
// Schema: one document per authenticated user at  users/{uid}
//
// The document mirrors the in-memory state object:
//   { categories, accounts, transactions, recurring, budgets,
//     nudgeRules, settings, lastModifiedAt }
//
// Firestore documents are capped at 1 MB. For a typical budget-app user
// this is plenty (~2,000 transactions ≈ 400 KB). If you hit the limit,
// migrate transactions to a sub-collection.

import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase.js'

// ── Helpers ────────────────────────────────────────────────────

/** Reference to the user's state document. */
function userDoc(uid) {
  return doc(db, 'users', uid)
}

/**
 * Sanitise a state object before writing to Firestore:
 *   • Remove undefined values (Firestore rejects them)
 *   • Strip the transport-only __remoteModifiedAt field
 */
function sanitise(state) {
  const { settings, ...rest } = state
  const { __remoteModifiedAt: _drop, ...cleanSettings } = settings || {}
  // Deep-strip undefined — Firestore throws on undefined values
  return JSON.parse(JSON.stringify({ ...rest, settings: cleanSettings }))
}

// ── Read ───────────────────────────────────────────────────────

/**
 * Load the user's latest state from Firestore (one-time read).
 * Returns the state object, or null if the user has no document yet.
 * The returned object matches the MERGE_REMOTE remote shape, including
 * the __remoteModifiedAt transport field on settings.
 */
export async function readUserState(uid) {
  const snap = await getDoc(userDoc(uid))
  if (!snap.exists()) return null
  const data = snap.data()
  // Attach lastModifiedAt as __remoteModifiedAt so bappy-state.jsx can
  // compare versions using the same logic as the old Sheets driver.
  return {
    ...data,
    settings: {
      ...(data.settings || {}),
      __remoteModifiedAt: data.lastModifiedAt || 0,
    },
  }
}

// ── Write ──────────────────────────────────────────────────────

/**
 * Save the full app state to Firestore.
 * Uses setDoc (merge: false) so stale fields from older schema versions
 * are not retained — same semantics as the old Sheets batchClear + write.
 */
export async function writeUserState(uid, state) {
  const clean = sanitise(state)
  // serverTimestamp() ensures the Firestore server clock is used for ordering,
  // but we also keep lastModifiedAt (client ms) for the version-compare logic.
  await setDoc(userDoc(uid), {
    ...clean,
    _serverUpdatedAt: serverTimestamp(),
  })
}

// ── Real-time listener ─────────────────────────────────────────

/**
 * Subscribe to live Firestore updates for the user's state document.
 * Calls `onUpdate(remoteState)` whenever another device writes.
 * Returns the unsubscribe function.
 *
 * `onUpdate` receives a shape compatible with the MERGE_REMOTE action
 * (same as readUserState).  The caller is responsible for version
 * comparison before dispatching.
 */
export function subscribeUserState(uid, onUpdate, onError) {
  return onSnapshot(
    userDoc(uid),
    (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      onUpdate({
        ...data,
        settings: {
          ...(data.settings || {}),
          __remoteModifiedAt: data.lastModifiedAt || 0,
        },
      })
    },
    (err) => {
      console.warn('[firebase-db] snapshot error:', err)
      if (onError) onError(err)
    }
  )
}
