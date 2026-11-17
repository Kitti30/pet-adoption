const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { auth } = require('../middleware/auth');

function sign(u, res) {
  const token = jwt.sign({ id: u.id, role: u.role, name: u.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 });
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, phone, province } = req.body;
    if (!name || !email || !password || password.length < 6)
      return res.status(400).json({ error: 'กรอกข้อมูลให้ครบ และรหัสผ่านอย่างน้อย 6 ตัวอักษร' });
    const hash = await bcrypt.hash(password, 10);
    const r = await db.query(
      `INSERT INTO users(name,email,password_hash,phone,province)
       VALUES($1,lower($2),$3,$4,$5) ON CONFLICT (email) DO NOTHING
       RETURNING id,name,email,role`, [name.trim(), email.trim(), hash, phone || null, province || null]);
    if (!r.rows.length) return res.status(409).json({ error: 'อีเมลนี้ถูกใช้สมัครแล้ว' });
    sign(r.rows[0], res);
    res.json({ user: r.rows[0] });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const r = await db.query('SELECT * FROM users WHERE email=lower($1)', [(email || '').trim()]);
    const u = r.rows[0];
    if (!u || !(await bcrypt.compare(password || '', u.password_hash)))
      return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
    if (u.status === 'banned') return res.status(403).json({ error: 'บัญชีนี้ถูกระงับการใช้งาน' });
    sign(u, res);
    res.json({ user: { id: u.id, name: u.name, email: u.email, role: u.role } });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });

router.get('/me', auth, async (req, res, next) => {
  try {
    const r = await db.query('SELECT id,name,email,role,phone,province,verified,status FROM users WHERE id=$1', [req.user.id]);
    if (!r.rows[0] || r.rows[0].status === 'banned') { res.clearCookie('token'); return res.status(401).json({ error: 'ไม่พบบัญชี' }); }
    res.json({ user: r.rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
