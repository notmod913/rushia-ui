const { getUserSettings, updateUserSettings } = require('../utils/userSettingsManager');
const { COLORS } = require('../config/constants');
const { EmbedBuilder } = require('discord.js');
const { BOT_OWNER_ID } = require('../config/constants');

async function handleNotificationViewCommand(message) {
  if (message.author.id !== BOT_OWNER_ID) {
    return message.reply('❌ Only the bot owner can use this command.');
  }

  // Remove bot mention and get clean content
  const content = message.content.replace(`<@${message.client.user.id}>`, '').replace(`<@!${message.client.user.id}>`, '').trim();
  const args = content.split(/\s+/);
  let targetUserId = null;

  // args[0] is 'nv', args[1] is the user ID or mention
  if (args[1]) {
    const match = args[1].match(/^<@!?(\d+)>$/) || args[1].match(/^(\d+)$/);
    if (match) {
      targetUserId = match[1];
    }
  }

  if (!targetUserId) {
    return message.reply('❌ Please provide a valid user ID or mention.\nUsage: `@bot nv <userId>` or `@bot nv @user`');
  }

  try {
    const user = await message.client.users.fetch(targetUserId);
    let settings = await getUserSettings(targetUserId);
    if (!settings) {
      settings = { expedition: true, stamina: true, raid: true, drop: true, staminaDM: false, expeditionDM: false, dropDM: false, raidSpawnDM: false, raidSpawnReminder: true };
    }

    const getStatusIcon = (enabled) => enabled ? '✅' : '❌';
    const getDMStatus = (enabled) => enabled ? '📩 DM' : '💬 Channel';

    const embed = new EmbedBuilder()
      .setTitle(`🔔 Notification Settings: ${user.username}`)
      .setThumbnail(user.displayAvatarURL())
      .setColor(COLORS.INFO)
      .addFields(
        { 
          name: '⚔️ Expedition', 
          value: `${getStatusIcon(settings.expedition)} ${settings.expedition ? 'Enabled' : 'Disabled'}\n${getDMStatus(settings.expeditionDM)}`, 
          inline: true 
        },
        { 
          name: '⚡ Stamina', 
          value: `${getStatusIcon(settings.stamina)} ${settings.stamina ? 'Enabled' : 'Disabled'}\n${getDMStatus(settings.staminaDM)}`, 
          inline: true 
        },
        { 
          name: '🛡️ Raid', 
          value: `${getStatusIcon(settings.raid)} ${settings.raid ? 'Enabled' : 'Disabled'}\n📩 Always DM`, 
          inline: true 
        },
        { 
          name: '🎯 Raid Spawn', 
          value: `${getStatusIcon(settings.raidSpawnReminder !== false)} ${settings.raidSpawnReminder !== false ? 'Enabled' : 'Disabled'}\n${getDMStatus(settings.raidSpawnDM)}`, 
          inline: true 
        },
        { 
          name: '🎁 Drop', 
          value: `${getStatusIcon(settings.drop !== false)} ${settings.drop !== false ? 'Enabled' : 'Disabled'}\n${getDMStatus(settings.dropDM)}`, 
          inline: true 
        }
      )
      .setFooter({ text: `User ID: ${targetUserId}` });

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error(`[NOTIFICATION VIEW ERROR] ${error.message}`);
    await message.reply('❌ Failed to fetch user settings. User may not exist.');
  }
}

async function handleNotificationView(interaction) {
  const userId = interaction.user.id;
  let settings = getUserSettings(userId);
  if (!settings) {
    settings = { expedition: true, stamina: true, raid: true, drop: true, staminaDM: false, expeditionDM: false, dropDM: false, raidSpawnReminder: true };
  }

  const getStatusIcon = (enabled) => enabled ? '✅' : '❌';
  const getDMStatus = (enabled) => enabled ? '📩 DM' : '💬 Channel';

  await interaction.reply({
    embeds: [{
      title: '🔔 Your Notification Settings',
      description: 'Configure your personal reminder preferences below.',
      fields: [
        { 
          name: '⚔️ Expedition Reminders', 
          value: `${getStatusIcon(settings.expedition)} ${settings.expedition ? 'Enabled' : 'Disabled'}\n${getDMStatus(settings.expeditionDM)}`, 
          inline: true 
        },
        { 
          name: '⚡ Stamina Reminders', 
          value: `${getStatusIcon(settings.stamina)} ${settings.stamina ? 'Enabled' : 'Disabled'}\n${getDMStatus(settings.staminaDM)}`, 
          inline: true 
        },
        { 
          name: '🛡️ Raid Fatigue', 
          value: `${getStatusIcon(settings.raid)} ${settings.raid ? 'Enabled' : 'Disabled'}\n📩 Always DM`, 
          inline: true 
        },
        { 
          name: '🎯 Raid Spawn Reminder', 
          value: `${getStatusIcon(settings.raidSpawnReminder !== false)} ${settings.raidSpawnReminder !== false ? 'Enabled' : 'Disabled'}\n${getDMStatus(settings.raidSpawnDM)}`, 
          inline: true 
        },
        { 
          name: '🎁 Drop Reminders', 
          value: `${getStatusIcon(settings.drop !== false)} ${settings.drop !== false ? 'Enabled' : 'Disabled'}\n${getDMStatus(settings.dropDM)}`, 
          inline: true 
        },
      ],
      footer: { text: 'Use /notifications set or /dm commands to modify settings' },
      color: COLORS.INFO,
    }],
    flags: 1 << 6,
  });
}

async function handleNotificationSet(interaction) {
  const userId = interaction.user.id;
  const type = interaction.options.getString('type');
  const enabled = interaction.options.getBoolean('enabled');

  await updateUserSettings(userId, { [type]: enabled });

  let replyContent;
  if (type === 'raidSpawnReminder') {
    replyContent = `Raid spawn reminders (30-min after /raid spawn) have been **${enabled ? 'enabled' : 'disabled'}**.`;
  } else {
    replyContent = `Notifications for **${type}** have been **${enabled ? 'enabled' : 'disabled'}**.`;
  }

  await interaction.reply({
    content: replyContent,
    flags: 1 << 6,
  });
}

module.exports = { handleNotificationView, handleNotificationSet, handleNotificationViewCommand };