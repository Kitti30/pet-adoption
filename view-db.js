require('dotenv').config();
const db = require('./src/db');
(async () => {
  const t = process.argv[2] || 'pets';
  if (!['users', 'pets', 'adoption_requests'].includes(t)) {
    console.log('ใช้: node view-db.js users | pets | adoption_requests');
    process.exit();
  }
  const r = await db.query(`SELECT * FROM ${t} ORDER BY id`);
  if (t === 'users') r.rows.forEach(u => delete u.password_hash);
  console.table(r.rows);
  process.exit();
})();