# Structured Logs Documentation

All logs are stored in MongoDB at `LOGS_URI` in the `logs` collection.

## Database Schema

```javascript
{
  _id: ObjectId,
  level: String,        // "INFO", "ERROR", "WARN", "DEBUG"
  message: String,      // Action identifier (e.g., "REMINDER_CREATED")
  timestamp: Date,      // Auto-generated
  guildId: String,      // Optional
  userId: String,       // Optional
  channelId: String,    // Optional
  metadata: Object      // Structured data
}
```

## Log Categories

### 1. REMINDER Logs

#### REMINDER_CREATED (INFO)
```json
{
  "level": "INFO",
  "message": "REMINDER_CREATED",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "metadata": {
    "category": "REMINDER",
    "action": "CREATED",
    "type": "stamina|expedition|raid|raidSpawn",
    "userId": "123456789",
    "guildId": "987654321",
    "channelId": "111222333",
    "remindAt": "2024-01-15T12:00:00.000Z",
    "cardCount": 3  // Only for expedition
  }
}
```

#### REMINDER_SENT (INFO)
```json
{
  "level": "INFO",
  "message": "REMINDER_SENT",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "metadata": {
    "category": "REMINDER",
    "action": "SENT",
    "type": "stamina|expedition|raid|raidSpawn",
    "userId": "123456789",
    "guildId": "987654321",
    "channelId": "111222333",  // Only if method is CHANNEL
    "method": "DM|CHANNEL"
  }
}
```

#### REMINDER_CREATE_FAILED (ERROR)
```json
{
  "level": "ERROR",
  "message": "REMINDER_CREATE_FAILED",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "metadata": {
    "category": "REMINDER",
    "action": "CREATE_FAILED",
    "type": "stamina|expedition|raid|raidSpawn",
    "userId": "123456789",
    "error": "Error message"
  }
}
```

#### REMINDER_SEND_FAILED (ERROR)
```json
{
  "level": "ERROR",
  "message": "REMINDER_SEND_FAILED",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "metadata": {
    "category": "REMINDER",
    "action": "SEND_FAILED",
    "type": "stamina|expedition|raid|raidSpawn",
    "userId": "123456789",
    "error": "Error message"
  }
}
```

### 2. SYSTEM Logs

#### BOT_READY (INFO)
```json
{
  "level": "INFO",
  "message": "BOT_READY",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "metadata": {
    "category": "SYSTEM",
    "action": "BOT_READY",
    "botTag": "BotName#1234",
    "botId": "123456789"
  }
}
```

#### SETTINGS_INITIALIZED (INFO)
```json
{
  "level": "INFO",
  "message": "SETTINGS_INITIALIZED",
  "timestamp": "2024-01-15T10:00:01.000Z",
  "metadata": {
    "category": "SYSTEM",
    "action": "SETTINGS_INITIALIZED",
    "guildCount": 10
  }
}
```

#### USER_SETTINGS_INITIALIZED (INFO)
```json
{
  "level": "INFO",
  "message": "USER_SETTINGS_INITIALIZED",
  "timestamp": "2024-01-15T10:00:02.000Z",
  "metadata": {
    "category": "SYSTEM",
    "action": "USER_SETTINGS_INITIALIZED",
    "userCount": 150
  }
}
```

#### SCHEDULER_ERROR (ERROR)
```json
{
  "level": "ERROR",
  "message": "SCHEDULER_ERROR",
  "timestamp": "2024-01-15T12:00:00.000Z",
  "metadata": {
    "category": "SYSTEM",
    "action": "SCHEDULER_ERROR",
    "error": "Error message"
  }
}
```

## MongoDB Query Examples

### Get all reminder creations
```javascript
db.logs.find({ 
  "metadata.category": "REMINDER",
  "metadata.action": "CREATED"
})
```

### Get reminders for specific user
```javascript
db.logs.find({ 
  "metadata.userId": "123456789",
  "metadata.category": "REMINDER"
}).sort({ timestamp: -1 })
```

### Get all errors
```javascript
db.logs.find({ level: "ERROR" }).sort({ timestamp: -1 })
```

### Get reminders by type
```javascript
db.logs.find({ 
  "metadata.type": "expedition",
  "metadata.action": "CREATED"
})
```

### Get statistics
```javascript
// Count by action
db.logs.aggregate([
  { $match: { "metadata.category": "REMINDER" } },
  { $group: { _id: "$metadata.action", count: { $sum: 1 } } }
])

// Count by type
db.logs.aggregate([
  { $match: { "metadata.category": "REMINDER" } },
  { $group: { _id: "$metadata.type", count: { $sum: 1 } } }
])

// Count by level
db.logs.aggregate([
  { $group: { _id: "$level", count: { $sum: 1 } } }
])
```

## Website Integration

Your website can connect directly to MongoDB using the LOGS_URI and query the logs collection.

### Example with Node.js/Express
```javascript
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  level: String,
  message: String,
  timestamp: Date,
  metadata: Object
});

const Log = mongoose.model('Log', logSchema);

// Get recent reminders
const recentReminders = await Log.find({
  'metadata.category': 'REMINDER'
}).sort({ timestamp: -1 }).limit(100);

// Get user activity
const userActivity = await Log.find({
  'metadata.userId': userId
}).sort({ timestamp: -1 });
```

## Indexes for Performance

The logs collection has a TTL index on `timestamp` (7 days auto-delete).

Recommended additional indexes for your website:
```javascript
db.logs.createIndex({ "metadata.category": 1, timestamp: -1 })
db.logs.createIndex({ "metadata.userId": 1, timestamp: -1 })
db.logs.createIndex({ "metadata.action": 1, timestamp: -1 })
db.logs.createIndex({ level: 1, timestamp: -1 })
```
