const mongoose = require('mongoose');
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { BOT_OWNER_ID } = require('../config/constants');

let wishlistConn = null;
let logsConn = null;

async function getWishlistConnection() {
  if (!wishlistConn || wishlistConn.readyState !== 1) {
    wishlistConn = await mongoose.createConnection(process.env.WISHLIST_URI).asPromise();
  }
  return wishlistConn;
}

async function getLogsConnection() {
  if (!logsConn || logsConn.readyState !== 1) {
    logsConn = await mongoose.createConnection(process.env.LOGS_MONGODB_URI).asPromise();
  }
  return logsConn;
}

// ==================== RAID WISHLIST PING TEST ====================
async function testRaidWishlistPing(userId = null) {
  const results = [];
  
  for (let iteration = 1; iteration <= 2; iteration++) {
    try {
      const Wishlist = await getWishlistConnection();
      const WishlistModel = Wishlist.model('Wishlist', new mongoose.Schema({
        _id: String,
        wl: [{ n: String, e: String }]
      }, { _id: false }), 'wishlists');

      // Get user's actual wishlist from DB
      let testUserId = userId || BOT_OWNER_ID;
      let userWishlist = await WishlistModel.findById(testUserId).lean();

      if (!userWishlist || !userWishlist.wl || userWishlist.wl.length === 0) {
        return {
          testName: 'Raid Wishlist Ping',
          success: false,
          error: `No wishlist found for user ${testUserId}. Add some raids to your wishlist first with @bot wa <raid_name>`
        };
      }

      // Use first item from their wishlist
      const testItem = userWishlist.wl[0];
      const testRaidName = testItem.n;
      const testElement = testItem.e;

      // Measure query time - this simulates the ping detection
      const start = Date.now();
      const usersWithWishlist = await WishlistModel.find({
        'wl': { $elemMatch: { n: testRaidName, e: testElement } }
      }, { _id: 1 }).lean();
      const queryTime = Date.now() - start;

      results.push({
        iteration,
        queryTime,
        usersFound: usersWithWishlist.length,
        testRaid: `${testRaidName}[${testElement}]`,
        userWishlistSize: userWishlist.wl.length
      });
    } catch (error) {
      results.push({
        iteration,
        error: error.message
      });
    }
  }

  return calculateStats('Raid Wishlist Ping', results);
}

// ==================== BOSS TIER PING TEST ====================
async function testBossTierPing() {
  const results = [];
  
  for (let iteration = 1; iteration <= 2; iteration++) {
    try {
      const mainDb = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
      const BotSettingsSchema = new mongoose.Schema({
        guildId: String,
        tierRoles: Object,
        bossRole: String
      }, { collection: 'botsettings' });
      const BotSettings = mainDb.model('BotSettings', BotSettingsSchema);

      const testGuildId = `test-guild-${Date.now()}-${iteration}`;
      
      // Setup test data
      await BotSettings.updateOne(
        { guildId: testGuildId },
        {
          $set: {
            guildId: testGuildId,
            bossRole: '123456789'
          }
        },
        { upsert: true }
      );

      // Measure query time
      const start = Date.now();
      const settings = await BotSettings.findOne({ guildId: testGuildId }).lean();
      const queryTime = Date.now() - start;

      // Cleanup
      await BotSettings.deleteOne({ guildId: testGuildId });

      results.push({
        iteration,
        queryTime,
        settingsFound: !!settings
      });

      await mainDb.close();
    } catch (error) {
      results.push({
        iteration,
        error: error.message
      });
    }
  }

  return calculateStats('Boss Tier Ping', results);
}

// ==================== CARD SEARCH TEST ====================
async function testCardSearch() {
  const results = [];
  
  for (let iteration = 1; iteration <= 2; iteration++) {
    try {
      const cardsPath = path.join(__dirname, '..', 'cards.json');
      
      const start = Date.now();
      const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));
      const searchTime = Date.now() - start;

      // Simulate search
      const searchStart = Date.now();
      const query = 'fire';
      const matches = cards.filter(c => 
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.element.toLowerCase().includes(query.toLowerCase())
      );
      const matchTime = Date.now() - searchStart;

      results.push({
        iteration,
        loadTime: searchTime,
        searchTime: matchTime,
        resultsFound: matches.length,
        totalCards: cards.length
      });
    } catch (error) {
      results.push({
        iteration,
        error: error.message
      });
    }
  }

  return calculateStats('Card Search', results);
}

// ==================== WISHLIST VIEW TEST ====================
async function testWishlistView() {
  const results = [];
  
  for (let iteration = 1; iteration <= 2; iteration++) {
    try {
      const Wishlist = await getWishlistConnection();
      const testUserId = `test-user-wishlist-${Date.now()}-${iteration}`;
      
      // Setup: Create test wishlist with multiple cards
      const cards = Array.from({ length: 8 }, (_, i) => ({
        n: `Card${i + 1}`,
        e: ['fire', 'water', 'air', 'earth', 'light', 'dark', 'electric', 'ice'][i % 8]
      }));

      const WishlistModel = Wishlist.model('Wishlist', new mongoose.Schema({
        _id: String,
        wl: [{ n: String, e: String }],
        cardCount: Number
      }, { _id: false }), 'wishlists');

      await WishlistModel.updateOne(
        { _id: testUserId },
        {
          $set: {
            _id: testUserId,
            wl: cards,
            cardCount: cards.length
          }
        },
        { upsert: true }
      );

      // Measure fetch time
      const start = Date.now();
      const wishlist = await WishlistModel.findById(testUserId).lean();
      const fetchTime = Date.now() - start;

      // Simulate grouping by element
      const groupStart = Date.now();
      const grouped = {};
      wishlist.wl.forEach(card => {
        if (!grouped[card.e]) grouped[card.e] = [];
        grouped[card.e].push(card.n);
      });
      const groupTime = Date.now() - groupStart;

      // Cleanup
      await WishlistModel.deleteOne({ _id: testUserId });

      results.push({
        iteration,
        fetchTime,
        groupTime,
        totalTime: fetchTime + groupTime,
        cardsCount: wishlist.wl.length
      });
    } catch (error) {
      results.push({
        iteration,
        error: error.message
      });
    }
  }

  return calculateStats('Wishlist View', results);
}

// ==================== DATABASE CONNECTION TEST ====================
async function testDatabaseConnection() {
  const results = [];
  
  for (let iteration = 1; iteration <= 2; iteration++) {
    try {
      const start = Date.now();
      const conn = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
      const connectionTime = Date.now() - start;

      // Simple ping
      const pingStart = Date.now();
      await conn.db.admin().ping();
      const pingTime = Date.now() - pingStart;

      await conn.close();

      results.push({
        iteration,
        connectionTime,
        pingTime,
        totalTime: connectionTime + pingTime
      });
    } catch (error) {
      results.push({
        iteration,
        error: error.message
      });
    }
  }

  return calculateStats('Database Connection', results);
}

// ==================== CACHE PERFORMANCE TEST ====================
async function testCachePerformance() {
  const cache = new Map();
  const results = [];
  
  for (let iteration = 1; iteration <= 2; iteration++) {
    try {
      // Write test
      const writeStart = Date.now();
      for (let i = 0; i < 100; i++) {
        cache.set(`key-${i}`, {
          data: `value-${i}`,
          timestamp: Date.now()
        });
      }
      const writeTime = Date.now() - writeStart;

      // Read test
      const readStart = Date.now();
      let found = 0;
      for (let i = 0; i < 100; i++) {
        if (cache.has(`key-${i}`)) found++;
      }
      const readTime = Date.now() - readStart;

      // Delete test
      const deleteStart = Date.now();
      for (let i = 0; i < 50; i++) {
        cache.delete(`key-${i}`);
      }
      const deleteTime = Date.now() - deleteStart;

      results.push({
        iteration,
        writeTime,
        readTime,
        deleteTime,
        totalTime: writeTime + readTime + deleteTime,
        itemsFound: found
      });
    } catch (error) {
      results.push({
        iteration,
        error: error.message
      });
    }
  }

  return calculateStats('Cache Performance', results);
}

// ==================== UTILITY FUNCTIONS ====================
function calculateStats(testName, results) {
  const validResults = results.filter(r => !r.error);
  
  if (validResults.length === 0) {
    return {
      testName,
      success: false,
      error: results[0]?.error || 'Unknown error'
    };
  }

  // Collect all timing metrics
  const metrics = {};
  Object.keys(validResults[0]).forEach(key => {
    if (key !== 'iteration' && typeof validResults[0][key] === 'number' && key.includes('Time')) {
      metrics[key] = validResults.map(r => r[key]);
    }
  });

  // Calculate averages and variance
  const stats = {};
  Object.entries(metrics).forEach(([key, values]) => {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = Math.max(...values) - Math.min(...values);
    stats[key] = { avg: avg.toFixed(2), min: Math.min(...values), max: Math.max(...values), variance };
  });

  return {
    testName,
    success: true,
    iterations: validResults.length,
    stats,
    rawResults: validResults
  };
}

function createResultEmbed(testResults) {
  const embed = new EmbedBuilder()
    .setColor(testResults.success ? 0x00aa00 : 0xaa0000)
    .setTitle(`🧪 ${testResults.testName} Test Results`);

  if (!testResults.success) {
    embed.addFields({ name: 'Error', value: testResults.error });
    return embed;
  }

  embed.addFields({
    name: 'Iterations',
    value: `${testResults.iterations}/2 completed`,
    inline: true
  });

  // Show raid tested for Raid Wishlist test
  if (testResults.rawResults?.[0]?.testRaid) {
    embed.addFields({
      name: '🎯 Raid Tested',
      value: testResults.rawResults[0].testRaid,
      inline: true
    });
    embed.addFields({
      name: '📋 Your Wishlist Size',
      value: `${testResults.rawResults[0].userWishlistSize} raid(s)`,
      inline: true
    });
  }

  Object.entries(testResults.stats).forEach(([metric, values]) => {
    const fieldName = metric
      .replace(/Time/g, '')
      .split(/(?=[A-Z])/)
      .join(' ')
      .toUpperCase();
    
    const fieldValue = `Avg: **${values.avg}ms**\nMin: ${values.min}ms | Max: ${values.max}ms\nVariance: ${values.variance}ms`;
    embed.addFields({ name: fieldName, value: fieldValue, inline: false });
  });

  // Add warnings for slow operations
  const allAvgs = Object.values(testResults.stats).map(s => parseFloat(s.avg));
  const slowestAvg = Math.max(...allAvgs);
  
  if (slowestAvg > 500) {
    embed.addFields({
      name: '⚠️ WARNING',
      value: `Some operations exceeded 500ms. Check database latency.`,
      inline: false
    });
  }

  return embed;
}

// ==================== TEXT COMMAND HANDLER ====================
const TEST_OPTIONS = {
  'raid-wishlist-ping': {
    label: '🎯 Raid Wishlist Ping',
    emoji: '🎯',
    fn: testRaidWishlistPing
  },
  'boss-tier-ping': {
    label: '👹 Boss Tier Ping',
    emoji: '👹',
    fn: testBossTierPing
  },
  'card-search': {
    label: '🔍 Card Search',
    emoji: '🔍',
    fn: testCardSearch
  },
  'wishlist-view': {
    label: '📋 Wishlist View',
    emoji: '📋',
    fn: testWishlistView
  },
  'database-connection': {
    label: '🗄️ Database Connection',
    emoji: '🗄️',
    fn: testDatabaseConnection
  },
  'cache-performance': {
    label: '⚡ Cache Performance',
    emoji: '⚡',
    fn: testCachePerformance
  }
};

async function handleTestCommand(message) {
  // Bot owner check
  if (message.author.id !== BOT_OWNER_ID) {
    return message.reply('❌ Only the bot owner can use this command.');
  }

  // Show menu
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('test_select')
    .setPlaceholder('Choose a test to run...')
    .addOptions(
      Object.entries(TEST_OPTIONS).map(([key, test]) => ({
        label: test.label,
        value: key,
        emoji: test.emoji
      }))
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('🧪 System Performance Tester')
    .setDescription('Select a test to run. Each test runs **2 iterations** and reports latency/performance metrics.')
    .addFields(
      { name: 'Available Tests', value: Object.values(TEST_OPTIONS).map(t => `${t.emoji} ${t.label}`).join('\n'), inline: false },
      { name: 'Results Include', value: '✓ Average, Min, Max latency\n✓ Variance (consistency)\n✓ Detailed metrics\n✓ Performance warnings', inline: false }
    );

  const reply = await message.reply({
    embeds: [embed],
    components: [row]
  });

  // Collect responses
  const collector = reply.createMessageComponentCollector({
    filter: i => i.user.id === message.author.id,
    time: 60000
  });

  collector.on('collect', async (interaction) => {
    const testKey = interaction.values[0];
    const test = TEST_OPTIONS[testKey];

    if (!test) {
      return interaction.reply({
        content: '❌ Test not found.',
        ephemeral: true
      });
    }

    // Acknowledge immediately
    await interaction.deferReply();

    const runningEmbed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle(`🔄 ${test.label}`)
      .setDescription('Running test (2 iterations in progress)...')
      .addFields({
        name: 'Status',
        value: '⏳ Please wait...',
        inline: false
      });

    await interaction.editReply({
      embeds: [runningEmbed],
      ephemeral: true
    });

    try {
      console.log(`[TEST] Starting: ${test.label}`);
      const startTime = Date.now();
      
      // For raid wishlist ping, pass the user ID and send a ping message
      let result;
      if (testKey === 'raid-wishlist-ping') {
        // Send ping message first to test if it reaches the user
        await interaction.channel.send(`${message.author} 📍 **Testing Raid Wishlist Ping** - Simulating raid detection and ping system...`).catch(() => {});
        
        // Run the test with user's actual wishlist
        result = await test.fn(message.author.id);
        
        // Send another ping message to show test completed
        await interaction.channel.send(`${message.author} ✅ **Raid Wishlist Test Complete** - Check results below.`).catch(() => {});
      } else {
        result = await test.fn();
      }
      
      const totalTime = Date.now() - startTime;

      const resultEmbed = createResultEmbed(result);
      resultEmbed.addFields({
        name: '⏱️ Test Execution Time',
        value: `${totalTime}ms`,
        inline: true
      });
      resultEmbed.setTimestamp();

      return interaction.editReply({
        embeds: [resultEmbed],
        ephemeral: true
      });

    } catch (error) {
      console.error(`[TEST ERROR] ${test.label}:`, error);
      const errorEmbed = new EmbedBuilder()
        .setColor(0xaa0000)
        .setTitle(`❌ ${test.label} Failed`)
        .addFields({
          name: 'Error',
          value: `\`\`\`${error.message}\`\`\``
        })
        .setTimestamp();

      return interaction.editReply({
        embeds: [errorEmbed],
        ephemeral: true
      });
    }
  });

  collector.on('end', () => {
    reply.edit({ components: [] }).catch(() => {});
  });
}

module.exports = {
  testRaidWishlistPing,
  testBossTierPing,
  testCardSearch,
  testWishlistView,
  testDatabaseConnection,
  testCachePerformance,
  createResultEmbed,
  handleTestCommand
};
