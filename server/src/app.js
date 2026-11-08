import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import logger from './middleware/logger.js'
import notFound from './middleware/notFound.js'
import errorHandler from './middleware/errorHandler.js'
import applicationRoutes from './routes/applications.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import demoRoutes from './routes/demo.js'
import healthRoutes from './routes/health.js'
import aiRoutes from './routes/ai.js'

const app = express()

// On Render (and most hosts) requests come through a proxy. Without this, req.ip would be
// the proxy's IP, so every user would share ONE login rate limit.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

// CLIENT_URL can be one URL or a comma-separated list (e.g. the Vercel URL + localhost)
const allowedOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map((url) => url.trim().replace(/\/$/, ''))
  .filter(Boolean)

// Order matters here. Express runs middleware top to bottom for every request.

// 1. security headers on every response (see README for the list)
app.use(helmet())

// 2. only the frontend at CLIENT_URL is allowed to call this API from a browser
app.use(cors({ origin: allowedOrigins }))

// 3. turns a JSON body into req.body (has to come before the routes that read it).
// The 10kb limit stops someone sending a huge body to tie up the server.
// AI routes get 32kb: 6,000 characters of text like "₹" can be up to 18kb in bytes,
// and we want our own clear "too long" 400 to answer, not a generic 413.
app.use('/api/ai', express.json({ limit: '32kb' }))
app.use(express.json({ limit: '10kb' }))

// 4. logs every request
app.use(logger)

// 5. the routes
app.use('/api/health', healthRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/applications', applicationRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api', demoRoutes)

// 6. nothing above matched, so it's a 404
app.use(notFound)

// 7. error handler goes LAST.
// Express only sends an error to an error handler that comes *after* the place it
// happened. If this was registered first, nothing would be "after" the routes,
// so a thrown ApiError would skip it and fall through to Express's default
// handler: an HTML page (with a stack trace in dev) instead of our JSON shape.
// It also wouldn't catch errors from express.json() for bad JSON bodies.
app.use(errorHandler)

export default app
