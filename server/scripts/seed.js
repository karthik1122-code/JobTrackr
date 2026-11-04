// npm run seed  ->  wipes the collections, then adds 2 users, 1 admin and 1,000 random applications
// All seeded accounts use the password: Password123!
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../src/config/db.js'
import User from '../src/models/User.js'
import Application, { PRIORITIES } from '../src/models/Application.js'

const COMPANIES = [
  'Google', 'Microsoft', 'Amazon', 'Razorpay', 'Zerodha', 'Swiggy', 'Zomato', 'Flipkart', 'CRED', 'PhonePe',
  'Meesho', 'Atlassian', 'Adobe', 'Uber', 'Ola', 'Freshworks', 'Postman', 'BrowserStack', 'Groww', 'Juspay',
  'Notion', 'Figma', 'Stripe', 'Vercel', 'Linear',
]
const ROLES = [
  'SDE Intern', 'Frontend Intern', 'Backend Intern', 'Full Stack Intern', 'Data Analyst Intern',
  'ML Intern', 'Product Intern', 'DevOps Intern', 'Mobile Intern', 'QA Intern',
]
const NOTES = ['Applied through referral', 'Recruiter replied', 'Online assessment done', 'Follow up next week', 'HR call scheduled']

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// weighted so it looks like a real job hunt: most stay at Applied, few offers
function randomStatus() {
  const r = Math.random()
  if (r < 0.5) return 'Applied'
  if (r < 0.75) return 'Rejected'
  if (r < 0.93) return 'Interview'
  return 'Offer'
}

function randomDate() {
  const daysAgo = randomInt(0, 365)
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
}

async function seed() {
  await connectDB()

  await Promise.all([User.deleteMany({}), Application.deleteMany({})])

  // create() (not insertMany) so the pre-save hook hashes each password
  const users = await User.create([
    { name: 'Karthik Uppari', email: 'karthik@example.com', password: 'Password123!' },
    { name: 'Asha Rao', email: 'asha@example.com', password: 'Password123!' },
  ])
  // the admin. You can also promote any account by setting role: "admin" on it in Atlas
  const admin = await User.create({ name: 'Admin', email: 'admin@example.com', password: 'Password123!', role: 'admin' })

  const apps = []
  for (let i = 0; i < 1000; i++) {
    const status = randomStatus()
    const app = {
      owner: i % 2 === 0 ? users[0]._id : users[1]._id,
      company: pick(COMPANIES),
      role: `${pick(ROLES)} #${i + 1}`, // number keeps every company + role pair unique
      status,
      appliedOn: randomDate(),
      priority: pick(PRIORITIES),
      notes: Math.random() < 0.3 ? [{ text: pick(NOTES) }] : [],
    }
    // offers (and some interviews) have a monthly stipend in INR
    if (status === 'Offer' || (status === 'Interview' && Math.random() < 0.5)) {
      app.salary = randomInt(20, 120) * 1000
    }
    apps.push(app)
  }

  await Application.insertMany(apps)

  console.log(`Seeded ${users.length} users, 1 admin and ${apps.length} applications`)
  for (const u of [...users, admin]) console.log(`  ${u.email} (${u.role}) password: Password123!`)
  await mongoose.disconnect()
}

seed().catch(async (err) => {
  console.error(err)
  await mongoose.disconnect()
  process.exit(1)
})
