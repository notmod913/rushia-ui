const Reminder = require('../database/Reminder');
const { getUserSettings } = require('../utils/userSettingsManager');
const { sendLog, sendError } = require('../utils/logger');
const { checkExistingReminder, createReminderSafe } = require('../utils/reminderDuplicateChecker');

const LUVI_ID = '1269481871021047891';

/**
 * Detects drop command usage and sets reminder
 */
async function detectAndSetDropReminder(message) {
  if (!message.guild || message.author.id !== LUVI_ID) return;
  if (Date.now() - message.createdTimestamp > 60000) return;
  if (!message.embeds.length) return;

  const embed = message.embeds[0];
  if (!embed.title || !embed.title.toLowerCase().includes('dropped')) return;

  // Extract userId from footer iconURL (Discord.js uses camelCase)
  const footer = embed.footer || embed.data?.footer;
  const iconUrl = footer?.iconURL || footer?.icon_url;
  const userId = iconUrl?.match(/avatars\/(\d+)\//)?.[1];
  if (!userId) return;

  const existingReminder = await checkExistingReminder(userId, 'drop');
  if (existingReminder) {
    console.log(`[DROP] Duplicate prevented for user ${userId}`);
    return;
  }

  const oneHour = 60 * 60 * 1000;
  const remindAt = new Date(Date.now() + oneHour);

  const result = await createReminderSafe({
    userId,
    guildId: message.guild.id,
    channelId: message.channel.id,
    remindAt,
    type: 'drop',
    reminderMessage: `<@${userId}>, You can now use </drop:1464548731549384900> again!`
  });

  if (result.success) {
    console.log(`[DROP REMINDER CREATED] User: ${userId}, Fires at: ${remindAt.toISOString()}`);
    await sendLog(`[DROP REMINDER SET] User: ${userId}, Channel: ${message.channel.id}`, {
      category: 'DROP',
      userId,
      guildId: message.guild.id,
      channelId: message.channel.id
    });
  } else if (result.reason === 'duplicate') {
    console.log(`[DROP] Duplicate prevented for user ${userId}`);
  } else {
    await sendError(`[DROP] Failed to create reminder: ${result.error.message}`, {
      category: 'DROP',
      userId,
      guildId: message.guild.id,
      error: result.error.stack
    });
  }
}

module.exports = { processDropMessage: detectAndSetDropReminder };
