const { extractCardsFromEmbed, extractCardsFromComponent, buildRarityMessage } = require('../utils/cardRarityParser');
const { startPaginationWatcher } = require('../systems/cardInventorySystem');

module.exports = {
    name: 'messageReactionAdd',
    async execute(reaction, user) {
        if (user.bot) return;
        if (reaction.emoji.name !== '✏️') return;

        try {
            await reaction.message.fetch();
            
            let cards = {};
            let embedUsername = null;
            
            // Try embeds first (inventory uses embeds, not components)
            if (reaction.message.embeds.length > 0) {
                const embed = reaction.message.embeds[0];
                if (embed && embed.title) {
                    const match = embed.title.match(/<:LU_Inventory:[^>]+>\s*(.+?)'s Inventory/);
                    embedUsername = match?.[1];
                    cards = extractCardsFromEmbed(embed);
                }
            }
            
            if (!embedUsername) return;
            
            // Try to find the user by username in the guild
            let targetUserId = null;
            if (reaction.message.guild) {
                try {
                    const members = await reaction.message.guild.members.fetch({ query: embedUsername, limit: 1 });
                    const member = members.first();
                    if (member && member.id === user.id) {
                        targetUserId = user.id;
                    }
                } catch (err) {
                    // Silent fail
                }
            }
            
            if (!targetUserId) return;
            if (Object.keys(cards).length === 0) return;

            const message = buildRarityMessage(cards);
            const cardListMessage = await reaction.message.reply({ content: message });
            
            // Remove both reactions
            try {
                await reaction.remove();
                const botReaction = reaction.message.reactions.cache.find(r => r.emoji.name === '✏️');
                if (botReaction) {
                    await botReaction.remove();
                }
            } catch (error) {
                // Silent fail
            }
            
            startPaginationWatcher(user.id, reaction.message, cardListMessage);
        } catch (error) {
            // Silent fail
        }
    }
};
