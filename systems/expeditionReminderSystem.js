const { parseExpeditionEmbed, parseExpeditionComponent } = require('../utils/embedParser');
const Reminder = require('../database/Reminder');
const { sendLog, sendError } = require('../utils/logger');

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

  if (!expeditionInfo) {
    console.log('[EXPEDITION] No expedition info parsed from message');
    return;
  }

  console.log(`[EXPEDITION] Parsed expedition for user: ${userId}, cards: ${expeditionInfo.cards?.length || 0}`);

  if (userId) {
    const messageTime = message.createdTimestamp;
    
    for (const card of expeditionInfo.cards) {
      const existingReminder = await Reminder.findOne({ userId, cardId: card.cardId });
      if (!existingReminder) {
        try {
          const remindAt = new Date(messageTime + card.remainingMillis);
          await Reminder.create({
            userId,
            cardId: card.cardId,
            channelId: message.channel.id,
            remindAt,
            type: 'expedition',
            reminderMessage: `<@${userId}>, your expedition cards are ready to be claimed!\n-# Use </expeditions:1426499105936379922> to resend your expedition cards. `, 
          });
        } catch (error) {
          if (error.code !== 11000) {
            await sendError(`[ERROR] Failed to create reminder for expedition: ${error.message}`);
          }
        }
      }
    }
  }
}

module.exports = { processExpeditionMessage };