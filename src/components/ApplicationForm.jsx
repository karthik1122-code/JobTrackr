import { useState } from 'react'
import { PRIORITIES } from '../constants'
import { validate, today } from '../validate'

const emptyForm = {
  company: '',
  role: '',
  appliedOn: '',
  priority: 'Medium',
  salary: '',
}

// onAdd returns a promise. If it rejects with { message, errors }, we show them here.
function ApplicationForm({ onAdd }) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function handleChange(e) {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    const found = validate(form)
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      await onAdd({
        company: form.company.trim(),
        role: form.role.trim(),
        appliedOn: form.appliedOn,
        priority: form.priority,
        ...(form.salary !== '' && { salary: Number(form.salary) }),
      })
      setForm(emptyForm)
    } catch (err) {
      // server errors go under their field (e.g. a 409 duplicate shows under Role)
      setErrors(err.errors ?? {})
      if (!err.errors || Object.keys(err.errors).length === 0) setMessage(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="app-form" onSubmit={handleSubmit} noValidate>
      <h2>Add application</h2>

      <div className="field">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" value={form.company} onChange={handleChange} />
        {errors.company && <p className="error">{errors.company}</p>}
      </div>

      <div className="field">
        <label htmlFor="role">Role</label>
        <input id="role" name="role" value={form.role} onChange={handleChange} />
        {errors.role && <p className="error">{errors.role}</p>}
      </div>

      <div className="field">
        <label htmlFor="appliedOn">Applied on</label>
        <input id="appliedOn" name="appliedOn" type="date" max={today()} value={form.appliedOn} onChange={handleChange} />
        {errors.appliedOn && <p className="error">{errors.appliedOn}</p>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="priority">Priority</label>
          <select id="priority" name="priority" value={form.priority} onChange={handleChange}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {errors.priority && <p className="error">{errors.priority}</p>}
        </div>

        <div className="field">
          <label htmlFor="salary">Stipend (₹/month)</label>
          <input id="salary" name="salary" type="number" placeholder="Optional" value={form.salary} onChange={handleChange} />
          {errors.salary && <p className="error">{errors.salary}</p>}
        </div>
      </div>

      {message && <p className="error form-error">{message}</p>}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add to board'}
      </button>
    </form>
  )
}

export default ApplicationForm
