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
    
    await sendLog(`[RAID SPAWN REMINDER SET] User: ${userId}, Channel: ${message.channel.id}, Message: ${message.url}`);
  } catch (error) {
    if (error.code === 11000) {
      console.log(`[INFO] Suppressed duplicate key error for raid spawn reminder. User: ${userId}`);
    } else {
      console.error(`[ERROR] Failed to create raid spawn reminder: ${error.message}`, error);
      await sendError(`[ERROR] Failed to create raid spawn reminder: ${error.message}`);
    }
  }
}

module.exports = { processRaidSpawnMessage: detectAndSetRaidSpawnReminder };
