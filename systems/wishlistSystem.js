const mongoose = require('mongoose');
const { EmbedBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');

let cardsCache = null;
let wishlistConn = null;
let Wishlist = null;
const wishlistCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

function findSimilarCards(name, allCards) {
  const nameLower = name.toLowerCase();
  const matches = allCards
    .map(card => ({
      card,
      distance: levenshteinDistance(nameLower, card.name.toLowerCase())
    }))
    .filter(m => m.distance <= 3)
    .sort((a, b) => a.distance - b.distance);
  
  if (matches.length === 0) return [];
  
  const minDistance = matches[0].distance;
  const closestMatches = matches.filter(m => m.distance === minDistance).map(m => m.card.name);
  
  return closestMatches;
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
    const added = [];
    const notFound = [];
    
    let userWishlist = await WishlistModel.findById(message.author.id);
    if (!userWishlist) {
      userWishlist = new WishlistModel({ _id: message.author.id, wl: [], cardCount: 0 });
    }
    
    for (const name of namesToAdd) {
      if (userWishlist.wl.length >= 10) {
        notFound.push(`${name} (Wishlist full - max 10 cards)`);
        continue;
      }
      const card = allCards.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (card) {
        const exists = userWishlist.wl.some(c => c.n.toLowerCase() === card.name.toLowerCase());
        if (!exists) {
          userWishlist.wl.push({ n: card.name, e: card.element.toLowerCase() });
          added.push(`${card.name} [${card.element}]`);
        }
      } else {
        const suggestions = findSimilarCards(name, allCards);
        if (suggestions.length > 0) {
          notFound.push(`${name} (Did you mean: ${suggestions.join(', ')}?)`);
        } else {
          notFound.push(name);
        }
      }
    }
    
    if (added.length > 0) {
      userWishlist.cardCount = userWishlist.wl.length;
      userWishlist.updatedAt = new Date();
      await userWishlist.save();
      invalidateCache(message.author.id);
    }
    
    const embed = new EmbedBuilder()
      .setColor(added.length > 0 ? 0x00ff00 : 0xff0000)
      .setTitle('Wishlist Update');
    
    if (added.length > 0) {
      embed.addFields({ name: '✅ Added', value: added.join('\n'), inline: false });
    }
    if (notFound.length > 0) {
      embed.addFields({ name: '❌ Not Found', value: notFound.join('\n'), inline: false });
    }
    
    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Wishlist add error:', error);
    await message.reply('❌ Error adding to wishlist.');
  }
}

async function handleWishlistView(message, targetUser = null) {
  try {
    const userId = targetUser?.id || message.author.id;
    const isOwner = message.author.id === process.env.BOT_OWNER_ID;
    
    if (targetUser && !isOwner) {
      await message.reply('❌ Only the bot owner can view other users\' wishlists.');
      return;
    }
    
    let wishlist = getCachedWishlist(userId);
    
    if (!wishlist) {
      const { Wishlist: WishlistModel } = await initWishlistConnection();
      wishlist = await WishlistModel.findById(userId).lean();
      if (wishlist) setCachedWishlist(userId, wishlist);
    }
    
    if (!wishlist || !wishlist.wl || wishlist.wl.length === 0) {
      await message.reply(`${targetUser ? `<@${userId}>` : 'You'} have no cards in wishlist.`);
      return;
    }
    
    const grouped = {};
    wishlist.wl.forEach(card => {
      if (!grouped[card.e]) grouped[card.e] = [];
      grouped[card.e].push(card.n);
    });
    
    const elements = Object.keys(grouped);
    const itemsPerPage = 5;
    let currentPage = 0;
    const totalPages = Math.ceil(elements.length / itemsPerPage);
    const totalCards = wishlist.cardCount || wishlist.wl.length;
    
    const generateEmbed = (page) => {
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle(`${targetUser ? `${targetUser.username}'s` : 'Your'} Wishlist`)
        .setDescription(`Total: ${totalCards}/10 cards`);
      
      const start = page * itemsPerPage;
      const end = Math.min(start + itemsPerPage, elements.length);
      
      for (let i = start; i < end; i++) {
        const element = elements[i];
        const cards = grouped[element];
        const cardList = cards.slice(0, 20).join(', ');
        const more = cards.length > 20 ? ` (+${cards.length - 20} more)` : '';
        embed.addFields({ 
          name: `${element.charAt(0).toUpperCase() + element.slice(1)} (${cards.length})`, 
          value: cardList + more, 
          inline: false 
        });
      }
      
      embed.setFooter({ text: `Page ${page + 1}/${totalPages}` });
      return embed;
    };
    
    const reply = await message.reply({ embeds: [generateEmbed(currentPage)] });
    
    if (totalPages > 1) {
      await reply.react('⬅️');
      await reply.react('➡️');
      
      const filter = (reaction, user) => {
        return ['⬅️', '➡️'].includes(reaction.emoji.name) && !user.bot;
      };
      
      const collector = reply.createReactionCollector({ filter, time: 60000 });
      
      collector.on('collect', async (reaction, user) => {
        if (user.id !== message.author.id) {
          await message.channel.send(`<@${user.id}> sharam h kya bro`);
          await reaction.users.remove(user.id);
          return;
        }
        
        if (reaction.emoji.name === '➡️' && currentPage < totalPages - 1) {
          currentPage++;
          await reply.edit({ embeds: [generateEmbed(currentPage)] });
        } else if (reaction.emoji.name === '⬅️' && currentPage > 0) {
          currentPage--;
          await reply.edit({ embeds: [generateEmbed(currentPage)] });
        }
        await reaction.users.remove(user.id);
      });
      
      collector.on('end', () => {
        reply.reactions.removeAll().catch(() => {});
      });
    }
  } catch (error) {
    console.error('Wishlist view error:', error);
    console.error('Error stack:', error.stack);
    await message.reply(`❌ Error viewing wishlist: ${error.message}`);
  }
}

module.exports = { handleWishlistAdd, handleWishlistView, handleWishlistRemove };

async function handleWishlistRemove(message, cardNames) {
  try {
    const allCards = getCards();
    const { Wishlist: WishlistModel } = await initWishlistConnection();
    
    const namesToRemove = cardNames.split(',').map(n => n.trim()).filter(n => n);
    const removed = [];
    const notFound = [];
    
    let userWishlist = await WishlistModel.findById(message.author.id);
    if (!userWishlist || !userWishlist.wl || userWishlist.wl.length === 0) {
      await message.reply('❌ Your wishlist is empty.');
      return;
    }
    
    for (const name of namesToRemove) {
      const card = allCards.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (card) {
        const initialLength = userWishlist.wl.length;
        userWishlist.wl = userWishlist.wl.filter(c => c.n.toLowerCase() !== card.name.toLowerCase());
        if (userWishlist.wl.length < initialLength) {
          removed.push(`${card.name} [${card.element}]`);
        } else {
          notFound.push(`${card.name} (not in your wishlist)`);
        }
      } else {
        const suggestions = findSimilarCards(name, allCards);
        if (suggestions.length > 0) {
          notFound.push(`${name} (Did you mean: ${suggestions.join(', ')}?)`);
        } else {
          notFound.push(name);
        }
      }
    }
    
    if (removed.length > 0) {
      userWishlist.cardCount = userWishlist.wl.length;
      userWishlist.updatedAt = new Date();
      await userWishlist.save();
      invalidateCache(message.author.id);
    }
    
    const embed = new EmbedBuilder()
      .setColor(removed.length > 0 ? 0x00ff00 : 0xff0000)
      .setTitle('Wishlist Update');
    
    if (removed.length > 0) {
      embed.addFields({ name: '✅ Removed', value: removed.join('\n'), inline: false });
    }
    if (notFound.length > 0) {
      embed.addFields({ name: '❌ Not Found/Removed', value: notFound.join('\n'), inline: false });
    }
    
    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Wishlist remove error:', error);
    await message.reply('❌ Error removing from wishlist.');
  }
}
