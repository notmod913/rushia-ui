const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Reminder = require('../database/Reminder');
const UserNotificationSettings = require('../database/UserNotificationSettings');

const sessions = new Map();

async function handleReminderView(message, filterArg = null) {
    if (message.author.id !== process.env.BOT_OWNER_ID) {
        return;
    }
    
    if (!filterArg) {
        return message.reply('Usage: `@bot rem <filter>`\nFilters: `e` (expedition), `s` (stamina), `r` (raid), `rs` (raid spawn), `d` (drop), `@user`, or `user_id`');
    }
    
    const filterMap = {
        'e': 'expedition',
        's': 'stamina',
        'r': 'raid',
        'rs': 'raidSpawn',
        'd': 'drop'
    };
    
    let targetUserId = null;
    let initialFilter = 'all';
    
    const mentionMatch = filterArg.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        targetUserId = mentionMatch[1];
    } else if (/^\d{17,19}$/.test(filterArg)) {
        targetUserId = filterArg;
    } else if (filterMap[filterArg]) {
        initialFilter = filterMap[filterArg];
    } else {
        return message.reply('Invalid filter. Use: `e`, `s`, `r`, `rs`, `d`, `@user`, or `user_id`');
    }
    
    let reminders = await Reminder.find({}).sort({ userId: 1, remindAt: 1 });
    
    if (targetUserId) {
        reminders = reminders.filter(r => r.userId === targetUserId);
        if (reminders.length === 0) {
            return message.reply(`No reminders found for <@${targetUserId}>.`);
        }
    }
    
    if (reminders.length === 0) {
        return message.reply('No active reminders found.');
    }

    const sessionId = `${message.author.id}-${Date.now()}`;
    sessions.set(sessionId, {
        userId: message.author.id,
        page: 0,
        filter: initialFilter,
        allReminders: reminders,
        showDropdown: false,
        showButtons: false,
        targetUserId
    });

    await sendReminderPage(message, sessionId);
    
    setTimeout(() => sessions.delete(sessionId), 300000);
}

async function sendReminderPage(message, sessionId, interaction = null) {
    const session = sessions.get(sessionId);
    if (!session) return;

    const client = interaction ? interaction.client : message.client;

    let filtered = session.allReminders;
    if (session.filter !== 'all') {
        filtered = session.allReminders.filter(r => r.type === session.filter);
    }

    const grouped = {};
    const seen = new Set();
    filtered.forEach(r => {
        const key = `${r.userId}-${r.type}`;
        if (!seen.has(key)) {
            if (!grouped[r.userId]) grouped[r.userId] = [];
            grouped[r.userId].push(r);
            seen.add(key);
        }
    });

    const users = Object.keys(grouped);
    const userSettings = await UserNotificationSettings.find({ userId: { $in: users } });
    const settingsMap = {};
    userSettings.forEach(s => settingsMap[s.userId] = s);

    const totalPages = Math.ceil(users.length / 6);
    const start = session.page * 6;
    const pageUsers = users.slice(start, start + 6);

    const typeEmojis = {
        expedition: '🗺️',
        stamina: '⚡',
        raid: '⚔️',
        raidSpawn: '🔔',
        drop: '🎴'
    };

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setFooter({ text: `Page ${session.page + 1}/${totalPages} • Filter: ${session.filter}` })
        .setTimestamp();

    if (session.targetUserId) {
        embed.setAuthor({ name: 'User Reminders', iconURL: client.user.displayAvatarURL() });
        embed.setDescription(`<@${session.targetUserId}>`);
    } else {
        embed.setAuthor({ name: 'Active Reminders', iconURL: client.user.displayAvatarURL() });
    }

    if (pageUsers.length === 0) {
        embed.setDescription('❌ No reminders match the selected filter.');
    } else {
        let description = '';
        pageUsers.forEach(userId => {
            const userReminders = grouped[userId];
            const settings = settingsMap[userId];
            
            userReminders.forEach(r => {
                const time = Math.floor(r.remindAt.getTime() / 1000);
                const emoji = typeEmojis[r.type] || '📌';
                let dmTag = '';
                if (r.type !== 'raid' && settings) {
                    if ((r.type === 'expedition' && settings.expeditionDM) ||
                        (r.type === 'stamina' && settings.staminaDM) ||
                        (r.type === 'raidSpawn' && settings.raidSpawnDM)) {
                        dmTag = '`DM`';
                    }
                }
                description += `<@${userId}> ${emoji}${r.type}${dmTag} <t:${time}:R>\n`;
            });
        });
        embed.setDescription(description.trim());
    }

    const filterMenu = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`rem_filter_${sessionId}`)
            .setPlaceholder('Filter by type')
            .addOptions([
                { label: 'All Types', value: 'all', emoji: '📋' },
                { label: 'Expedition', value: 'expedition', emoji: '🗺️' },
                { label: 'Stamina', value: 'stamina', emoji: '⚡' },
                { label: 'Raid', value: 'raid', emoji: '⚔️' },
                { label: 'Raid Spawn', value: 'raidSpawn', emoji: '🔔' },
                { label: 'Drop', value: 'drop', emoji: '🎴' }
            ])
    );

    const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rem_prev_${sessionId}`)
            .setLabel('◀')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(session.page === 0),
        new ButtonBuilder()
            .setCustomId(`rem_next_${sessionId}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(session.page >= totalPages - 1)
    );

    const components = [];
    if (session.showDropdown) components.push(filterMenu);
    if (session.showButtons) components.push(buttons);
    const payload = { embeds: [embed], components, allowedMentions: { parse: [] } };
    
    if (interaction) {
        await interaction.update(payload);
    } else {
        await message.reply(payload);
    }
}

async function handleReminderInteraction(interaction) {
    const [action, type, sessionId] = interaction.customId.split('_');
    
    if (action !== 'rem') return false;

    const session = sessions.get(sessionId);
    if (!session || session.userId !== interaction.user.id) {
        await interaction.reply({ content: 'Session expired or unauthorized.', ephemeral: true });
        return true;
    }

    if (type === 'filter') {
        session.filter = interaction.values[0];
        session.page = 0;
    } else if (type === 'prev') {
        session.page = Math.max(0, session.page - 1);
    } else if (type === 'next') {
        session.page++;
    }

    await sendReminderPage(null, sessionId, interaction);
    return true;
}

module.exports = { handleReminderView, handleReminderInteraction };
