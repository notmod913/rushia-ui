const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  n: { type: String, required: true },
  e: { type: String, required: true }
}, { _id: false });

const wishlistSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  wl: [wishlistItemSchema],
  cardCount: { type: Number, default: 0 },
  updatedAt: { type: Date, default: Date.now }
}, { collection: 'wishlists' });

// Index for fast _id lookup
wishlistSchema.index({ _id: 1 }, { name: 'idx_user_id' });

// Index for sorting by update time
wishlistSchema.index({ updatedAt: -1 }, { name: 'idx_updated' });

// Pre-save hook to update denormalized cardCount
wishlistSchema.pre('save', function(next) {
  if (this.isModified('wl')) {
    this.cardCount = this.wl.length;
    this.updatedAt = new Date();
  }
  next();
});

module.exports = mongoose.model('Wishlist', wishlistSchema, 'wishlists');
