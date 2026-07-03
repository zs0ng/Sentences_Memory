import Dexie, { type Table } from 'dexie'
import { calculateNextReview } from '../utils/reviewScheduler'
import type { ReviewLog, ReviewResult, Sentence } from '../types/sentence'

class SentenceMemoryDB extends Dexie {
  sentences!: Table<Sentence, string>
  reviewLogs!: Table<ReviewLog, string>

  constructor() {
    super('SentenceMemoryDB')

    this.version(1).stores({
      sentences:
        'id, originalText, *tags, nextReviewAt, createdAt, updatedAt, archived',
      reviewLogs: 'id, sentenceId, reviewedAt',
    })
  }
}

export const db = new SentenceMemoryDB()

function createSentence(originalText: string): Sentence {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    originalText,
    chineseMeaning: '',
    mnemonic: '',
    tags: [],
    masteryLevel: 0,
    reviewCount: 0,
    easeFactor: 2.5,
    createdAt: now,
    updatedAt: now,
    nextReviewAt: now,
    archived: false,
  }
}

export async function listSentences() {
  return db.sentences.orderBy('createdAt').reverse().toArray()
}

export async function listActiveSentences() {
  return db.sentences
    .orderBy('createdAt')
    .reverse()
    .filter((sentence) => !sentence.archived)
    .toArray()
}

export async function countReviewLogs() {
  return db.reviewLogs.count()
}

export async function listReviewLogs() {
  return db.reviewLogs.orderBy('reviewedAt').reverse().toArray()
}

export async function listDueSentences(now = new Date().toISOString()) {
  return db.sentences
    .where('nextReviewAt')
    .belowOrEqual(now)
    .filter((sentence) => !sentence.archived)
    .sortBy('nextReviewAt')
}

export async function importSentences(sentences: string[]) {
  const existing = await db.sentences.toArray()
  const existingTexts = new Set(
    existing.map((sentence) => sentence.originalText.trim().toLowerCase()),
  )

  const freshSentences = sentences
    .filter((sentence) => !existingTexts.has(sentence.trim().toLowerCase()))
    .map(createSentence)

  if (freshSentences.length > 0) {
    await db.sentences.bulkAdd(freshSentences)
  }

  return {
    imported: freshSentences.length,
    skipped: sentences.length - freshSentences.length,
  }
}

export async function updateSentence(sentence: Sentence) {
  await db.sentences.put({
    ...sentence,
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteSentence(id: string) {
  await db.sentences.delete(id)
  await db.reviewLogs.where('sentenceId').equals(id).delete()
}

export async function clearDatabase() {
  await db.transaction('rw', db.sentences, db.reviewLogs, async () => {
    await db.reviewLogs.clear()
    await db.sentences.clear()
  })
}

export async function seedDatabase(sentences: Sentence[], reviewLogs: ReviewLog[] = []) {
  await clearDatabase()

  await db.transaction('rw', db.sentences, db.reviewLogs, async () => {
    await db.sentences.bulkPut(sentences)

    if (reviewLogs.length > 0) {
      await db.reviewLogs.bulkPut(reviewLogs)
    }
  })
}

export async function submitReview(sentence: Sentence, result: ReviewResult) {
  const schedule = calculateNextReview(result, sentence)
  const reviewedAt = new Date().toISOString()

  const updatedSentence: Sentence = {
    ...sentence,
    ...schedule,
    reviewCount: sentence.reviewCount + 1,
    lastReviewedAt: reviewedAt,
    updatedAt: reviewedAt,
  }

  const reviewLog: ReviewLog = {
    id: crypto.randomUUID(),
    sentenceId: sentence.id,
    result,
    reviewedAt,
    oldNextReviewAt: sentence.nextReviewAt,
    newNextReviewAt: updatedSentence.nextReviewAt,
  }

  await db.transaction('rw', db.sentences, db.reviewLogs, async () => {
    await db.sentences.put(updatedSentence)
    await db.reviewLogs.add(reviewLog)
  })

  return {
    sentence: updatedSentence,
    reviewLog,
  }
}
