import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      minlength: [2, 'name must be 2–60 characters'],
      maxlength: [60, 'name must be 2–60 characters'],
    },
    email: {
      type: String,
      required: [true, 'email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'email is not valid'],
    },
  },
  { timestamps: true },
)

export default mongoose.model('User', userSchema)
