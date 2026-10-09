const mongoose = require('mongoose');
const { hashPassword, isPasswordHash } = require('../utils/password');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },
    preferences: {
      theme: {
        type: String,
        enum: ['system', 'light', 'dark'],
        default: 'system',
      },
      notifications: {
        achievements: { type: Boolean, default: true },
        challenges: { type: Boolean, default: true },
        goals: { type: Boolean, default: true },
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_document, returned) {
        delete returned.password;
        delete returned.tokenVersion;
        delete returned.__v;
        returned.id = returned._id.toString();
        delete returned._id;
        return returned;
      },
    },
    toObject: {
      transform(_document, returned) {
        delete returned.password;
        delete returned.tokenVersion;
        delete returned.__v;
        returned.id = returned._id.toString();
        delete returned._id;
        return returned;
      },
    },
  }
);

userSchema.pre('save', async function hashUnprotectedPassword() {
  if (this.isModified('password') && !isPasswordHash(this.password)) {
    this.password = await hashPassword(this.password);
  }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
