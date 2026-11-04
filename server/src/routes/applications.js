import { Router } from 'express'
import mongoose from 'mongoose'
import Application, { STATUSES } from '../models/Application.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import allowFields from '../middleware/allowFields.js'
import { protect } from '../middleware/auth.js'

const router = Router()

// every route below needs a logged-in user
router.use(protect)

const EDITABLE = ['company', 'role', 'status', 'appliedOn', 'priority', 'salary']
const OWNER_FIELDS = 'name email'

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// query params must be plain strings (?status[$ne]=x would arrive as an object)
function stringParam(query, name, errors) {
  const value = query[name]
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    errors[name] = `${name} must be a single value`
    return undefined
  }
  return value
}

// Always starts with { owner: req.user.id }, so a user can only ever see their own data.
// Another user's application simply isn't found, which gives a 404.
function ownFilter(req) {
  return { owner: req.user.id }
}

async function findOwnOr404(req, id) {
  const app = await Application.findOne({ _id: id, ...ownFilter(req) })
  if (!app) throw new ApiError(404, `No application with id ${id}`)
  return app
}

// same company + role for the same owner, ignoring case
async function checkDuplicate(owner, company, role, ignoreId) {
  if (typeof company !== 'string' || typeof role !== 'string') return
  const filter = { owner, company: company.trim(), role: role.trim() }
  // mongoose.trusted tells sanitizeFilter that this $ne is ours, not user input
  if (ignoreId) filter._id = mongoose.trusted({ $ne: ignoreId })

  const existing = await Application.findOne(filter).collation({ locale: 'en', strength: 2 })
  if (existing) {
    throw new ApiError(409, 'This application already exists', {
      role: `You already added ${role.trim()} at ${company.trim()}`,
    })
  }
}

// GET /api/applications?page=2&limit=10&status=Interview&search=google
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const errors = {}
    const status = stringParam(req.query, 'status', errors)
    const search = stringParam(req.query, 'search', errors)
    const pageParam = stringParam(req.query, 'page', errors)
    const limitParam = stringParam(req.query, 'limit', errors)

    const page = pageParam === undefined ? 1 : Number(pageParam)
    const limit = limitParam === undefined ? 10 : Number(limitParam)
    if (status && !STATUSES.includes(status)) errors.status = `status must be one of: ${STATUSES.join(', ')}`
    if (!errors.page && (!Number.isInteger(page) || page < 1)) errors.page = 'page must be a whole number, 1 or more'
    if (!errors.limit && (!Number.isInteger(limit) || limit < 1 || limit > 100)) {
      errors.limit = 'limit must be a whole number from 1 to 100'
    }
    if (Object.keys(errors).length > 0) throw new ApiError(400, 'Invalid query', errors)

    const filter = ownFilter(req)
    if (status) filter.status = status
    if (search) {
      const re = new RegExp(escapeRegex(search), 'i')
      filter.$or = [{ company: re }, { role: re }]
    }

    const [total, data] = await Promise.all([
      Application.countDocuments(filter),
      Application.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('owner', OWNER_FIELDS),
    ])

    res.status(200).json({
      success: true,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      count: data.length,
      data,
    })
  }),
)

// GET /api/applications/stats  (the logged-in user's own numbers)
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const groups = await Application.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(req.user.id) } },
      { $group: { _id: '$status', count: { $sum: 1 }, averageSalary: { $avg: '$salary' } } },
      { $sort: { count: -1 } },
    ])

    const byStatus = {}
    for (const status of STATUSES) byStatus[status] = 0
    for (const g of groups) byStatus[g._id] = g.count
    const offers = groups.find((g) => g._id === 'Offer')

    res.status(200).json({
      success: true,
      data: {
        total: groups.reduce((sum, g) => sum + g.count, 0),
        byStatus,
        averageOfferSalary: offers?.averageSalary ? Math.round(offers.averageSalary) : null,
      },
    })
  }),
)

// GET /api/applications/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const app = await findOwnOr404(req, req.params.id)
    await app.populate('owner', OWNER_FIELDS)
    res.status(200).json({ success: true, data: app })
  }),
)

// POST /api/applications  (owner always comes from the token, never the body)
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { company, role, status, appliedOn, priority, salary } = req.body ?? {}

    await checkDuplicate(req.user.id, company, role)

    const app = await Application.create({ owner: req.user.id, company, role, status, appliedOn, priority, salary })
    await app.populate('owner', OWNER_FIELDS)

    res.status(201).json({ success: true, data: app })
  }),
)

// PATCH /api/applications/:id  (only the fields sent get changed)
router.patch(
  '/:id',
  allowFields(EDITABLE),
  asyncHandler(async (req, res) => {
    const app = await findOwnOr404(req, req.params.id)

    if (req.body.company !== undefined || req.body.role !== undefined) {
      await checkDuplicate(app.owner, req.body.company ?? app.company, req.body.role ?? app.role, app._id)
    }

    app.set(req.body)
    await app.save()
    await app.populate('owner', OWNER_FIELDS)

    res.status(200).json({ success: true, data: app })
  }),
)

// DELETE /api/applications/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const app = await Application.findOneAndDelete({ _id: req.params.id, ...ownFilter(req) })
    if (!app) throw new ApiError(404, `No application with id ${req.params.id}`)
    res.status(204).end()
  }),
)

// POST /api/applications/:id/notes  { "text": "..." }
// The text is saved exactly as typed, even if it contains HTML. That's fine because
// it's only ever shown as text (see "XSS" in the README).
router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const app = await findOwnOr404(req, req.params.id)

    const text = req.body?.text
    if (typeof text !== 'string' || !text.trim()) {
      throw new ApiError(400, 'Validation failed', { text: 'note text is required' })
    }
    if (text.trim().length > 500) {
      throw new ApiError(400, 'Validation failed', { text: 'note must be at most 500 characters' })
    }

    app.notes.push({ text })
    await app.save()
    await app.populate('owner', OWNER_FIELDS)

    res.status(201).json({ success: true, data: app })
  }),
)

export default router
