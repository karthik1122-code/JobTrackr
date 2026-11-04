import { Router } from 'express'
import User from '../models/User.js'
import asyncHandler from '../utils/asyncHandler.js'

const router = Router()

// GET /api/users  (handy for finding an owner id until login exists)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const users = await User.find().sort({ createdAt: 1 })
    res.status(200).json({ success: true, count: users.length, data: users })
  }),
)

// POST /api/users  { "name": "...", "email": "..." }
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email } = req.body ?? {}
    const user = await User.create({ name, email })
    res.status(201).json({ success: true, data: user })
  }),
)

export default router
