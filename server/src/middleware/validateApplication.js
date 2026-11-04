import ApiError from '../utils/ApiError.js'

export const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']
export const PRIORITIES = ['Low', 'Medium', 'High']
const FIELDS = ['company', 'role', 'status', 'appliedOn', 'priority']

function today() {
  return new Date().toISOString().slice(0, 10)
}

function checkText(value, label) {
  if (typeof value !== 'string' || !value.trim()) return `${label} is required`
  const length = value.trim().length
  if (length < 2 || length > 60) return `${label} must be 2–60 characters`
  return null
}

function checkDate(value) {
  if (!value) return 'appliedOn is required'
  // expect yyyy-mm-dd, same as the date input on the frontend
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(new Date(value))) {
    return 'appliedOn must be a date like 2026-10-20'
  }
  if (value > today()) return "appliedOn can't be in the future"
  return null
}

// Same rules as the Day 3 form.
// For POST every required field must be there. For PATCH (partial: true) we only
// check the fields that were sent, and reject any field we don't know about.
function validateApplication({ partial = false } = {}) {
  return (req, res, next) => {
    const body = req.body
    const errors = {}

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next(new ApiError(400, 'Request body must be a JSON object'))
    }

    for (const key of Object.keys(body)) {
      if (!FIELDS.includes(key)) errors[key] = `${key} is not an allowed field`
    }

    if (partial && Object.keys(body).length === 0) {
      return next(new ApiError(400, 'Send at least one field to update'))
    }

    const has = (field) => !partial || body[field] !== undefined

    if (has('company')) {
      const msg = checkText(body.company, 'company')
      if (msg) errors.company = msg
    }

    if (has('role')) {
      const msg = checkText(body.role, 'role')
      if (msg) errors.role = msg
    }

    if (has('appliedOn')) {
      const msg = checkDate(body.appliedOn)
      if (msg) errors.appliedOn = msg
    }

    // status is optional on create (defaults to Applied)
    if (body.status !== undefined && !STATUSES.includes(body.status)) {
      errors.status = `status must be one of: ${STATUSES.join(', ')}`
    }

    if (has('priority')) {
      if (body.priority === undefined) errors.priority = 'priority is required'
      else if (!PRIORITIES.includes(body.priority)) errors.priority = `priority must be one of: ${PRIORITIES.join(', ')}`
    }

    if (Object.keys(errors).length > 0) {
      return next(new ApiError(400, 'Validation failed', errors))
    }

    next()
  }
}

export default validateApplication
