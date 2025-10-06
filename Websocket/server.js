// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const chokidar = require('chokidar');

const PORT = 8080;
const API_PORT = 3001; // REST API port (แยกจาก WS หรือจะรวมก็ได้)
const CAT21_FILE = path.join(__dirname, '../src/data/cat21.json');
const CENTER = { lat: 13.7367, lon: 100.5231 };
const MAX_RADIUS_METERS = 10000; // รัศมีวงกลม

// ---- Helper: clamp Lat/Lon ให้อยู่ในวงกลม ----
function clampToCircle(lat, lon, centerLat, centerLon, maxRadiusMeters) {
  const degLatToMeters = (deg) => deg * 111320;
  const degLonToMeters = (deg, atLat) => deg * (111320 * Math.cos(atLat * Math.PI / 180));

  let dx = degLonToMeters(lon - centerLon, centerLat);
  let dy = degLatToMeters(lat - centerLat);
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > maxRadiusMeters) {
    const scale = maxRadiusMeters / distance;
    dx *= scale;
    dy *= scale;
    lat = centerLat + dy / 111320;
    lon = centerLon + dx / (111320 * Math.cos(centerLat * Math.PI / 180));
  }
  return { latitude: lat, longitude: lon };
}

// ---- Load initial data (safe fallback) ----
let cat21Data = [];
function loadFile() {
  try {
    const raw = fs.readFileSync(CAT21_FILE, 'utf8');
    cat21Data = JSON.parse(raw);
    console.log('[server] loaded cat21.json, entries=', cat21Data.length);
    cat21Data.forEach((p, i) => {
      if (!p.theta) p.theta = Math.random() * Math.PI * 2;
      if (!p.radius) p.radius = 1000 + Math.random() * 1000;
      if (!p.wgs_84_coordinates) p.wgs_84_coordinates = { ...CENTER };
      if (!p.target_identification) p.target_identification = `THA${p.id || i + 1}`;
      if (!p.flight_level) p.flight_level = "FL300";

      // clamp initial positions
      const clamped = clampToCircle(
        p.wgs_84_coordinates.latitude,
        p.wgs_84_coordinates.longitude,
        CENTER.lat,
        CENTER.lon,
        MAX_RADIUS_METERS
      );
      p.wgs_84_coordinates.latitude = clamped.latitude;
      p.wgs_84_coordinates.longitude = clamped.longitude;
    });
  } catch (e) {
    console.warn('[server] could not load file, using empty array', e.message);
    cat21Data = [];
  }
}
loadFile();

// ---- HTTP (REST) Server for injection / management ----
const app = express();
app.use(bodyParser.json({ limit: '200kb' }));
const API_KEY = process.env.API_KEY || 'ctf-test-key';

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const key = req.header('x-api-key') || req.query.api_key;
  if (key && key === API_KEY) return next();
  return res.status(401).json({ error: 'invalid api key' });
}

app.get('/health', (req, res) => res.json({ ok: true }));
app.get('/cat21', (req, res) => res.json({ cat21: cat21Data }));

app.post('/inject', requireApiKey, (req, res) => {
  const payload = req.body;
  if (!payload) return res.status(400).json({ error: 'missing body' });

  let incoming = payload.cat21 || payload;
  if (!Array.isArray(incoming)) incoming = [incoming];

  const normalized = incoming.map((p, idx) => {
    const copy = { ...p };
    if (!copy.wgs_84_coordinates && (copy.latitude && copy.longitude)) {
      copy.wgs_84_coordinates = { latitude: copy.latitude, longitude: copy.longitude };
    }
    if (!copy.wgs_84_coordinates) copy.wgs_84_coordinates = { ...CENTER };
    copy.id = copy.id || `inj_${Date.now()}_${idx}`;
    copy.target_identification = copy.target_identification || copy.id.toString();
    copy.flight_level = copy.flight_level || 'FL999';
    copy.theta = copy.theta || Math.random() * Math.PI * 2;
    copy.radius = copy.radius || (1000 + Math.random() * 1000);

    // clamp injected target
    const clamped = clampToCircle(
      copy.wgs_84_coordinates.latitude,
      copy.wgs_84_coordinates.longitude,
      CENTER.lat,
      CENTER.lon,
      MAX_RADIUS_METERS
    );
    copy.wgs_84_coordinates.latitude = clamped.latitude;
    copy.wgs_84_coordinates.longitude = clamped.longitude;

    return copy;
  });

  cat21Data = cat21Data.concat(normalized);

  try {
    fs.writeFileSync(CAT21_FILE, JSON.stringify(cat21Data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[server] failed to write file', e.message);
  }

  broadcast({ cat21: cat21Data });
  return res.json({ ok: true, added: normalized.length, total: cat21Data.length });
});

app.post('/replace', requireApiKey, (req, res) => {
  if (!Array.isArray(req.body.cat21)) return res.status(400).json({ error: 'cat21 array required' });
  cat21Data = req.body.cat21;

  cat21Data.forEach((p, i) => {
    if (!p.theta) p.theta = Math.random() * Math.PI * 2;
    if (!p.radius) p.radius = 1000 + Math.random() * 1000;
    if (!p.wgs_84_coordinates) p.wgs_84_coordinates = { ...CENTER };

    // clamp
    const clamped = clampToCircle(
      p.wgs_84_coordinates.latitude,
      p.wgs_84_coordinates.longitude,
      CENTER.lat,
      CENTER.lon,
      MAX_RADIUS_METERS
    );
    p.wgs_84_coordinates.latitude = clamped.latitude;
    p.wgs_84_coordinates.longitude = clamped.longitude;
  });

  try { fs.writeFileSync(CAT21_FILE, JSON.stringify(cat21Data, null, 2)); } catch (e) {}
  broadcast({ cat21: cat21Data });
  res.json({ ok: true, total: cat21Data.length });
});

const httpServer = http.createServer(app);
httpServer.listen(API_PORT, () => console.log(`[http] api listening on ${API_PORT}`));

// ---- WebSocket Server ----
const wss = new WebSocket.Server({ port: PORT });
console.log(`[ws] listening ws://localhost:${PORT}`);

function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ cat21: cat21Data }));
  ws.on('close', () => console.log('[ws] client disconnected'));
});

// ---- Background updater ----
const UPDATE_MS = 500;
setInterval(() => {
  if (!cat21Data.length) return;
  cat21Data.forEach(p => {
    p.theta = (p.theta || 0) + 0.05;
    const r = Math.min(p.radius, MAX_RADIUS_METERS);
    let lat = CENTER.lat + (r / 111320) * Math.cos(p.theta);
    let lon = CENTER.lon + (r / (111320 * Math.cos(CENTER.lat * Math.PI / 180))) * Math.sin(p.theta);

    const clamped = clampToCircle(lat, lon, CENTER.lat, CENTER.lon, MAX_RADIUS_METERS);
    p.wgs_84_coordinates.latitude = clamped.latitude;
    p.wgs_84_coordinates.longitude = clamped.longitude;
  });
  broadcast({ cat21: cat21Data });
}, UPDATE_MS);

// ---- Watch file changes ----
try {
  chokidar.watch(CAT21_FILE).on('change', () => {
    console.log('[watch] cat21.json changed, reloading');
    loadFile();
    broadcast({ cat21: cat21Data });
  });
} catch (e) {
  console.warn('[watch] chokidar not available', e.message);
}

