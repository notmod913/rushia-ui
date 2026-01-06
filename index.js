require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  const { getCommandCount } = require('./systems/healthWebhookSystem');
  res.json({
    status: 'online',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    commandsUsed: getCommandCount(),
    timestamp: new Date()
  });
});

app.post('/webhook/health', (req, res) => {
  const { setWebhookUrl } = require('./systems/healthWebhookSystem');
  setWebhookUrl(req.body.webhookUrl);
  res.json({ success: true, message: 'Webhook URL set' });
});

// Logs API
const { router: logsRouter } = require('./systems/logsAPI');
app.use('/api', logsRouter);

app.listen(3001, () => console.log('Health check on port 3001'));

if (process.env.HEALTH_WEBHOOK_URL) {
  const { setWebhookUrl } = require('./systems/healthWebhookSystem');
  setWebhookUrl(process.env.HEALTH_WEBHOOK_URL);
}

const { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  Events, 
  PermissionsBitField,
  ActivityType,
  REST,
  Routes
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const { startScheduler } = require('./tasks/reminderScheduler');
const { initializeSettings } = require('./utils/settingsManager');
const { initializeUserSettings } = require('./utils/userSettingsManager');
const DatabaseManager = require('./database/database');
const { sendLog, sendError, initializeLogsDB } = require('./utils/logger');
const { handleCardInventorySystem } = require('./systems/cardInventorySystem');
const { incrementCommandCount, startHealthPosting, setClient } = require('./systems/healthWebhookSystem');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
});

// Load commands from ./commands folder
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command.data && command.execute) {
    client.commands.set(command.data.name, command);
    console.log(`Loaded command: ${command.data.name}`);
  } else {
    console.warn(`Skipped loading ${file}: missing data or execute`);
  }
}

// Load event handlers from ./events folder
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Track command usage
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isCommand()) incrementCommandCount();
});

// Load system handlers for reactions
const { handleGeneratorReaction } = require('./systems/messageGeneratorSystem');

// Handle reactions for generator system and card rarity system
client.on(Events.MessageReactionAdd, async (reaction, user) => {
  await handleGeneratorReaction(reaction, user);
});

// Guild join welcome/setup guide
client.on(Events.GuildCreate, async (guild) => {
  try {
    const defaultChannel = guild.channels.cache
      .filter(ch => 
        ch.type === 0 && 
        ch.permissionsFor(guild.members.me).has(PermissionsBitField.Flags.SendMessages)
      )
      .first();

    if (!defaultChannel) {
      await sendLog(`No accessible text channel found in guild ${guild.name}`, { guildId: guild.id });
      return;
    }

    const guideMessage = `
**Hello! Thanks for adding Rushia!**`;

    await defaultChannel.send(guideMessage);
    await sendLog(`Sent setup guide message in guild ${guild.name}`, { guildId: guild.id });
  } catch (error) {
    await sendError(`Failed to send setup message in guild ${guild.name}: ${error.message}`, { guildId: guild.id });
  }
});

// Deploy slash commands function
async function deployCommands(client) {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js'));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (!command.data) {
      console.error(`❌ Command ${file} is missing data export`);
      continue;
    }
    commands.push(command.data.toJSON());
  }

  const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
  
  if (client && client.user) {
    console.log(`🤖 Bot Name: ${client.user.username}`);
  }

  try {
    console.log(`🔄 Deploying ${commands.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    console.log('✅ Successfully deployed slash commands.');
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
    throw error;
  }
}

// Connect to MongoDB and login the bot
(async () => {
  try {
    await DatabaseManager.connect();
    await DatabaseManager.createIndexes();
    await initializeLogsDB();
    
    // Deploy commands before starting bot
    await deployCommands(client);
    
    // Schedule daily cleanup
    setInterval(() => {
      DatabaseManager.cleanup().catch(console.error);
    }, 24 * 60 * 60 * 1000); // Daily

  client.once(Events.ClientReady, async readyClient => {
        await sendLog(`[${readyClient.user.username}] Bot logged in as ${readyClient.user.tag}`);
        await initializeSettings();
        await initializeUserSettings();
        startScheduler(readyClient);
        handleCardInventorySystem(readyClient);
        setClient(readyClient);
        startHealthPosting();
        
        const activities = [
          { name: 'boss spawns', type: ActivityType.Watching },
          { name: 'raid fatigue', type: ActivityType.Listening },
          { name: 'expeditions', type: ActivityType.Watching },
          { name: 'stamina refills', type: ActivityType.Listening },
          { name: 'card alerts', type: ActivityType.Watching },
          { name: 'game notifications', type: ActivityType.Playing }
        ];
        
        let activityIndex = 0;
        const updateActivity = () => {
          readyClient.user.setActivity(activities[activityIndex].name, { type: activities[activityIndex].type });
          activityIndex = (activityIndex + 1) % activities.length;
        };
        
        updateActivity();
        setInterval(updateActivity, 20000);
        
        console.log(`✅ ${readyClient.user.tag} is online and ready!`);
    });

    await client.login(process.env.BOT_TOKEN);
  } catch (error) {
    console.error('❌ Failed to start bot:', error);
    process.exit(1);
  }
})();
