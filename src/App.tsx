import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  Archive,
  BookOpen,
  Brain,
  CheckCircle2,
  FilePlus2,
  Filter,
  LayoutDashboard,
  LoaderCircle,
  LogIn,
  LogOut,
  PencilLine,
  RotateCcw,
  Search,
  Trash2,
} from 'lucide-react'
import './App.css'
import {
  countReviewLogs,
  deleteSentence,
  importSentences,
  listActiveSentences,
  listDueSentences,
  submitReview,
  updateSentence,
} from './db/localDb'
import {
  isFirebaseConfigured,
  removeSentenceFromCloud,
  signInWithGoogle,
  signOutFromFirebase,
  subscribeToAuth,
  syncAllData,
  syncReviewLog,
  syncSentence,
  type SyncStatus,
} from './services/cloudSync'
import { parseSentencesFromText } from './utils/parseSentences'
import type { ReviewResult, Sentence } from './types/sentence'
import type { User } from 'firebase/auth'

type DashboardStats = {
  dueCount: number
  totalCount: number
  masteredCount: number
  recentCount: number
  reviewLogCount: number
}

const emptyStats: DashboardStats = {
  dueCount: 0,
  totalCount: 0,
  masteredCount: 0,
  recentCount: 0,
  reviewLogCount: 0,
}

function App() {
  const [sentences, setSentences] = useState<Sentence[]>([])
  const [dueSentences, setDueSentences] = useState<Sentence[]>([])
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState<string>('')
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only')
  const [isAuthLoading, setIsAuthLoading] = useState(isFirebaseConfigured)

  useEffect(() => {
    void refreshData()
  }, [])

  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (user) => {
      setCurrentUser(user)
      setIsAuthLoading(false)

      if (!user) {
        setSyncStatus('local-only')
        return
      }

      setSyncStatus('syncing')
      try {
        await syncAllData(user.uid)
        await refreshData()
        setSyncStatus('synced')
      } catch (error) {
        console.error(error)
        setSyncStatus('sync-failed')
        setNotice('Firebase sync failed.')
      }
    })

    return unsubscribe
  }, [])

  useEffect(() => {
    if (!notice) {
      return undefined
    }

    const timer = window.setTimeout(() => setNotice(''), 2500)
    return () => window.clearTimeout(timer)
  }, [notice])

  async function refreshData() {
    setIsLoading(true)

    const [activeSentences, allDueSentences, reviewLogCount] = await Promise.all([
      listActiveSentences(),
      listDueSentences(),
      countReviewLogs(),
    ])

    setSentences(activeSentences)
    setDueSentences(allDueSentences)
    setStats({
      dueCount: allDueSentences.length,
      totalCount: activeSentences.length,
      masteredCount: activeSentences.filter((sentence) => sentence.masteryLevel >= 5).length,
      recentCount: activeSentences.filter((sentence) => {
        const createdAt = new Date(sentence.createdAt).getTime()
        return Date.now() - createdAt <= 7 * 24 * 60 * 60 * 1000
      }).length,
      reviewLogCount,
    })

    setIsLoading(false)
  }

  async function handleImport(rawText: string) {
    const parsedSentences = parseSentencesFromText(rawText)
    const result = await importSentences(parsedSentences)
    await refreshData()

    if (result.imported === 0) {
      setNotice(`No new sentences imported. Skipped ${result.skipped}.`)
      return result
    }

    setNotice(`Imported ${result.imported} sentence${result.imported > 1 ? 's' : ''}.`)
    return result
  }

  async function handleSave(sentence: Sentence) {
    await updateSentence(sentence)

    if (currentUser) {
      setSyncStatus('syncing')
      try {
        await syncSentence(currentUser.uid, {
          ...sentence,
          updatedAt: new Date().toISOString(),
        })
        setSyncStatus('synced')
      } catch (error) {
        console.error(error)
        setSyncStatus('sync-failed')
      }
    }

    await refreshData()
    setNotice('Sentence saved.')
  }

  async function handleDelete(id: string) {
    await deleteSentence(id)

    if (currentUser) {
      setSyncStatus('syncing')
      try {
        await removeSentenceFromCloud(currentUser.uid, id)
        setSyncStatus('synced')
      } catch (error) {
        console.error(error)
        setSyncStatus('sync-failed')
      }
    }

    await refreshData()
    setNotice('Sentence deleted.')
  }

  async function handleReview(sentence: Sentence, result: ReviewResult) {
    const updated = await submitReview(sentence, result)

    if (currentUser) {
      setSyncStatus('syncing')
      try {
        await Promise.all([
          syncSentence(currentUser.uid, updated.sentence),
          syncReviewLog(currentUser.uid, updated.reviewLog),
        ])
        setSyncStatus('synced')
      } catch (error) {
        console.error(error)
        setSyncStatus('sync-failed')
      }
    }

    await refreshData()
  }

  async function handleSignIn() {
    if (!isFirebaseConfigured) {
      setNotice('Firebase config is missing.')
      return
    }

    setSyncStatus('syncing')
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error(error)
      setSyncStatus('sync-failed')
      setNotice('Google sign-in failed.')
    }
  }

  async function handleSignOut() {
    try {
      await signOutFromFirebase()
      setNotice('Signed out.')
    } catch (error) {
      console.error(error)
      setNotice('Sign-out failed.')
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local-first sentence memorisation</p>
          <h1>Sentence Memory</h1>
        </div>
        <nav className="topnav">
          <NavLinkItem to="/" icon={<LayoutDashboard size={18} />} label="Dashboard" />
          <NavLinkItem to="/import" icon={<FilePlus2 size={18} />} label="Import" />
          <NavLinkItem to="/library" icon={<BookOpen size={18} />} label="Library" />
          <NavLinkItem to="/review" icon={<Brain size={18} />} label="Review" />
        </nav>
        <div className="account-panel">
          <span className={`sync-pill sync-${syncStatus}`}>
            {syncStatusLabel(syncStatus, isAuthLoading)}
          </span>
          {currentUser ? (
            <>
              <span className="user-pill">{currentUser.email}</span>
              <button type="button" className="secondary-button" onClick={() => void handleSignOut()}>
                <LogOut size={16} />
                Sign out
              </button>
            </>
          ) : (
            <button
              type="button"
              className="secondary-button"
              disabled={!isFirebaseConfigured || isAuthLoading}
              onClick={() => void handleSignIn()}
            >
              {isAuthLoading ? <LoaderCircle size={16} className="spin" /> : <LogIn size={16} />}
              Sign in with Google
            </button>
          )}
        </div>
      </header>

      {notice ? <div className="notice">{notice}</div> : null}

      <main className="page-shell">
        <Routes>
          <Route
            path="/"
            element={
              <DashboardPage
                dueCount={stats.dueCount}
                totalCount={stats.totalCount}
                masteredCount={stats.masteredCount}
                recentCount={stats.recentCount}
                reviewLogCount={stats.reviewLogCount}
                isLoading={isLoading}
              />
            }
          />
          <Route path="/import" element={<ImportPage onImport={handleImport} />} />
          <Route
            path="/library"
            element={
              <LibraryPage
                sentences={sentences}
                isLoading={isLoading}
                onSave={handleSave}
                onDelete={handleDelete}
              />
            }
          />
          <Route
            path="/review"
            element={
              <ReviewPage
                dueSentences={dueSentences}
                isLoading={isLoading}
                onReview={handleReview}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function syncStatusLabel(status: SyncStatus, isAuthLoading: boolean) {
  if (isAuthLoading) {
    return 'Checking auth...'
  }

  switch (status) {
    case 'local-only':
      return 'Local only'
    case 'syncing':
      return 'Syncing...'
    case 'synced':
      return 'Synced'
    case 'sync-failed':
      return 'Sync failed'
  }
}

function NavLinkItem({
  to,
  icon,
  label,
}: {
  to: string
  icon: React.ReactNode
  label: string
}) {
  const location = useLocation()
  const isActive = location.pathname === to

  return (
    <Link className={`nav-pill${isActive ? ' is-active' : ''}`} to={to}>
      {icon}
      <span>{label}</span>
    </Link>
  )
}

function DashboardPage({
  dueCount,
  totalCount,
  masteredCount,
  recentCount,
  reviewLogCount,
  isLoading,
}: DashboardStats & { isLoading: boolean }) {
  const cards = [
    { key: 'due', label: 'Due today', value: dueCount, accent: 'accent-red' },
    { key: 'total', label: 'Total sentences', value: totalCount, accent: 'accent-blue' },
    { key: 'mastered', label: 'Mastered', value: masteredCount, accent: 'accent-green' },
    { key: 'recent', label: 'Recent imports', value: recentCount, accent: 'accent-gold' },
  ]

  return (
    <section className="stack">
      <div className="hero-panel">
        <div>
          <p className="eyebrow">MVP dashboard</p>
          <h2>Study from Chinese prompts, reveal the English, then schedule the next review.</h2>
        </div>
        <div className="hero-actions">
          <Link className="primary-button" to="/review">
            Start review
          </Link>
          <Link className="secondary-button" to="/import">
            Import sentences
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        {cards.map((card) => (
          <article key={card.label} className={`stat-card ${card.accent}`}>
            <p>{card.label}</p>
            <strong data-testid={`stat-${card.key}`}>{isLoading ? '...' : card.value}</strong>
          </article>
        ))}
      </div>

      <article className="surface">
        <div className="section-title">
          <h3>Learning snapshot</h3>
          <CheckCircle2 size={18} />
        </div>
        <p className="muted">
          {isLoading
            ? 'Loading local data...'
            : `You have ${dueCount} due sentence${dueCount === 1 ? '' : 's'} and ${reviewLogCount} review log${reviewLogCount === 1 ? '' : 's'} stored locally.`}
        </p>
      </article>
    </section>
  )
}

function ImportPage({
  onImport,
}: {
  onImport: (rawText: string) => Promise<{ imported: number; skipped: number }>
}) {
  const navigate = useNavigate()
  const [rawText, setRawText] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const parsedSentences = useMemo(() => parseSentencesFromText(rawText), [rawText])

  async function handleSubmit() {
    if (parsedSentences.length === 0) {
      return
    }

    setIsSaving(true)
    await onImport(rawText)
    setRawText('')
    setIsSaving(false)
    navigate('/library')
  }

  return (
    <section className="stack">
      <div className="split-panel">
        <article className="surface">
          <div className="section-title">
            <h3>Paste sentences</h3>
            <FilePlus2 size={18} />
          </div>
          <p className="muted">Separate each sentence with a blank line.</p>
          <textarea
            className="editor"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder="Human beings compete with other living things for resources and space."
          />
        </article>

        <article className="surface">
          <div className="section-title">
            <h3>Preview</h3>
            <span className="badge">{parsedSentences.length} detected</span>
          </div>
          <div className="preview-list">
            {parsedSentences.length === 0 ? (
              <p className="muted">Your parsed sentences will appear here.</p>
            ) : (
              parsedSentences.map((sentence, index) => (
                <div key={`${sentence}-${index}`} className="preview-item">
                  <span>{index + 1}</span>
                  <p>{sentence}</p>
                </div>
              ))
            )}
          </div>
        </article>
      </div>

      <button
        type="button"
        className="primary-button align-start"
        disabled={parsedSentences.length === 0 || isSaving}
        onClick={() => void handleSubmit()}
      >
        {isSaving ? 'Importing...' : 'Import to library'}
      </button>
    </section>
  )
}

function LibraryPage({
  sentences,
  isLoading,
  onSave,
  onDelete,
}: {
  sentences: Sentence[]
  isLoading: boolean
  onSave: (sentence: Sentence) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({})
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState('all')

  const tags = useMemo(
    () =>
      Array.from(
        new Set(sentences.flatMap((sentence) => sentence.tags).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [sentences],
  )

  const filteredSentences = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return sentences.filter((sentence) => {
      const matchesTag = selectedTag === 'all' || sentence.tags.includes(selectedTag)
      const haystack = [
        sentence.originalText,
        sentence.chineseMeaning,
        sentence.mnemonic,
        sentence.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()

      const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery)
      return matchesTag && matchesQuery
    })
  }, [query, selectedTag, sentences])

  function toggleReveal(id: string) {
    setRevealedIds((current) => ({
      ...current,
      [id]: !current[id],
    }))
  }

  return (
    <section className="stack">
      <article className="surface">
        <div className="section-title">
          <h3>Sentence library</h3>
          <span className="badge">{filteredSentences.length} shown</span>
        </div>
        <p className="muted">
          {isLoading
            ? 'Loading your local sentence library...'
            : 'Search by English, Chinese, mnemonic, or tags, then reveal only when you want to check recall.'}
        </p>
      </article>

      <article className="surface filter-panel">
        <label className="field">
          <span className="sentence-label">
            <Search size={14} />
            Search
          </span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search English, Chinese, mnemonic, or tags"
          />
        </label>

        <label className="field">
          <span className="sentence-label">
            <Filter size={14} />
            Tag filter
          </span>
          <select value={selectedTag} onChange={(event) => setSelectedTag(event.target.value)}>
            <option value="all">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
      </article>

      <div className="stack">
        {!isLoading && sentences.length === 0 ? (
          <article className="surface empty-state">
            <p>No sentences yet. Import a batch to get started.</p>
            <Link className="secondary-button" to="/import">
              Go to import
            </Link>
          </article>
        ) : null}

        {!isLoading && sentences.length > 0 && filteredSentences.length === 0 ? (
          <article className="surface empty-state">
            <p>No sentences match the current search or tag filter.</p>
          </article>
        ) : null}

        {filteredSentences.map((sentence) => (
          <article key={sentence.id} className="surface sentence-card">
            <div className="sentence-header">
              <div>
                <p className="sentence-label">Chinese meaning</p>
                <p className="sentence-text">{sentence.chineseMeaning || 'No Chinese meaning yet.'}</p>
              </div>
              <div className="sentence-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Edit sentence"
                  onClick={() => setEditingId(sentence.id)}
                >
                  <PencilLine size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Archive sentence"
                  onClick={() => void onSave({ ...sentence, archived: true })}
                >
                  <Archive size={16} />
                </button>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label="Delete sentence"
                  onClick={() => void onDelete(sentence.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <button
              type="button"
              className={`reveal-panel${revealedIds[sentence.id] ? ' is-revealed' : ''}`}
              onClick={() => toggleReveal(sentence.id)}
            >
              <p className="sentence-label">English answer</p>
              <p className="sentence-text">
                {revealedIds[sentence.id] ? sentence.originalText : '████████████████ Click to reveal'}
              </p>
            </button>

            <div className="sentence-meta">
              <span>Mastery {sentence.masteryLevel}</span>
              <span>Reviews {sentence.reviewCount}</span>
              <span>Next {formatDate(sentence.nextReviewAt)}</span>
            </div>

            {sentence.tags.length > 0 ? (
              <div className="tag-row">
                {sentence.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {sentence.mnemonic ? (
              <p className="muted sentence-text">Mnemonic: {sentence.mnemonic}</p>
            ) : null}

            {editingId === sentence.id ? (
              <EditSentenceForm
                sentence={sentence}
                onCancel={() => setEditingId(null)}
                onSave={async (updatedSentence) => {
                  await onSave(updatedSentence)
                  setEditingId(null)
                }}
              />
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

function EditSentenceForm({
  sentence,
  onCancel,
  onSave,
}: {
  sentence: Sentence
  onCancel: () => void
  onSave: (sentence: Sentence) => Promise<void>
}) {
  const [originalText, setOriginalText] = useState(sentence.originalText)
  const [chineseMeaning, setChineseMeaning] = useState(sentence.chineseMeaning)
  const [mnemonic, setMnemonic] = useState(sentence.mnemonic)
  const [tagsText, setTagsText] = useState(sentence.tags.join(', '))

  return (
    <form
      className="edit-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!originalText.trim()) {
          return
        }

        void onSave({
          ...sentence,
          originalText: originalText.trim(),
          chineseMeaning: chineseMeaning.trim(),
          mnemonic: mnemonic.trim(),
          tags: tagsText
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        })
      }}
    >
      <label>
        <span>English</span>
        <textarea value={originalText} onChange={(event) => setOriginalText(event.target.value)} />
      </label>
      <label>
        <span>Chinese meaning</span>
        <textarea
          value={chineseMeaning}
          onChange={(event) => setChineseMeaning(event.target.value)}
        />
      </label>
      <label>
        <span>Mnemonic</span>
        <textarea value={mnemonic} onChange={(event) => setMnemonic(event.target.value)} />
      </label>
      <label>
        <span>Tags</span>
        <input value={tagsText} onChange={(event) => setTagsText(event.target.value)} />
      </label>
      <div className="inline-actions">
        <button type="submit" className="primary-button" disabled={!originalText.trim()}>
          Save
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function ReviewPage({
  dueSentences,
  isLoading,
  onReview,
}: {
  dueSentences: Sentence[]
  isLoading: boolean
  onReview: (sentence: Sentence, result: ReviewResult) => Promise<void>
}) {
  const [revealed, setRevealed] = useState(false)
  const currentSentenceId = dueSentences[0]?.id

  useEffect(() => {
    setRevealed(false)
  }, [currentSentenceId, dueSentences.length])

  if (isLoading) {
    return (
      <section className="surface">
        <p className="muted">Loading due sentences...</p>
      </section>
    )
  }

  if (dueSentences.length === 0) {
    return (
      <section className="surface empty-state">
        <CheckCircle2 size={22} />
        <h3>All done for now</h3>
        <p className="muted">No due sentences at the moment.</p>
        <Link className="secondary-button" to="/library">
          Back to library
        </Link>
      </section>
    )
  }

  const sentence = dueSentences[0]

  return (
    <section className="stack">
      <article className="surface review-card">
        <div className="section-title">
          <h3>Review queue</h3>
          <span className="badge">{dueSentences.length} due</span>
        </div>
        <p className="sentence-label">Chinese meaning</p>
        <h2 className="review-prompt">{sentence.chineseMeaning || 'No meaning yet'}</h2>

        {revealed ? (
          <div className="answer-block">
            <p className="sentence-label">English answer</p>
            <p className="sentence-text">{sentence.originalText}</p>
            {sentence.mnemonic ? <p className="muted sentence-text">Mnemonic: {sentence.mnemonic}</p> : null}
          </div>
        ) : (
          <button type="button" className="primary-button align-start" onClick={() => setRevealed(true)}>
            Reveal answer
          </button>
        )}

        {revealed ? (
          <div className="rating-row">
            {(['forgot', 'hard', 'good', 'easy'] as ReviewResult[]).map((result) => (
              <button
                key={result}
                type="button"
                className="secondary-button"
                onClick={() => void onReview(sentence, result)}
              >
                {result}
              </button>
            ))}
          </div>
        ) : null}
      </article>

      <article className="surface">
        <div className="section-title">
          <h3>Scheduling rules</h3>
          <RotateCcw size={18} />
        </div>
        <p className="muted">forgot: 10 min, hard: 1 day, good: 3 days, easy: 7 days.</p>
      </article>
    </section>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default App
