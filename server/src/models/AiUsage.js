import mongoose from 'mongoose'

// one document per call to the AI provider (a retry is a second call, so it's logged too)
const aiUsageSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    endpoint: { type: String, required: true }, // summarize, rewrite, extract
    model: { type: String, required: true },
    inputTokens: { type: Number, required: true },
    outputTokens: { type: Number, required: true },
    ms: { type: Number, required: true }, // how long the provider took
    cost: { type: Number, required: true }, // USD
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

// /api/ai/usage looks up one user's calls since midnight
aiUsageSchema.index({ user: 1, createdAt: -1 })

export default mongoose.model('AiUsage', aiUsageSchema)
