const Reminder = require('../database/Reminder');
const { getUserSettings } = require('../utils/userSettingsManager');
const { sendLog, sendError } = require('../utils/logger');
const { SCHEDULER } = require('../config/constants');

async function checkReminders(client) {
  try {
    const now = new Date();
    const dueReminders = await Reminder.find({ remindAt: { $lte: now } }).limit(SCHEDULER.BATCH_SIZE);

    if (dueReminders.length === 0) return;

    const remindersToProcess = dueReminders.reduce((acc, reminder) => {
      const key = reminder.type === 'raid_reset' ? `${reminder.guildId}-${reminder.type}` : `${reminder.userId}-${reminder.reminderMessage}`;
      if (!acc[key]) {
        acc[key] = {
          userId: reminder.userId,
          guildId: reminder.guildId,
          channelId: reminder.channelId,
          reminderMessage: reminder.reminderMessage,
          type: reminder.type,
          remindAt: reminder.remindAt,
          reminderIds: [],
        };
      }
      acc[key].reminderIds.push(reminder._id);
      return acc;
    }, {});

    const sendPromises = [];
    const remindersToDelete = [];

    for (const key in remindersToProcess) {
      const reminderData = remindersToProcess[key];
      remindersToDelete.push(...reminderData.reminderIds);

      const sendPromise = (async () => {
        try {
          const delayMs = now - reminderData.remindAt;
          const isEarly = delayMs < 0;
          const timingInfo = isEarly ? `EARLY by ${Math.abs(delayMs)}ms` : `DELAYED by ${delayMs}ms`;
          
          let userSettings = getUserSettings(reminderData.userId);
          if (!userSettings) {
            const { updateUserSettings } = require('../utils/userSettingsManager');
            await updateUserSettings(reminderData.userId, {
              expedition: true,
              stamina: true,
              raid: true,
              staminaDM: false,
              expeditionDM: false,
              raidSpawnReminder: true
            });
            userSettings = getUserSettings(reminderData.userId);
          }
          const sendReminder = userSettings[reminderData.type] !== false;
          
          // Determine DM preference based on reminder type
          let sendInDm = false;
          if (reminderData.type === 'raid') {
            sendInDm = true; // Raid always DM
          } else if (reminderData.type === 'stamina') {
            sendInDm = userSettings && userSettings.staminaDM;
          } else if (reminderData.type === 'expedition') {
            sendInDm = userSettings && userSettings.expeditionDM;
          } else if (reminderData.type === 'raidSpawn') {
            sendInDm = userSettings && userSettings.raidSpawnDM;
          }

          if (sendReminder) {
            if (sendInDm) {
              const user = await client.users.fetch(reminderData.userId);
              if (user) {
                await user.send(reminderData.reminderMessage);
                await sendLog(`[REMINDER SENT] Type: ${reminderData.type}, User: ${reminderData.userId} via DM | ${timingInfo}`, {
                  category: 'REMINDER',
                  type: reminderData.type,
                  userId: reminderData.userId,
                  method: 'DM',
                  delayMs,
                  isEarly
                });
              }
            } else {
              const channel = await client.channels.fetch(reminderData.channelId);
              if (channel) {
                await channel.send(reminderData.reminderMessage);
                await sendLog(`[REMINDER SENT] Type: ${reminderData.type}, User: ${reminderData.userId} in Channel: ${reminderData.channelId} | ${timingInfo}`, {
                  category: 'REMINDER',
                  type: reminderData.type,
                  userId: reminderData.userId,
                  channelId: reminderData.channelId,
                  method: 'CHANNEL',
                  delayMs,
                  isEarly
                });
              }
            }
          }
        } catch (error) {
          if (error.code === 50007) {
            await sendLog(`[REMINDER] Cannot DM user - permissions denied`, {
              category: 'REMINDER',
              userId: reminderData.userId,
              error: 'CANNOT_DM'
            });
          } else if (error.code === 50013) {
            const channel = await client.channels.fetch(reminderData.channelId).catch(() => null);
            const guild = channel?.guild;
            await sendLog(`[REMINDER] Missing permissions for #${channel?.name || reminderData.channelId} in ${guild?.name || 'Unknown Server'}`, {
              category: 'REMINDER',
              channelId: reminderData.channelId,
              guildId: reminderData.guildId,
              error: 'MISSING_PERMISSIONS'
            });
          } else {
            await sendError(`[REMINDER] Failed to send: ${error.message}`, {
              category: 'REMINDER',
              userId: reminderData.userId,
              channelId: reminderData.channelId,
              type: reminderData.type,
              error: error.stack
            });
          }
        }
      })();
      sendPromises.push(sendPromise);
    }

    await Promise.all(sendPromises);

    // Clean up all processed reminders
    if (remindersToDelete.length > 0) {
      try {
        await Reminder.deleteMany({ _id: { $in: remindersToDelete } });
      } catch (error) {
        console.error(`Failed to delete reminders:`, error);
        await sendError(`[ERROR] Failed to delete reminders:\n${error.message}`);
      }
    }

  } catch (error) {
    console.error(`[ERROR] Error in checkReminders: ${error.message}`, error);
  }

}

function startScheduler(client) {
  (function schedule() {
    checkReminders(client).finally(() => setTimeout(schedule, SCHEDULER.CHECK_INTERVAL));
  })();
  sendLog('[SCHEDULER] Reminder scheduler started.', { category: 'SYSTEM' });
}

module.exports = { startScheduler };
