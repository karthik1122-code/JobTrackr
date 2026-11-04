import { Router } from 'express'
import ApiError from '../utils/ApiError.js'
import validateApplication, { STATUSES } from '../middleware/validateApplication.js'
import { applications, newId } from '../data/applications.js'

const router = Router()

function findOr404(id) {
  const app = applications.find((a) => a.id === id)
  if (!app) throw new ApiError(404, `No application with id ${id}`)
  return app
}

function isDuplicate(company, role, ignoreId) {
  return applications.some(
    (a) =>
      a.id !== ignoreId &&
      a.company.toLowerCase() === company.trim().toLowerCase() &&
      a.role.toLowerCase() === role.trim().toLowerCase(),
  )
}

// GET /api/applications?status=Interview&search=google
router.get('/', (req, res) => {
  const { status, search } = req.query
  let result = applications

  if (status) {
    if (!STATUSES.includes(status)) {
      throw new ApiError(400, 'Invalid filter', { status: `status must be one of: ${STATUSES.join(', ')}` })
    }
    result = result.filter((a) => a.status === status)
  }

  if (search) {
    const q = search.toLowerCase()
    result = result.filter((a) => a.company.toLowerCase().includes(q) || a.role.toLowerCase().includes(q))
  }

  res.status(200).json({ success: true, count: result.length, data: result })
})

// GET /api/applications/:id
router.get('/:id', (req, res) => {
  const app = findOr404(req.params.id)
  res.status(200).json({ success: true, data: app })
})

// POST /api/applications
router.post('/', validateApplication(), (req, res) => {
  const { company, role, appliedOn, priority, status = 'Applied' } = req.body

  if (isDuplicate(company, role)) {
    throw new ApiError(409, 'This application already exists', {
      role: `You already added ${role.trim()} at ${company.trim()}`,
    })
  }

  const app = {
    id: newId(),
    company: company.trim(),
    role: role.trim(),
    status,
    appliedOn,
    priority,
  }
  applications.push(app)

  res.status(201).json({ success: true, data: app })
})

// PATCH /api/applications/:id  (only the fields sent get changed)
router.patch('/:id', validateApplication({ partial: true }), (req, res) => {
  const app = findOr404(req.params.id)
  const updates = req.body

  const company = updates.company ?? app.company
  const role = updates.role ?? app.role
  if ((updates.company || updates.role) && isDuplicate(company, role, app.id)) {
    throw new ApiError(409, 'This application already exists', { role: `You already added ${role} at ${company}` })
  }

  // validateApplication already rejected unknown fields, so this only copies known ones
  if (updates.company) updates.company = updates.company.trim()
  if (updates.role) updates.role = updates.role.trim()
  Object.assign(app, updates)

  res.status(200).json({ success: true, data: app })
})

// DELETE /api/applications/:id
router.delete('/:id', (req, res) => {
  const app = findOr404(req.params.id)
  applications.splice(applications.indexOf(app), 1)
  res.status(204).end()
})

export default router
