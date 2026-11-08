// USD per 1 million tokens (paid tier), from https://ai.google.dev/gemini-api/docs/pricing
// checked Nov 2026. Update this when you change LLM_MODEL or Google changes its prices.
// (On the free tier you aren't charged, but we still log what it WOULD cost.)
const PRICES = {
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.5 },
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5 },
  'gemini-3.6-flash': { input: 0.75, output: 3.75 },
  'gemini-3.8-flash': { input: 0.75, output: 3.75 },
}

// cost = tokens × price per million / 1,000,000
export function costFor(model, inputTokens, outputTokens) {
  const price = PRICES[model]
  if (!price) {
    console.warn(`[pricing] no price for ${model}, logging cost as 0`)
    return 0
  }
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}
