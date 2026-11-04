import mongoose from 'mongoose'

// If someone sends { "email": { "$ne": null } }, Mongoose wraps the object in $eq
// so it's treated as a plain value to match, not as a query operator.
mongoose.set('sanitizeFilter', true)

export async function connectDB() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is missing from .env')

  await mongoose.connect(uri)
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`)
}
