import { Router } from 'express'

const router = Router()

// Waits 3 seconds without blocking. setTimeout hands the waiting to Node's timers,
// so the event loop is free to handle other requests in the meantime.
router.get('/slow', (req, res) => {
  setTimeout(() => {
    res.json({ success: true, message: 'Done after 3 seconds (non-blocking)' })
  }, 3000)
})

// Spins for 3 seconds. This keeps the single JavaScript thread busy,
// so the event loop can't pick up any other request until it finishes.
router.get('/block', (req, res) => {
  const start = Date.now()
  while (Date.now() - start < 3000) {
    // busy loop, doing nothing on purpose
  }
  res.json({ success: true, message: 'Done after 3 seconds (blocked everything)' })
})

export default router
