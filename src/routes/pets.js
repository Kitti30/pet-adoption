const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { auth, optionalAuth } = require('../middleware/auth');

const dir = path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(dir, { recursive: true });
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: dir,
    filename: (req, f, cb) => cb(null, crypto.randomBytes(10).toString('hex') + EXT[f.mimetype])
  }),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, f, cb) => cb(null, !!EXT[f.mimetype])
});

// ค้นหา: ชนิด สายพันธุ์ อายุ พื้นที่
router.get('/', async (req, res, next) => {
  try {
    const { species, breed, age, province, q } = req.query;
    const w = ["p.status='available'"], v = [];
    if (species) { v.push(species); w.push(`p.species=$${v.length}`); }
    if (breed) { v.push('%' + breed + '%'); w.push(`p.breed ILIKE $${v.length}`); }
    if (province) { v.push('%' + province + '%'); w.push(`p.province ILIKE $${v.length}`); }
    if (q) { v.push('%' + q + '%'); w.push(`(p.name ILIKE $${v.length} OR p.description ILIKE $${v.length})`); }
    const ages = { baby: 'p.age_months<12', young: 'p.age_months BETWEEN 12 AND 35', adult: 'p.age_months BETWEEN 36 AND 95', senior: 'p.age_months>=96' };
    if (ages[age]) w.push(ages[age]);
    const limit = Math.min(parseInt(req.query.limit) || 60, 100);
    const r = await db.query(
      `SELECT p.*, u.name AS owner_name FROM pets p JOIN users u ON u.id=p.owner_id
       WHERE ${w.join(' AND ')} ORDER BY p.created_at DESC LIMIT ${limit}`, v);
    res.json({ pets: r.rows });
  } catch (e) { next(e); }
});

router.get('/mine', auth, async (req, res, next) => {
  try {
    const r = await db.query('SELECT * FROM pets WHERE owner_id=$1 ORDER BY created_at DESC', [req.user.id]);
    res.json({ pets: r.rows });
  } catch (e) { next(e); }
});

router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT p.*, u.name AS owner_name, u.verified AS owner_verified FROM pets p
       JOIN users u ON u.id=p.owner_id WHERE p.id=$1`, [parseInt(req.params.id) || 0]);
    const p = r.rows[0];
    if (!p) return res.status(404).json({ error: 'ไม่พบสัตว์ตัวนี้' });
    const isOwner = req.user && (req.user.id === p.owner_id || req.user.role === 'admin');
    if (!['available', 'adopted'].includes(p.status) && !isOwner) return res.status(404).json({ error: 'ไม่พบสัตว์ตัวนี้' });
    p.is_owner = !!isOwner;
    if (req.user) {
      const q = await db.query('SELECT status FROM adoption_requests WHERE pet_id=$1 AND applicant_id=$2', [p.id, req.user.id]);
      p.my_request = q.rows[0] ? q.rows[0].status : null;
    }
    res.json({ pet: p });
  } catch (e) { next(e); }
});

// ลงทะเบียนสัตว์ที่ต้องการหาบ้าน (รอแอดมินอนุมัติก่อนขึ้นประกาศ)
router.post('/', auth, upload.single('image'), async (req, res, next) => {
  try {
    const { name, species, breed, age_months, gender, province, description, health_note } = req.body;
    if (!name || !species || !province) return res.status(400).json({ error: 'กรอกชื่อ ชนิดสัตว์ และจังหวัดให้ครบ' });
    const img = req.file ? '/uploads/' + req.file.filename : null;
    const r = await db.query(
      `INSERT INTO pets(owner_id,name,species,breed,age_months,gender,province,description,health_note,image_url)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.user.id, name.trim(), species, breed || null, Math.max(parseInt(age_months) || 0, 0),
       gender || 'unknown', province.trim(), description || null, health_note || null, img]);
    res.json({ pet: r.rows[0] });
  } catch (e) {
    if (e.code === '23514') return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง (ชนิดสัตว์/เพศ)' });
    next(e);
  }
});

router.delete('/:id', auth, async (req, res, next) => {
  try {
    const r = await db.query("DELETE FROM pets WHERE id=$1 AND (owner_id=$2 OR $3='admin') RETURNING id",
      [parseInt(req.params.id) || 0, req.user.id, req.user.role]);
    if (!r.rows.length) return res.status(404).json({ error: 'ไม่พบหรือไม่มีสิทธิ์ลบ' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

module.exports = router;
