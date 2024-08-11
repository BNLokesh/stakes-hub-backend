const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

// Path to the database file
const dbPath = path.join(__dirname, 'market.db');

const initializeDb = async () => {
  try {
    // Open a connection to the database
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Create a table if it doesn't exist
    await db.exec(`
      CREATE TABLE IF NOT EXISTS PendingOrderTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_qty INTEGER,
    buyer_price REAL,
    seller_price REAL,
    seller_qty INTEGER
);
    `);

    await db.exec(`
        CREATE TABLE IF NOT EXISTS CompletedOrderTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price REAL,
    qty INTEGER
);
      `);

      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_buyer_price ON PendingOrderTable (buyer_price);
      `);
      
      await db.exec(`
        CREATE INDEX IF NOT EXISTS idx_seller_price ON PendingOrderTable (seller_price);
      `);

    console.log('Database and table initialized successfully');
    await db.close();
  } catch (error) {
    console.error(`Error initializing database: ${error.message}`);
  }
};

initializeDb();
