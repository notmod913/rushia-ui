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
  console.log(`📝 Usage: @${client.user.tag} <message_id>`);
  console.log('🔍 Waiting for commands...\n');
});

client.on('messageCreate', async (message) => {
  // Check if bot is mentioned
  if (!message.mentions.has(client.user.id)) return;
  
  // Extract message ID from command
  const args = message.content.split(' ').filter(arg => arg !== `<@${client.user.id}>`);
  const messageId = args[0];
  
  if (!messageId) {
    return message.reply('❌ Please provide a message ID!\nUsage: `@bot <message_id>`');
  }
  
  try {
    // Fetch the message
    const targetMessage = await message.channel.messages.fetch(messageId);
    
    await message.reply('✅ Message structure logged to terminal!');
    
    // Log to terminal
    console.log('\n' + '━'.repeat(100));
    console.log(`📨 FROM: ${targetMessage.author.tag} | CHANNEL: #${targetMessage.channel.name}`);
    console.log(`🔗 ${targetMessage.url}`);
    console.log(`📋 Requested by: ${message.author.tag}`);
    console.log('━'.repeat(100));
    
    // Message content
    if (targetMessage.content) {
      console.log(`\n💬 MESSAGE CONTENT:`);
      console.log(targetMessage.content);
    }
    
    // Embeds
    if (targetMessage.embeds.length === 0) {
      console.log('\n⚠️  No embeds found in this message');
      console.log('\n📊 MESSAGE DATA:');
      console.log(`   Content: ${targetMessage.content || 'None'}`);
      console.log(`   Attachments: ${targetMessage.attachments.size}`);
      console.log(`   Components: ${targetMessage.components.length}`);
      console.log(`   Stickers: ${targetMessage.stickers.size}`);
    } else {
      targetMessage.embeds.forEach((embed, index) => {
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
    }
    
    // Components
    if (targetMessage.components.length > 0) {
      console.log('\n🧩 COMPONENTS:');
      console.log(JSON.stringify(targetMessage.components, null, 2));
    }
    
    console.log('\n' + '━'.repeat(100) + '\n');
    
  } catch (error) {
    console.error('Error fetching message:', error);
    message.reply('❌ Could not fetch that message! Make sure the ID is correct and the message is in this channel.');
  }
});

client.login(process.env.BOT_TOKEN);
