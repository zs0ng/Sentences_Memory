import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import { clearDatabase, countReviewLogs, db, seedDatabase } from './db/localDb'
import { createFixtureSentences } from './test/fixtures'

function renderApp(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: <App />,
      },
    ],
    {
      initialEntries: [path],
    },
  )

  return render(
    <RouterProvider router={router} />,
  )
}

describe('App acceptance flow', () => {
  beforeEach(async () => {
    await clearDatabase()
    await seedDatabase(createFixtureSentences())
  })

  it('shows correct dashboard totals for active and due sentences', async () => {
    renderApp('/')

    await waitFor(() => {
      expect(screen.getByTestId('stat-total')).toHaveTextContent('6')
      expect(screen.getByTestId('stat-due')).toHaveTextContent('4')
      expect(screen.getByTestId('stat-mastered')).toHaveTextContent('1')
    })
  })

  it('supports library search and tag filtering on active sentences only', async () => {
    renderApp('/library')

    await screen.findByRole('heading', { name: 'Sentence library' })
    expect(await screen.findByText('大多数科学家认为气候变化威胁着地球上的生命。')).toBeInTheDocument()
    expect(screen.queryByText('Archived sentences should stay out of the active study flow.')).not.toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('Search English, Chinese, mnemonic, or tags')
    await userEvent.type(searchInput, 'climate')
    expect(screen.getByText('大多数科学家认为气候变化威胁着地球上的生命。')).toBeInTheDocument()
    expect(screen.getByText('1 shown')).toBeInTheDocument()

    await userEvent.clear(searchInput)
    await userEvent.type(searchInput, '缓存')
    expect(screen.getByText('系统缓存可以在流量高峰时把性能提升 25%。')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /click to reveal/i }))
    expect(screen.getByText("The system's cache improves performance by 25% during peak traffic.")).toBeInTheDocument()

    await userEvent.clear(searchInput)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'PTE WFD')
    expect(screen.getByText('大多数科学家认为气候变化威胁着地球上的生命。')).toBeInTheDocument()
    expect(screen.getByText('2 shown')).toBeInTheDocument()
    expect(screen.queryByText('系统缓存可以在流量高峰时把性能提升 25%。')).not.toBeInTheDocument()
  })

  it('keeps long revealed sentences readable inside the library card', async () => {
    renderApp('/library')

    await screen.findByRole('heading', { name: 'Sentence library' })
    await userEvent.type(
      screen.getByPlaceholderText('Search English, Chinese, mnemonic, or tags'),
      'committee insisted',
    )

    await userEvent.click(screen.getByRole('button', { name: /click to reveal/i }))
    expect(
      screen.getByText(/Because the committee insisted on documenting every unexpected dependency/),
    ).toBeInTheDocument()
  })

  it('renders empty Chinese prompts safely and records review logs after an easy review', async () => {
    renderApp('/review')

    await screen.findByRole('heading', { name: 'Review queue' })
    expect(await screen.findByText('No meaning yet')).toBeInTheDocument()
    expect(screen.queryByText('Archived sentences should stay out of the active study flow.')).not.toBeInTheDocument()
    expect(screen.queryByText('The final report should include a clear explanation of the methodology.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Reveal answer' }))
    expect(screen.getByText('Practice makes progress even when the result is not immediate.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'easy' }))

    await waitFor(async () => {
      expect(await countReviewLogs()).toBe(1)
    })

    const reviewedSentence = await db.sentences.get('empty-meaning')
    expect(reviewedSentence?.nextReviewAt && reviewedSentence.nextReviewAt > new Date().toISOString()).toBe(true)
    expect(
      await screen.findByRole('heading', { name: '大多数科学家认为气候变化威胁着地球上的生命。' }),
    ).toBeInTheDocument()
  })
})
