import mongoose from 'mongoose'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

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
    password: {
      type: String,
      required: [true, 'password is required'],
      minlength: [8, 'password must be at least 8 characters'],
      maxlength: [72, 'password must be at most 72 characters'], // bcrypt ignores anything after 72 bytes
      select: false, // never loaded unless a query asks for it with .select('+password')
    },
    role: {
      type: String,
      enum: { values: ['user', 'admin'], message: 'role must be user or admin' },
      default: 'user',
    },
  },
  {
    timestamps: true,
    // extra safety: even if a password was loaded, it never ends up in a JSON response
    toJSON: {
      transform: (doc, ret) => {
        delete ret.password
        delete ret.__v
        return ret
      },
    },
  },
)

// hash the password whenever it's new or changed (validation has already checked the length)
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS)
})

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

export default mongoose.model('User', userSchema)
