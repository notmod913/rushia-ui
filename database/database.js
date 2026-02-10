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
        autoIndex: false
      });
    } catch (error) {
      const { sendError } = require('../utils/logger');
      await sendError(`MongoDB connection failed: ${error.message}`);
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

      await Promise.all([
        Reminder.createIndexes(),
        BotSettings.createIndexes(),
        UserNotificationSettings.createIndexes(),
        Drops.createIndexes(),
        RarityDrop.createIndexes()
      ]);
    } catch (error) {
      const { sendError } = require('../utils/logger');
      await sendError(`Failed to create indexes: ${error.message}`);
    }
  }

  static async cleanup() {
    const Reminder = require('./Reminder');
    
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      await Reminder.deleteMany({ 
        createdAt: { $lt: sevenDaysAgo },
        sent: false
      });
    } catch (error) {
      const { sendError } = require('../utils/logger');
      await sendError(`Cleanup failed: ${error.message}`);
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
      return null;
    }
  }

  static async disconnect() {
    try {
      await mongoose.disconnect();
    } catch (error) {
      const { sendError } = require('../utils/logger');
      await sendError(`Disconnect failed: ${error.message}`);
    }
  }
}

mongoose.connection.on('error', (err) => {
  const { sendError } = require('../utils/logger');
  sendError(`MongoDB connection error: ${err.message}`).catch(() => {});
});

process.on('SIGINT', async () => {
  await DatabaseManager.disconnect();
  process.exit(0);
});

module.exports = DatabaseManager;
