const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const helpCategories = {
  overview: {
    title: '🤖 Rushia Bot - Overview',
    description: 'Welcome to Rushia Bot! Select a category from the dropdown below to learn more.',
    fields: [
      { name: '📋 Admin Commands', value: 'Server configuration and role management', inline: true },
      { name: '👤 User Commands', value: 'Personal notification settings', inline: true },
      { name: '🔍 Card Search', value: 'Search through 1000+ cards', inline: true },
      { name: '📊 Leaderboard', value: 'View drop statistics', inline: true },
      { name: '📦 Inventory Helper', value: 'Interactive inventory management', inline: true },
      { name: '🔧 Auto Features', value: 'Automatic detection and reminders', inline: true }
    ]
  },
  admin: {
    title: '📋 Admin Commands',
    description: '*Requires Manage Roles permission*',
    fields: [
      { name: '/set-boss-role [role]', value: 'Set or remove role to ping for all boss spawns' },
      { name: '/multi-roles enable', value: 'Enable separate roles for each boss tier (1, 2, 3)' },
      { name: '/multi-roles disable', value: 'Use single role for all boss tiers' },
      { name: '/multi-roles set-boss', value: 'Set role for specific tier (Tier 1/2/3)' },
      { name: '/view-settings', value: 'View current boss role configuration' }
    ]
  },
  user: {
    title: '👤 User Commands',
    description: 'Manage your personal notification preferences',
    fields: [
      { name: '/notifications view', value: 'View your current notification settings' },
      { name: '/notifications set', value: 'Enable/disable notifications\n**Types:** expedition, stamina, raid, raidSpawnReminder, drop' },
      { name: '/dm enable <type>', value: 'Receive reminders via DM\n**Types:** expedition, stamina, raidSpawn, drop' },
      { name: '/dm disable <type>', value: 'Receive reminders in channel instead of DM' },
      { name: '/suggestion', value: 'Send a suggestion to the bot owner (max 1000 chars)' }
    ]
  },
  search: {
    title: '🔍 Card Search',
    description: 'Search through 1000+ cards using mentions',
    fields: [
      { name: 'Usage', value: '`@bot f <query>` or `@bot find <query>`' },
      { name: 'Examples', value: '• `@bot f naruto` - Find Naruto characters\n• `@bot find fire duelist` - Find fire duelist cards\n• `@bot f bleach ice` - Find ice cards from Bleach' },
      { name: 'Multiple Results', value: 'Type number (1, 2, 3) to select from results' },
      { name: 'Single Result', value: 'Shows card details directly' }
    ]
  },
  leaderboard: {
    title: '📊 Drop Leaderboard',
    description: 'View server drop statistics and rankings',
    fields: [
      { name: 'Usage', value: '`rlb` or `@bot rlb`' },
      { name: 'Features', value: '• Top 10 droppers with total drop counts\n• "Rare Drops" button for Exotic/Legendary stats\n• Admin/Owner can paginate and reset leaderboard' },
      { name: 'Tracking', value: 'Automatically tracks all drops in your server' }
    ]
  },
  inventory: {
    title: '📦 Inventory Helper',
    description: 'Interactive inventory management system',
    fields: [
      { name: '🔍 Command Builder', value: 'React with 🔍 to build custom inventory commands with card selections and filters' },
      { name: '✏️ Card Scraper', value: 'React with ✏️ to extract and organize all cards by rarity from your inventory' },
      { name: 'Features', value: '• Select cards from dropdown\n• Add/remove cards to command\n• Configure filters (rarity, element, type)\n• Auto-updates when you change pages' },
      { name: 'Auto-React', value: 'Bot automatically reacts with 🔍 and ✏️ on inventory embeds' }
    ]
  },
  auto: {
    title: '🔧 Automatic Features',
    description: 'Features that work automatically in the background',
    fields: [
      { name: 'Boss Detection', value: 'Auto-detects all tier boss spawns and pings configured roles' },
      { name: 'Stamina Reminders', value: 'Auto-reminds when stamina refills to configured percentage' },
      { name: 'Expedition Reminders', value: 'Auto-reminds when expeditions complete' },
      { name: 'Raid Reminders', value: 'Reminds when raid fatigue recovers + 30-min spawn reminder' },
      { name: 'Drop Tracking', value: 'Tracks all drops and rare drops (Exotic/Legendary)' }
    ]
  }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows setup instructions for Rushia Bot'),

  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setTitle(helpCategories.overview.title)
      .setDescription(helpCategories.overview.description)
      .addFields(helpCategories.overview.fields)
      .setColor(0x0099ff)
      .setFooter({ text: 'Select a category from the dropdown below' });

    const dropdown = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`help_category_${interaction.user.id}`)
          .setPlaceholder('Select a help category')
          .addOptions([
            { label: 'Overview', value: 'overview', emoji: '🤖', description: 'Main help page' },
            { label: 'Admin Commands', value: 'admin', emoji: '📋', description: 'Server configuration' },
            { label: 'User Commands', value: 'user', emoji: '👤', description: 'Personal settings' },
            { label: 'Card Search', value: 'search', emoji: '🔍', description: 'Search cards' },
            { label: 'Leaderboard', value: 'leaderboard', emoji: '📊', description: 'Drop statistics' },
            { label: 'Inventory Helper', value: 'inventory', emoji: '📦', description: 'Inventory tools' },
            { label: 'Auto Features', value: 'auto', emoji: '🔧', description: 'Automatic features' }
          ])
      );

    await interaction.reply({ embeds: [embed], components: [dropdown], ephemeral: true });
  },
};

async function handleHelpCategory(interaction) {
  if (!interaction.customId.startsWith('help_category_')) return false;

  const userId = interaction.customId.split('_')[2];
  if (interaction.user.id !== userId) {
    await interaction.reply({ content: 'This is not your help menu!', ephemeral: true });
    return true;
  }

  const category = interaction.values[0];
  const categoryData = helpCategories[category];

  const embed = new EmbedBuilder()
    .setTitle(categoryData.title)
    .setDescription(categoryData.description)
    .addFields(categoryData.fields)
    .setColor(0x0099ff)
    .setFooter({ text: 'Select another category to learn more' });

  await interaction.update({ embeds: [embed] });
  return true;
}

module.exports.handleHelpCategory = handleHelpCategory;

async function handleHelpCommand(message) {
  const embed = new EmbedBuilder()
    .setTitle(helpCategories.overview.title)
    .setDescription(helpCategories.overview.description)
    .addFields(helpCategories.overview.fields)
    .setColor(0x0099ff)
    .setFooter({ text: 'Select a category from the dropdown below' });

  const dropdown = new ActionRowBuilder()
    .addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`help_category_${message.author.id}`)
        .setPlaceholder('Select a help category')
        .addOptions([
          { label: 'Overview', value: 'overview', emoji: '🤖', description: 'Main help page' },
          { label: 'Admin Commands', value: 'admin', emoji: '📋', description: 'Server configuration' },
          { label: 'User Commands', value: 'user', emoji: '👤', description: 'Personal settings' },
          { label: 'Card Search', value: 'search', emoji: '🔍', description: 'Search cards' },
          { label: 'Leaderboard', value: 'leaderboard', emoji: '📊', description: 'Drop statistics' },
          { label: 'Inventory Helper', value: 'inventory', emoji: '📦', description: 'Inventory tools' },
          { label: 'Auto Features', value: 'auto', emoji: '🔧', description: 'Automatic features' }
        ])
    );

  await message.reply({ embeds: [embed], components: [dropdown] });
}

module.exports.handleHelpCommand = handleHelpCommand;
