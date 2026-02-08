const { EmbedBuilder } = require('discord.js');
const { getUserSettings } = require('./userSettingsManager');
const { BOT_OWNER_ID } = require('../config/constants');

async function handleUserSettingsView(message) {
    if (message.author.id !== BOT_OWNER_ID) {
        return message.reply('❌ Only the bot owner can use this command.');
    }

    const args = message.content.split(/\s+/);
    let targetUserId = null;

    // Check for user ID or mention
    if (args[1]) {
        // Extract user ID from mention or use directly
        const match = args[1].match(/^<@!?(\d+)>$/) || args[1].match(/^(\d+)$/);
        if (match) {
            targetUserId = match[1];
        }
    }

    if (!targetUserId) {
        return message.reply('❌ Please provide a valid user ID or mention.\nUsage: `@bot s <userId>` or `@bot s @user`');
    }

    try {
        const user = await message.client.users.fetch(targetUserId);
        const settings = await getUserSettings(targetUserId);

        const embed = new EmbedBuilder()
            .setTitle(`⚙️ User Settings: ${user.username}`)
            .setThumbnail(user.displayAvatarURL())
            .setColor(0x5865F2)
            .setFooter({ text: `User ID: ${targetUserId}` });

        if (!settings) {
            embed.setDescription('❌ No settings found. User will use default settings.');
            embed.addFields(
                { name: '📋 Default Settings', value: '```yaml\nExpedition: ✅ Enabled (Channel)\nStamina: ✅ Enabled (Channel)\nRaid: ✅ Enabled (Channel)\nRaid Spawn: ✅ Enabled (Channel)\nDrop: ✅ Enabled (Channel)\n```' }
            );
        } else {
            const notificationStatus = `\`\`\`yaml
Expedition: ${settings.expedition ? '✅ Enabled' : '❌ Disabled'}
Stamina: ${settings.stamina ? '✅ Enabled' : '❌ Disabled'}
Raid: ${settings.raid ? '✅ Enabled' : '❌ Disabled'}
Raid Spawn: ${settings.raidSpawn ? '✅ Enabled' : '❌ Disabled'}
Drop: ${settings.drop ? '✅ Enabled' : '❌ Disabled'}
\`\`\``;

            const dmStatus = `\`\`\`yaml
Expedition DM: ${settings.expeditionDM ? '✅ Enabled' : '❌ Disabled'}
Stamina DM: ${settings.staminaDM ? '✅ Enabled' : '❌ Disabled'}
Raid Spawn DM: ${settings.raidSpawnDM ? '✅ Enabled' : '❌ Disabled'}
Drop DM: ${settings.dropDM ? '✅ Enabled' : '❌ Disabled'}
\`\`\``;

            embed.addFields(
                { name: '📋 Notification Status', value: notificationStatus, inline: false },
                { name: '💬 DM Preferences', value: dmStatus, inline: false }
            );
        }

        await message.reply({ embeds: [embed] });
    } catch (error) {
        console.error(`[USER SETTINGS VIEW ERROR] ${error.message}`);
        await message.reply('❌ Failed to fetch user settings. User may not exist.');
    }
}

module.exports = { handleUserSettingsView };
