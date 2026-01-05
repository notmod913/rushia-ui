const { Events } = require('discord.js');
const { processExpeditionMessage } = require('../systems/expeditionReminderSystem');
const { processRaidMessage } = require('../systems/raidReminderSystem');
const { processRaidSpawnMessage } = require('../systems/raidSpawnReminderSystem');
const { LUVI_BOT_ID } = require('../config/constants');
const CacheManager = require('../optimization/cache');

module.exports = {
    name: Events.MessageUpdate,
    async execute(oldMessage, newMessage) {
        if (newMessage.author.id !== LUVI_BOT_ID) return;
        
        const messageKey = `msg_edit_${newMessage.id}_${newMessage.editedTimestamp}`;
        if (CacheManager.getMessage(messageKey)) return;
        CacheManager.setMessage(messageKey, true);
        
        await processRaidSpawnMessage(newMessage);
        await processExpeditionMessage(newMessage);
        await processRaidMessage(newMessage);
    }
};
