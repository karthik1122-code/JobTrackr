import { Router } from 'express'
import mongoose from 'mongoose'

const router = Router()

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting']

// GET /api/health  used to check the live server (and by Render's health check)
router.get('/', (req, res) => {
  const database = DB_STATES[mongoose.connection.readyState] ?? 'unknown'
  const ok = database === 'connected'

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    uptime: Math.round(process.uptime()), // seconds since the server started
    database,
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
})

export default router
