// npm run explain  ->  runs find({ owner, status: 'Interview' }).explain('executionStats')
// once without the { owner: 1, status: 1 } index and once with it, and prints both
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import User from '../src/models/User.js'
import Application from '../src/models/Application.js'

const INDEX_NAME = 'owner_1_status_1'

// the stage that actually read the data (IXSCAN / COLLSCAN) is the innermost one
function scanStage(stage) {
  return stage.inputStage ? scanStage(stage.inputStage) : stage.stage
}

async function run(label, owner) {
  const result = await Application.find({ owner: owner._id, status: 'Interview' }).explain('executionStats')
  const stats = result.executionStats
  const row = {
    stage: scanStage(result.queryPlanner.winningPlan),
    docsReturned: stats.nReturned,
    docsExamined: stats.totalDocsExamined,
    keysExamined: stats.totalKeysExamined,
    timeMs: stats.executionTimeMillis,
  }
  console.log(`\n${label}`)
  console.table(row)
  return row
}

async function main() {
  await connectDB()
  const owner = await User.findOne({ email: 'karthik@example.com' })
  if (!owner) throw new Error('Run npm run seed first')

  const indexes = await Application.collection.indexes()
  if (indexes.some((i) => i.name === INDEX_NAME)) await Application.collection.dropIndex(INDEX_NAME)

  const before = await run('BEFORE the index', owner)

  await Application.collection.createIndex({ owner: 1, status: 1 }, { name: INDEX_NAME })

  const after = await run('AFTER adding { owner: 1, status: 1 }', owner)

  console.log(
    `\nDocuments examined went from ${before.docsExamined} (${before.stage}) to ${after.docsExamined} (${after.stage}).`,
  )
  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
