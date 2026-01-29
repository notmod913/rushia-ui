const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
  userId: { type: String },
  guildId: { type: String },
  cardId: { type: String },
  channelId: { type: String, required: true },
  remindAt: { type: Date, required: true },
  type: { type: String, required: true, enum: ['expedition', 'stamina', 'raid', 'raidSpawn', 'drop'] },
  reminderMessage: { type: String, required: true },
}, { timestamps: false });

// Fast lookup for due reminders
reminderSchema.index({ remindAt: 1 });

// Unique index for expedition reminders (userId + cardId)
reminderSchema.index({ userId: 1, cardId: 1 }, { unique: true, partialFilterExpression: { type: 'expedition' } });

// Unique index for stamina, raid, raidSpawn, and drop reminders (userId + type)
reminderSchema.index({ userId: 1, type: 1 }, { unique: true, partialFilterExpression: { type: { $in: ['stamina', 'raid', 'raidSpawn', 'drop'] } } });

module.exports = mongoose.model('Reminder', reminderSchema, 'reminders');
