import type { Sentence } from '../types/sentence'

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString()
}

function hoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function buildSentence(overrides: Partial<Sentence> & Pick<Sentence, 'id' | 'originalText'>): Sentence {
  const baseCreatedAt = hoursAgo(4)
  const { id, originalText, ...rest } = overrides

  return {
    id,
    originalText,
    chineseMeaning: '',
    mnemonic: '',
    chunks: [],
    tags: [],
    masteryLevel: 0,
    reviewCount: 0,
    easeFactor: 2.5,
    createdAt: baseCreatedAt,
    updatedAt: baseCreatedAt,
    nextReviewAt: minutesFromNow(-30),
    archived: false,
    ...rest,
  }
}

export function createFixtureSentences() {
  return [
    buildSentence({
      id: 'empty-meaning',
      originalText: 'Practice makes progress even when the result is not immediate.',
      chineseMeaning: '',
      nextReviewAt: minutesFromNow(-60),
      createdAt: hoursAgo(10),
      updatedAt: hoursAgo(10),
    }),
    buildSentence({
      id: 'climate',
      originalText: 'Most scientists believe that climate change threatens life on Earth.',
      chineseMeaning: '大多数科学家认为气候变化威胁着地球上的生命。',
      mnemonic: '记住 climate change 和 threatens life 的搭配。',
      tags: ['PTE WFD'],
      nextReviewAt: minutesFromNow(-45),
      createdAt: hoursAgo(9),
      updatedAt: hoursAgo(9),
    }),
    buildSentence({
      id: 'cache',
      originalText: "The system's cache improves performance by 25% during peak traffic.",
      chineseMeaning: '系统缓存可以在流量高峰时把性能提升 25%。',
      mnemonic: '抓住 cache, performance, peak traffic 三个关键词。',
      tags: ['Systems'],
      nextReviewAt: minutesFromNow(-30),
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(8),
    }),
    buildSentence({
      id: 'long',
      originalText:
        'Because the committee insisted on documenting every unexpected dependency, every rollback path, every operational exception, and every temporary workaround before release, the migration plan became much longer than anyone expected but still had to remain readable on a single study card.',
      chineseMeaning:
        '因为委员会要求在发布前记录每一个意外依赖、回滚路径、运维异常和临时补丁，所以迁移方案虽然变得异常冗长，但仍然必须在一张学习卡片中保持可读。',
      mnemonic: '把长句拆成 insisted on documenting / before release / remain readable 三段。',
      tags: ['Long Form'],
      nextReviewAt: minutesFromNow(-15),
      createdAt: hoursAgo(7),
      updatedAt: hoursAgo(7),
    }),
    buildSentence({
      id: 'future',
      originalText: 'The final report should include a clear explanation of the methodology.',
      chineseMeaning: '最终报告应当清楚解释研究方法。',
      tags: ['PTE WFD'],
      nextReviewAt: minutesFromNow(24 * 60),
      createdAt: hoursAgo(6),
      updatedAt: hoursAgo(6),
    }),
    buildSentence({
      id: 'mastered',
      originalText: 'Effective communication is a key skill in project management.',
      chineseMeaning: '有效沟通是项目管理中的关键技能。',
      tags: ['Work'],
      masteryLevel: 5,
      reviewCount: 6,
      nextReviewAt: minutesFromNow(48 * 60),
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(5),
    }),
    buildSentence({
      id: 'archived',
      originalText: 'Archived sentences should stay out of the active study flow.',
      chineseMeaning: '已归档句子不应继续出现在主动学习流程里。',
      tags: ['Archive'],
      archived: true,
      nextReviewAt: minutesFromNow(-10),
      createdAt: hoursAgo(4),
      updatedAt: hoursAgo(4),
    }),
  ]
}
