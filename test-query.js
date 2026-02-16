require('dotenv').config();
const mongoose = require('mongoose');

const WISHLIST_URI = process.env.WISHLIST_URI;

const wishlistSchema = new mongoose.Schema({
  _id: String,
  wl: [{
    n: String,
    e: String
  }]
}, {
  collection: 'users'
});

async function testQuery() {
  try {
    const conn = await mongoose.createConnection(WISHLIST_URI).asPromise();
    const Wishlist = conn.model('Wishlist', wishlistSchema);
    
    console.log('Testing exact query from code...\n');
    
    const query = {
      'wl.n': 'Mereoleona Vermillion',
      'wl.e': 'fire'
    };
    
    console.log('Query:', JSON.stringify(query));
    
    const results = await Wishlist.find(query);
    
    console.log(`\nResults: ${results.length} wishlist(s) found`);
    
    if (results.length > 0) {
      results.forEach(wl => {
        console.log(`\n  User ID: ${wl._id}`);
        console.log(`  Total items: ${wl.wl.length}`);
        const match = wl.wl.find(item => item.n === 'Mereoleona Vermillion' && item.e === 'fire');
        if (match) {
          console.log(`  ✅ Match: ${match.n} (${match.e})`);
        }
      });
    }
    
    await conn.close();
  } catch (error) {
    console.error('Error:', error);
  }
}

testQuery();
