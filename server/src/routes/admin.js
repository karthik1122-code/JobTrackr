import { Router } from 'express'
import Application, { STATUSES } from '../models/Application.js'
import User from '../models/User.js'
import asyncHandler from '../utils/asyncHandler.js'
import { protect, authorize } from '../middleware/auth.js'

const router = Router()

// logged in AND an admin, otherwise 401 / 403
router.use(protect, authorize('admin'))

// GET /api/admin/stats  (totals across every user)
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [usersByRole, statusGroups, topUsers] = await Promise.all([
      User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),

      Application.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, averageSalary: { $avg: '$salary' } } },
        { $sort: { count: -1 } },
      ]),

      // who has the most applications (only name + email, never passwords)
      Application.aggregate([
        { $group: { _id: '$owner', applications: { $sum: 1 } } },
        { $sort: { applications: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        { $project: { _id: 0, userId: '$_id', name: '$user.name', email: '$user.email', applications: 1 } },
      ]),
    ])

    const users = { total: 0, user: 0, admin: 0 }
    for (const g of usersByRole) {
      users[g._id] = g.count
      users.total += g.count
    }

    const byStatus = {}
    for (const status of STATUSES) byStatus[status] = 0
    for (const g of statusGroups) byStatus[g._id] = g.count
    const offers = statusGroups.find((g) => g._id === 'Offer')

    res.status(200).json({
      success: true,
      data: {
        users,
        applications: {
          total: statusGroups.reduce((sum, g) => sum + g.count, 0),
          byStatus,
          averageOfferSalary: offers?.averageSalary ? Math.round(offers.averageSalary) : null,
        },
        topUsers,
      },
    })
  }),
)

export default router
