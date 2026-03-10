const mongoose = require('mongoose');
const { EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

let cardsCache = null;
let wishlistConn = null;
let Wishlist = null;
const wishlistCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

const ELEMENT_EMOJIS = {
  normal: '<:LU_NeutralElement:1478643394585821217>',
  water: '<:LU_WaterElement:1478643391901470863>',
  ice: '<:LU_IceElement:1478643390211035237>',
  ground: '<:LU_GroundElement:1478643388155826299>',
  grass: '<:LU_GrassElement:1478643385681055805>',
  fire: '<:LU_FireElement:1478643383605006376>',
  electric: '<:LU_ElectricElement:1478643380689829929>',
  air: '<:LU_AirElement:1478643377523130420>',
  light: '<:LU_LightElement:1478643374805352449>',
  dark: '<:LU_DarkElement:1478643372485902426>'
};

function getCards() {
  if (!cardsCache) {
    const cardsPath = path.join(__dirname, '..', 'cards.json');
    cardsCache = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
  }
  return cardsCache;
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b.charAt(i - 1) === a.charAt(j - 1)
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

const pendingConfirmations = new Map();

function findSimilarCards(name, allCards) {
  const nameLower = name.toLowerCase().trim();
  if (!nameLower) return [];
  
  const containsMatches = allCards.filter(c => c.name.toLowerCase().includes(nameLower));
  if (containsMatches.length > 0) return containsMatches;
  
  const searchWords = nameLower.split(/\s+/).filter(w => w.length > 0);
  const allWordsMatches = allCards.filter(c => {
    const cardNameLower = c.name.toLowerCase();
    return searchWords.every(word => cardNameLower.includes(word));
  });
  if (allWordsMatches.length > 0) return allWordsMatches;
  
  const anyWordExactMatches = allCards.filter(c => {
    const cardWords = c.name.toLowerCase().split(/\s+/);
    return searchWords.some(sw => cardWords.includes(sw));
  });
  if (anyWordExactMatches.length > 0) return anyWordExactMatches;
  
  const anyWordPartialMatches = allCards.filter(c => {
    const cardWords = c.name.toLowerCase().split(/\s+/);
    return searchWords.some(sw => cardWords.some(cw => cw.includes(sw) || sw.includes(cw)));
  });
  if (anyWordPartialMatches.length > 0) return anyWordPartialMatches;
  
  const threshold = nameLower.length <= 3 ? 1 : nameLower.length <= 6 ? 2 : 3;
  const fuzzyMatches = allCards
    .map(card => ({
      card,
      distance: levenshteinDistance(nameLower, card.name.toLowerCase())
    }))
    .filter(m => m.distance <= threshold)
    .sort((a, b) => a.distance - b.distance);
  
  if (fuzzyMatches.length > 0) {
    const minDistance = fuzzyMatches[0].distance;
    return fuzzyMatches.filter(m => m.distance === minDistance).map(m => m.card);
  }
  
  return [];
}

async function initWishlistConnection() {
  if (wishlistConn && wishlistConn.readyState === 1) return { conn: wishlistConn, Wishlist };
  
  wishlistConn = await mongoose.createConnection(process.env.WISHLIST_URI).asPromise();
  Wishlist = wishlistConn.model('Wishlist', new mongoose.Schema({
    _id: String,
    wl: [{ n: String, e: String }],
    cardCount: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
  }, { collection: 'wishlists' }), 'wishlists');
  return { conn: wishlistConn, Wishlist };
}

function getCachedWishlist(userId) {
  const cached = wishlistCache.get(userId);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedWishlist(userId, data) {
  wishlistCache.set(userId, { data, time: Date.now() });
}

function invalidateCache(userId) {
  wishlistCache.delete(userId);
}

async function handleWishlistAdd(message, cardNames) {
  try {
    const allCards = getCards();
    const { Wishlist: WishlistModel } = await initWishlistConnection();
    
    const namesToAdd = cardNames.split(',').map(n => n.trim()).filter(n => n);
    
    if (namesToAdd.length !== 1) {
      await message.reply('❌ Please add one card at a time for better accuracy.');
      return;
    }
    
    const name = namesToAdd[0];
    let userWishlist = await WishlistModel.findById(message.author.id);
    if (!userWishlist) {
      userWishlist = new WishlistModel({ _id: message.author.id, wl: [], cardCount: 0 });
    }
    
    if (userWishlist.wl.length >= 10) {
      await message.reply('❌ Wishlist full - max 10 cards allowed.');
      return;
    }
    
    const matches = findSimilarCards(name, allCards);
    
    if (matches.length === 0) {
      await message.reply(`❌ No cards found matching "${name}".`);
      return;
    }
    
    if (matches.length === 1) {
      const card = matches[0];
      const exists = userWishlist.wl.some(c => c.n === card.name && c.e === card.element.toLowerCase());
      if (exists) {
        await message.reply(`❌ **${card.name}** ${ELEMENT_EMOJIS[card.element.toLowerCase()] || card.element} is already in your wishlist.`);
        return;
      }
      
      userWishlist.wl.push({ n: card.name, e: card.element.toLowerCase() });
      userWishlist.cardCount = userWishlist.wl.length;
      userWishlist.updatedAt = new Date();
      await userWishlist.save();
      invalidateCache(message.author.id);
      
      await message.reply(`✅ Added **${card.name}** ${ELEMENT_EMOJIS[card.element.toLowerCase()] || card.element} [${card.series}] to your wishlist!`);
      return;
    }
    
    const displayLimit = 25;
    const displayMatches = matches.slice(0, displayLimit);
    const hasMore = matches.length > displayLimit;
    
    const embed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('Multiple cards found')
      .setDescription(`Found ${matches.length} card${matches.length > 1 ? 's' : ''}${hasMore ? ` (showing first ${displayLimit})` : ''}. Reply with the number to select:\n\n` +
        displayMatches.map((c, i) => {
          const emoji = ELEMENT_EMOJIS[c.element.toLowerCase()] || c.element;
          return `**${i + 1}.** ${c.name} ${emoji} - ${c.series} (${c.role})`;
        }).join('\n'))
      .setFooter({ text: 'Reply with 1, 2, 3... or "cancel"' });
    
    await message.reply({ embeds: [embed] });
    
    pendingConfirmations.set(message.author.id, {
      matches: displayMatches,
      wishlist: userWishlist,
      timestamp: Date.now()
    });
    
    setTimeout(() => pendingConfirmations.delete(message.author.id), 60000);
    
  } catch (error) {
    console.error('Wishlist add error:', error);
    await message.reply('❌ Error adding to wishlist.');
  }
}

async function handleWishlistView(message, targetUser = null) {
  let loadingMsg = null;
  try {
    const userId = targetUser?.id || message.author.id;
    const isOwner = message.author.id === process.env.BOT_OWNER_ID;
    
    if (targetUser && !isOwner) {
      await message.reply('❌ Only the bot owner can view other users\' wishlists.');
      return;
    }
    
    let wishlist = getCachedWishlist(userId);
    
    if (!wishlist) {
      loadingMsg = await message.reply('<a:loading:1471139633894133812>');
    }
    
    if (!wishlist) {
      const { Wishlist: WishlistModel } = await initWishlistConnection();
      wishlist = await WishlistModel.findById(userId).lean();
      if (wishlist) setCachedWishlist(userId, wishlist);
    }
    
    if (!wishlist || !wishlist.wl || wishlist.wl.length === 0) {
      const emptyMsg = `${targetUser ? `<@${userId}>` : 'You'} have no cards in wishlist.`;
      if (loadingMsg) {
        await loadingMsg.edit(emptyMsg);
      } else {
        await message.reply(emptyMsg);
      }
      return;
    }
    
    const totalCards = wishlist.cardCount || wishlist.wl.length;
    const maxLength = Math.max(...wishlist.wl.map(c => c.n.length));
    
    const cardLines = wishlist.wl.map(card => {
      const emoji = ELEMENT_EMOJIS[card.e] || card.e;
      const paddedName = card.n.padEnd(maxLength, ' ');
      return `${emoji} \`${paddedName}\``;
    });
    
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`${targetUser ? `${targetUser.username}'s` : `${message.author.username}'s`} Wishlist`)
      .setDescription(cardLines.join('\n'))
      .setFooter({ text: `${totalCards}/10 cards` });
    
    if (loadingMsg) {
      await loadingMsg.edit({ content: '', embeds: [embed] });
    } else {
      await message.reply({ embeds: [embed] });
    }
    
  } catch (error) {
    console.error('Wishlist view error:', error);
    const errorMsg = `❌ Error viewing wishlist: ${error.message}`;
    if (loadingMsg) {
      await loadingMsg.edit(errorMsg).catch(() => {});
    } else {
      await message.reply(errorMsg);
    }
  }
}

async function handleWishlistSelection(message, selection) {
  const pending = pendingConfirmations.get(message.author.id);
  if (!pending) return false;
  
  if (selection.toLowerCase() === 'cancel') {
    pendingConfirmations.delete(message.author.id);
    await message.reply('❌ Cancelled.');
    return true;
  }
  
  const num = parseInt(selection);
  if (isNaN(num) || num < 1 || num > pending.matches.length) {
    return false;
  }
  
  try {
    if (pending.action === 'remove') {
      // Handle remove action
      const cardToRemove = pending.matches[num - 1];
      pending.wishlist.wl = pending.wishlist.wl.filter(c => c.n !== cardToRemove.n);
      pending.wishlist.cardCount = pending.wishlist.wl.length;
      pending.wishlist.updatedAt = new Date();
      await pending.wishlist.save();
      invalidateCache(message.author.id);
      
      const emoji = ELEMENT_EMOJIS[cardToRemove.e] || cardToRemove.e;
      await message.reply(`✅ Removed **${cardToRemove.n}** ${emoji} from your wishlist!`);
    } else {
      // Handle add action
      const card = pending.matches[num - 1];
      const exists = pending.wishlist.wl.some(c => c.n === card.name && c.e === card.element.toLowerCase());
      
      if (exists) {
        await message.reply(`❌ **${card.name}** ${ELEMENT_EMOJIS[card.element.toLowerCase()] || card.element} is already in your wishlist.`);
      } else {
        pending.wishlist.wl.push({ n: card.name, e: card.element.toLowerCase() });
        pending.wishlist.cardCount = pending.wishlist.wl.length;
        pending.wishlist.updatedAt = new Date();
        await pending.wishlist.save();
        invalidateCache(message.author.id);
        
        await message.reply(`✅ Added **${card.name}** ${ELEMENT_EMOJIS[card.element.toLowerCase()] || card.element} [${card.series}] to your wishlist!`);
      }
    }
    
    pendingConfirmations.delete(message.author.id);
    return true;
  } catch (error) {
    console.error('Selection error:', error);
    await message.reply('❌ Error processing selection.');
    pendingConfirmations.delete(message.author.id);
    return true;
  }
}

async function handleWishlistRemove(message, cardNames) {
  try {
    const allCards = getCards();
    const { Wishlist: WishlistModel } = await initWishlistConnection();
    
    const userWishlist = await WishlistModel.findById(message.author.id);
    if (!userWishlist || userWishlist.wl.length === 0) {
      await message.reply('❌ Your wishlist is empty.');
      return;
    }
    
    const namesToRemove = cardNames.split(',').map(n => n.trim()).filter(n => n);
    
    if (namesToRemove.length !== 1) {
      await message.reply('❌ Please remove one card at a time for better accuracy.');
      return;
    }
    
    const name = namesToRemove[0];
    
    // Find matches in user's wishlist first
    const wishlistMatches = userWishlist.wl.filter(c => 
      c.n.toLowerCase().includes(name.toLowerCase())
    );
    
    if (wishlistMatches.length === 0) {
      await message.reply(`❌ No cards in your wishlist match "${name}".`);
      return;
    }
    
    if (wishlistMatches.length === 1) {
      const cardToRemove = wishlistMatches[0];
      userWishlist.wl = userWishlist.wl.filter(c => c.n !== cardToRemove.n);
      userWishlist.cardCount = userWishlist.wl.length;
      userWishlist.updatedAt = new Date();
      await userWishlist.save();
      invalidateCache(message.author.id);
      
      const emoji = ELEMENT_EMOJIS[cardToRemove.e] || cardToRemove.e;
      await message.reply(`✅ Removed **${cardToRemove.n}** ${emoji} from your wishlist!`);
      return;
    }
    
    // Multiple matches - show options
    const embed = new EmbedBuilder()
      .setColor(0xff6b6b)
      .setTitle('Multiple cards found in your wishlist')
      .setDescription(`Found ${wishlistMatches.length} cards. Reply with the number to remove:\n\n` +
        wishlistMatches.map((c, i) => {
          const emoji = ELEMENT_EMOJIS[c.e] || c.e;
          return `**${i + 1}.** ${c.n} ${emoji}`;
        }).join('\n'))
      .setFooter({ text: 'Reply with 1, 2, 3... or "cancel"' });
    
    await message.reply({ embeds: [embed] });
    
    pendingConfirmations.set(message.author.id, {
      matches: wishlistMatches,
      wishlist: userWishlist,
      action: 'remove',
      timestamp: Date.now()
    });
    
    setTimeout(() => pendingConfirmations.delete(message.author.id), 60000);
    
  } catch (error) {
    console.error('Wishlist remove error:', error);
    await message.reply('❌ Error removing from wishlist.');
  }
}

module.exports = { handleWishlistAdd, handleWishlistView, handleWishlistSelection, handleWishlistRemove };
