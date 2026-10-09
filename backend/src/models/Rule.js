const mongoose = require('mongoose');

const ACTIVITIES = [
  'Instagram',
  'YouTube',
  'Facebook',
  'X',
  'Netflix',
  'Any Website',
  'Custom Website',
];

const ACTIONS = [
  'blur',
  'warning',
  'fullscreen_reminder',
  'countdown',
  'custom_message',
  'restriction',
];

const DOMAIN_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const ruleSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    activity: {
      type: String,
      required: true,
      enum: ACTIVITIES,
    },
    target: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 253,
      validate: {
        validator(value) {
          if (this.activity === 'Custom Website') {
            return typeof value === 'string' && DOMAIN_PATTERN.test(value);
          }
          return value === undefined || value === null || value === '';
        },
        message: 'A valid domain target is required only for a custom website.',
      },
      required() {
        return this.activity === 'Custom Website';
      },
    },
    timeLimit: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
      validate: {
        validator: Number.isInteger,
        message: 'Time limit must be a whole number of minutes.',
      },
    },
    action: {
      type: String,
      required: true,
      enum: ACTIONS,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 500,
    },
    restDuration: {
      type: Number,
      required: true,
      min: 1,
      max: 1440,
      validate: {
        validator: Number.isInteger,
        message: 'Rest duration must be a whole number of minutes.',
      },
    },
    enabled: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

ruleSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.Rule || mongoose.model('Rule', ruleSchema);
