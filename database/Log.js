const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  level: { type: String, required: true, enum: ['INFO', 'ERROR', 'WARN', 'DEBUG'] },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  guildId: { type: String },
  userId: { type: String },
  channelId: { type: String },
  metadata: { type: Object }
});

// TTL index to auto-delete logs older than 7 days
logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('Log', logSchema, 'logs');