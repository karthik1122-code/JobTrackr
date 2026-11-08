import ApiError from '../utils/ApiError.js'
import { costFor } from '../config/pricing.js'

// The ONLY file that knows which AI provider we use (Google Gemini, REST API).
// Routes call callLLM() and get back the same shape whatever the provider is,
// so switching to OpenAI or Anthropic means rewriting this one function.
//
// The key is read from process.env on the server. It never goes to the browser:
// React only ever calls our own /api/ai/* routes.

const DEFAULT_MODEL = 'gemini-3.1-flash-lite'
const TIMEOUT_MS = 30_000

export async function callLLM({ system, user, temperature = 0.2, maxTokens = 1024, schema }) {
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL || DEFAULT_MODEL
  if (!apiKey) throw new ApiError(503, 'AI features are not set up on this server (LLM_API_KEY is missing)')

  const body = {
    systemInstruction: { parts: [{ text: system }] }, // the rules
    contents: [{ role: 'user', parts: [{ text: user }] }], // the input
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  }
  // structured output: the model has to answer with JSON that matches this schema
  if (schema) {
    body.generationConfig.responseMimeType = 'application/json'
    body.generationConfig.responseSchema = schema
  }

  // LLM_BASE_URL is only set when testing against a fake server
  const baseUrl = process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com'
  const started = Date.now()

  let res
  try {
    res = await fetch(`${baseUrl}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new ApiError(502, "The AI provider didn't respond. Please try again.")
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    // log the provider's message for us, but don't send it to the user
    console.error(`[llm] ${res.status} from provider: ${data?.error?.message || 'no message'}`)
    if (res.status === 429) throw new ApiError(429, 'The AI is busy right now. Please try again in a minute.')
    throw new ApiError(502, 'The AI provider returned an error. Please try again.')
  }

  const candidate = data.candidates?.[0]
  const text = (candidate?.content?.parts || []).map((part) => part.text || '').join('').trim()
  const usage = data.usageMetadata || {}
  const inputTokens = usage.promptTokenCount || 0
  // "thinking" tokens are billed as output too
  const outputTokens = (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0)

  return {
    text,
    model,
    inputTokens,
    outputTokens,
    ms: Date.now() - started,
    cost: costFor(model, inputTokens, outputTokens),
    finishReason: candidate?.finishReason,
  }
}
