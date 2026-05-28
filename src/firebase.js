// firebase.js — single Firebase app instance shared across auth + db modules
// All config values come from Vite env vars so they are never hard-coded.
// Add these to your .env.local (see .env.example for the full list).

import { initializeApp, getApps }  from 'firebase/app'
import { getFirestore }             from 'firebase/firestore'
import { getAuth }                  from 'firebase/auth'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
}

// Guard against double-init (React StrictMode renders twice in dev)
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)

export const db   = getFirestore(app)
export const auth = getAuth(app)
export default app
