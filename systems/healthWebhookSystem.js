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
  
  const embed = new EmbedBuilder()
    .setTitle('🤖 Bot Status Monitor')
    .setColor(0x00ff00)
    .addFields(
      { name: 'Status', value: '🟢 Online', inline: true },
      { name: 'Uptime', value: uptime, inline: true },
      { name: 'Ping', value: `${ping}ms`, inline: true },
      { name: 'Memory', value: `${memUsage} MB / ${memMax} MB`, inline: true },
      { name: 'Commands Used', value: commandCount.toString(), inline: true },
      { name: 'Database', value: '✅ Connected', inline: true },
      { name: 'Last Updated', value: new Date().toLocaleString(), inline: false }
    )
    .setFooter({ text: 'Status Monitor' });
  
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
      console.log('Health webhook posted:', messageId);
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
    console.error('Failed to post/edit health webhook:', error.message);
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
    
    const embed = await createStatusEmbed();
    return message.reply({ embeds: [embed] });
  }
};
