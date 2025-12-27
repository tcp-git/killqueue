// Simple seed script to populate 20 queue slots (5 x 4)
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'supervisor',
  password: 'saas',
  database: 'qq'
};

async function run() {
  const conn = await mysql.createConnection({
    host: DB_CONFIG.host,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    multipleStatements: true
  });
  try {
    // run init SQL to create DB and table
    const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    await conn.query(initSql);
    await conn.end();

    const db = await mysql.createConnection(DB_CONFIG);
    await db.query('TRUNCATE TABLE queue_items');

    const inserts = [];
    let idx = 1;
    for (let r = 1; r <= 5; r++) {
      for (let c = 1; c <= 4; c++) {
        const num = String(idx).padStart(3, '0');
        inserts.push([num, r, c]);
        idx++;
      }
    }

    const stmt = 'INSERT INTO queue_items (queue_no, position_row, position_col) VALUES ?';
    await db.query(stmt, [inserts]);
    console.log('Seeded', inserts.length, 'rows');
    await db.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
