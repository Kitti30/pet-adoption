const jwt = require('jsonwebtoken');

function read(req) {
  const t = req.cookies && req.cookies.token;
  if (!t) return null;
  try { return jwt.verify(t, process.env.JWT_SECRET); } catch { return null; }
}
exports.auth = (req, res, next) => {
  const u = read(req);
  if (!u) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  req.user = u; next();
};
exports.optionalAuth = (req, res, next) => { req.user = read(req); next(); };
exports.admin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: 'สำหรับผู้ดูแลระบบเท่านั้น' });
  next();
};
