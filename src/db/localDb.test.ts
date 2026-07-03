import { beforeEach, describe, expect, it } from 'vitest'
import { clearDatabase, countReviewLogs, listDueSentences, seedDatabase, submitReview } from './localDb'
import { createFixtureSentences } from '../test/fixtures'

describe('localDb', () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it('returns only active due sentences', async () => {
    await seedDatabase(createFixtureSentences())

    const dueSentences = await listDueSentences()

    expect(dueSentences.map((sentence) => sentence.id)).toEqual([
      'empty-meaning',
      'climate',
      'cache',
      'long',
    ])
  })

  it('creates a review log and pushes easy reviews into the future', async () => {
    const fixtureSentences = createFixtureSentences()
    await seedDatabase(fixtureSentences)

    const climateSentence = fixtureSentences.find((sentence) => sentence.id === 'climate')
    if (!climateSentence) {
      throw new Error('Missing climate fixture sentence')
    }

    const updatedReview = await submitReview(climateSentence, 'easy')

    expect(updatedReview.sentence.nextReviewAt > new Date().toISOString()).toBe(true)
    expect(updatedReview.sentence.reviewCount).toBe(climateSentence.reviewCount + 1)
    expect(await countReviewLogs()).toBe(1)
  })
})
