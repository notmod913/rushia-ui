const express = require('express');
const crypto = require('crypto');

const router = express.Router();

// Generate secure API key - Add this to your .env: LOGS_API_KEY=your_generated_key
const API_KEY = process.env.LOGS_API_KEY || crypto.randomBytes(32).toString('hex');

// Log storage (last 5000 logs in memory)
const logs = [];
const MAX_LOGS = 5000;

// Middleware: Verify API key
const authenticate = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Store log
function addLog(level, category, message, metadata = {}) {
  const log = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    ...metadata
  };
  
  logs.unshift(log);
  if (logs.length > MAX_LOGS) logs.pop();
  
  return log;
}

// GET /api/logs - Fetch logs
router.get('/logs', authenticate, (req, res) => {
  const { level, category, search, limit = 100, offset = 0 } = req.query;
  
  let filtered = logs;
  
  if (level) filtered = filtered.filter(l => l.level === level);
  if (category) filtered = filtered.filter(l => l.category === category);
  if (search) filtered = filtered.filter(l => l.message.toLowerCase().includes(search.toLowerCase()));
  
  res.json({
    total: filtered.length,
    logs: filtered.slice(+offset, +offset + +limit)
  });
});

// GET /api/logs/stats - Statistics
router.get('/logs/stats', authenticate, (req, res) => {
  const now = Date.now();
  const hour = 3600000;
  
  res.json({
    total: logs.length,
    byLevel: {
      INFO: logs.filter(l => l.level === 'INFO').length,
      WARN: logs.filter(l => l.level === 'WARN').length,
      ERROR: logs.filter(l => l.level === 'ERROR').length,
      DEBUG: logs.filter(l => l.level === 'DEBUG').length
    },
    lastHour: logs.filter(l => now - new Date(l.timestamp).getTime() < hour).length,
    categories: [...new Set(logs.map(l => l.category))]
  });
});

// DELETE /api/logs - Clear logs
router.delete('/logs', authenticate, (req, res) => {
  const count = logs.length;
  logs.length = 0;
  res.json({ cleared: count });
});

// Print API key on startup
if (!process.env.LOGS_API_KEY) {
  console.log('\n⚠️  LOGS_API_KEY not set in .env');
  console.log(`Generated API Key: ${API_KEY}`);
  console.log('Add this to your .env file:\n');
  console.log(`LOGS_API_KEY=${API_KEY}\n`);
}

module.exports = { router, addLog, API_KEY };
