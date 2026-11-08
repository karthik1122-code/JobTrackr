import rateLimit from 'express-rate-limit'
import ApiError from '../utils/ApiError.js'

// 5 login attempts per 15 minutes per IP, the 6th gets a 429
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7', // sends RateLimit and Retry-After headers
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    const minutes = Math.ceil(options.windowMs / 60000)
    next(new ApiError(429, `Too many login attempts. Try again in ${minutes} minutes.`))
  },
})

// AI calls cost money, so each user gets 30 per hour (runs after protect, so we know the user)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  keyGenerator: (req) => req.user.id,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, 'You have used your 30 AI requests for this hour. Try again later.'))
  },
})
