// Express 4 doesn't catch errors from async functions by itself,
// so this passes any rejected promise on to the error handler.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export default asyncHandler
