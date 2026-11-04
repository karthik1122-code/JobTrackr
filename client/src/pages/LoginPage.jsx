import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { readError } from '../api/client'

function LoginPage() {
  const { login, notice } = useAuth()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email.trim() || !form.password) {
      setError('Enter your email and password')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await login(form)
      // GuestOnly in App.jsx sends them on to the page they wanted
    } catch (err) {
      setError(readError(err).message)
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="brand auth-brand">
          <span className="logo">JT</span>
          <span>JobTrackr</span>
        </div>
        <h1>Log in</h1>

        {notice && <p className="banner warning">{notice}</p>}
        {location.state?.from && location.state.from !== '/' && !notice && (
          <p className="banner info">Log in to continue.</p>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
          />
        </div>

        {error && <p className="error form-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="auth-switch">
          New here?{' '}
          <Link to="/register" state={location.state}>
            Create an account
          </Link>
        </p>
      </form>
    </main>
  )
}

export default LoginPage
