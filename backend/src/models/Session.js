const mongoose = require('mongoose');

const pauseSchema = new mongoose.Schema(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    durationSeconds: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const ruleSnapshotSchema = new mongoose.Schema(
  {
    activity: { type: String, required: true },
    target: { type: String, default: null },
    timeLimit: { type: Number, required: true },
    action: { type: String, required: true },
    message: { type: String, required: true },
    restDuration: { type: Number, required: true },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activeOwner: {
      type: mongoose.Schema.Types.ObjectId,
      default: undefined,
    },
    ruleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rule',
      default: null,
    },
    ruleSnapshot: {
      type: ruleSnapshotSchema,
      default: null,
    },
    restStartedAt: {
      type: Date,
      default: null,
    },
    restEndsAt: {
      type: Date,
      default: null,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: ['active', 'paused', 'completed'],
      default: 'active',
    },
    lastResumedAt: {
      type: Date,
      default: null,
    },
    pauseHistory: {
      type: [pauseSchema],
      default: [],
    },
    durationSeconds: {
      type: Number,
      min: 0,
      default: 0,
      validate: {
        validator: Number.isInteger,
        message: 'Duration must be stored as whole seconds.',
      },
    },
  },
  { timestamps: true, optimisticConcurrency: true }
);

sessionSchema.index({ user: 1, status: 1, startTime: -1 });
sessionSchema.index(
  { activeOwner: 1 },
  { unique: true, sparse: true, name: 'one_open_session_per_user' }
);

module.exports = mongoose.models.Session || mongoose.model('Session', sessionSchema);
