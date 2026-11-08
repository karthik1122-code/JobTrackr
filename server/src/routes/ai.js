import express from 'express'
import { protect, authorize } from '../middleware/auth.js'
import { aiLimiter } from '../middleware/rateLimit.js'
import requireStrings from '../middleware/requireStrings.js'
import asyncHandler from '../utils/asyncHandler.js'
import ApiError from '../utils/ApiError.js'
import { summarize, rewrite, extract, usageToday, TONES } from '../services/ai.js'
import { SAMPLE_JOB, JOB_WITHOUT_SALARY, RESUME_LINES } from '../data/aiExperiments.js'

const router = express.Router()

const MAX_CHARS = 6000

// reject long input with 400 BEFORE we pay for a model call
function maxLength(field) {
  return (req, res, next) => {
    const length = req.body[field].trim().length
    if (length > MAX_CHARS) {
      return next(
        new ApiError(400, `${field} is too long`, {
          [field]: `${field} is ${length.toLocaleString('en-IN')} characters. The limit is 6,000.`,
        }),
      )
    }
    next()
  }
}

// every AI route needs a logged-in user (Day 7 auth)
router.use(protect)

router.get(
  '/usage',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await usageToday(req.user.id) })
  }),
)

// the limiter is per user, so one account can't run up the bill
router.post(
  '/summarize',
  aiLimiter,
  requireStrings(['jobDescription']),
  maxLength('jobDescription'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await summarize(req.user.id, req.body.jobDescription.trim()) })
  }),
)

router.post(
  '/rewrite',
  aiLimiter,
  requireStrings(['text', 'tone']),
  maxLength('text'),
  (req, res, next) => {
    if (!TONES.includes(req.body.tone)) {
      return next(new ApiError(400, 'Validation failed', { tone: `tone must be one of: ${TONES.join(', ')}` }))
    }
    next()
  },
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await rewrite(req.user.id, req.body.text.trim(), req.body.tone) })
  }),
)

router.post(
  '/extract',
  aiLimiter,
  requireStrings(['jobDescription']),
  maxLength('jobDescription'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await extract(req.user.id, req.body.jobDescription.trim()) })
  }),
)

// Admin only: runs the experiments written up in EXPERIMENTS.md on the server
// (where the API key is) and returns every answer. 3 + 3 + 6 + 1 = 13 model calls.
router.post(
  '/experiments',
  authorize('admin'),
  asyncHandler(async (req, res) => {
    const id = req.user.id
    const temperature = { 0: [], 1: [] }
    for (const t of [0, 1]) {
      for (let run = 1; run <= 3; run++) temperature[t].push((await summarize(id, SAMPLE_JOB, { temperature: t })).bullets)
    }

    const rewrites = []
    for (const line of RESUME_LINES) {
      const zero = await rewrite(id, line, 'confident', { style: 'zero-shot' })
      const few = await rewrite(id, line, 'confident', { style: 'few-shot' })
      rewrites.push({ line, zeroShot: zero.rewritten, fewShot: few.rewritten })
    }

    const noSalary = await extract(id, JOB_WITHOUT_SALARY)

    res.json({ success: true, data: { temperature, rewrites, noSalary: noSalary.details, usage: await usageToday(id) } })
  }),
)

export default router
