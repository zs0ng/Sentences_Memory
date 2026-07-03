import {
  type User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore'
import { auth, db, googleProvider, isFirebaseConfigured } from './firebase'
import { listReviewLogs, listSentences, seedDatabase } from '../db/localDb'
import type { ReviewLog, Sentence } from '../types/sentence'

export type SyncStatus = 'local-only' | 'syncing' | 'synced' | 'sync-failed'

export { isFirebaseConfigured }

function requireFirebase() {
  if (!auth || !db || !isFirebaseConfigured) {
    throw new Error('Firebase is not configured')
  }

  return { auth, db }
}

function sentenceCollection(userId: string) {
  return collection(requireFirebase().db, 'users', userId, 'sentences')
}

function reviewLogCollection(userId: string) {
  return collection(requireFirebase().db, 'users', userId, 'reviewLogs')
}

function mergeByUpdatedAt(localItems: Sentence[], remoteItems: Sentence[]) {
  const merged = new Map<string, Sentence>()

  for (const item of [...localItems, ...remoteItems]) {
    const current = merged.get(item.id)
    if (!current || current.updatedAt < item.updatedAt) {
      merged.set(item.id, item)
    }
  }

  return Array.from(merged.values())
}

function mergeLogs(localItems: ReviewLog[], remoteItems: ReviewLog[]) {
  const merged = new Map<string, ReviewLog>()

  for (const item of [...localItems, ...remoteItems]) {
    const current = merged.get(item.id)
    if (!current || current.reviewedAt < item.reviewedAt) {
      merged.set(item.id, item)
    }
  }

  return Array.from(merged.values())
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  if (!auth) {
    callback(null)
    return () => undefined
  }

  return onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle() {
  const { auth: firebaseAuth } = requireFirebase()
  return signInWithPopup(firebaseAuth, googleProvider)
}

export async function signOutFromFirebase() {
  const { auth: firebaseAuth } = requireFirebase()
  return signOut(firebaseAuth)
}

export async function syncAllData(userId: string) {
  const [localSentences, localReviewLogs, remoteSentenceSnapshot, remoteReviewLogSnapshot] =
    await Promise.all([
      listSentences(),
      listReviewLogs(),
      getDocs(sentenceCollection(userId)),
      getDocs(reviewLogCollection(userId)),
    ])

  const remoteSentences = remoteSentenceSnapshot.docs.map((entry) => entry.data() as Sentence)
  const remoteReviewLogs = remoteReviewLogSnapshot.docs.map((entry) => entry.data() as ReviewLog)

  const mergedSentences = mergeByUpdatedAt(localSentences, remoteSentences)
  const mergedReviewLogs = mergeLogs(localReviewLogs, remoteReviewLogs)

  await Promise.all([
    ...mergedSentences.map((sentence) =>
      setDoc(doc(sentenceCollection(userId), sentence.id), sentence),
    ),
    ...mergedReviewLogs.map((reviewLog) =>
      setDoc(doc(reviewLogCollection(userId), reviewLog.id), reviewLog),
    ),
  ])

  await seedDatabase(mergedSentences, mergedReviewLogs)
}

export async function syncSentence(userId: string, sentence: Sentence) {
  await setDoc(doc(sentenceCollection(userId), sentence.id), sentence)
}

export async function syncReviewLog(userId: string, reviewLog: ReviewLog) {
  await setDoc(doc(reviewLogCollection(userId), reviewLog.id), reviewLog)
}

export async function removeSentenceFromCloud(userId: string, sentenceId: string) {
  await deleteDoc(doc(sentenceCollection(userId), sentenceId))
}
