import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '../components/Header'
import ApplicationForm from '../components/ApplicationForm'
import Board from '../components/Board'
import StatsBar from '../components/StatsBar'
import Pagination from '../components/Pagination'
import { useDebounce } from '../hooks/useDebounce'
import { readError } from '../api/client'
import {
  createApplication,
  deleteApplication,
  fetchApplications,
  fetchStats,
  updateApplication,
} from '../api/applications'
import { STATUSES } from '../constants'

const PAGE_SIZE = 20

function BoardPage() {
  // search, status and page live in the URL, so a refresh (or a shared link) keeps them
  const [searchParams, setSearchParams] = useSearchParams()
  const search = searchParams.get('search') ?? ''
  const status = STATUSES.includes(searchParams.get('status')) ? searchParams.get('status') : ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  // the search box updates instantly, the URL (and the API call) only after typing stops
  const [searchText, setSearchText] = useState(search)
  const debouncedSearch = useDebounce(searchText.trim(), 400)

  const [result, setResult] = useState(null) // { data, total, totalPages, page }
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [stats, setStats] = useState(null)
  const [statsError, setStatsError] = useState('')
  const [pendingIds, setPendingIds] = useState(new Set())
  const [actionError, setActionError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const apps = result?.data ?? []

  function updateParams(changes) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === null || (key === 'page' && value === 1)) next.delete(key)
      else next.set(key, String(value))
    }
    setSearchParams(next)
  }

  // typing a new search goes back to page 1
  useEffect(() => {
    if (debouncedSearch !== search) updateParams({ search: debouncedSearch, page: 1 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch])

  // load the current page whenever the filters, the page or reloadKey change
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError('')

    const params = { page, limit: PAGE_SIZE }
    if (search) params.search = search
    if (status) params.status = status

    fetchApplications(params, controller.signal)
      .then((data) => {
        // deleting the last card on a page leaves it empty, so step back one page
        if (data.data.length === 0 && page > 1 && page > data.totalPages) {
          updateParams({ page: Math.max(1, data.totalPages) })
          return
        }
        setResult(data)
        setLoading(false)
      })
      .catch((err) => {
        const { message, cancelled } = readError(err)
        if (cancelled) return
        setLoadError(message)
        setLoading(false)
      })

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page, reloadKey])

  const loadStats = useCallback(() => {
    setStatsError('')
    fetchStats()
      .then(setStats)
      .catch((err) => setStatsError(readError(err).message))
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  function setPending(id, isPending) {
    setPendingIds((prev) => {
      const next = new Set(prev)
      if (isPending) next.add(id)
      else next.delete(id)
      return next
    })
  }

  // ADD: wait for the server, then refetch.
  // The new card's position, page count and totals all depend on the server, so refetching is simplest.
  async function handleAdd(newApp) {
    setActionError('')
    try {
      await createApplication(newApp)
    } catch (err) {
      throw readError(err) // ApplicationForm shows the field errors
    }
    if (page !== 1) updateParams({ page: 1 }) // newest first, so it's on page 1
    else setReloadKey((k) => k + 1)
    loadStats()
  }

  // MOVE / REJECT: optimistic update.
  // The card moves on screen straight away. If the API says no, put it back and show why.
  async function changeStatus(app, newStatus) {
    const oldStatus = app.status
    setActionError('')
    setPending(app._id, true)
    setResult((prev) => ({
      ...prev,
      data: prev.data.map((a) => (a._id === app._id ? { ...a, status: newStatus } : a)),
    }))

    try {
      const saved = await updateApplication(app._id, { status: newStatus })
      setResult((prev) => ({ ...prev, data: prev.data.map((a) => (a._id === saved._id ? saved : a)) }))
      // with a status filter on, the card no longer belongs on this list
      if (status) setReloadKey((k) => k + 1)
      loadStats()
    } catch (err) {
      // roll back just this card
      setResult((prev) => ({
        ...prev,
        data: prev.data.map((a) => (a._id === app._id ? { ...a, status: oldStatus } : a)),
      }))
      const { message, cancelled } = readError(err)
      if (!cancelled) setActionError(`Couldn't move ${app.company} to ${newStatus}: ${message}`)
    } finally {
      setPending(app._id, false)
    }
  }

  // DELETE: wait for the server (no undo), then refetch so the page refills from the next one
  async function handleDelete(app) {
    if (!window.confirm(`Delete ${app.role} at ${app.company}?`)) return
    setActionError('')
    setPending(app._id, true)
    try {
      await deleteApplication(app._id)
      setReloadKey((k) => k + 1)
      loadStats()
    } catch (err) {
      setActionError(`Couldn't delete ${app.company}: ${readError(err).message}`)
    } finally {
      setPending(app._id, false)
    }
  }

  const filtering = Boolean(search || status)

  return (
    <div className="app">
      <Header stats={stats} />

      <main className="layout">
        <ApplicationForm onAdd={handleAdd} />

        <section className="board-area">
          <StatsBar stats={stats} error={statsError} />

          <div className="filters">
            <input
              type="search"
              placeholder="Search company or role"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="Search applications"
            />
            <select
              value={status}
              onChange={(e) => updateParams({ status: e.target.value, page: 1 })}
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {actionError && (
            <p className="banner error-banner" role="alert">
              {actionError}
              <button type="button" className="banner-close" onClick={() => setActionError('')} aria-label="Dismiss">
                ×
              </button>
            </p>
          )}

          {loadError ? (
            <div className="state-box">
              <p>Couldn't load your applications. {loadError}</p>
              <button type="button" className="btn-ghost dark" onClick={() => setReloadKey((k) => k + 1)}>
                Try again
              </button>
            </div>
          ) : !result ? (
            <div className="state-box">Loading your applications…</div>
          ) : result.total === 0 ? (
            <div className="state-box">
              {filtering ? (
                <>
                  <p>No applications match these filters.</p>
                  <button
                    type="button"
                    className="btn-ghost dark"
                    onClick={() => {
                      setSearchText('')
                      setSearchParams({})
                    }}
                  >
                    Clear filters
                  </button>
                </>
              ) : (
                <p>No applications yet. Add your first one with the form.</p>
              )}
            </div>
          ) : (
            <div className={loading ? 'board-wrap loading' : 'board-wrap'} aria-busy={loading}>
              <Board
                apps={apps}
                pendingIds={pendingIds}
                onMove={changeStatus}
                onReject={(app) => changeStatus(app, 'Rejected')}
                onDelete={handleDelete}
              />
              <Pagination
                page={result.page}
                totalPages={result.totalPages}
                total={result.total}
                disabled={loading}
                onChange={(p) => updateParams({ page: p })}
              />
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default BoardPage
