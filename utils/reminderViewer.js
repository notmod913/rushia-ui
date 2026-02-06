const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Reminder = require('../database/Reminder');
const { BOT_OWNER_ID } = require('../config/constants');

async function handleReminderView(message) {
    if (message.author.id !== BOT_OWNER_ID) {
        return message.reply('❌ Only the bot owner can use this command.');
    }

    // Delete old expired reminders (older than 1 hour and not sent)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    await Reminder.deleteMany({
        remindAt: { $lt: oneHourAgo },
        sent: { $ne: true }
    });

    const reminders = await Reminder.find({
        sent: { $ne: true }
    }).sort({ remindAt: 1 });
    
    if (reminders.length === 0) {
        return message.reply('❌ No active reminders found.');
    }

    await sendReminderPage(message, message.author.id, 0, 'all', reminders);
}

async function sendReminderPage(message, userId, page, filter, allReminders, interaction = null) {
    let filtered = allReminders;
    if (filter !== 'all') {
        filtered = allReminders.filter(r => r.type === filter);
    }

    const itemsPerPage = 5;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = page * itemsPerPage;
    const pageReminders = filtered.slice(start, start + itemsPerPage);

    const typeEmojis = {
        expedition: '🗺️',
        stamina: '⚡',
        raid: '⚔️',
        raidSpawn: '🔔',
        drop: '🎁'
    };

    const embed = new EmbedBuilder()
        .setTitle(`📋 Active Reminders (${filter === 'all' ? 'All Types' : filter})`)
        .setColor(0x5865F2)
        .setFooter({ text: `Page ${page + 1}/${totalPages || 1}` });

    if (pageReminders.length === 0) {
        embed.setDescription('No reminders in this category');
    } else {
        const now = Date.now();
        const lines = pageReminders.map(r => {
            const time = Math.floor(r.remindAt.getTime() / 1000);
            const emoji = typeEmojis[r.type] || '📌';
            const isExpired = r.remindAt.getTime() < now;
            const expiredTag = isExpired ? ' **[EXPIRED]**' : '';
            return `${emoji} <@${r.userId}> - <t:${time}:R>${expiredTag}\n${r.reminderMessage}`;
        });
        embed.setDescription(lines.join('\n\n'));
    }

    const filterButtons1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rem_expedition_${userId}_${page}_${filter}`)
            .setLabel('Expedition')
            .setStyle(filter === 'expedition' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`rem_stamina_${userId}_${page}_${filter}`)
            .setLabel('Stamina')
            .setStyle(filter === 'stamina' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`rem_raid_${userId}_${page}_${filter}`)
            .setLabel('Raid')
            .setStyle(filter === 'raid' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`rem_raidSpawn_${userId}_${page}_${filter}`)
            .setLabel('Raid Spawn')
            .setStyle(filter === 'raidSpawn' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`rem_drop_${userId}_${page}_${filter}`)
            .setLabel('Drop')
            .setStyle(filter === 'drop' ? ButtonStyle.Primary : ButtonStyle.Secondary)
    );

    const filterButtons2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rem_prev_${userId}_${page}_${filter}`)
            .setLabel('◀')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page === 0),
        new ButtonBuilder()
            .setCustomId(`rem_next_${userId}_${page}_${filter}`)
            .setLabel('▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1)
    );

    const payload = { embeds: [embed], components: [filterButtons1, filterButtons2], allowedMentions: { parse: [] } };
    
    if (interaction) {
        await interaction.update(payload);
    } else {
        await message.reply(payload);
    }
}

async function handleReminderInteraction(interaction) {
    const customId = interaction.customId;
    if (!customId.startsWith('rem_')) return false;

    const parts = customId.split('_');
    const action = parts[1];
    const userId = parts[2];
    let page = parseInt(parts[3]);
    let filter = parts[4];

    if (userId !== interaction.user.id) {
        await interaction.reply({ content: 'mat kr lala mat kr', ephemeral: true });
        return true;
    }

    const reminders = await Reminder.find({
        sent: { $ne: true }
    }).sort({ remindAt: 1 });

    if (['expedition', 'stamina', 'raid', 'raidSpawn', 'drop'].includes(action)) {
        filter = action;
        page = 0;
    } else if (action === 'prev') {
        page = Math.max(0, page - 1);
    } else if (action === 'next') {
        page++;
    }

    await sendReminderPage(interaction.message, userId, page, filter, reminders, interaction);
    return true;
}

module.exports = { handleReminderView, handleReminderInteraction };
