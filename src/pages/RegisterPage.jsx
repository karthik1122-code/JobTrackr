import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { readError } from '../api/client'

function validateRegister(form) {
  const errors = {}
  const name = form.name.trim()
  if (name.length < 2 || name.length > 60) errors.name = 'Name must be 2–60 characters'
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email'
  if (form.password.length < 8) errors.password = 'Password must be at least 8 characters'
  return errors
}

function RegisterPage() {
  const { register } = useAuth()
  const location = useLocation()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const found = validateRegister(form)
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await register(form)
    } catch (err) {
      // e.g. 409 { errors: { email: "... is already taken" } }
      const { message: msg, errors: serverErrors } = readError(err)
      setErrors(serverErrors)
      if (Object.keys(serverErrors).length === 0) setMessage(msg)
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
        <h1>Create your account</h1>

        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" autoComplete="name" value={form.name} onChange={handleChange} />
          {errors.name && <p className="error">{errors.name}</p>}
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} />
          {errors.email && <p className="error">{errors.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
          />
          {errors.password && <p className="error">{errors.password}</p>}
        </div>

        {message && <p className="error form-error">{message}</p>}

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-switch">
          Already have an account?{' '}
          <Link to="/login" state={location.state}>
            Log in
          </Link>
        </p>
      </form>
    </main>
  )
}

export default RegisterPage
