import { STATUSES } from '../constants'

// numbers come from GET /api/applications/stats (the Day 6 aggregation route)
function StatsBar({ stats, error }) {
  if (error) return <p className="stats-bar stats-error">Couldn't load stats. {error}</p>
  if (!stats) return <div className="stats-bar stats-loading">Loading stats…</div>

  return (
    <div className="stats-bar">
      {STATUSES.map((status) => (
        <div key={status} className={`stat stat-${status.toLowerCase()}`}>
          <span className="stat-number">{stats.byStatus[status]}</span>
          <span className="stat-label">{status}</span>
        </div>
      ))}
      <div className="stat stat-salary">
        <span className="stat-number">
          {stats.averageOfferSalary ? `₹${stats.averageOfferSalary.toLocaleString('en-IN')}` : '—'}
        </span>
        <span className="stat-label">Avg offer stipend</span>
      </div>
    </div>
  )
}

export default StatsBar
