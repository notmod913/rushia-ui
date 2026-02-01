const { EmbedBuilder } = require('discord.js');
const Reminder = require('../database/Reminder');

async function handlePingCommand(message) {
  try {
    const BOT_OWNER_ID = process.env.BOT_OWNER_ID;
    
    if (message.author.id !== BOT_OWNER_ID) {
      return message.reply('This command is restricted to the bot owner only.');
    }

    const startTime = Date.now();
    const reply = await message.reply('Pinging...');
    const botLatency = Date.now() - startTime;

    // Measure database latency
    const dbStart = Date.now();
    await Reminder.findOne().limit(1);
    const dbLatency = Date.now() - dbStart;

    // WebSocket latency
    const wsLatency = message.client.ws.ping;

    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Bot Latency', value: `${botLatency}ms`, inline: true },
        { name: 'WebSocket', value: `${wsLatency}ms`, inline: true },
        { name: 'Database', value: `${dbLatency}ms`, inline: true }
      )
      .setFooter({ text: 'Bot latency = Time to send message | DB latency = Query response time' })
      .setTimestamp();

    await reply.edit({ content: null, embeds: [embed] });

  } catch (error) {
    console.error('Error in ping command:', error);
    await message.reply('An error occurred while checking latency.');
  }
}

module.exports = { handlePingCommand };
