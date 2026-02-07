const { parseRaidViewEmbed, parseRaidViewComponent } = require('../utils/embedParser');
const Reminder = require('../database/Reminder');
const { sendLog, sendError } = require('../utils/logger');
const { checkExistingReminder, createReminderSafe } = require('../utils/reminderDuplicateChecker');

async function processRaidMessage(message) {
  if (!message.guild) return;

  // Log all Luvi messages for debugging
  if (message.author.id === '1269481871021047891') {
    console.log(`[RAID DEBUG] Luvi message detected`);
    console.log(`[RAID DEBUG] Has embeds: ${message.embeds.length > 0}`);
    console.log(`[RAID DEBUG] Has components: ${message.components?.length > 0}`);
    if (message.embeds.length > 0) {
      console.log(`[RAID DEBUG] Embed title: ${message.embeds[0].title}`);
    }
  }

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

  if (!raidInfo) {
    if (message.author.id === '1269481871021047891' && (message.embeds.length > 0 || message.components?.length > 0)) {
      console.log(`[RAID DEBUG] Failed to parse - not raid view format`);
    }
    return;
  }

  console.log(`[RAID SUCCESS] Parsed ${raidInfo.length} fatigued users`);

  for (const fatiguedUser of raidInfo) {
    const { userId, fatigueMillis } = fatiguedUser;
    const remindAt = new Date(Date.now() + fatigueMillis);

    const existingReminder = await checkExistingReminder(userId, 'raid');
    if (existingReminder) continue;

    const result = await createReminderSafe({
      userId,
      guildId: message.guild.id,
      channelId: message.channel.id,
      remindAt,
      type: 'raid',
      reminderMessage: `<@${userId}>, your raid fatigue has worn off! use </raid attack:1404667045332910220> to attack the boss again.`
    });

    if (result.success) {
      console.log(`[RAID REMINDER CREATED ✅] User: ${userId}, Fires at: ${remindAt.toISOString()}`);
    } else if (result.reason === 'duplicate') {
      console.log(`[RAID DUPLICATE] Skipped for user ${userId}`);
    } else {
      console.error(`[RAID ERROR] Failed to create reminder: ${result.error.message}`);
      await sendError(`[ERROR] Failed to create raid reminder: ${result.error.message}`);
    }
  }
}

module.exports = { processRaidMessage };