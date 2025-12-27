// Load environment variables from .env if present
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

// --- Assumptions ---
const DB_CONFIG = {
  host: '127.0.0.1',
  user: 'supervisor',
  password: 'saas',
  database: 'qq'
};

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

let pool;
async function initDb() {
  pool = mysql.createPool({
    host: DB_CONFIG.host,
    user: DB_CONFIG.user,
    password: DB_CONFIG.password,
    database: DB_CONFIG.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

app.get('/api/health', async (req, res) => {
  res.json({status: 'ok'});
});

app.get('/api/queue', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM queue_items ORDER BY id');
  res.json(rows);
});

app.post('/api/select', async (req, res) => {
  const ids = req.body.ids || [];
  if (!Array.isArray(ids)) return res.status(400).json({error: 'ids must be array'});
  if (ids.length === 0) return res.json({updated:0});
  const [result] = await pool.query('UPDATE queue_items SET status = ? WHERE id IN (?)', ['SELECTED', ids]);
  res.json({updated: result.affectedRows});
});

app.post('/api/call', async (req, res) => {
  const ids = req.body.ids || [];
  const called_by = req.body.called_by || 'unknown';
  if (!Array.isArray(ids)) return res.status(400).json({error: 'ids must be array'});
  if (ids.length === 0) return res.json({updated:0});
  const now = new Date();
  const [result] = await pool.query('UPDATE queue_items SET status = ?, called_at = ?, called_by = ? WHERE id IN (?)', ['CALLED', now, called_by, ids]);
  res.json({updated: result.affectedRows});
});

app.post('/api/cancel', async (req, res) => {
  const ids = req.body.ids || [];
  if (!Array.isArray(ids)) return res.status(400).json({error: 'ids must be array'});
  if (ids.length === 0) return res.json({updated:0});
  const [result] = await pool.query('UPDATE queue_items SET status = ? WHERE id IN (?)', ['CANCEL', ids]);
  res.json({updated: result.affectedRows});
});

app.post('/api/skip', async (req, res) => {
  const ids = req.body.ids || [];
  if (!Array.isArray(ids)) return res.status(400).json({error: 'ids must be array'});
  if (ids.length === 0) return res.json({updated:0});
  const [result] = await pool.query('UPDATE queue_items SET status = ? WHERE id IN (?)', ['SKIP', ids]);
  res.json({updated: result.affectedRows});
});

const PORT = process.env.PORT || 8080;
initDb().then(() => {
  app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
}).catch(err => {
  console.error('Failed to initialize DB pool', err);
  process.exit(1);
});
