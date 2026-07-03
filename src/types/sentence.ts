export type ReviewResult = 'forgot' | 'hard' | 'good' | 'easy'

export interface SentenceChunk {
  text: string
  meaning: string
}

export interface Sentence {
  id: string
  originalText: string
  chineseMeaning: string
  mnemonic: string
  chunks?: SentenceChunk[]
  tags: string[]
  masteryLevel: number
  reviewCount: number
  easeFactor: number
  createdAt: string
  updatedAt: string
  lastReviewedAt?: string
  nextReviewAt: string
  archived: boolean
}

export interface ReviewLog {
  id: string
  sentenceId: string
  result: ReviewResult
  reviewedAt: string
  oldNextReviewAt?: string
  newNextReviewAt: string
}
