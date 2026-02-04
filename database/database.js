const mongoose = require('mongoose');

class DatabaseManager {
  static async connect() {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        maxPoolSize: 20,
        minPoolSize: 5,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,
        retryWrites: true,
        retryReads: true,
        w: 'majority',
        readPreference: 'primaryPreferred',
        bufferCommands: false,
        autoIndex: false // Disable auto-indexing in production
      });

      // Enable query logging in development
      if (process.env.NODE_ENV === 'development') {
        mongoose.set('debug', true);
      }

      console.log('✅ MongoDB connected with optimized settings');
      console.log(`   - Pool size: 5-20 connections`);
      console.log(`   - Read preference: primaryPreferred`);
      console.log(`   - Retry writes: enabled`);
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  static async createIndexes() {
    try {
      const Reminder = require('./Reminder');
      const BotSettings = require('./BotSettings');
      const UserNotificationSettings = require('./UserNotificationSettings');
      const Drops = require('./Drops');
      const RarityDrop = require('./RarityDrop');

      console.log('🔧 Creating database indexes...');

      await Promise.all([
        Reminder.createIndexes(),
        BotSettings.createIndexes(),
        UserNotificationSettings.createIndexes(),
        Drops.createIndexes(),
        RarityDrop.createIndexes()
      ]);

      console.log('✅ All indexes created successfully');
    } catch (error) {
      console.error('❌ Failed to create indexes:', error);
    }
  }

  static async cleanup() {
    const Reminder = require('./Reminder');
    
    try {
      // Clean up old unsent reminders (older than 7 days)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const result = await Reminder.deleteMany({ 
        createdAt: { $lt: sevenDaysAgo },
        sent: false
      });
      
      if (result.deletedCount > 0) {
        console.log(`🧹 Cleaned up ${result.deletedCount} old reminders`);
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
    }
  }

  static async getStats() {
    try {
      const Reminder = require('./Reminder');
      const BotSettings = require('./BotSettings');
      const UserNotificationSettings = require('./UserNotificationSettings');

      const [reminderCount, guildCount, userCount] = await Promise.all([
        Reminder.countDocuments({ sent: false }),
        BotSettings.countDocuments(),
        UserNotificationSettings.countDocuments()
      ]);

      return {
        activeReminders: reminderCount,
        guilds: guildCount,
        users: userCount,
        poolSize: mongoose.connection.client.s.options.maxPoolSize
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error);
      return null;
    }
  }

  static async disconnect() {
    try {
      await mongoose.disconnect();
      console.log('✅ MongoDB disconnected');
    } catch (error) {
      console.error('❌ Disconnect failed:', error);
    }
  }
}

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('📡 MongoDB connection established');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await DatabaseManager.disconnect();
  process.exit(0);
});

module.exports = DatabaseManager;
