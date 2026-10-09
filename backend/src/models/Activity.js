const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activity: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    target: {
      type: String,
      trim: true,
      maxlength: 253,
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
    durationSeconds: {
      type: Number,
      min: 0,
      default: null,
      validate: {
        validator(value) {
          return value === null || Number.isInteger(value);
        },
        message: 'Duration must be stored as whole seconds.',
      },
    },
    date: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

activitySchema.index({ user: 1, startTime: -1 });
activitySchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { endTime: null },
    name: 'one_active_activity_per_user',
  }
);

module.exports = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
