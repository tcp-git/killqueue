# QQ Queue System — Cross-language Specification

เอกสารนี้รวบรวมสเปคของระบบคิว (Caller + Display + MySQL) ที่สร้างขึ้นในโปรเจคตัวอย่าง เพื่อให้ผู้อื่นสามารถนำไปพัฒนาใหม่ด้วยภาษา/เฟรมเวิร์กใดก็ได้โดยทำตามสเปคนี้

## ภาพรวมระบบ
- หน้าที่หลัก: จัดการคิวรูปแบบตารางขนาด 5x4 (5 แถว × 4 คอลัมน์) สำหรับการเรียกหมายเลขคิว
- ส่วนประกอบหลัก:
  - Database: MySQL (ฐานข้อมูลชื่อ `qq`)
  - Backend: HTTP API (REST) ให้บริการข้อมูลคิวและอัพเดตสถานะ
  - Frontend Caller: หน้าเพื่อเลือก/เรียก/ยกเลิก/ข้ามหมายเลข และเลื่อนมุมมอง (Prev/Next row)
  - Frontend Display: หน้าจอแสดงผลเต็มจอ (Blink + sound เมื่อมีการเรียก)
  - Assets: เสียง `dingdong.mp3` ที่เล่นเมื่อมีการเรียก
- พฤติกรรมเรียลไทม์: ปัจจุบันใช้ polling HTTP (Caller 2000ms, Display 1500ms). WebSocket เป็นทางเลือกแนะนำสำหรับ real-time push.

## โฟลเดอร์และไฟล์สำคัญ (จากตัวอย่าง)
- `server.js` — Express HTTP server, API endpoints
- `db/init.sql` — DDL สำหรับสร้างฐานข้อมูลและตาราง
- `db/seed.js` — สคริปต์เติมข้อมูลเริ่มต้น (20 แถว สำหรับ 5x4)
- `public/index.html` — Caller UI (controls + grid)
- `public/display.html` — Display UI (fullscreen)
- `public/dingdong.mp3` — เสียงเรียก (ใส่ไฟล์จริงลงที่นี่)
- `test/smoke.js` — ทดสอบเบื้องต้นเรียก /api/health และ /api/queue
- `package.json` — ขึ้นอยู่กับภาษา (ในตัวอย่างเป็น Node.js)

> หากนำไปสร้างด้วยภาษาอื่น ให้เก็บโครงสร้างไฟล์ที่เทียบเท่า: static files (public), แหล่งที่มาของ API, สคริปต์ DB/seed และสคริปต์ทดสอบ

## Database
- Database name: `qq`
- Table: `queue_items`

DDL (MySQL):

```sql
CREATE DATABASE IF NOT EXISTS `qq` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `qq`;

CREATE TABLE IF NOT EXISTS `queue_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `queue_no` VARCHAR(10) NOT NULL,
  `position_row` INT NOT NULL,
  `position_col` INT NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'IDLE',
  `called_at` DATETIME NULL,
  `called_by` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- Initial seed: 20 rows representing numbers 001..020, ordered by row then col (row 1 col1..4, row2 col1..4, ... row5 col4)
  - `queue_no` stored as zero-padded 3-digit string ("001" .. "020").
  - `position_row` 1..5, `position_col` 1..4

## Status enum and state transitions
- Status values: `IDLE`, `SELECTED`, `CALLED`, `CANCEL`, `SKIP`
- Typical transitions:
  - `IDLE` -> `SELECTED` via /api/select
  - `SELECTED` -> `CALLED` via /api/call (also sets `called_at` and `called_by`)
  - Any -> `CANCEL` via /api/cancel
  - Any -> `SKIP` via /api/skip

Notes: enforce these via server-side updates. Use transactions if updating multiple rows with side effects.

## HTTP API (REST)
All endpoints are JSON-based. The server in example uses base path `/api`.

1) GET /api/health
- Response 200
- Body: `{ "status": "ok" }`

2) GET /api/queue
- Response: 200
- Body: JSON array of queue item objects ordered by `id` (or by `position_row`,`position_col`)
- Item shape:
```json
{
  "id": 1,
  "queue_no": "001",
  "position_row": 1,
  "position_col": 1,
  "status": "IDLE",
  "called_at": null,
  "called_by": null,
  "created_at": "2025-12-27T..."
}
```

3) POST /api/select
- Body: `{ "ids": [1,2,3] }`
- Action: sets status = `SELECTED` for listed ids
- Response: `{ "updated": <number> }`

4) POST /api/call
- Body: `{ "ids": [3], "called_by": "caller1" }`
- Action: sets status=`CALLED`, sets `called_at` to server time, sets `called_by`
- Response: `{ "updated": <number> }`

5) POST /api/cancel
- Body: `{ "ids": [3] }`
- Action: sets status=`CANCEL` for given ids
- Response: `{ "updated": <number> }`

6) POST /api/skip
- Body: `{ "ids": [3] }`
- Action: sets status=`SKIP` for given ids
- Response: `{ "updated": <number> }`

Validation:
- Server should validate that `ids` is an array. Return 400 on invalid.
- If `ids` empty return `{ updated: 0 }`.

Security:
- Use parameterized queries or ORM (no string interpolation directly into SQL).
- Sanitize/validate `called_by` length.
- Add auth if exposing publicly.

## Frontend Behavior — Caller (`public/index.html`)
Goal: 5 rows × 4 columns grid, shows a viewport window of `ROWS*COLS` numbers that can be shifted by rows.

Visual & layout
- Grid size: 5 (ROWS) × 4 (COLS). By option A the grid fills the available container edge-to-edge (cells may stretch if viewport aspect differs).
- Caller overlay controls: located as floating overlay so grid area is not reduced (overlay reserved height to avoid covering bottom row).
- Controls (buttons):
  - `ก่อนหน้า` (Prev) — shift visible window up by 1 row (i.e., subtract 4 numbers)
  - `ถัดไป` (Next) — shift visible window down by 1 row (i.e., add 4 numbers)
  - `เรียก` (Call) — send selected `ids` to /api/call
  - `ยกเลิก` (Cancel) — send selected `ids` to /api/cancel
  - `ข้าม` (Skip) — send selected `ids` to /api/skip
- Selection: clicking a real DB cell toggles selection. Selection uses a Set so multiple selections are supported via clicks. Buttons operate on all selected items.
- Placeholders: when the viewport window extends beyond existing DB items, the UI synthesizes placeholder numbers (e.g., 021..024). Placeholders are non-selectable and visually marked.

Sizing & typography
- Each cell width and height are computed separately to fill the grid area. Font size is scaled relative to min(cellWidth, cellHeight) (example: 62% for caller, 66% for display) to keep numbers large and readable.
- Caller polling interval: 2000 ms (2s). After fetch, `render()` is called and `adjustGrid()` recalculates sizes.

Behavior on actions
- Call: POST /api/call with selected ids, then `load()` refreshes data.
- Cancel/Skip similar.
- Shift rows: updates `viewRowOffset` (integer, >= 0) and re-renders. Prev/Next do not create DB rows.

Optional/extra features
- Keyboard navigation: `moveSelection(delta)` helper exists and can be wired to arrow keys for single-selection step.
- Auto-hide overlay: optional to maximize grid-to-edge.

## Frontend Behavior — Display (`public/display.html`)
- Fullscreen grid 5x4, edge-to-edge fill. Each cell displays `queue_no`.
- Blink + play ding sound when an item becomes `CALLED` (per poll diff detection).
  - Blink class applied; blink animation removed after 10 seconds.
  - Audio: play `public/dingdong.mp3` on newly called items.
- Polling interval: 1500 ms (1.5s).

## Polling vs Push
- Current: polling (Caller 2000ms, Display 1500ms).
- Recommended: use WebSocket or server-sent events (SSE) in production for lower-latency updates and to avoid repeated DB queries.

## Assets
- `public/dingdong.mp3` — place a short mp3; the Display plays it when new `CALLED` entries appear.

## Seed and initialization
- `db/init.sql` creates DB + `queue_items` table.
- `db/seed.js` (Node example) runs init SQL and inserts 20 rows (001..020)
- When reimplementing: provide an equivalent seed script that executes DDL and inserts the initial rows.

## Tests
- `test/smoke.js` example: check `/api/health` and `/api/queue` respond correctly.
- Suggested automated tests for other languages:
  - Unit: DB model tests (CRUD), API input validation
  - Integration: run seed, start server, call /api/queue and verify length and known values
  - UI: end-to-end test (Puppeteer/Selenium) to verify grid layout and button actions

## Run / Deploy (example, Node)
- Default DB credentials used in example (for local dev):
  - host: 127.0.0.1
  - user: supervisor
  - password: saas
  - database: qq
- Default port: 8080 (can be overridden with `PORT` env var)

Example commands (Node):
```bash
# install
npm install
# seed DB
node db/seed.js
# run server
PORT=8080 npm start
# run smoke test
PORT=8080 node test/smoke.js
```

When port 8080 is in use choose another port: `PORT=8081 npm start`.

## Example API calls (curl)
- GET queue:
```bash
curl -s http://localhost:8080/api/queue | jq '.'
```
- Call ids 5 and 6:
```bash
curl -X POST http://localhost:8080/api/call -H 'Content-Type: application/json' -d '{"ids":[5],"called_by":"caller1"}'
```

## Edge cases and important notes
- Timezone/dates: `called_at` and `created_at` are DATETIME; store/convert to UTC or choose project convention.
- Concurrency: if multiple callers may call the same ID simultaneously, use DB transactions/row-level locks to avoid race conditions.
- Missing DB rows beyond seed: UI synthesizes placeholders; decide whether to allow creating new rows via API or to disallow.
- Input validation: ensure `ids` are integers and exist in DB before executing updates (return not-found or skip silently depending on policy).

## How to reimplement in another language
General steps (language-agnostic):
1. Provide a static file server to serve `index.html`, `display.html` and asset files.
2. Implement REST endpoints described above. Use parameterized SQL (prepared statements) or ORM methods to update rows.
3. Implement `GET /api/queue` to return ordered queue items. Keep the shape consistent.
4. Implement seed/DDL to create `queue_items` and insert initial rows (001..020).
5. Implement frontend JS logic (grid rendering, polling, shiftRows, toggle selection, call/cancel/skip actions). UI can be ported verbatim or reimplemented using a framework (React/Vue/Angular) — the semantics remain the same.
6. Implement tests: health, queue length, and a few update flows.

Example mapping (pseudo):
- Python Flask: use `flask` + `pymysql`/`mysqlclient` or `SQLAlchemy`. Endpoints identical.
- Go: use `net/http` + `database/sql` + `go-sql-driver/mysql`.
- Java: Spring Boot + JDBC or JPA.

## Acceptance criteria (what "done" means)
- Server exposes all required endpoints and updates DB as described.
- Caller shows a 5x4 viewport, Prev/Next shift rows by one row each (4 numbers), placeholders appear for numbers beyond DB, selection clicks toggle and Call/Cancel/Skip update DB.
- Display blinks + plays sound for newly called items for 10s.
- Seed script creates initial 20 items.
- Smoke test passes.

## Possible next improvements (optional)
- Replace polling with WebSocket/SSE for real-time push updates.
- Add user authentication & audit trail for calls (who called, timestamps history table).
- Add pagination state and page indicator for the Caller.
- Add automatic creation (or admin flow) for new numbers beyond current DB.
- Add robust unit/integration tests and CI pipeline.

---
End of SPEC. This document should be sufficient to reimplement the system in another language/framework by following the API contracts, DB schema, UI behavior, and seed data described above.

## UX / UI Guidelines (detailed)

ต่อไปนี้เป็นแนวทาง UX/UI ที่ละเอียดขึ้น เพื่อให้การพอร์ตไปยังภาษา/เฟรมเวิร์กอื่นได้ผลลัพธ์ที่เหมือนกันทั้งรูปลักษณ์และพฤติกรรม

1) เป้าหมายการออกแบบ
- Readability: หมายเลขต้องอ่านชัดในระยะไกล (ตัวเลขใหญ่, ความคมของฟอนต์สูง)
- Fast recognition: สถานะสำคัญ (CALLED) ต้องโดดเด่นจากระยะไกล
- Minimal interaction: ผู้ใช้ (พนักงาน) ควรทำการเลือก/เรียกได้ด้วยการคลิกไม่กี่ครั้งหรือคีย์ลัด

2) Layout rules
- Grid: ROWS = 5, COLS = 4. แสดง viewport ขนาด 5×4 เสมอ (caller และ display)
- Fill policy: Option A (edge-to-edge): grid ขยายเต็ม container โดยคำนวณ width/height แยกกัน (อาจยืด/ย่อ) เพื่อให้ช่องใหญ่ที่สุดบนทุกอุปกรณ์
- Safe margins: ปุ่ม overlay ต้องไม่ปิดช่องแถวสุดล่าง — ให้สำรองพื้นที่ (reserve) เท่ากับ overlay height + 12–24px
- Gap: ระหว่างช่อง (grid gap) = 8–12px (ปรับได้ตามขนาดหน้าจอ)

3) Typography
- Font family: sans-serif ที่รองรับภาษาไทย เช่น Inter, Noto Sans Thai
- Font weight: ตัวเลขใช้ font-weight 700–900 (ตัวอย่างใช้ 800)
- Scaling rule: font-size = floor(min(cellWidth, cellHeight) * X)
  - Caller: X ≈ 0.56–0.62 (ปรับขึ้น/ลงได้ตาม readability)
  - Display: X ≈ 0.60–0.72 (ให้ใหญ่กว่าเล็กน้อยเพราะเป็นหน้าจอสาธารณะ)
- Number format: zero-padded 3 digits ("001") เพื่อรักษาความยาวเท่ากัน

4) Colour & states (ตัวอย่างโทนสี)
- IDLE: background #FFFFFF, border #E5E7EB (gray-200), text #111827
- SELECTED: outline หรือ border หนา (ตัวอย่าง: outline: 3px #111827)
- CALLED: background #111827 (หรือสีเข้ม), text #FFFFFF — คอนทราสต์สูงเพื่อให้เห็นชัด
- CANCEL: โปร่งแสง (opacity 0.45) + line-through
- PLACEHOLDER: สีอ่อน (ตัวอย่าง background #FAFAFB, text #9CA3AF) และไม่สามารถเลือกได้

Accessibility
- Contrast: ตรวจสอบว่าสี CALLED กับ text มี contrast ratio >= 4.5:1
- ARIA: grid ใช้ role="grid" / role="gridcell" หรือ aria-labels ตามความเหมาะสม; controls overlay มี role="region" และ aria-live สำหรับ preview
- Keyboard: รองรับ focus/keyboard navigation — Tab to controls, arrow keys to move selection (optional), Enter to call
- Screen reader: Provide aria-live notifications when a number is called: "Called: 012"

5) Motion & timing
- Blink duration: 10s for newly called items (blink animation or temporary highlight)
- Transition: use short easing for press feedback (120ms) and fade/scale for state changes
- Sound: ding sound on CALL — keep it short (~300–800ms) and non-intrusive; allow mute via browser controls or a UI toggle

6) Interaction patterns
- Selection: click toggles selection; support multi-select via clicks. Visual feedback: outline or strong border for selected items.
- Call flow: select -> press "เรียก" (Call) -> server updates -> Display receives update and blinks/plays sound
- Prev/Next: shift viewport by 1 row (COLS) per click. Prev disabled when viewRowOffset==0; Next allowed until reasonable limit (or wrap if enabled)
- Placeholder behaviour: placeholders are display-only. Policy option: if calling placeholders should create DB rows, add server endpoint to create-on-call.

7) Wireframe (ASCII)

Caller (full viewport):

-------------------------------------------------
| Header: "ตัวเรียกคิว (Caller)"                 |
|-----------------------------------------------|
| [grid 5x4 fills area]                          |
|                                               |
|                                               |
|-----------------------------------------------|
| [controls overlay: Prev] [Call] [Next] [Cancel]|
-------------------------------------------------

Display (fullscreen):

-----------------------------------------------
| [grid 5x4 fills entire screen, large numbers] |
|  blink + play sound when new CALLED appears   |
-----------------------------------------------

8) Edge cases & small-screen behavior
- Very short heights: if cell height < min threshold (e.g., 32px), enable vertical scrolling or reduce rows shown (but acceptance requires showing 5 rows; prefer responsive scaling)
- Very wide screens: keep numbers large but cap font-size to avoid extremely large numbers (max font-size rule)

9) Acceptance criteria (UI)
- On desktop 1080p: grid fills available area, numbers are legible at ~2–3m viewing distance
- On tablet/TV display: Display page shows numbers very large and plays ding when CALLED
- Prev/Next shifts rows exactly by 4 numbers; placeholders appear when beyond seeded items
- Blink lasts 10s and sound plays on first detection of new CALLED
- All interactive controls reachable via keyboard and have ARIA labels

10) Deliverables for UI implementation
- HTML/CSS/JS files for Caller and Display (or components if using framework)
- Accessibility notes and keyboard bindings
- Design tokens: colors, spacing, font scales (a small JSON or SCSS variables file recommended)

---

ส่วนนี้เป็นแนวทางเชิงออกแบบที่ละเอียดพอจะนำไปสร้าง UI ให้สอดคล้องข้ามแพลตฟอร์มได้ — ถ้าต้องการผมจะสร้างไฟล์แยก `UX_GUIDELINES.md` ที่มีโทนสีตัวอย่าง (hex), ตัวอย่าง CSS variables, และตัวอย่างภาพหน้าจอ/รหัสสีเพื่อให้ทีมออกแบบใช้ต่อได้ทันที

