const { parseExpeditionEmbed, parseExpeditionComponent } = require('../utils/embedParser');
const Reminder = require('../database/Reminder');
const { sendLog, sendError } = require('../utils/logger');
const { checkExistingReminder, createReminderSafe } = require('../utils/reminderDuplicateChecker');

async function processExpeditionMessage(message) {
  if (!message.guild) return;

  let expeditionInfo = null;
  let userId = message.interaction?.user?.id;

  // Try parsing components first
  if (message.components && message.components.length > 0) {
    expeditionInfo = parseExpeditionComponent(message.components);
    
    // For component format, try to get userId from username if no interaction
    if (!userId && expeditionInfo?.username) {
      try {
        const members = await message.guild.members.fetch({ query: expeditionInfo.username, limit: 1 });
        const member = members.first();
        if (member) {
          userId = member.id;
        }
      } catch (err) {
        // Silent fail
      }
    }
  }

  // Fallback to embed parsing (old format)
  if (!expeditionInfo && message.embeds.length > 0) {
    const embed = message.embeds[0];
    expeditionInfo = parseExpeditionEmbed(embed);
    
    // For embed format, try to get userId from username
    if (!userId && expeditionInfo?.username) {
      try {
        const members = await message.guild.members.fetch({ query: expeditionInfo.username, limit: 1 });
        const member = members.first();
        if (member) userId = member.id;
      } catch (err) {
        // Silent fail
      }
    }
  }

  if (!expeditionInfo) return;

  console.log(`[EXPEDITION] Parsed expedition info:`, expeditionInfo);

  if (!userId && expeditionInfo?.username) {
    try {
      const members = await message.guild.members.fetch({ query: expeditionInfo.username, limit: 1 });
      const member = members.first();
      if (member) userId = member.id;
    } catch (err) {
      console.log(`[EXPEDITION] Failed to fetch member by username: ${expeditionInfo.username}`);
    }
  }

  if (!userId) {
    console.log(`[EXPEDITION] No userId found, skipping. Username: ${expeditionInfo?.username}`);
    return;
  }

  for (const card of expeditionInfo.cards) {
    const remindAt = new Date(Date.now() + card.remainingMillis);
    
    const existingReminder = await checkExistingReminder(userId, 'expedition', card.cardId);
    if (existingReminder) continue;

    const result = await createReminderSafe({
      userId,
      guildId: message.guild.id,
      cardId: card.cardId,
      channelId: message.channel.id,
      remindAt,
      type: 'expedition',
      reminderMessage: `<@${userId}>, your expedition cards are ready to be claimed!\n-# Use </expeditions:1426499105936379922> to resend your expedition cards.`
    });

    if (result.success) {
      const timeRemaining = card.remainingMillis;
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
      console.log(`[EXPEDITION REMINDER CREATED] User: ${userId}, Card: ${card.cardId}, In: ${hours}h ${minutes}m ${seconds}s`);
    } else if (result.reason === 'duplicate') {
      console.log(`[EXPEDITION] Duplicate prevented for user ${userId}, card ${card.cardId}`);
    } else {
      await sendError(`[ERROR] Failed to create expedition reminder: ${result.error.message}`);
    }
  }
}

module.exports = { processExpeditionMessage };