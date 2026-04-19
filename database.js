const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'memory.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      issue TEXT NOT NULL,
      response TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  db.run(`
    CREATE TABLE IF NOT EXISTS user_facts (
      user_id TEXT NOT NULL,
      fact_key TEXT NOT NULL,
      fact_value TEXT NOT NULL,
      PRIMARY KEY (user_id, fact_key)
    )
  `);
});


/**
 * Saves a new interaction to the database
 */
function saveInteraction(userId, issue, response) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO interactions (user_id, issue, response) VALUES (?, ?, ?)`;
    db.run(query, [userId, issue, response], function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID });
    });
  });
}

/**
 * Retrieves global insights data
 */
function getGlobalInsights() {
  return new Promise((resolve, reject) => {
    const queries = {
      total: "SELECT COUNT(*) as count FROM interactions",
      repeated: "SELECT COUNT(*) as count FROM (SELECT issue FROM interactions GROUP BY issue HAVING COUNT(*) > 1)",
      mostCommon: "SELECT issue, COUNT(issue) as count FROM interactions GROUP BY issue ORDER BY count DESC LIMIT 1"
    };

    db.get(queries.total, (err, totalRow) => {
      if (err) return reject(err);
      db.get(queries.repeated, (err, repeatedRow) => {
        if (err) return reject(err);
        db.get(queries.mostCommon, (err, commonRow) => {
          if (err) return reject(err);
          resolve({
            totalIssues: totalRow.count || 0,
            repeatedIssues: repeatedRow.count || 0,
            mostCommonIssue: commonRow ? commonRow.issue : "None"
          });
        });
      });
    });
  });
}

/**
 * Retrieves all past interactions for a specific user
 */
function getUserInteractions(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM interactions WHERE user_id = ? ORDER BY timestamp DESC`;
    db.all(query, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Retrieves all interactions (all users)
 */
function getAllInteractions() {
  return new Promise((resolve, reject) => {
    const query = `SELECT * FROM interactions ORDER BY timestamp DESC`;
    db.all(query, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

/**
 * Saves or updates a specific user fact (structured memory)
 */
function saveFact(userId, key, value) {
  console.log(`[Database] Updating Memory - User: ${userId}, Key: ${key}, Value: ${value}`);
  return new Promise((resolve, reject) => {
    const query = `INSERT OR REPLACE INTO user_facts (user_id, fact_key, fact_value) VALUES (?, ?, ?)`;
    db.run(query, [userId, key, value], function(err) {
      if (err) reject(err);
      else resolve({ success: true });
    });
  });
}

/**
 * Retrieves a specific user fact by key
 */
function getFactByKey(userId, key) {
  return new Promise((resolve, reject) => {
    const query = `SELECT fact_value FROM user_facts WHERE user_id = ? AND fact_key = ?`;
    db.get(query, [userId, key], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.fact_value : null);
    });
  });
}

/**
 * Retrieves all known facts for a specific user
 */
function getAllUserFacts(userId) {
  return new Promise((resolve, reject) => {
    const query = `SELECT fact_key, fact_value FROM user_facts WHERE user_id = ?`;
    db.all(query, [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

module.exports = {
  saveInteraction,
  getUserInteractions,
  getGlobalInsights,
  getAllInteractions,
  saveFact,
  getFactByKey,
  getAllUserFacts
};


