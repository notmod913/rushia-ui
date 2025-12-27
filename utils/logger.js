const { WebhookClient } = require('discord.js');
const mongoose = require('mongoose');

const logWebhook = process.env.LOG_WEBHOOK_URL ? new WebhookClient({ url: process.env.LOG_WEBHOOK_URL }) : null;
const errorWebhook = process.env.ERROR_WEBHOOK_URL ? new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL }) : null;

let Log = null;
let logsConnection = null;

// In-memory buffering for logs received before DB connection is ready.
// We'll cap the buffer to avoid unbounded memory growth.
const pendingLogs = [];
const MAX_PENDING_LOGS = 500;

function createLogDocument(level, message, metadata = {}) {
  return {
    level,
    message,
    timestamp: new Date(),
    guildId: metadata.guildId,
    userId: metadata.userId,
    channelId: metadata.channelId,
    metadata: metadata.metadata || metadata, // allow both { metadata: {} } or metadata object
  };
}

// Initialize logs database connection
async function initializeLogsDB() {
  if (!process.env.LOGS_URI) {
    // No logs DB configured; skip initialization.
    return;
  }

  try {
    // Create an uninitialized connection and explicitly open it so we can await readiness.
    logsConnection = mongoose.createConnection();
    await logsConnection.openUri(process.env.LOGS_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // If you want writes to be buffered by Mongoose instead of our in-memory buffer, set this to true.
      bufferCommands: false,
    });

    const logSchema = new mongoose.Schema({
      level: { type: String, required: true, enum: ['INFO', 'ERROR', 'WARN', 'DEBUG'] },
      message: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
      guildId: { type: String },
      userId: { type: String },
      channelId: { type: String },
      metadata: { type: Object },
    });
    // TTL index to expire logs after 30 days (2592000 seconds)
    logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

    Log = logsConnection.model('Log', logSchema);

    // Wire up connection event handlers to track state and flush pending logs on connect.
    logsConnection.on('connected', () => {
      console.log('✅ Logs DB connected');
      flushPendingLogs().catch(err => {
        // Log to console because DB logging may be unreliable here.
        console.error('Error flushing pending logs:', err);
      });
    });

    logsConnection.on('error', (err) => {
      console.error('Logs DB connection error:', err);
    });

    logsConnection.on('disconnected', () => {
      console.warn('Logs DB disconnected');
    });

    // If connection is already ready (openUri awaited), flush pending logs now.
    if (logsConnection.readyState === 1) {
      await flushPendingLogs();
    }
  } catch (error) {
    console.error('Failed to initialize logs database:', error);
  }
}

async function flushPendingLogs() {
  if (!Log || !logsConnection) return;
  if (logsConnection.readyState !== 1) return; // only flush when connected

  if (pendingLogs.length === 0) return;

  // Consume pending logs in a batch
  const docs = pendingLogs.splice(0, pendingLogs.length);
  try {
    // Use insertMany for efficiency; unordered so one failing doc won't stop others.
    await Log.insertMany(docs, { ordered: false });
  } catch (error) {
    // If some inserts fail, report and continue. We don't re-queue to avoid duplicates.
    console.error('Failed to insert some pending logs:', error);
  }
}

async function saveLogToDB(level, message, metadata = {}) {
  // If no log model (no LOGS_URI) configured, skip DB logging.
  if (!Log) return;

  // If connection not ready, buffer in memory up to MAX_PENDING_LOGS
  if (!logsConnection || logsConnection.readyState !== 1) {
    if (pendingLogs.length < MAX_PENDING_LOGS) {
      pendingLogs.push(createLogDocument(level, message, metadata));
    } else if (pendingLogs.length === MAX_PENDING_LOGS) {
      // Push a single notice that buffer is full, then stop pushing further logs.
      pendingLogs.push(createLogDocument('WARN', 'Pending logs buffer full - dropping further logs', {}));
      console.warn('Logs buffer full — further logs will be dropped until DB reconnects.');
    }
    return;
  }

  try {
    await Log.create(createLogDocument(level, message, metadata));
  } catch (error) {
    console.error('Failed to save log to database:', error);
  }
}

async function sendLog(message, metadata = {}) {
  // Save to DB (or buffer) but don't block on DB errors
  saveLogToDB('INFO', message, metadata).catch(() => { /* intentionally silent here */ });

  if (logWebhook) {
    try {
      await logWebhook.send(message);
    } catch (error) {
      // Silent fail for webhook errors
      console.error('Failed to send log webhook:', error);
    }
  }
}

async function sendError(message, metadata = {}) {
  saveLogToDB('ERROR', message, metadata).catch(() => { /* intentionally silent here */ });

  if (errorWebhook) {
    try {
      await errorWebhook.send(message);
    } catch (error) {
      // Silent fail for webhook errors
      console.error('Failed to send error webhook:', error);
    }
  }
}

async function sendWarn(message, metadata = {}) {
  saveLogToDB('WARN', message, metadata).catch(() => { /* intentionally silent here */ });
}

async function sendDebug(message, metadata = {}) {
  saveLogToDB('DEBUG', message, metadata).catch(() => { /* intentionally silent here */ });
}

module.exports = { sendLog, sendError, sendWarn, sendDebug, initializeLogsDB };
