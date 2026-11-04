import { Router } from 'express'
import bcrypt from 'bcrypt'
import User from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import requireStrings from '../middleware/requireStrings.js'
import { loginLimiter } from '../middleware/rateLimit.js'
import { protect } from '../middleware/auth.js'
import { signToken } from '../utils/token.js'

const router = Router()

// a real bcrypt hash of a random string. Used when the email doesn't exist so the
// response takes the same time as a wrong password (no hint that the email is unknown)
const DUMMY_HASH = '$2b$12$Gx4cqTu9aS74cN1YXxIS..tguNnG4uDTC5jDKnLl5N8PjH.1cLQvW'

// POST /api/auth/register  { name, email, password }
router.post(
  '/register',
  requireStrings(['name', 'email', 'password']),
  asyncHandler(async (req, res) => {
    const { name, email, password } = req.body

    // role is never taken from the body, everyone signs up as a normal user
    const user = await User.create({ name, email, password })

    res.status(201).json({ success: true, token: signToken(user), user })
  }),
)

// POST /api/auth/login  { email, password }
// the rate limiter runs first so every attempt counts, even invalid ones
router.post(
  '/login',
  loginLimiter,
  requireStrings(['email', 'password']),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password')
    const passwordOk = user ? await user.comparePassword(password) : await bcrypt.compare(password, DUMMY_HASH)

    // same message for "no such email" and "wrong password"
    if (!user || !passwordOk) throw new ApiError(401, 'Invalid email or password')

    res.status(200).json({ success: true, token: signToken(user), user })
  }),
)

// GET /api/auth/me
router.get(
  '/me',
  protect,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id)
    res.status(200).json({ success: true, user })
  }),
)

export default router
