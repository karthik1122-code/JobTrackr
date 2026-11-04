import ApiError from '../utils/ApiError.js'

// rejects any body field that isn't in the list (used for PATCH)
function allowFields(fields) {
  return (req, res, next) => {
    const body = req.body
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next(new ApiError(400, 'Request body must be a JSON object'))
    }

    const keys = Object.keys(body)
    if (keys.length === 0) return next(new ApiError(400, 'Send at least one field to update'))

    const errors = {}
    for (const key of keys) {
      if (!fields.includes(key)) errors[key] = `${key} is not an allowed field`
    }
    if (Object.keys(errors).length > 0) return next(new ApiError(400, 'Validation failed', errors))

    next()
  }
}

export default allowFields
