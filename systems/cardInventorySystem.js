const { Events } = require('discord.js');
const { LUVI_BOT_ID } = require('../config/constants');
const { buildRarityMessage } = require('../utils/cardRarityParser');

const watchers = new Map();
const MAX_MESSAGE_LENGTH = 2000;

async function reactWithRetry(message, emoji, maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await message.react(emoji);
            return;
        } catch (error) {
            console.error(`Attempt ${attempt}/${maxRetries} failed to react:`, error.message);
            if (attempt < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
}

async function processInventoryComponent(message) {
    if (!message.components || message.components.length === 0) return;
    
    const container = message.components.find(c => c.type === 17);
    if (!container || !container.components) return;
    
    const titleComponent = container.components.find(c => 
        c.type === 10 && c.content && c.content.includes("<:LU_Inventory:") && c.content.includes("'s Inventory")
    );
    
    if (titleComponent) {
        await reactWithRetry(message, '✏️', 3);
    }
}

async function processInventoryEmbed(message) {
    const embed = message.embeds[0];
    if (!embed.title) return;
    if (embed.title.includes('<:LU_Inventory:') && embed.title.includes("'s Inventory")) {
        await reactWithRetry(message, '✏️', 3);
    }
}

async function processInventoryMessage(message) {
    if (message.author.id !== LUVI_BOT_ID) return;
    
    // Try components first
    if (message.components && message.components.length > 0) {
        await processInventoryComponent(message);
        return;
    }
    
    // Fallback to embeds
    if (!message.embeds.length) {
        setTimeout(async () => {
            try {
                const fetchedMessage = await message.channel.messages.fetch(message.id);
                if (fetchedMessage.components && fetchedMessage.components.length > 0) {
                    await processInventoryComponent(fetchedMessage);
                } else if (fetchedMessage.embeds.length > 0) {
                    await processInventoryEmbed(fetchedMessage);
                }
            } catch (error) {
                console.error('Error fetching message after delay:', error);
            }
        }, 2000);
        return;
    }
    await processInventoryEmbed(message);
}

function extractCardsFromComponent(components) {
    const cards = {};
    const RARITY_MAP = { 'M': 'Mythical', 'L': 'Legendary', 'E': 'Exotic', 'R': 'Rare', 'UC': 'Uncommon', 'C': 'Common' };
    const GRADE_MAP = { 'SPlusTier': 'S+', 'STier': 'S', 'ATier': 'A', 'BTier': 'B', 'CTier': 'C', 'DTier': 'D' };
    
    if (!components || components.length === 0) return cards;
    
    const container = components.find(c => c.type === 17);
    if (!container || !container.components) return cards;
    
    // Find all text components with card data
    const cardComponents = container.components.filter(c => 
        c.type === 10 && c.content && c.content.includes('ID: `')
    );
    
    cardComponents.forEach(comp => {
        const content = comp.content;
        
        // Extract rarity and card name
        const nameMatch = content.match(/\*\*(?:🧭 )?<:LU_([MLEURC]+):[^>]+>\s*([^*]+)\*\*/);
        const idMatch = content.match(/ID: `(\d+)`/);
        
        if (nameMatch && idMatch) {
            const cardId = idMatch[1];
            const rarity = RARITY_MAP[nameMatch[1]];
            let cardName = nameMatch[2].trim();
            
            // Check for iconic - only LU_Iconic emoji
            const isIconic = content.includes('<:LU_Iconic:') || content.includes('<:Iconic:');
            if (isIconic) {
                cardName = `✨ ${cardName}`;
            }
            
            // Extract grade
            let grade = '';
            const gradeMatch = content.match(/:LU_(SPlusTier|STier|ATier|BTier|CTier|DTier):/);
            if (gradeMatch) {
                grade = GRADE_MAP[gradeMatch[1]];
            }
            
            if (rarity) {
                if (!cards[rarity]) cards[rarity] = [];
                cards[rarity].push({ name: cardName, grade, id: cardId });
            }
        }
    });
    
    return cards;
}

function extractCardsWithIds(embed) {
    const cards = {};
    const RARITY_MAP = { 'M': 'Mythical', 'L': 'Legendary', 'E': 'Exotic', 'R': 'Rare', 'UC': 'Uncommon', 'C': 'Common' };
    const GRADE_MAP = { 'SPlusTier': 'S+', 'STier': 'S', 'ATier': 'A', 'BTier': 'B', 'CTier': 'C', 'DTier': 'D' };
    
    if (!embed.fields) return cards;

    embed.fields.forEach(field => {
        const nameMatch = field.name.match(/<:LU_([MLEURC]+):[^>]+>\s*([^|]+?)(?:\s*\|(.+))?$/);
        const idMatch = field.value.match(/ID:\s*`(\d+)`/);
        
        if (nameMatch && idMatch) {
            const cardId = idMatch[1];
            const rarity = RARITY_MAP[nameMatch[1]];
            let cardName = nameMatch[2].trim().replace(/🔒/g, '').replace(/\s+/g, ' ').trim();
            const iconicPart = nameMatch[3];
            
            let grade = '';
            const gradeMatch = field.value.match(/:LU_(SPlusTier|STier|ATier|BTier|CTier|DTier):/);
            if (gradeMatch) {
                grade = GRADE_MAP[gradeMatch[1]];
            }
            
            if (iconicPart && iconicPart.includes('Iconic')) {
                cardName = `✨ ${cardName}`;
            }
            
            if (rarity) {
                if (!cards[rarity]) cards[rarity] = [];
                cards[rarity].push({ name: cardName, grade, id: cardId });
            }
        }
    });
    return cards;
}

function startPaginationWatcher(userId, inventoryMessage, cardListMessage) {
    if (watchers.has(userId)) {
        clearInterval(watchers.get(userId).interval);
    }

    let allCards = {};
    let seenIds = new Set();
    let lastPage = 1;
    let isActive = true;
    const startTime = Date.now();
    const maxDuration = 180000;
    
    const interval = setInterval(async () => {
        if (!isActive) return;

        if (Date.now() - startTime > maxDuration) {
            clearInterval(interval);
            isActive = false;
            watchers.delete(userId);
            try {
                await cardListMessage.reply({ content: '✅ Scraping completed. No more updates.', flags: 64 });
            } catch (error) {
                console.error('Error sending ephemeral message:', error);
            }
            return;
        }

        try {
            const fetchedInventory = await inventoryMessage.channel.messages.fetch(inventoryMessage.id);
            
            let pageCards = {};
            let currentPage = 1;
            let totalPages = 1;
            
            // Try components first
            if (fetchedInventory.components && fetchedInventory.components.length > 0) {
                const container = fetchedInventory.components.find(c => c.type === 17);
                if (container) {
                    const pageComponent = container.components.find(c => 
                        c.type === 10 && c.content && c.content.includes('Page:')
                    );
                    
                    if (pageComponent) {
                        const pageMatch = pageComponent.content.match(/Page: (\d+)\/(\d+)/);
                        if (pageMatch) {
                            currentPage = parseInt(pageMatch[1]);
                            totalPages = parseInt(pageMatch[2]);
                            pageCards = extractCardsFromComponent(fetchedInventory.components);
                        }
                    }
                }
            } else if (fetchedInventory.embeds[0]) {
                // Fallback to embed
                const embed = fetchedInventory.embeds[0];
                const pageMatch = embed.description?.match(/Page (\d+)\/(\d+)/);
                if (pageMatch) {
                    currentPage = parseInt(pageMatch[1]);
                    totalPages = parseInt(pageMatch[2]);
                    pageCards = extractCardsWithIds(embed);
                }
            }
            
            if (!pageCards || Object.keys(pageCards).length === 0) {
                clearInterval(interval);
                isActive = false;
                watchers.delete(userId);
                return;
            }
            Object.entries(pageCards).forEach(([rarity, cards]) => {
                if (!allCards[rarity]) allCards[rarity] = [];
                cards.forEach(card => {
                    if (!seenIds.has(card.id)) {
                        seenIds.add(card.id);
                        allCards[rarity].push(card);
                    }
                });
            });

            if (currentPage !== lastPage) {
                const message = buildRarityMessage(allCards);
                if (message.length > MAX_MESSAGE_LENGTH) {
                    clearInterval(interval);
                    isActive = false;
                    watchers.delete(userId);
                    try {
                        await cardListMessage.reply({ content: '⚠️ Message limit reached. Scraping stopped.', flags: 64 });
                    } catch (error) {
                        console.error('Error sending ephemeral message:', error);
                    }
                    return;
                }
                await cardListMessage.edit({ content: message });
                lastPage = currentPage;
            }

            if (currentPage >= totalPages) {
                clearInterval(interval);
                isActive = false;
                watchers.delete(userId);
                try {
                    await cardListMessage.reply({ content: '✅ All pages scraped. No more updates.', flags: 64 });
                } catch (error) {
                    console.error('Error sending ephemeral message:', error);
                }
            }
        } catch (error) {
            if (error.code === 10008) {
                clearInterval(interval);
                isActive = false;
                watchers.delete(userId);
                return;
            }
            console.error('Error in pagination watcher:', error);
            clearInterval(interval);
            isActive = false;
            watchers.delete(userId);
        }
    }, 500);

    watchers.set(userId, { interval, allCards });
}

async function handleCardInventorySystem(client) {
    client.on(Events.MessageCreate, async (message) => {
        await processInventoryMessage(message);
    });
}

module.exports = { handleCardInventorySystem, startPaginationWatcher };
