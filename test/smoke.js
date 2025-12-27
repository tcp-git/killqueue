const http = require('http');

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

function fetch(path) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: '127.0.0.1', port: PORT, path, timeout: 5000 };
    http.get(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject).on('timeout', () => reject(new Error('timeout')));
  });
}

(async function() {
  try {
    const h = await fetch('/api/health');
    if (h.status !== 200) throw new Error('/api/health status ' + h.status);
    const js = JSON.parse(h.body || '{}');
    if (js.status !== 'ok') throw new Error('/api/health body invalid');

    const q = await fetch('/api/queue');
    if (q.status !== 200) throw new Error('/api/queue status ' + q.status);
    const arr = JSON.parse(q.body || '[]');
    if (!Array.isArray(arr)) throw new Error('/api/queue did not return array');

    console.log('SMOKE OK - queue length =', arr.length);
    process.exit(0);
  } catch (err) {
    console.error('SMOKE FAILED', err && err.message ? err.message : err);
    process.exit(2);
  }
})();
