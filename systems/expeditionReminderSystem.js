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

  const cardSummary = expeditionInfo.cards.map(c => c.cardName).join(', ');
  console.log(`[EXPEDITION] ${expeditionInfo.username}: ${expeditionInfo.cards.length} cards (${cardSummary})`);

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

  // Group cards by time (within 5 second window)
  const timeGroups = {};
  for (const card of expeditionInfo.cards) {
    const remindAt = new Date(Date.now() + card.remainingMillis);
    const timeKey = Math.floor(remindAt.getTime() / 5000); // 5 second buckets
    
    if (!timeGroups[timeKey]) {
      timeGroups[timeKey] = {
        remindAt,
        cards: []
      };
    }
    timeGroups[timeKey].cards.push(card);
  }

  // Create one reminder per time group
  for (const timeKey in timeGroups) {
    const group = timeGroups[timeKey];
    const cardNames = group.cards.map(c => c.cardName).join(', ');
    
    // Use first card's ID as unique identifier
    const existingReminder = await checkExistingReminder(userId, 'expedition', group.cards[0].cardId);
    if (existingReminder) {
      console.log(`[EXPEDITION] Duplicate prevented for user ${userId}`);
      continue;
    }

    const result = await createReminderSafe({
      userId,
      guildId: message.guild.id,
      cardId: group.cards[0].cardId,
      channelId: message.channel.id,
      remindAt: group.remindAt,
      type: 'expedition',
      reminderMessage: group.cards.length > 1
        ? `<@${userId}>, your expedition cards are ready to be claimed!\n**Cards:** ${cardNames}\n-# Use </expeditions:1426499105936379922> to resend your expedition cards.`
        : `<@${userId}>, your expedition cards are ready to be claimed!\n-# Use </expeditions:1426499105936379922> to resend your expedition cards.`
    });

    if (result.success) {
      const timeRemaining = group.cards[0].remainingMillis;
      const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
      const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);
      console.log(`[EXPEDITION REMINDER CREATED] User: ${userId}, ${group.cards.length} card(s), In: ${hours}h ${minutes}m ${seconds}s`);
    } else if (result.reason === 'duplicate') {
      console.log(`[EXPEDITION] Duplicate prevented for user ${userId}`);
    } else {
      await sendError(`[ERROR] Failed to create expedition reminder: ${result.error.message}`);
    }
  }
}

module.exports = { processExpeditionMessage };