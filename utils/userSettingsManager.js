const UserNotificationSettings = require('../database/UserNotificationSettings');
const { sendLog, sendError } = require('./logger');
const CacheManager = require('../optimization/cache');

async function initializeUserSettings() {
  try {
    const allSettings = await UserNotificationSettings.find();
    allSettings.forEach(settings => {
      CacheManager.setUserSettings(settings.userId, settings);
    });
    await sendLog(`[INFO] Cached user settings for ${allSettings.length} users.`);
  } catch (error) {
    console.error(`[ERROR] Failed to initialize user settings: ${error.message}`);
    await sendError(`[ERROR] Failed to initialize user settings: ${error.message}`);
  }
}

async function getUserSettings(userId) {
  // Check cache first
  let settings = CacheManager.getUserSettings(userId);
  if (settings) return settings;

  // Query database if not in cache
  try {
    settings = await UserNotificationSettings.findOne({ userId });
    if (settings) {
      CacheManager.setUserSettings(userId, settings);
    }
    return settings;
  } catch (error) {
    console.error(`[ERROR] Failed to get user settings for ${userId}: ${error.message}`);
    return null;
  }
}

async function updateUserSettings(userId, newSettings) {
  try {
    const updatedSettings = await UserNotificationSettings.findOneAndUpdate(
      { userId },
      { $set: newSettings },
      { new: true, upsert: true }
    );
    CacheManager.setUserSettings(userId, updatedSettings);
    await sendLog(`[INFO] User settings updated for user ${userId}`);
    return updatedSettings;
  } catch (error) {
    console.error(`[ERROR] Failed to update user settings for ${userId}: ${error.message}`);
    await sendError(`[ERROR] Failed to update user settings for ${userId}: ${error.message}`);
    return null;
  }
}

module.exports = {
  initializeUserSettings,
  getUserSettings,
  updateUserSettings,
};
