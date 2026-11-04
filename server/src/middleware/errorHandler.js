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

  // anything we didn't throw ourselves is a bug, so don't leak the details outside dev
  if (statusCode === 500) {
    console.error(err)
    if (!isDev) message = 'Something went wrong on the server'
  }

  const body = { success: false, message, errors }
  if (isDev) body.stack = err.stack

  res.status(statusCode).json(body)
}

export default errorHandler
