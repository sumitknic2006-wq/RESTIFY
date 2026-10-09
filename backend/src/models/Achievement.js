const mongoose = require('mongoose');

const achievementSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    achievementId: { type: String, required: true, trim: true },
    unlockedAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

achievementSchema.index(
  { user: 1, achievementId: 1 },
  { unique: true, name: 'one_unlock_per_user_achievement' }
);

module.exports = mongoose.models.Achievement || mongoose.model('Achievement', achievementSchema);
