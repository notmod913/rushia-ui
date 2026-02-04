const BotSettings = require('../database/BotSettings');
const { sendLog, sendError } = require('./logger');
const CacheManager = require('../optimization/cache');

async function initializeSettings() {
  try {
    const allSettings = await BotSettings.find();
    allSettings.forEach(settings => {
      CacheManager.setGuildSettings(settings.guildId, settings);
    });
    await sendLog(`[INFO] Cached guild settings for ${allSettings.length} guilds.`);
  } catch (error) {
    console.error(`[ERROR] Failed to initialize settings: ${error.message}`);
    await sendError(`[ERROR] Failed to initialize settings: ${error.message}`);
  }
}

async function getSettings(guildId) {
  // Check cache first
  let settings = CacheManager.getGuildSettings(guildId);
  if (settings) return settings;

  // Query database if not in cache
  try {
    settings = await BotSettings.findOne({ guildId });
    if (settings) {
      CacheManager.setGuildSettings(guildId, settings);
    }
    return settings;
  } catch (error) {
    console.error(`[ERROR] Failed to get settings for guild ${guildId}: ${error.message}`);
    return null;
  }
}

async function updateSettings(guildId, newSettings) {
  try {
    const update = {};
    const toUnset = {};

    for (const key in newSettings) {
      if (newSettings[key] === undefined) {
        toUnset[key] = 1;
      } else {
        if (!update.$set) update.$set = {};
        update.$set[key] = newSettings[key];
      }
    }

    if (Object.keys(toUnset).length > 0) {
      update.$unset = toUnset;
    }

    const updatedSettings = await BotSettings.findOneAndUpdate(
      { guildId },
      update,
      { new: true, upsert: true }
    );

    CacheManager.setGuildSettings(guildId, updatedSettings);
    await sendLog(`[INFO] Settings updated for guild ${guildId}`);
    return updatedSettings;
  } catch (error) {
    console.error(`[ERROR] Failed to update settings for guild ${guildId}: ${error.message}`);
    await sendError(`[ERROR] Failed to update settings for guild ${guildId}: ${error.message}`);
    return null;
  }
}

module.exports = {
  initializeSettings,
  getSettings,
  updateSettings,
};
