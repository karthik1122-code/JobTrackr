import { Router } from 'express'
import mongoose from 'mongoose'
import Application, { STATUSES } from '../models/Application.js'
import User from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import allowFields from '../middleware/allowFields.js'

const router = Router()

const EDITABLE = ['company', 'role', 'status', 'appliedOn', 'priority', 'salary']
const OWNER_FIELDS = 'name email'

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// builds the filter from ?owner=&status=&search=
function buildFilter(query) {
  const filter = {}
  const errors = {}

  if (query.owner) {
    if (!mongoose.isValidObjectId(query.owner)) errors.owner = `${query.owner} is not a valid id`
    else filter.owner = new mongoose.Types.ObjectId(query.owner)
  }
  if (query.status) {
    if (!STATUSES.includes(query.status)) errors.status = `status must be one of: ${STATUSES.join(', ')}`
    else filter.status = query.status
  }
  if (query.search) {
    const re = new RegExp(escapeRegex(query.search), 'i')
    filter.$or = [{ company: re }, { role: re }]
  }

  if (Object.keys(errors).length > 0) throw new ApiError(400, 'Invalid filter', errors)
  return filter
}

async function findOr404(id) {
  const app = await Application.findById(id).populate('owner', OWNER_FIELDS)
  if (!app) throw new ApiError(404, `No application with id ${id}`)
  return app
}

// same company + role for the same owner, ignoring case
async function checkDuplicate(owner, company, role, ignoreId) {
  if (!company || !role) return
  const existing = await Application.findOne({
    owner,
    company: company.trim(),
    role: role.trim(),
    _id: { $ne: ignoreId },
  }).collation({ locale: 'en', strength: 2 })

  if (existing) {
    throw new ApiError(409, 'This application already exists', {
      role: `You already added ${role.trim()} at ${company.trim()}`,
    })
  }
}

// GET /api/applications?page=2&limit=10&status=Interview&search=google&owner=<id>
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query)

    const page = req.query.page === undefined ? 1 : Number(req.query.page)
    const limit = req.query.limit === undefined ? 10 : Number(req.query.limit)
    const errors = {}
    if (!Number.isInteger(page) || page < 1) errors.page = 'page must be a whole number, 1 or more'
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) errors.limit = 'limit must be a whole number from 1 to 100'
    if (Object.keys(errors).length > 0) throw new ApiError(400, 'Invalid pagination', errors)

    // count and page run at the same time
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

// GET /api/applications/stats?owner=<id>
// has to be above /:id, otherwise "stats" would be treated as an id
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const filter = buildFilter({ owner: req.query.owner })

    const groups = await Application.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          averageSalary: { $avg: '$salary' }, // $avg skips documents with no salary
        },
      },
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
    const app = await findOr404(req.params.id)
    res.status(200).json({ success: true, data: app })
  }),
)

// POST /api/applications
// login comes on Day 7, until then the body says who the owner is
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { owner, company, role, status, appliedOn, priority, salary } = req.body ?? {}

    if (owner && mongoose.isValidObjectId(owner) && !(await User.exists({ _id: owner }))) {
      throw new ApiError(404, `No user with id ${owner}`, { owner: 'user not found' })
    }
    if (owner && mongoose.isValidObjectId(owner)) await checkDuplicate(owner, company, role)

    // only these fields are copied in, so nobody can set notes, _id or timestamps directly.
    // create() runs the schema validation, the error handler turns failures into 400s
    const app = await Application.create({ owner, company, role, status, appliedOn, priority, salary })
    await app.populate('owner', OWNER_FIELDS)

    res.status(201).json({ success: true, data: app })
  }),
)

// PATCH /api/applications/:id  (only the fields sent get changed)
router.patch(
  '/:id',
  allowFields(EDITABLE),
  asyncHandler(async (req, res) => {
    const app = await Application.findById(req.params.id)
    if (!app) throw new ApiError(404, `No application with id ${req.params.id}`)

    if (req.body.company !== undefined || req.body.role !== undefined) {
      await checkDuplicate(app.owner, req.body.company ?? app.company, req.body.role ?? app.role, app._id)
    }

    app.set(req.body)
    await app.save() // save() runs the validators again
    await app.populate('owner', OWNER_FIELDS)

    res.status(200).json({ success: true, data: app })
  }),
)

// DELETE /api/applications/:id
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const app = await Application.findByIdAndDelete(req.params.id)
    if (!app) throw new ApiError(404, `No application with id ${req.params.id}`)
    res.status(204).end()
  }),
)

// POST /api/applications/:id/notes  { "text": "..." }
router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const app = await Application.findById(req.params.id)
    if (!app) throw new ApiError(404, `No application with id ${req.params.id}`)

    // check here so the error says "text" instead of Mongoose's "notes.3.text"
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
