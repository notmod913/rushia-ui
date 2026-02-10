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
    // TTL index to expire logs after 7 days (604800 seconds)
    logSchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 });

    Log = logsConnection.model('Log', logSchema);

    // Wire up connection event handlers to track state and flush pending logs on connect.
    logsConnection.on('connected', () => {
      flushPendingLogs().catch(() => {});
    });

    logsConnection.on('error', (err) => {
      saveLogToDB('ERROR', `Logs DB error: ${err.message}`).catch(() => {});
    });

    // If connection is already ready (openUri awaited), flush pending logs now.
    if (logsConnection.readyState === 1) {
      await flushPendingLogs();
    }
  } catch (error) {
    // Silent fail - can't log to DB if DB init failed
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
    // Silent fail
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
      pendingLogs.push(createLogDocument('WARN', 'Pending logs buffer full - dropping further logs', {}));
    }
    return;
  }

  try {
    await Log.create(createLogDocument(level, message, metadata));
  } catch (error) {
    // Silent fail
  }
}

async function sendLog(message, metadata = {}) {
  const logData = typeof message === 'string' && !metadata.category 
    ? { message, ...metadata }
    : { message, metadata };
  
  saveLogToDB('INFO', logData.message, logData.metadata || logData).catch(() => {});

  if (logWebhook) {
    try {
      await logWebhook.send(message);
    } catch (error) {
      // Silent fail
    }
  }
}

async function sendError(message, metadata = {}) {
  const logData = typeof message === 'string' && !metadata.category 
    ? { message, ...metadata }
    : { message, metadata };
  
  saveLogToDB('ERROR', logData.message, logData.metadata || logData).catch(() => {});

  if (errorWebhook) {
    try {
      await errorWebhook.send(message);
    } catch (error) {
      // Silent fail
    }
  }
}

async function sendWarn(message, metadata = {}) {
  saveLogToDB('WARN', message, metadata).catch(() => {});
}

async function sendDebug(message, metadata = {}) {
  saveLogToDB('DEBUG', message, metadata).catch(() => {});
}

function silenceConsole() {
  const noop = () => {};
  const originalConsole = { log: console.log, error: console.error, warn: console.warn, info: console.info, debug: console.debug };
  
  console.log = (...args) => saveLogToDB('INFO', args.join(' ')).catch(noop);
  console.info = (...args) => saveLogToDB('INFO', args.join(' ')).catch(noop);
  console.error = (...args) => saveLogToDB('ERROR', args.join(' ')).catch(noop);
  console.warn = (...args) => saveLogToDB('WARN', args.join(' ')).catch(noop);
  console.debug = (...args) => saveLogToDB('DEBUG', args.join(' ')).catch(noop);
  
  return originalConsole;
}

module.exports = { sendLog, sendError, sendWarn, sendDebug, initializeLogsDB, silenceConsole };
