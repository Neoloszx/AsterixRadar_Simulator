# ติดตั้งโมดูลเพิ่มเติม
### `npm install express`



## วิธีใช้งาน Frontend
ไปที่หน้าโฟลเดอร์หลัก
### `npm run start`
แสดงผลที่ [http://localhost:3000](http://localhost:3000)

## วิธีใช้งาน Backend
ไปที่โฟล์เดอร์ Websocket
### `node server.js`
มีการใช้ API ที่ Port 3001
มีการใช้ Websocket ที่ Port 8080

###รูปแบบการใช้ API
## check health - ตรวจสอบสถานะ API
### `curl http://localhost:3001/health`

## ตรวจสอบไฟล์ cat21.json (สำหรับการอ่านค่าเพื่อแสดงผลจุดแดงบนเรดาห์)
### `curl http://localhost:3001/cat21`

## Inject New Plane or ADS-B Object
### `curl -X POST http://localhost:3001/inject \
  -H "Content-Type: application/json" \
  -H "x-api-key: ctf-test-key" \
  -d '[
    {
    "id": "11",
    "wgs_84_coordinates": {
      "latitude": 13.732702902113223,
      "longitude": 100.51937775192434
    },
    "target_identification": "SU-27",
    "flight_level": "FL11500",     
    "radius": 1000,
    "theta": 60.42561206965791,
    “callsign” : “Godzilla”
  }
  ]'`

