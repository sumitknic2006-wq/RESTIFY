const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    category: {
      type: String,
      enum: ['achievements', 'challenges', 'goals'],
      required: true,
    },
    sourceKey: { type: String, required: true, trim: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    readAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index(
  { user: 1, sourceKey: 1 },
  { unique: true, name: 'one_notification_per_user_source' }
);
notificationSchema.index({ user: 1, dismissedAt: 1, createdAt: -1 });

module.exports =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
