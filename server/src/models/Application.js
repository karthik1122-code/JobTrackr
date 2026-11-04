import mongoose from 'mongoose'

export const STATUSES = ['Applied', 'Interview', 'Offer', 'Rejected']
export const PRIORITIES = ['Low', 'Medium', 'High']

// notes live inside the application (embedded), they're always read together with it
const noteSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'note text is required'],
      trim: true,
      maxlength: [500, 'note must be at most 500 characters'],
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

const applicationSchema = new mongoose.Schema(
  {
    // the owner is its own collection (referenced), one user has many applications
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'owner is required'],
    },
    company: {
      type: String,
      required: [true, 'company is required'],
      trim: true,
      minlength: [2, 'company must be 2–60 characters'],
      maxlength: [60, 'company must be 2–60 characters'],
    },
    role: {
      type: String,
      required: [true, 'role is required'],
      trim: true,
      minlength: [2, 'role must be 2–60 characters'],
      maxlength: [60, 'role must be 2–60 characters'],
    },
    status: {
      type: String,
      enum: { values: STATUSES, message: `status must be one of: ${STATUSES.join(', ')}` },
      default: 'Applied',
    },
    appliedOn: {
      type: Date,
      required: [true, 'appliedOn is required'],
      validate: {
        validator: (value) => value <= new Date(),
        message: "appliedOn can't be in the future",
      },
    },
    priority: {
      type: String,
      enum: { values: PRIORITIES, message: `priority must be one of: ${PRIORITIES.join(', ')}` },
      default: 'Medium',
    },
    salary: {
      type: Number,
      min: [0, "salary can't be negative"],
    },
    notes: [noteSchema],
  },
  { timestamps: true },
)

// makes "this user's Interview applications" fast (see README for the explain() results)
applicationSchema.index({ owner: 1, status: 1 })

export default mongoose.model('Application', applicationSchema)
