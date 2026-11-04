// Express knows this is an error handler because it takes 4 arguments.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development'

  let statusCode = err.statusCode || 500
  let message = err.message
  let errors = err.errors || {}

  // express.json() throws this when the body isn't valid JSON
  if (err.type === 'entity.parse.failed') {
    statusCode = 400
    message = 'Request body is not valid JSON'
    errors = {}
  }

  // bad ObjectId, e.g. /api/applications/abc
  if (err.name === 'CastError') {
    const field = err.path === '_id' ? 'id' : err.path
    statusCode = 400
    message = `Invalid ${field}: ${JSON.stringify(err.value)}`
    errors = { [field]: `${JSON.stringify(err.value)} is not a valid id` }
  }

  // schema rules failed, turn Mongoose's errors into { field: message }
  if (err.name === 'ValidationError') {
    statusCode = 400
    message = 'Validation failed'
    errors = {}
    for (const [field, detail] of Object.entries(err.errors)) {
      if (detail.name === 'CastError') {
        errors[field] = detail.kind === 'ObjectId' ? `${field} is not a valid id` : `${field} must be a ${detail.kind.toLowerCase()}`
      } else {
        errors[field] = detail.message
      }
    }
  }

  // unique index broken, e.g. two users with the same email
  if (err.code === 11000) {
    statusCode = 409
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    message = `${field} already exists`
    errors = { [field]: `${err.keyValue?.[field]} is already taken` }
  }

  // anything else is a bug, so don't leak the details outside dev
  if (statusCode === 500) {
    console.error(err)
    if (!isDev) message = 'Something went wrong on the server'
    errors = {}
  }

  const body = { success: false, message, errors }
  if (isDev) body.stack = err.stack

  res.status(statusCode).json(body)
}

export default errorHandler
