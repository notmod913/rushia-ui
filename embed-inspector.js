const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('ready', () => {
  console.log(`✅ Embed Inspector Bot logged in as ${client.user.tag}`);
  console.log('🔍 Monitoring all embeds...\n');
});

client.on('messageCreate', async (message) => {
  if (!message.embeds.length) return;

  console.log('\n' + '━'.repeat(100));
  console.log(`📨 FROM: ${message.author.tag} | CHANNEL: #${message.channel.name}`);
  console.log(`🔗 ${message.url}`);
  console.log('━'.repeat(100));

  message.embeds.forEach((embed, index) => {
    console.log(`\n╔═══ EMBED #${index + 1} ═══════════════════════════════════════════════════════════════════════`);
    
    const data = embed.data;
    
    // Author
    if (data.author) {
      console.log(`║ 👤 AUTHOR:`);
      console.log(`║    Name: ${data.author.name || 'N/A'}`);
      if (data.author.icon_url) console.log(`║    Icon: ${data.author.icon_url}`);
      if (data.author.url) console.log(`║    URL: ${data.author.url}`);
    }
    
    // Title
    if (data.title) {
      console.log(`║ 📌 TITLE: ${data.title}`);
      if (data.url) console.log(`║    Link: ${data.url}`);
    }
    
    // Description
    if (data.description) {
      console.log(`║ 📝 DESCRIPTION:`);
      console.log(`║    ${data.description.split('\n').join('\n║    ')}`);
    }
    
    // Fields
    if (data.fields && data.fields.length > 0) {
      console.log(`║ 📋 FIELDS (${data.fields.length}):`);
      data.fields.forEach((field, i) => {
        console.log(`║    ┌─ Field ${i + 1} ${field.inline ? '[INLINE]' : ''}`);
        console.log(`║    │ Name: ${field.name}`);
        console.log(`║    │ Value: ${field.value.split('\n').join('\n║    │        ')}`);
        console.log(`║    └─`);
      });
    }
    
    // Thumbnail
    if (data.thumbnail) {
      console.log(`║ 🖼️  THUMBNAIL: ${data.thumbnail.url}`);
    }
    
    // Image
    if (data.image) {
      console.log(`║ 🖼️  IMAGE: ${data.image.url}`);
    }
    
    // Footer
    if (data.footer) {
      console.log(`║ 📍 FOOTER:`);
      console.log(`║    Text: ${data.footer.text}`);
      if (data.footer.icon_url) console.log(`║    Icon: ${data.footer.icon_url}`);
    }
    
    // Timestamp
    if (data.timestamp) {
      console.log(`║ ⏰ TIMESTAMP: ${data.timestamp}`);
    }
    
    // Color
    if (data.color) {
      console.log(`║ 🎨 COLOR: ${data.color} (0x${data.color.toString(16).toUpperCase()})`);
    }
    
    console.log(`╚${'═'.repeat(99)}`);
    
    // Raw JSON
    console.log(`\n📦 RAW JSON:`);
    console.log(JSON.stringify(data, null, 2));
  });
  
  console.log('\n' + '━'.repeat(100) + '\n');
});

client.login(process.env.BOT_TOKEN);
