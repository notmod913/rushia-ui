const { Events } = require('discord.js');
const { processBossMessage } = require('../systems/tierPingSystem');
const { processCardMessage } = require('../systems/cardPingSystem');
const { processStaminaMessage } = require('../systems/staminaReminderSystem');
const { processExpeditionMessage } = require('../systems/expeditionReminderSystem');
const { processRaidMessage } = require('../systems/raidReminderSystem');
const { processRaidSpawnMessage } = require('../systems/raidSpawnReminderSystem');
const { processInventoryMessage: processGeneratorMessage } = require('../systems/messageGeneratorSystem');
const { LUVI_BOT_ID } = require('../config/constants');
const CacheManager = require('../optimization/cache');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        const client = message.client;

        // Handle bot mentions for card search and logs
        if (!message.author.bot && message.mentions.has(client.user)) {
            const content = message.content.replace(`<@${client.user.id}>`, '').trim();
            
            if (content.toLowerCase() === 'logs') {
                const { handleLogsCommand } = require('../commands/logs');
                await handleLogsCommand(message);
                return;
            }
            
            const match = content.match(/^(f|find)\s+(.+)$/i);
            if (match) {
                const cardSearch = require('../systems/cardSearchSystem');
                await cardSearch.handleSearch(message, match[2]);
                return;
            }
        }
        
        // Handle card search number selection
        if (!message.author.bot && message.content.match(/^\d+$/)) {
            const cardSearch = require('../systems/cardSearchSystem');
            const handled = await cardSearch.handleSelection(message);
            if (handled) return;
        }

        // Only process Luvi bot messages for game notifications
        if (message.author.id !== LUVI_BOT_ID) return;
        
        const messageKey = `msg_${message.id}_${message.createdTimestamp}`;
        if (CacheManager.getMessage(messageKey)) return;
        CacheManager.setMessage(messageKey, true);

        await processStaminaMessage(message);
        await processExpeditionMessage(message);
        await processRaidMessage(message);
        await processRaidSpawnMessage(message);
        await processBossMessage(message);
        await processCardMessage(message);
        await processGeneratorMessage(message);
    }
};
