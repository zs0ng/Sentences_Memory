import type { ReviewResult, Sentence } from '../types/sentence'

export function calculateNextReview(
  result: ReviewResult,
  current: Sentence,
): Pick<Sentence, 'nextReviewAt' | 'masteryLevel' | 'easeFactor'> {
  const now = new Date()

  let minutesToAdd = 0
  let masteryDelta = 0
  let easeDelta = 0

  switch (result) {
    case 'forgot':
      minutesToAdd = 10
      masteryDelta = -1
      easeDelta = -0.2
      break
    case 'hard':
      minutesToAdd = 24 * 60
      masteryDelta = 0
      easeDelta = -0.1
      break
    case 'good':
      minutesToAdd = 3 * 24 * 60
      masteryDelta = 1
      break
    case 'easy':
      minutesToAdd = 7 * 24 * 60
      masteryDelta = 2
      easeDelta = 0.1
      break
  }

  const nextReviewAt = new Date(
    now.getTime() + minutesToAdd * 60 * 1000,
  ).toISOString()

  return {
    nextReviewAt,
    masteryLevel: Math.max(0, current.masteryLevel + masteryDelta),
    easeFactor: Math.max(1.3, current.easeFactor + easeDelta),
  }
}
