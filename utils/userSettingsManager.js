const UserNotificationSettings = require('../database/UserNotificationSettings');
const { sendLog, sendError } = require('./logger');
const CacheManager = require('../optimization/cache');

async function initializeUserSettings() {
  try {
    const allSettings = await UserNotificationSettings.find();
    allSettings.forEach(settings => {
      CacheManager.setUserSettings(settings.userId, settings);
    });
    await sendLog('USER_SETTINGS_INITIALIZED', { 
      category: 'SYSTEM',
      action: 'USER_SETTINGS_INITIALIZED',
      userCount: allSettings.length
    });
  } catch (error) {
    await sendError('USER_SETTINGS_INIT_FAILED', { 
      category: 'SYSTEM',
      action: 'USER_SETTINGS_INIT_FAILED',
      error: error.message
    });
  }
}

async function getUserSettings(userId) {
  let settings = CacheManager.getUserSettings(userId);
  if (settings) return settings;

  try {
    settings = await UserNotificationSettings.findOne({ userId });
    if (settings) {
      CacheManager.setUserSettings(userId, settings);
    }
    return settings;
  } catch (error) {
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
    await sendLog(`User settings updated for user ${userId}`);
    return updatedSettings;
  } catch (error) {
    await sendError(`Failed to update user settings for ${userId}: ${error.message}`);
    return null;
  }
}

module.exports = {
  initializeUserSettings,
  getUserSettings,
  updateUserSettings,
};
