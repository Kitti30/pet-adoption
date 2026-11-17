require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('../src/db');

(async () => {
  await db.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  console.log('✔ สร้างตารางเรียบร้อย');
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (ADMIN_EMAIL && ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.query(
      `INSERT INTO users(name,email,password_hash,role,verified)
       VALUES('ผู้ดูแลระบบ',lower($1),$2,'admin',TRUE)
       ON CONFLICT (email) DO NOTHING`, [ADMIN_EMAIL, hash]);
    console.log('✔ สร้างบัญชี Admin:', ADMIN_EMAIL);
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
