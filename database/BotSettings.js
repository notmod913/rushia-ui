const mongoose = require('mongoose');

const botSettingsSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  bossRoleId: { type: String },
  cardRoleId: { type: String },
  tier1RoleId: { type: String },
  tier2RoleId: { type: String },
  tier3RoleId: { type: String },
  multiRoleEnabled: { type: Boolean, default: false, index: true }
}, { timestamps: false });

module.exports = mongoose.model('BotSettings', botSettingsSchema, 'guilds');
