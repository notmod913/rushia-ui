const { PermissionsBitField, EmbedBuilder } = require('discord.js');

async function handlePermsCheck(message) {
    if (!message.guild) {
        return message.reply('This command can only be used in a server.');
    }

    const botMember = message.guild.members.me;
    const channel = message.channel;

    const requiredPerms = [
        { name: 'View Channels', flag: PermissionsBitField.Flags.ViewChannel, critical: true },
        { name: 'Send Messages', flag: PermissionsBitField.Flags.SendMessages, critical: true },
        { name: 'Read Message History', flag: PermissionsBitField.Flags.ReadMessageHistory, critical: true },
        { name: 'Mention Roles', flag: PermissionsBitField.Flags.MentionEveryone, critical: true },
        { name: 'Use Application Commands', flag: PermissionsBitField.Flags.UseApplicationCommands, critical: false },
        { name: 'Embed Links', flag: PermissionsBitField.Flags.EmbedLinks, critical: false },
        { name: 'Add Reactions', flag: PermissionsBitField.Flags.AddReactions, critical: false },
    ];

    const serverPerms = [];
    requiredPerms.forEach(perm => {
        const hasPermission = botMember.permissions.has(perm.flag);
        serverPerms.push({ name: perm.name, has: hasPermission, critical: perm.critical });
    });

    const channelPerms = [];
    requiredPerms.forEach(perm => {
        const hasPermission = channel.permissionsFor(botMember).has(perm.flag);
        channelPerms.push({ name: perm.name, has: hasPermission, critical: perm.critical });
    });

    const getIcon = (has, critical) => has ? '✅' : (critical ? '❌' : '⚠️');

    const serverPermsText = serverPerms.map(p => `${getIcon(p.has, p.critical)} ${p.name}`).join('\n');
    const channelPermsText = channelPerms.map(p => `${getIcon(p.has, p.critical)} ${p.name}`).join('\n');

    const allCriticalOk = serverPerms.every(p => !p.critical || p.has) && channelPerms.every(p => !p.critical || p.has);

    const embed = new EmbedBuilder()
        .setTitle('🔐 Bot Permission Check')
        .setDescription(allCriticalOk ? '✅ All critical permissions are granted!' : '❌ Missing critical permissions! Bot may not work properly.')
        .addFields(
            { name: '🌐 Server Permissions', value: serverPermsText, inline: true },
            { name: '📝 Channel Permissions', value: channelPermsText, inline: true },
            { name: '📌 Legend', value: '✅ = Has permission\n❌ = Missing (Critical)\n⚠️ = Missing (Optional)', inline: false }
        )
        .setColor(allCriticalOk ? 0x00ff00 : 0xff0000)
        .setFooter({ text: `Checked in #${channel.name}` })
        .setTimestamp();

    await message.reply({ embeds: [embed] });
}

module.exports = { handlePermsCheck };
