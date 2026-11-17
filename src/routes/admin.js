const router = require('express').Router();
const db = require('../db');
const { auth, admin } = require('../middleware/auth');

router.use(auth, admin);

router.get('/stats', async (req, res, next) => {
  try {
    const q = async s => (await db.query(s)).rows[0].c;
    res.json({
      users: await q('SELECT COUNT(*)::int c FROM users'),
      pets_pending: await q("SELECT COUNT(*)::int c FROM pets WHERE status='pending'"),
      pets_available: await q("SELECT COUNT(*)::int c FROM pets WHERE status='available'"),
      pets_adopted: await q("SELECT COUNT(*)::int c FROM pets WHERE status='adopted'"),
      requests_pending: await q("SELECT COUNT(*)::int c FROM adoption_requests WHERE status='pending'")
    });
  } catch (e) { next(e); }
});

router.get('/pets', async (req, res, next) => {
  try {
    const v = [], w = [];
    if (req.query.status) { v.push(req.query.status); w.push('p.status=$1'); }
    const r = await db.query(
      `SELECT p.*, u.name AS owner_name FROM pets p JOIN users u ON u.id=p.owner_id
       ${w.length ? 'WHERE ' + w.join(' AND ') : ''} ORDER BY (p.status='pending') DESC, p.created_at DESC LIMIT 200`, v);
    res.json({ pets: r.rows });
  } catch (e) { next(e); }
});

router.patch('/pets/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'available', 'adopted', 'hidden'].includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    await db.query('UPDATE pets SET status=$1 WHERE id=$2', [status, parseInt(req.params.id) || 0]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/users', async (req, res, next) => {
  try {
    const r = await db.query('SELECT id,name,email,phone,province,role,status,verified,created_at FROM users ORDER BY created_at DESC LIMIT 300');
    res.json({ users: r.rows });
  } catch (e) { next(e); }
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id) || 0;
    if (id === req.user.id) return res.status(400).json({ error: 'ไม่สามารถแก้ไขบัญชีตัวเองได้' });
    const { status, verified } = req.body;
    if (status) await db.query('UPDATE users SET status=$1 WHERE id=$2', [status === 'banned' ? 'banned' : 'active', id]);
    if (typeof verified === 'boolean') await db.query('UPDATE users SET verified=$1 WHERE id=$2', [verified, id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/requests', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT r.id,r.status,r.score,r.created_at,p.name AS pet_name,u.name AS applicant_name
       FROM adoption_requests r JOIN pets p ON p.id=r.pet_id JOIN users u ON u.id=r.applicant_id
       ORDER BY r.created_at DESC LIMIT 200`);
    res.json({ requests: r.rows });
  } catch (e) { next(e); }
});

module.exports = router;
