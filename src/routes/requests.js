const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// คะแนนความพร้อม (เต็ม 100) คำนวณจากแบบสอบถาม
function readiness(a) {
  let s = 0;
  if (a.has_experience) s += 15;
  if (a.family_agrees) s += 20;
  if (a.commit_vet) s += 20;
  if (a.housing_ok) s += 20;
  s += { lt4: 15, '4to8': 8, gt8: 0 }[a.hours_alone] || 0;
  s += a.monthly_budget >= 1000 ? 10 : a.monthly_budget >= 500 ? 5 : 0;
  return s;
}

// ยื่นคำขอรับเลี้ยง + แบบสอบถาม
router.post('/', auth, async (req, res, next) => {
  try {
    const b = req.body;
    const petId = parseInt(b.pet_id) || 0;
    if (!b.housing_type || !b.hours_alone || !b.reason || b.reason.trim().length < 10 || !b.phone)
      return res.status(400).json({ error: 'กรอกแบบสอบถามให้ครบ (เหตุผลอย่างน้อย 10 ตัวอักษร)' });
    const p = (await db.query('SELECT owner_id,status FROM pets WHERE id=$1', [petId])).rows[0];
    if (!p || p.status !== 'available') return res.status(400).json({ error: 'สัตว์ตัวนี้ไม่เปิดรับคำขอแล้ว' });
    if (p.owner_id === req.user.id) return res.status(400).json({ error: 'ไม่สามารถขอรับเลี้ยงสัตว์ของตัวเองได้' });
    const a = {
      housing_type: b.housing_type, housing_ok: !!b.housing_ok, has_experience: !!b.has_experience,
      has_other_pets: !!b.has_other_pets, family_agrees: !!b.family_agrees, commit_vet: !!b.commit_vet,
      hours_alone: b.hours_alone, monthly_budget: Math.max(parseInt(b.monthly_budget) || 0, 0),
      reason: b.reason.trim(), phone: b.phone.trim()
    };
    a.score = readiness(a);
    const r = await db.query(
      `INSERT INTO adoption_requests(pet_id,applicant_id,housing_type,housing_ok,has_experience,has_other_pets,
        family_agrees,commit_vet,hours_alone,monthly_budget,reason,phone,score)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (pet_id,applicant_id) DO NOTHING RETURNING id`,
      [petId, req.user.id, a.housing_type, a.housing_ok, a.has_experience, a.has_other_pets, a.family_agrees,
       a.commit_vet, a.hours_alone, a.monthly_budget, a.reason, a.phone, a.score]);
    if (!r.rows.length) return res.status(409).json({ error: 'คุณยื่นคำขอสัตว์ตัวนี้ไปแล้ว' });
    res.json({ ok: true, score: a.score });
  } catch (e) {
    if (e.code === '23514') return res.status(400).json({ error: 'ข้อมูลแบบสอบถามไม่ถูกต้อง' });
    next(e);
  }
});

// คำขอที่ฉันยื่น
router.get('/mine', auth, async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT r.id,r.status,r.reviewer_note,r.created_at,p.id AS pet_id,p.name AS pet_name,p.image_url
       FROM adoption_requests r JOIN pets p ON p.id=r.pet_id
       WHERE r.applicant_id=$1 ORDER BY r.created_at DESC`, [req.user.id]);
    res.json({ requests: r.rows });
  } catch (e) { next(e); }
});

// คำขอที่ส่งมาหาสัตว์ของฉัน (พร้อมข้อมูลตรวจสอบผู้ขอ)
router.get('/incoming', auth, async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT r.*, p.name AS pet_name, u.name AS applicant_name, u.email AS applicant_email,
              u.verified AS applicant_verified, u.province AS applicant_province,
              (SELECT COUNT(*) FROM adoption_requests x WHERE x.applicant_id=u.id AND x.status='approved')::int AS approved_before
       FROM adoption_requests r
       JOIN pets p ON p.id=r.pet_id JOIN users u ON u.id=r.applicant_id
       WHERE p.owner_id=$1 ORDER BY (r.status='pending') DESC, r.score DESC, r.created_at DESC`, [req.user.id]);
    res.json({ requests: r.rows });
  } catch (e) { next(e); }
});

// อนุมัติ / ปฏิเสธ (เจ้าของสัตว์หรือ Admin)
router.patch('/:id', auth, async (req, res, next) => {
  const client = await db.connect();
  try {
    const { status, note } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    await client.query('BEGIN');
    const r = (await client.query(
      `SELECT r.id,r.pet_id,r.status,p.owner_id FROM adoption_requests r
       JOIN pets p ON p.id=r.pet_id WHERE r.id=$1 FOR UPDATE OF r`, [parseInt(req.params.id) || 0])).rows[0];
    if (!r) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'ไม่พบคำขอ' }); }
    if (r.owner_id !== req.user.id && req.user.role !== 'admin') { await client.query('ROLLBACK'); return res.status(403).json({ error: 'ไม่มีสิทธิ์' }); }
    if (r.status !== 'pending') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'คำขอนี้ถูกพิจารณาไปแล้ว' }); }
    await client.query('UPDATE adoption_requests SET status=$1,reviewer_note=$2,reviewed_at=NOW() WHERE id=$3', [status, note || null, r.id]);
    if (status === 'approved') {
      await client.query("UPDATE pets SET status='adopted' WHERE id=$1", [r.pet_id]);
      await client.query(
        `UPDATE adoption_requests SET status='rejected',reviewer_note='สัตว์ได้รับการรับเลี้ยงแล้ว',reviewed_at=NOW()
         WHERE pet_id=$1 AND status='pending' AND id<>$2`, [r.pet_id, r.id]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) { await client.query('ROLLBACK').catch(() => {}); next(e); }
  finally { client.release(); }
});

module.exports = router;
