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
