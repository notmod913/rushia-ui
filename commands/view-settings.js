const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const BotSettings = require('../database/BotSettings');
const { BOT_OWNER_ID, COLORS } = require('../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('view-settings')
    .setDescription('View current boss tier and card ping roles'),

  async execute(interaction) {
    if (!interaction.inGuild()) {
      return interaction.reply({ content: 'This command can only be used in a server.', flags: 1 << 6 });
    }

    const member = interaction.member;

    const hasPermission =
      member.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
      interaction.user.id === BOT_OWNER_ID;

    if (!hasPermission) {
      return interaction.reply({
        content: '❌ You do not have permission to use this command.',
        flags: 1 << 6,
      });
    }

    try {
      const guildId = interaction.guild.id;
      const settings = await BotSettings.findOne({ guildId });

      if (!settings) {
        return interaction.reply({
          content: '⚠️ No settings found for this server.',
         flags: 1 << 6,
        });
      }

      const multiRoleStatus = settings.multiRoleEnabled ? '✅ Enabled' : '❌ Disabled';
      
      let description = `**Multi-Role System:** ${multiRoleStatus}\n\n`;
      
      if (settings.multiRoleEnabled) {
        // Show tier-specific roles
        description += '**Boss Roles:**\n';
        description += `• Tier 1: ${settings.tier1RoleId ? `<@&${settings.tier1RoleId}>` : '❌ Not set'}\n`;
        description += `• Tier 2: ${settings.tier2RoleId ? `<@&${settings.tier2RoleId}>` : '❌ Not set'}\n`;
        description += `• Tier 3: ${settings.tier3RoleId ? `<@&${settings.tier3RoleId}>` : '❌ Not set'}\n\n`;
        
        description += '**Card Roles:**\n';
        description += `• Common: ${settings.commonRoleId ? `<@&${settings.commonRoleId}>` : '❌ Not set'}\n`;
        description += `• Uncommon: ${settings.uncommonRoleId ? `<@&${settings.uncommonRoleId}>` : '❌ Not set'}\n`;
        description += `• Rare: ${settings.rareRoleId ? `<@&${settings.rareRoleId}>` : '❌ Not set'}\n`;
        description += `• Exotic: ${settings.exoticRoleId ? `<@&${settings.exoticRoleId}>` : '❌ Not set'}\n`;
        description += `• Legendary: ${settings.legendaryRoleId ? `<@&${settings.legendaryRoleId}>` : '❌ Not set'}`;
      } else {
        // Show single roles
        const bossRole = settings.bossRoleId ? `<@&${settings.bossRoleId}>` : '❌ Not set';
        const cardRole = settings.cardPingId ? `<@&${settings.cardPingId}>` : '❌ Not set';
        
        description += `**Boss Role (All Tiers):** ${bossRole}\n`;
        description += `**Card Role (All Rarities):** ${cardRole}`;
      }

      const embed = {
        color: COLORS.INFO,
        title: '📊 Current Role Settings',
        description,
        footer: { text: 'Use /multi-roles to enable/disable multi-role system' }
      };

      await interaction.reply({ embeds: [embed], flags: 1 << 6 });
    } catch (error) {
      console.error(`[ERROR] Failed to view settings: ${error.message}`, error);
      await interaction.reply({ content: '❌ An error occurred while trying to view settings.', flags: 1 << 6 });
    }
  },
};
