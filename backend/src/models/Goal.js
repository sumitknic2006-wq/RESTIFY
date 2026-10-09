const mongoose = require('mongoose');

const targetHistorySchema = new mongoose.Schema(
  {
    period: { type: String, required: true, enum: ['daily', 'weekly'] },
    targetMinutes: { type: Number, required: true, min: 1 },
    effectiveFrom: { type: Date, required: true },
  },
  { _id: false }
);

const goalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    period: { type: String, required: true, enum: ['daily', 'weekly'] },
    targetMinutes: {
      type: Number,
      required: true,
      min: 1,
      max: 10080,
      validate: {
        validator: Number.isInteger,
        message: 'Goal duration must be a whole number of minutes.',
      },
    },
    isActive: { type: Boolean, default: true, required: true },
    targetHistory: { type: [targetHistorySchema], default: [] },
  },
  { timestamps: true }
);

goalSchema.index({ user: 1, period: 1, updatedAt: -1 });

module.exports = mongoose.models.Goal || mongoose.model('Goal', goalSchema);
