require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');

if (!process.env.JWT_SECRET) { console.error('ยังไม่ได้ตั้ง JWT_SECRET ในไฟล์ .env'); process.exit(1); }

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/pets', require('./routes/pets'));
app.use('/api/requests', require('./routes/requests'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API นี้' }));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'ไฟล์ใหญ่เกิน 3MB' : 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`เปิดใช้งานที่ http://localhost:${port}`));
