import express from 'express'
import cors from 'cors'
import logger from './middleware/logger.js'
import notFound from './middleware/notFound.js'
import errorHandler from './middleware/errorHandler.js'
import applicationRoutes from './routes/applications.js'
import userRoutes from './routes/users.js'
import demoRoutes from './routes/demo.js'

const app = express()

// Order matters here. Express runs middleware top to bottom for every request.

// 1. only the frontend at CLIENT_URL is allowed to call this API from a browser
app.use(cors({ origin: process.env.CLIENT_URL }))

// 2. turns a JSON body into req.body (has to come before the routes that read it)
app.use(express.json())

// 3. logs every request
app.use(logger)

// 4. the routes
app.use('/api/applications', applicationRoutes)
app.use('/api/users', userRoutes)
app.use('/api', demoRoutes)

// 5. nothing above matched, so it's a 404
app.use(notFound)

// 6. error handler goes LAST.
// Express only sends an error to an error handler that comes *after* the place it
// happened. If this was registered first, nothing would be "after" the routes,
// so a thrown ApiError would skip it and fall through to Express's default
// handler: an HTML page (with a stack trace in dev) instead of our JSON shape.
// It also wouldn't catch errors from express.json() for bad JSON bodies.
app.use(errorHandler)

export default app
