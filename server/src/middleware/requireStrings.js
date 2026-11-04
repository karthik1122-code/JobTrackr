import ApiError from '../utils/ApiError.js'

// Blocks NoSQL injection like { "email": { "$ne": null } } before it reaches the database:
// every listed field has to be a plain string.
function requireStrings(fields) {
  return (req, res, next) => {
    const body = req.body ?? {}
    const errors = {}

    for (const field of fields) {
      const value = body[field]
      if (value === undefined || value === null || value === '') errors[field] = `${field} is required`
      else if (typeof value !== 'string') errors[field] = `${field} must be a string`
    }

    if (Object.keys(errors).length > 0) return next(new ApiError(400, 'Validation failed', errors))
    next()
  }
}

export default requireStrings
