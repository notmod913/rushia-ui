const { Events } = require('discord.js');
const { processBossMessage } = require('../systems/tierPingSystem');
const { processStaminaMessage } = require('../systems/staminaReminderSystem');
const { processExpeditionMessage } = require('../systems/expeditionReminderSystem');
const { processRaidMessage } = require('../systems/raidReminderSystem');
const { processRaidSpawnMessage } = require('../systems/raidSpawnReminderSystem');
const { processDropMessage } = require('../systems/dropSystem');
const { processRarityDrop } = require('../systems/rarityDropSystem');
const { processDropCount } = require('../systems/dropCountSystem');
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
            
            if (content.toLowerCase() === 'perms') {
                const { handlePermsCheck } = require('../utils/permsChecker');
                await handlePermsCheck(message);
                return;
            }
            
            if (content.toLowerCase() === 'stats') {
                const { handleStatsCommand } = require('../systems/healthWebhookSystem');
                await handleStatsCommand(message);
                return;
            }
            
            if (content.toLowerCase() === 'rem' || content.toLowerCase().startsWith('rem ')) {
                const { handleReminderView } = require('../utils/reminderViewer');
                const args = content.toLowerCase().split(' ');
                const filter = args[1] || null;
                await handleReminderView(message, filter);
                return;
            }
            
            if (content.toLowerCase() === 'servers' || content.toLowerCase() === 'guilds') {
                const { handleServerListCommand } = require('../systems/serverManagementSystem');
                await handleServerListCommand(message);
                return;
            }
            
            // Handle info command with server ID
            const infoMatch = content.match(/^(info|i|in|inf)\s+(\d+)$/i);
            if (infoMatch) {
                const { handleServerInfoCommand } = require('../systems/serverManagementSystem');
                await handleServerInfoCommand(message, infoMatch[2]);
                return;
            }
            
            if (content.toLowerCase() === 'rlb') {
                const { handleRlbCommand } = require('../systems/rlbSystem');
                await handleRlbCommand(message);
                return;
            }
            
            if (content.toLowerCase() === 'ping') {
                const { handlePingCommand } = require('../commands/ping');
                await handlePingCommand(message);
                return;
            }
            
            const match = content.match(/^(f|find)\s+(.+)$/i);
            if (match) {
                const cardSearch = require('../systems/cardSearchSystem');
                await cardSearch.handleSearch(message, match[2]);
                return;
            }
        }
        
        // Handle prefix commands
        if (!message.author.bot && message.content.toLowerCase().startsWith('r')) {
            const args = message.content.slice(1).trim().split(/\s+/);
            const command = args[0]?.toLowerCase();
            
            if (command === 'lb') {
                const { handleRlbCommand } = require('../systems/rlbSystem');
                await handleRlbCommand(message);
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
        await processDropMessage(message);
        await processRarityDrop(message);
        await processDropCount(message);
        await processBossMessage(message);
        await processGeneratorMessage(message);
    }
};
