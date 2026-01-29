const RARITY_ORDER = ['Mythical', 'Legendary', 'Exotic', 'Rare', 'Uncommon', 'Common'];

const RARITY_CODE_MAP = {
    'M': 'Mythical',
    'L': 'Legendary',
    'E': 'Exotic',
    'R': 'Rare',
    'UC': 'Uncommon',
    'C': 'Common'
};

const GRADE_MAP = {
    'SPlusTier': 'S+',
    'STier': 'S',
    'ATier': 'A',
    'BTier': 'B',
    'CTier': 'C',
    'DTier': 'D'
};

function extractCardsFromComponent(components) {
    const cards = {};
    if (!components || components.length === 0) return cards;
    
    const container = components.find(c => c.type === 17);
    if (!container || !container.components) return cards;
    
    const cardComponents = container.components.filter(c => 
        c.type === 10 && c.content && c.content.includes('ID: `')
    );
    
    cardComponents.forEach(comp => {
        const content = comp.content;
        const nameMatch = content.match(/\*\*(?:🧭 )?<:LU_([MLEURC]+):[^>]+>\s*([^*]+)\*\*/);
        
        if (nameMatch) {
            const rarityCode = nameMatch[1];
            let cardName = nameMatch[2].trim();
            const rarity = RARITY_CODE_MAP[rarityCode];
            
            // Check for iconic - only LU_Iconic emoji
            if (content.includes('<:LU_Iconic:') || content.includes('<:Iconic:')) {
                cardName = `✨ ${cardName}`;
            }
            
            let grade = '';
            const gradeMatch = content.match(/:LU_(SPlusTier|STier|ATier|BTier|CTier|DTier):/);
            if (gradeMatch) {
                grade = GRADE_MAP[gradeMatch[1]];
            }
            
            if (rarity) {
                if (!cards[rarity]) cards[rarity] = [];
                cards[rarity].push({ name: cardName, grade });
            }
        }
    });
    
    return cards;
}

function extractCardsFromEmbed(embed) {
    const cards = {};
    if (!embed.fields) return cards;

    embed.fields.forEach(field => {
        const nameMatch = field.name.match(/<:LU_([MLEURC]+):[^>]+>\s*([^|]+?)(?:\s*\|.*)?$/);
        if (nameMatch) {
            const rarityCode = nameMatch[1];
            const cardName = nameMatch[2].trim().replace(/🔒/g, '').replace(/\s+/g, ' ').trim();
            const rarity = RARITY_CODE_MAP[rarityCode];
            
            let grade = '';
            const gradeMatch = field.value.match(/:LU_(SPlusTier|STier|ATier|BTier|CTier|DTier):/);
            if (gradeMatch) {
                grade = GRADE_MAP[gradeMatch[1]];
            }
            
            if (rarity) {
                if (!cards[rarity]) cards[rarity] = [];
                cards[rarity].push({ name: cardName, grade });
            }
        }
    });
    return cards;
}

function buildRarityMessage(cards) {
    const rarities = RARITY_ORDER.filter(r => cards[r]?.length > 0);
    if (rarities.length === 0) return 'No cards found.';
    return rarities.map(rarity => {
        const cardList = cards[rarity].map(card => card.grade ? `${card.name}[${card.grade}]` : card.name).join(', ');
        return `**${rarity}**\n${cardList}`;
    }).join('\n');
}

module.exports = { extractCardsFromEmbed, extractCardsFromComponent, buildRarityMessage };
