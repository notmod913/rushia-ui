const { EmbedBuilder } = require('discord.js');

let webhookUrl = null;
let commandCount = 0;
let messageId = null;
let client = null;
const startTime = Date.now();

function getUptimeString() {
  const diff = Date.now() - startTime;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${days}d ${hours}h ${minutes}m`;
}

async function createStatusEmbed() {
  const uptime = getUptimeString();
  const memUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
  const memMax = (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2);
  const ping = client ? client.ws.ping : 0;
  
  // Get database stats
  const DatabaseManager = require('../database/database');
  const Reminder = require('../database/Reminder');
  const dbStats = await DatabaseManager.getStats();
  
  // Get active reminders by type
  const remindersByType = await Reminder.aggregate([
    { $match: { sent: { $ne: true } } },
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);
  
  const reminderCounts = remindersByType.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});
  
  const reminderText = [
    `⚡ Stamina: ${reminderCounts.stamina || 0}`,
    `🗺️ Expedition: ${reminderCounts.expedition || 0}`,
    `⚔️ Raid: ${reminderCounts.raid || 0}`,
    `🔔 Raid Spawn: ${reminderCounts.raidSpawn || 0}`,
    `🎁 Drop: ${reminderCounts.drop || 0}`
  ].join('\n');
  
  const embed = new EmbedBuilder()
    .setTitle('📊 Bot Statistics')
    .setColor(0x5865F2)
    .setDescription(`**🟢 Status**\nUptime: ${uptime} | Ping: ${ping}ms\n\n**💾 Memory**\n${memUsage} MB / ${memMax} MB\n\n**<:db:1471141805327126608> Database**\nGuilds: ${dbStats?.guilds || 0} | Users: ${dbStats?.users || 0}\nLatency: ${0}ms\n\n**⏰ Active Reminders (${dbStats?.activeReminders || 0})**\n${reminderText}\n\n**🎮 Commands Used**\n${commandCount}`)
    .setFooter({ text: `Last Updated: ${new Date().toLocaleString()}` });
  
  return embed;
}

async function postOrEditEmbed() {
  if (!webhookUrl) return;
  
  try {
    const embed = await createStatusEmbed();
    const payload = { embeds: [embed.toJSON()] };
    
    if (!messageId) {
      const response = await fetch(`${webhookUrl}?wait=true`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error('Webhook post failed:', response.status);
        return;
      }
      
      const data = await response.json();
      messageId = data.id;
    } else {
      const webhookParts = webhookUrl.split('/');
      const webhookId = webhookParts[webhookParts.length - 2];
      const webhookToken = webhookParts[webhookParts.length - 1];
      
      const response = await fetch(`https://discord.com/api/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        console.error('Webhook edit failed:', response.status);
        messageId = null;
      }
    }
  } catch (error) {
    // Silent fail
  }
}

module.exports = {
  setWebhookUrl: (url) => {
    webhookUrl = url;
  },

  setClient: (discordClient) => {
    client = discordClient;
  },

  incrementCommandCount: () => {
    commandCount++;
  },

  startHealthPosting: () => {
    postOrEditEmbed();
    setInterval(postOrEditEmbed, 3600000);
  },

  getCommandCount: () => commandCount,

  handleStatsCommand: async (message) => {
    if (message.author.id !== process.env.BOT_OWNER_ID) {
      return message.reply('❌ Only bot owner can use this command');
    }
    
    const loading = await message.reply('<a:loading:1471139633894133812>');
    
    try {
      // Measure latencies
      const Reminder = require('../database/Reminder');
      const dbStart = Date.now();
      await Reminder.findOne().limit(1);
      const dbLatency = Date.now() - dbStart;
      
      const embed = await createStatusEmbed();
      
      // Update database latency in description
      const currentDesc = embed.data.description;
      const updatedDesc = currentDesc.replace('Latency: 0ms', `Latency: ${dbLatency}ms`);
      embed.setDescription(updatedDesc);
      
      await loading.edit({ content: null, embeds: [embed] });
    } catch (error) {
      await loading.edit('❌ Failed to load stats');
    }
  }
};
