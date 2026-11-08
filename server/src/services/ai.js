import { readFileSync } from 'node:fs'
import mongoose from 'mongoose'
import { callLLM } from './llm.js'
import AiUsage from '../models/AiUsage.js'
import ApiError from '../utils/ApiError.js'

// prompts live in server/prompts/*.txt, not in the code, so they can be changed without touching logic
const prompt = (name) => readFileSync(new URL(`../../prompts/${name}.system.txt`, import.meta.url), 'utf8').trim()
const PROMPTS = {
  summarize: prompt('summarize'),
  'rewrite.zero-shot': prompt('rewrite.zero-shot'),
  'rewrite.few-shot': prompt('rewrite.few-shot'),
  extract: prompt('extract'),
}

// few-shot won the comparison in EXPERIMENTS.md
export const REWRITE_STYLE = 'few-shot'
export const TONES = ['formal', 'confident', 'concise']

// calls the model and saves tokens + cost for this user
async function callAndLog(userId, endpoint, options) {
  const result = await callLLM(options)
  console.log(
    `[ai] ${endpoint} model=${result.model} in=${result.inputTokens} out=${result.outputTokens} ` +
      `time=${result.ms}ms cost=$${result.cost.toFixed(6)}`,
  )
  await AiUsage.create({
    user: userId,
    endpoint,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    ms: result.ms,
    cost: result.cost,
  })
  return result
}

const usageOf = (results) => ({
  inputTokens: results.reduce((sum, r) => sum + r.inputTokens, 0),
  outputTokens: results.reduce((sum, r) => sum + r.outputTokens, 0),
  cost: Number(results.reduce((sum, r) => sum + r.cost, 0).toFixed(6)),
  calls: results.length,
})

// ---------- summarize ----------

const summarySchema = {
  type: 'OBJECT',
  properties: {
    role: { type: 'STRING' },
    mustHaveSkills: { type: 'STRING' },
    niceToHave: { type: 'STRING' },
    responsibilities: { type: 'STRING' },
    redFlags: { type: 'STRING' },
  },
  required: ['role', 'mustHaveSkills', 'niceToHave', 'responsibilities', 'redFlags'],
  propertyOrdering: ['role', 'mustHaveSkills', 'niceToHave', 'responsibilities', 'redFlags'],
}

export async function summarize(userId, jobDescription, { temperature = 0 } = {}) {
  const result = await callAndLog(userId, 'summarize', {
    system: PROMPTS.summarize,
    user: `Job description:\n"""\n${jobDescription}\n"""`,
    temperature,
    schema: summarySchema,
  })

  const s = parseJson(result.text)
  if (!s || summarySchema.required.some((key) => typeof s[key] !== 'string')) {
    throw new ApiError(502, "The AI's answer was in the wrong format. Please try again.")
  }

  return {
    bullets: [
      `Role: ${s.role}`,
      `Must-have skills: ${s.mustHaveSkills}`,
      `Nice-to-haves: ${s.niceToHave}`,
      `Responsibilities: ${s.responsibilities}`,
      `Red flags: ${s.redFlags}`,
    ],
    usage: usageOf([result]),
  }
}

// ---------- rewrite ----------

const MAX_WORDS = 30
const countWords = (text) => text.split(/\s+/).filter(Boolean).length

export async function rewrite(userId, text, tone, { style = REWRITE_STYLE, temperature = 0.3 } = {}) {
  const ask = (extra = '') =>
    callAndLog(userId, 'rewrite', {
      system: PROMPTS[`rewrite.${style}`],
      user: `Tone: ${tone}\nResume line: ${text}${extra}`,
      temperature,
      maxTokens: 200,
    })

  const results = [await ask()]
  let line = cleanLine(results[0].text)

  // the model sometimes goes over 30 words, so ask once more, strictly
  if (countWords(line) > MAX_WORDS) {
    results.push(await ask(`\n\nYour last answer had ${countWords(line)} words. Use ${MAX_WORDS} words or fewer.`))
    line = cleanLine(results[1].text)
  }
  // still too long: cut it, so the "max 30 words" promise always holds
  if (countWords(line) > MAX_WORDS) line = line.split(/\s+/).slice(0, MAX_WORDS).join(' ').replace(/[,;:]$/, '') + '.'
  if (!line) throw new ApiError(502, 'The AI returned an empty answer. Please try again.')

  return { rewritten: line, tone, words: countWords(line), usage: usageOf(results) }
}

// models like to add quotes, a bullet or a "Rewrite:" label
function cleanLine(text) {
  return text
    .split('\n')[0]
    .replace(/^(rewrite|rewritten)\s*:\s*/i, '')
    .replace(/^[-•*]\s*/, '')
    .replace(/^["'“]|["'”]$/g, '')
    .trim()
}

// ---------- extract ----------

const extractSchema = {
  type: 'OBJECT',
  properties: {
    company: { type: 'STRING', nullable: true },
    role: { type: 'STRING', nullable: true },
    location: { type: 'STRING', nullable: true },
    skills: { type: 'ARRAY', items: { type: 'STRING' } },
    minYears: { type: 'NUMBER', nullable: true },
    salaryRange: { type: 'STRING', nullable: true },
  },
  required: ['company', 'role', 'location', 'skills', 'minYears', 'salaryRange'],
  propertyOrdering: ['company', 'role', 'location', 'skills', 'minYears', 'salaryRange'],
}
const FIELDS = extractSchema.required

export async function extract(userId, jobDescription) {
  const results = []

  // try twice: if the JSON is broken or has the wrong fields, ask again once
  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await callAndLog(userId, 'extract', {
      system: PROMPTS.extract,
      user: `Job description:\n"""\n${jobDescription}\n"""`,
      temperature: 0,
      schema: extractSchema,
    })
    results.push(result)

    const details = checkExtract(parseJson(result.text), jobDescription)
    if (details) return { details, usage: usageOf(results) }
    console.warn(`[ai] extract attempt ${attempt} gave invalid JSON`)
  }

  throw new ApiError(502, "The AI couldn't return valid details for this job description after 2 tries. Please try again.")
}

// returns the cleaned object, or null if the shape is wrong
function checkExtract(data, jobDescription) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null

  const keys = Object.keys(data)
  if (keys.length !== FIELDS.length || !FIELDS.every((field) => keys.includes(field))) return null

  const isTextOrNull = (value) => value === null || typeof value === 'string'
  if (!isTextOrNull(data.company) || !isTextOrNull(data.role) || !isTextOrNull(data.location) || !isTextOrNull(data.salaryRange)) return null
  if (!Array.isArray(data.skills) || !data.skills.every((skill) => typeof skill === 'string')) return null
  if (data.minYears !== null && (typeof data.minYears !== 'number' || data.minYears < 0 || data.minYears > 50)) return null

  const blankToNull = (value) => (typeof value === 'string' && value.trim() === '' ? null : value?.trim?.() ?? value)
  const details = {
    company: blankToNull(data.company),
    role: blankToNull(data.role),
    location: blankToNull(data.location),
    skills: [...new Set(data.skills.map((skill) => skill.trim()).filter(Boolean))],
    minYears: data.minYears,
    salaryRange: blankToNull(data.salaryRange),
  }

  // extra guard against a made-up salary: every number in it has to appear in the text
  if (details.salaryRange) {
    const digitsInText = jobDescription.replace(/[,\s]/g, '')
    const numbers = details.salaryRange.replace(/,/g, '').match(/\d+(\.\d+)?/g) || []
    if (numbers.length === 0 || !numbers.every((n) => digitsInText.includes(n))) details.salaryRange = null
  }

  return details
}

function parseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// ---------- usage today ----------

// "today" means since midnight in India (UTC+5:30), where our users are
function startOfTodayIST() {
  const offsetMs = 330 * 60 * 1000
  const ist = new Date(Date.now() + offsetMs)
  ist.setUTCHours(0, 0, 0, 0)
  return new Date(ist.getTime() - offsetMs)
}

export async function usageToday(userId) {
  const since = startOfTodayIST()
  // sanitizeFilter (see db.js) strips $ operators, so mark this server-built one as trusted
  const rows = await AiUsage.find({ user: userId, createdAt: mongoose.trusted({ $gte: since }) }).sort({ createdAt: -1 }).lean()

  const byEndpoint = {}
  for (const row of rows) {
    const e = (byEndpoint[row.endpoint] ??= { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 })
    e.calls++
    e.inputTokens += row.inputTokens
    e.outputTokens += row.outputTokens
    e.cost += row.cost
  }
  for (const e of Object.values(byEndpoint)) e.cost = Number(e.cost.toFixed(6))

  const total = rows.reduce(
    (t, row) => ({
      calls: t.calls + 1,
      inputTokens: t.inputTokens + row.inputTokens,
      outputTokens: t.outputTokens + row.outputTokens,
      cost: t.cost + row.cost,
    }),
    { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 },
  )

  return {
    since: since.toISOString(),
    total: { ...total, totalTokens: total.inputTokens + total.outputTokens, cost: Number(total.cost.toFixed(6)) },
    byEndpoint,
    recent: rows.slice(0, 10).map(({ endpoint, model, inputTokens, outputTokens, ms, cost, createdAt }) => ({
      endpoint,
      model,
      inputTokens,
      outputTokens,
      ms,
      cost,
      createdAt,
    })),
  }
}
