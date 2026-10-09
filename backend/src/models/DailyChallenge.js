const mongoose = require('mongoose');

const dailyChallengeSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    challengeId: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    completedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

dailyChallengeSchema.index(
  { user: 1, date: 1 },
  { unique: true, name: 'one_daily_challenge_completion_per_user' }
);

module.exports =
  mongoose.models.DailyChallenge || mongoose.model('DailyChallenge', dailyChallengeSchema);
