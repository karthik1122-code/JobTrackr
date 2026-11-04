import { Link } from 'react-router-dom'

function NotFound() {
  return (
    <main className="auth-page">
      <div className="auth-card not-found">
        <h1>404</h1>
        <p>This page doesn't exist.</p>
        <Link to="/">Go to your board</Link>
      </div>
    </main>
  )
}

export default NotFound
