QQ Queue System (generated scaffold)

ไฟล์ในโปรเจ็กต์นี้คือ scaffold แบบง่ายสำหรับระบบคิวที่อธิบายใน `ui.md`/`readme.md`:

- `server.js` — Express API ที่ให้ endpoints สำหรับดึง/อัพเดตสถานะคิว
- `db/init.sql` — สคริปต์ SQL สำหรับสร้างฐานข้อมูล `qq` และตาราง `queue_items`
- `db/seed.js` — สคริปต์ Node.js ที่จะสร้างตาราง (จาก `init.sql`) และเติม 20 ช่อง (5x4)
- `public/index.html` — หน้า Caller (หน้าพนักงาน) ที่เลือก/เรียก/ยกเลิก/ข้าม
- `public/display.html` — หน้า Display (หน้าจอ TV) ที่แสดงผลกระพริบและเล่นเสียงเมื่อถูกเรียก

การติดตั้งและรัน (บน macOS / Linux / Windows ที่มี Node.js และ MySQL):

1) ติดตั้ง dependencies

```bash
npm install
```

2) สร้าง DB และเติมข้อมูลตัวอย่าง (สองทางเลือก)

Option A (ใช้ mysql client):

```bash
mysql -u supervisor -p saas < db/init.sql
node db/seed.js
```

Option B (ถ้า user มีสิทธิ์สร้าง DB):

```bash
node db/seed.js
```

3) สตาร์ทเซิร์ฟเวอร์

```bash
npm start
```

4) หน้า UI

Caller: http://localhost:8080/index.html
Display: http://localhost:8080/display.html

5) รันทดสอบ smoke (หลังสตาร์ทเซิร์ฟเวอร์)

```bash
npm test
```

หมายเหตุสำคัญ
- วางไฟล์เสียง `dingdong.mp3` ลงที่ `public/dingdong.mp3` เพื่อให้เสียงทำงาน
- ปรับข้อมูลการเชื่อมต่อ DB ใน `server.js` / `db/seed.js` หาก credentials/host ต่างกัน
- สำหรับ production ให้เพิ่มการจัดการข้อผิดพลาด, authentication, การ migrate ฐานข้อมูล และ/หรือ WebSocket

ถ้าต้องการ ผมจะรัน `npm install`, `node db/seed.js`, สตาร์ทเซิร์ฟเวอร์ และรัน `npm test` ให้ — บอกผมได้เลยว่าต้องการให้ผมรันคำสั่งเหล่านี้หรือไม่
