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
            
            // Try components first
            if (reaction.message.components && reaction.message.components.length > 0) {
                const container = reaction.message.components.find(c => c.type === 17);
                if (container) {
                    const titleComponent = container.components.find(c => 
                        c.type === 10 && c.content && c.content.includes("'s Inventory")
                    );
                    
                    if (titleComponent) {
                        const match = titleComponent.content.match(/\*\*<:LU_Inventory:[^>]+>\s*(.+?)'s Inventory/);
                        if (match) {
                            embedUsername = match[1];
                            cards = extractCardsFromComponent(reaction.message.components);
                        }
                    }
                }
            } else if (reaction.message.embeds.length > 0) {
                // Fallback to embed
                const embed = reaction.message.embeds[0];
                if (embed && embed.title) {
                    embedUsername = embed.title.match(/<:LU_Inventory:[^>]+>\s*(.+?)'s Inventory/)?.[1];
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
                console.error('Error removing reactions:', error);
            }
            
            startPaginationWatcher(user.id, reaction.message, cardListMessage);
        } catch (error) {
            console.error('Error handling card reaction:', error);
        }
    }
};
