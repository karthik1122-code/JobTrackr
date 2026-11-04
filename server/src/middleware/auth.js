import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'

// checks "Authorization: Bearer <token>" and puts the logged-in user on req.user
export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || ''
  const [type, token] = header.split(' ')

  if (type !== 'Bearer' || !token) {
    throw new ApiError(401, 'Not authorised, no token')
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Not authorised, token expired' : 'Not authorised, invalid token'
    throw new ApiError(401, message)
  }

  // the account might have been deleted since the token was made
  const user = await User.findById(payload.id)
  if (!user) throw new ApiError(401, 'Not authorised, user no longer exists')

  // role comes from the database, not the token, so a changed role takes effect straight away
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role }
  next()
})

// use after protect, e.g. authorize('admin')
export function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, 'Forbidden: you do not have permission to do this'))
    }
    next()
  }
}
