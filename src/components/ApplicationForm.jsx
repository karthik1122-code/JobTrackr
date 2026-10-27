import { useState } from 'react'
import { PRIORITIES } from '../constants'
import { validate, today } from '../validate'

const emptyForm = {
  company: '',
  role: '',
  appliedOn: '',
  priority: 'Medium',
}

function ApplicationForm({ apps, onAdd }) {
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})

  function handleChange(e) {
    const { name, value } = e.target
    setForm({ ...form, [name]: value })
  }

  function handleSubmit(e) {
    e.preventDefault()

    const found = validate(form, apps)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    onAdd({
      id: crypto.randomUUID(),
      company: form.company.trim(),
      role: form.role.trim(),
      appliedOn: form.appliedOn,
      priority: form.priority,
      status: 'Applied',
    })
    setForm(emptyForm)
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
        <input
          id="appliedOn"
          name="appliedOn"
          type="date"
          max={today()}
          value={form.appliedOn}
          onChange={handleChange}
        />
        {errors.appliedOn && <p className="error">{errors.appliedOn}</p>}
      </div>

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

      <button type="submit" className="btn-primary">
        Add to board
      </button>
    </form>
  )
}

export default ApplicationForm
