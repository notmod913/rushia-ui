const { parseRaidViewEmbed, parseRaidViewComponent } = require('../utils/embedParser');
const Reminder = require('../database/Reminder');
const { sendLog, sendError } = require('../utils/logger');
const { checkDuplicate, createReminderSafe } = require('../utils/reminderDuplicateChecker');

async function processRaidMessage(message) {
  if (!message.guild) return;

  let raidInfo = null;

  // Try parsing components first (new format)
  if (message.components && message.components.length > 0) {
    raidInfo = parseRaidViewComponent(message.components);
  }

  // Fallback to embed parsing (old format)
  if (!raidInfo && message.embeds.length > 0) {
    const embed = message.embeds[0];
    raidInfo = parseRaidViewEmbed(embed);
  }

  if (!raidInfo) return;

  console.log(`[RAID] Processing ${raidInfo.length} fatigued users`);

  for (const fatiguedUser of raidInfo) {
    const { userId, fatigueMillis } = fatiguedUser;
    const remindAt = new Date(Date.now() + fatigueMillis);

    const existingReminder = await checkDuplicate(userId, 'raid');
    if (existingReminder) continue;

    const result = await createReminderSafe({
      userId,
      channelId: message.channel.id,
      remindAt,
      type: 'raid',
      reminderMessage: `<@${userId}>, your raid fatigue has worn off! use </raid attack:1404667045332910220> to attack the boss again.`
    });

    if (result.success) {
      console.log(`[RAID REMINDER CREATED] User: ${userId}, Fires at: ${remindAt.toISOString()}`);
    } else if (result.reason === 'duplicate') {
      console.log(`[RAID] Duplicate prevented for user ${userId}`);
    } else {
      await sendError(`[ERROR] Failed to create raid reminder: ${result.error.message}`);
    }
  }
}

module.exports = { processRaidMessage };