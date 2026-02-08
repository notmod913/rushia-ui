const Reminder = require('../database/Reminder');
const { getUserSettings } = require('../utils/userSettingsManager');
const { sendLog, sendError } = require('../utils/logger');
const { SCHEDULER } = require('../config/constants');

async function checkReminders(client) {
  try {
    const dueReminders = await Reminder.getDueReminders(2000, SCHEDULER.BATCH_SIZE);
    if (dueReminders.length === 0) return;

    // Mark as sent immediately to prevent race conditions
    const reminderIds = dueReminders.map(r => r._id);
    await Reminder.markAsSent(reminderIds);

    const remindersToProcess = dueReminders.reduce((acc, reminder) => {
      const key = `${reminder.userId}-${reminder.type}`;
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

    for (const key in remindersToProcess) {
      const reminderData = remindersToProcess[key];

      sendPromises.push((async () => {
        try {
          const now = new Date();
          const delayMs = now - reminderData.remindAt;
          const timingInfo = delayMs < 0 ? `EARLY by ${Math.abs(delayMs)}ms` : `DELAYED by ${delayMs}ms`;
          
          let userSettings = await getUserSettings(reminderData.userId);
          if (!userSettings) {
            const { updateUserSettings } = require('../utils/userSettingsManager');
            userSettings = await updateUserSettings(reminderData.userId, {
              expedition: true,
              stamina: true,
              raid: true,
              drop: true,
              staminaDM: false,
              expeditionDM: false,
              dropDM: false,
              raidSpawnDM: false,
              raidSpawnReminder: true
            });
          }

          const sendReminder = userSettings[reminderData.type] !== false;
          let sendInDm = false;

          console.log(`[REMINDER CHECK] Type: ${reminderData.type}, User: ${reminderData.userId}, Enabled: ${sendReminder}`);

          if (reminderData.type === 'raid') {
            sendInDm = true;
          } else if (reminderData.type === 'stamina') {
            sendInDm = userSettings?.staminaDM;
          } else if (reminderData.type === 'expedition') {
            sendInDm = userSettings?.expeditionDM;
          } else if (reminderData.type === 'raidSpawn') {
            sendInDm = userSettings?.raidSpawnDM;
          } else if (reminderData.type === 'drop') {
            sendInDm = userSettings?.dropDM;
          }

          console.log(`[REMINDER CHECK] SendInDM: ${sendInDm}, Will send: ${sendReminder}`);

          if (sendReminder) {
            if (sendInDm) {
              const user = await client.users.fetch(reminderData.userId);
              if (user) {
                await user.send(reminderData.reminderMessage);
                console.log(`[REMINDER SENT] ${reminderData.type} to ${reminderData.userId} via DM | ${timingInfo}`);
              }
            } else {
              const channel = await client.channels.fetch(reminderData.channelId);
              if (channel) {
                await channel.send(reminderData.reminderMessage);
                console.log(`[REMINDER SENT] ${reminderData.type} to ${reminderData.userId} in channel | ${timingInfo}`);
              }
            }
          }
        } catch (error) {
          console.error(`[REMINDER ERROR] ${error.message}`);
        }
      })());
    }

    await Promise.all(sendPromises);

  } catch (error) {
    console.error(`[SCHEDULER ERROR] ${error.message}`);
  }
}

function startScheduler(client) {
  (function schedule() {
    checkReminders(client).finally(() => setTimeout(schedule, SCHEDULER.CHECK_INTERVAL));
  })();
  sendLog('[SCHEDULER] Reminder scheduler started.', { category: 'SYSTEM' });
}

module.exports = { startScheduler };
