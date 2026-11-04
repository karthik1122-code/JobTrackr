import 'dotenv/config'
import app from './app.js'
import { connectDB } from './config/db.js'

const PORT = process.env.PORT || 5000

// only start taking requests once the database is connected
try {
  await connectDB()
  app.listen(PORT, () => {
    console.log(`JobTrackr API running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`)
  })
} catch (err) {
  console.error('Could not connect to MongoDB:', err.message)
  process.exit(1)
}
