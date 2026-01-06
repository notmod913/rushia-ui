const Reminder = require('../database/Reminder');
const { getUserSettings } = require('../utils/userSettingsManager');
const { sendLog, sendError } = require('../utils/logger');

const LUVI_ID = '1269481871021047891';
const timeoutMap = new Map();

/**
 * Detects raid spawn from message and sets reminder
 */
async function detectAndSetRaidSpawnReminder(message) {
  if (!message.guild || message.author.id !== LUVI_ID) return;
  if (Date.now() - message.createdTimestamp > 60000) return;
  if (!message.embeds.length) return;

  const embed = message.embeds[0];
  if (embed.title !== 'Raid Spawned!') return;

  const userId = message.interactionMetadata?.user?.id || message.interaction?.user?.id;
  if (!userId) return;

  const thirtyMinutes = 30 * 60 * 1000;
  const remindAt = new Date(Date.now() + thirtyMinutes);

  try {
    await Reminder.create({
      userId,
      channelId: message.channel.id,
      remindAt,
      type: 'raidSpawn',
      reminderMessage: `<@${userId}>, You can now use </raid spawn:1404667045332910220> to spawn a new raid boss!`
    });
    
    await sendLog(`[RAID SPAWN REMINDER SET] User: ${userId}, Channel: ${message.channel.id}, Message: ${message.url}`, {
      category: 'RAID_SPAWN',
      userId,
      guildId: message.guild.id,
      channelId: message.channel.id
    });
  } catch (error) {
    if (error.code === 11000) {
      await sendLog(`[RAID SPAWN] Duplicate reminder skipped - User already has active reminder`, {
        category: 'RAID_SPAWN',
        userId,
        guildId: message.guild.id,
        channelId: message.channel.id,
        reason: 'duplicate'
      });
    } else {
      await sendError(`[RAID SPAWN] Failed to create reminder: ${error.message}`, {
        category: 'RAID_SPAWN',
        userId,
        guildId: message.guild.id,
        channelId: message.channel.id,
        error: error.stack
      });
    }
  }
}

module.exports = { processRaidSpawnMessage: detectAndSetRaidSpawnReminder };
