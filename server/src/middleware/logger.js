// prints something like: GET /api/applications?status=Interview 200 - 3ms
function logger(req, res, next) {
  const start = Date.now()

  // wait until the response has actually been sent so we know the status code
  res.on('finish', () => {
    const ms = Date.now() - start
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${ms}ms`)
  })

  next()
}

export default logger
