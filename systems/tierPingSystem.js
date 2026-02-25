const { parseBossEmbed, parseBossComponent } = require('../utils/embedParser');
const { getSettings } = require('../utils/settingsManager');
const { sendLog, sendError } = require('../utils/logger');
const { getRoleDelay } = require('../utils/roleDelayManager');
const { PermissionsBitField } = require('discord.js');

async function processBossMessage(message) {
  if (!message.guild) return;

  let bossInfo = null;

  // Try parsing components first (new format)
  if (message.components && message.components.length > 0) {
    bossInfo = parseBossComponent(message.components);
  }

  // Fallback to embed parsing (old format)
  if (!bossInfo && message.embeds.length > 0) {
    const embed = message.embeds[0];
    bossInfo = parseBossEmbed(embed);
  }

  if (!bossInfo) return;

  console.log(`[BOSS] Detected boss: ${bossInfo.bossName} (${bossInfo.tier})`);

  const settings = await getSettings(message.guild.id);
  if (!settings) {
    console.log(`[BOSS] No settings found for guild ${message.guild.id}`);
    return;
  }

  const roleConfig = settings.multiRoleEnabled 
    ? `Multi-role: T1=${settings.tier1RoleId || 'none'}, T2=${settings.tier2RoleId || 'none'}, T3=${settings.tier3RoleId || 'none'}`
    : `Single role: ${settings.bossRoleId || 'none'}`;
  console.log(`[BOSS] ${roleConfig}`);

  let roleId = null;
  
  // Check if multi-role system is enabled
  if (settings.multiRoleEnabled) {
    const tierMap = {
      'Tier 1': 'tier1RoleId',
      'Tier 2': 'tier2RoleId',
      'Tier 3': 'tier3RoleId'
    };
    
    const roleField = tierMap[bossInfo.tier];
    if (roleField) {
      roleId = settings[roleField];
    }
  } else {
    roleId = settings.bossRoleId;
  }

  if (roleId) {
    try {
      const role = message.guild.roles.cache.get(roleId);
      if (!role) {
        await sendLog(`[BOSS ERROR] Role not found: ${roleId} in guild ${message.guild.name}`, { 
          guildId: message.guild.id,
          error: 'ROLE_NOT_FOUND'
        });
        return;
      }

      const botMember = message.guild.members.me;
      const hasMentionPerm = message.channel.permissionsFor(botMember).has(PermissionsBitField.Flags.MentionEveryone);
      const botAboveRole = botMember.roles.highest.position > role.position;
      const roleIsMentionable = role.mentionable;

      if (!hasMentionPerm && !botAboveRole && !roleIsMentionable) {
        await sendLog(`[BOSS PERM ERROR] Missing permissions to ping role "${role.name}" in channel #${message.channel.name} (${message.guild.name})`, {
          guildId: message.guild.id,
          channelId: message.channel.id,
          roleId: roleId,
          roleName: role.name,
          channelName: message.channel.name,
          serverName: message.guild.name,
          error: 'MISSING_PING_PERMISSION'
        });
        return;
      }

      const content = `<@&${roleId}> **${bossInfo.tier} Boss Spawned!**\nBoss: **${bossInfo.bossName}**`;
      
      // Check if there's a delay set for this role
      const delayMs = getRoleDelay(settings, roleId);
      
      if (delayMs > 0) {
        // Send after delay
        setTimeout(() => {
          message.channel.send({ content, allowedMentions: { roles: [roleId] } })
            .catch(err => {
              console.error(`[ERROR] Failed to send delayed boss ping: ${err.message}`, err);
              sendError(`[ERROR] Failed to send delayed boss ping: ${err.message}`);
            });
        }, delayMs);
        await sendLog(`[BOSS DETECTED] ${bossInfo.bossName} (${bossInfo.tier}) in guild ${message.guild.name} (delayed by ${delayMs}ms)`);
      } else {
        // Send immediately
        await message.channel.send({ content, allowedMentions: { roles: [roleId] } });
        await sendLog(`[BOSS DETECTED] ${bossInfo.bossName} (${bossInfo.tier}) in guild ${message.guild.name}`);
      }
    } catch (err) {
      console.error(`[ERROR] Failed to send boss ping: ${err.message}`, err);
      await sendError(`[ERROR] Failed to send boss ping: ${err.message}`);
    }
  }
}

module.exports = { processBossMessage };
