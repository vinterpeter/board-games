import { initializeApp } from 'firebase/app'
import { getDatabase, ref, set, onValue, push, update, remove, get } from 'firebase/database'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Check if Firebase is configured
const isFirebaseConfigured = () => {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.includes('your_')
}

// Initialize Firebase only if configured
let app: ReturnType<typeof initializeApp> | null = null
let database: ReturnType<typeof getDatabase> | null = null
let auth: ReturnType<typeof getAuth> | null = null
const googleProvider = new GoogleAuthProvider()

if (isFirebaseConfigured()) {
  app = initializeApp(firebaseConfig)
  database = getDatabase(app)
  auth = getAuth(app)
}

// Auth functions
const signInWithGoogle = async (): Promise<User | null> => {
  if (!auth) return null
  try {
    const result = await signInWithPopup(auth, googleProvider)
    return result.user
  } catch (error) {
    console.error('Google sign-in error:', error)
    return null
  }
}

const signOut = async (): Promise<void> => {
  if (!auth) return
  try {
    await firebaseSignOut(auth)
  } catch (error) {
    console.error('Sign-out error:', error)
  }
}

export {
  database,
  ref,
  set,
  onValue,
  push,
  update,
  remove,
  get,
  isFirebaseConfigured,
  auth,
  signInWithGoogle,
  signOut,
  onAuthStateChanged,
  type User
}
