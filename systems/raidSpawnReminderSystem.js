const Reminder = require('../database/Reminder');
const { getUserSettings } = require('../utils/userSettingsManager');
const { sendLog, sendError } = require('../utils/logger');
const { checkExistingReminder, createReminderSafe } = require('../utils/reminderDuplicateChecker');

const LUVI_ID = '1269481871021047891';
const timeoutMap = new Map();

/**
 * Detects raid spawn from message and sets reminder
 */
async function detectAndSetRaidSpawnReminder(message) {
  if (!message.guild || message.author.id !== LUVI_ID) return;
  
  // Log all Luvi messages for debugging
  console.log(`[RAID SPAWN DEBUG] Luvi message detected`);
  console.log(`[RAID SPAWN DEBUG] Message age: ${Date.now() - message.createdTimestamp}ms`);
  console.log(`[RAID SPAWN DEBUG] Has embeds: ${message.embeds.length > 0}`);
  if (message.embeds.length > 0) {
    console.log(`[RAID SPAWN DEBUG] Embed title: ${message.embeds[0].title}`);
  }
  
  if (Date.now() - message.createdTimestamp > 60000) {
    console.log(`[RAID SPAWN DEBUG] Message too old, skipping`);
    return;
  }
  if (!message.embeds.length) {
    console.log(`[RAID SPAWN DEBUG] No embeds found`);
    return;
  }

  const embed = message.embeds[0];
  if (embed.title !== 'Raid Spawned!') {
    console.log(`[RAID SPAWN DEBUG] Not a raid spawn embed (title: ${embed.title})`);
    return;
  }
  
  console.log(`[RAID SPAWN SUCCESS] Raid spawn detected`);

  const userId = message.interactionMetadata?.user?.id || message.interaction?.user?.id;
  if (!userId) {
    console.log(`[RAID SPAWN WARNING] No userId found in interaction`);
    return;
  }
  
  console.log(`[RAID SPAWN SUCCESS] Creating reminder for user ${userId}`);

  const thirtyMinutes = 30 * 60 * 1000;
  const remindAt = new Date(Date.now() + thirtyMinutes);

  const existingReminder = await checkExistingReminder(userId, 'raidSpawn');
  if (existingReminder) {
    console.log(`[RAID SPAWN] Duplicate prevented for user ${userId}`);
    return;
  }

  const result = await createReminderSafe({
    userId,
    guildId: message.guild.id,
    channelId: message.channel.id,
    remindAt,
    type: 'raidSpawn',
    reminderMessage: `<@${userId}>, You can now use </raid spawn:1404667045332910220> to spawn a new raid boss!`
  });

  if (result.success) {
    console.log(`[RAID SPAWN REMINDER CREATED ✅] User: ${userId}, Fires at: ${remindAt.toISOString()}`);
    await sendLog(`[RAID SPAWN REMINDER SET] User: ${userId}, Channel: ${message.channel.id}`, {
      category: 'RAID_SPAWN',
      userId,
      guildId: message.guild.id,
      channelId: message.channel.id
    });
  } else if (result.reason === 'duplicate') {
    console.log(`[RAID SPAWN DUPLICATE] Skipped for user ${userId}`);
    await sendLog(`[RAID SPAWN] Duplicate reminder skipped`, {
      category: 'RAID_SPAWN',
      userId,
      guildId: message.guild.id,
      reason: 'duplicate'
    });
  } else {
    console.error(`[RAID SPAWN ERROR] Failed to create reminder: ${result.error.message}`);
    await sendError(`[RAID SPAWN] Failed to create reminder: ${result.error.message}`, {
      category: 'RAID_SPAWN',
      userId,
      guildId: message.guild.id,
      error: result.error.stack
    });
  }
}

module.exports = { processRaidSpawnMessage: detectAndSetRaidSpawnReminder };
