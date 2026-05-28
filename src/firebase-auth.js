// firebase-auth.js — Firebase Authentication helpers (replaces google-auth.js)
// Supports:
//   • Google Sign-In via popup
//   • Email / password (used by the demo email flow)
//   • Anonymous fallback for "demo" mode

import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut as fbSignOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth'
import { auth } from './firebase.js'

const googleProvider = new GoogleAuthProvider()
// Request the same profile scopes we previously used with GIS
googleProvider.addScope('email')
googleProvider.addScope('profile')

// ── Google Sign-In ────────────────────────────────────────────

/**
 * Open the Google Sign-In popup and return the Firebase User.
 * The returned user.email / user.displayName / user.photoURL map
 * directly to the old profile shape.
 */
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user   // { uid, email, displayName, photoURL, ... }
}

// ── Email / password sign-in ──────────────────────────────────

/**
 * Sign in with email+password, creating the account if it doesn't exist.
 * This backs the "Continue with email + 6-digit code" demo flow.
 *
 * The 6-digit code alone is too short/simple for Firebase's password rules,
 * so we derive a deterministic, longer password from email + code.
 * The same email + same code always maps to the same Firebase password, so
 * the demo UX is preserved: "set" your code on first sign-in, reuse it later.
 */
function derivePassword(email, code) {
  // Deterministic: "bappy‑{emailPrefix}‑{code}‑{reversed code}" — always 18+ chars, unique per email+code
  const prefix = email.split('@')[0].slice(0, 6).toLowerCase()
  const reversed = code.split('').reverse().join('')
  return `bappy-${prefix}-${code}-${reversed}`
}

export async function signInWithEmail(email, code) {
  const password = derivePassword(email, code)
  try {
    const result = await signInWithEmailAndPassword(auth, email, password)
    return result.user
  } catch (err) {
    // Account doesn't exist yet — create it automatically (first-time sign-in)
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      const result = await createUserWithEmailAndPassword(auth, email, password)
      return result.user
    }
    throw err
  }
}

// ── Anonymous / demo sign-in ─────────────────────────────────

export async function signInAnon() {
  const result = await signInAnonymously(auth)
  return result.user
}

// ── Sign-out ──────────────────────────────────────────────────

export async function signOut() {
  await fbSignOut(auth)
}

// ── Auth state observer ───────────────────────────────────────
// Calls `callback(user | null)` immediately with the current user,
// then on every subsequent change.  Returns the unsubscribe function.

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

// ── Helpers ───────────────────────────────────────────────────

/** Normalise a Firebase user object into the shape the app expects. */
export function normaliseUser(fbUser) {
  if (!fbUser) return null
  return {
    uid:        fbUser.uid,
    email:      fbUser.email      || '',
    name:       fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    picture:    fbUser.photoURL    || null,
    method:     fbUser.providerData?.[0]?.providerId === 'google.com' ? 'google' : 'email',
    signedInAt: new Date().toISOString(),
  }
}
