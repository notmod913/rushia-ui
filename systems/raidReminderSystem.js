const { parseRaidViewEmbed, parseRaidViewComponent } = require('../utils/embedParser');
const Reminder = require('../database/Reminder');
const { sendLog, sendError } = require('../utils/logger');
const { checkExistingReminder, createReminderSafe } = require('../utils/reminderDuplicateChecker');

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
      reminderMessage: `<@${userId}>, your raid fatigue has worn off! use </raid attack:1472170030723764364> to attack the boss again.`
    });

    if (result.success) {
      await sendLog('REMINDER_CREATED', { 
        category: 'REMINDER',
        action: 'CREATED',
        type: 'raid',
        userId, 
        guildId: message.guild.id,
        channelId: message.channel.id,
        remindAt: remindAt.toISOString()
      });
    } else if (result.reason !== 'duplicate') {
      await sendError('REMINDER_CREATE_FAILED', { 
        category: 'REMINDER',
        action: 'CREATE_FAILED',
        type: 'raid',
        userId,
        error: result.error.message
      });
    }
  }
}

module.exports = { processRaidMessage };
