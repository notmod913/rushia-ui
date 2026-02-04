const userSettingsCache = new Map();
const guildSettingsCache = new Map();

class CacheManager {
  // User Settings
  static setUserSettings(userId, data) {
    userSettingsCache.set(userId, data);
  }

  static getUserSettings(userId) {
    return userSettingsCache.get(userId);
  }

  // Guild Settings
  static setGuildSettings(guildId, data) {
    guildSettingsCache.set(guildId, data);
  }

  static getGuildSettings(guildId) {
    return guildSettingsCache.get(guildId);
  }

  static clearAll() {
    userSettingsCache.clear();
    guildSettingsCache.clear();
  }
}

module.exports = CacheManager;
