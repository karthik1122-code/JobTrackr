import { useAuth } from '../context/AuthContext'

function plural(count, word) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function Header({ stats }) {
  const { user, logout } = useAuth()

  return (
    <header className="header">
      <div className="brand">
        <span className="logo">JT</span>
        <h1>JobTrackr</h1>
      </div>

      {stats && (
        <p className="stats">
          {plural(stats.total, 'application')} · {plural(stats.byStatus.Interview, 'interview')} ·{' '}
          {plural(stats.byStatus.Offer, 'offer')}
        </p>
      )}

      <div className="user-menu">
        <span className="user-name">{user.name}</span>
        <button type="button" className="btn-ghost" onClick={logout}>
          Log out
        </button>
      </div>
    </header>
  )
}

export default Header
