import { useState } from 'react'
import Header from './components/Header'
import ApplicationForm from './components/ApplicationForm'
import Board from './components/Board'
import { NEXT_STATUS, PRIORITIES } from './constants'

const sampleApps = [
  { id: 'a1', company: 'Razorpay', role: 'Frontend Intern', status: 'Applied', appliedOn: '2026-10-20', priority: 'High' },
  { id: 'a2', company: 'Zerodha', role: 'Backend Intern', status: 'Interview', appliedOn: '2026-10-14', priority: 'Medium' },
  { id: 'a3', company: 'Swiggy', role: 'SDE Intern', status: 'Rejected', appliedOn: '2026-10-02', priority: 'Low' },
]

function App() {
  const [apps, setApps] = useState(sampleApps)
  const [search, setSearch] = useState('')
  const [priority, setPriority] = useState('All')

  // Why not apps.push(newApp); setApps(apps)?
  // push changes the same array in place, so the reference doesn't change.
  // React compares old state and new state with Object.is, sees the same
  // array, and skips the re-render. So we always give it a new array instead.
  function addApp(newApp) {
    setApps([newApp, ...apps])
  }

  function moveToNext(id) {
    setApps(
      apps.map((app) =>
        app.id === id && NEXT_STATUS[app.status] ? { ...app, status: NEXT_STATUS[app.status] } : app,
      ),
    )
  }

  function reject(id) {
    setApps(apps.map((app) => (app.id === id ? { ...app, status: 'Rejected' } : app)))
  }

  function deleteApp(id) {
    const app = apps.find((a) => a.id === id)
    if (!window.confirm(`Delete ${app.role} at ${app.company}?`)) return
    setApps(apps.filter((a) => a.id !== id))
  }

  // filtered list is worked out on every render, not kept in state
  const query = search.trim().toLowerCase()
  const visibleApps = apps.filter((app) => {
    const matchesSearch =
      app.company.toLowerCase().includes(query) || app.role.toLowerCase().includes(query)
    const matchesPriority = priority === 'All' || app.priority === priority
    return matchesSearch && matchesPriority
  })

  return (
    <div className="app">
      <Header apps={apps} />

      <main className="layout">
        <ApplicationForm apps={apps} onAdd={addApp} />

        <section className="board-area">
          <div className="filters">
            <input
              type="search"
              placeholder="Search company or role"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search applications"
            />
            <select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Filter by priority">
              <option value="All">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <Board apps={visibleApps} onMove={moveToNext} onReject={reject} onDelete={deleteApp} />
        </section>
      </main>
    </div>
  )
}

export default App
