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

// ---- Load initial data (safe fallback) ----
let cat21Data = [];
function loadFile() {
  try {
    const raw = fs.readFileSync(CAT21_FILE, 'utf8');
    cat21Data = JSON.parse(raw);
    console.log('[server] loaded cat21.json, entries=', cat21Data.length);
    // ensure fields
    cat21Data.forEach((p, i) => {
      if (!p.theta) p.theta = Math.random() * Math.PI * 2;
      if (!p.radius) p.radius = 1000 + Math.random() * 1000;
      if (!p.wgs_84_coordinates) p.wgs_84_coordinates = { latitude: 13.7367, longitude: 100.5231 };
      if (!p.target_identification) p.target_identification = `THA${p.id || i+1}`;
      if (!p.flight_level) p.flight_level = "FL300";
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

// Simple API key check (optional). Set to null to disable.
const API_KEY = process.env.API_KEY || 'ctf-test-key'; // change/remove for open hackable mode

function requireApiKey(req, res, next) {
  if (!API_KEY) return next();
  const key = req.header('x-api-key') || req.query.api_key;
  if (key && key === API_KEY) return next();
  return res.status(401).json({ error: 'invalid api key' });
}

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Get current data
app.get('/cat21', (req, res) => res.json({ cat21: cat21Data }));

// Inject / replace data (POST). Body: { cat21: [ ... ] } or single object
app.post('/inject', requireApiKey, (req, res) => {
  const payload = req.body;
  if (!payload) return res.status(400).json({ error: 'missing body' });

  // allow both object or array
  let incoming = payload.cat21 || payload;
  if (!Array.isArray(incoming)) incoming = [incoming];

  // Basic validation & normalization
  const normalized = incoming.map((p, idx) => {
    const copy = Object.assign({}, p);
    if (!copy.wgs_84_coordinates && (copy.latitude && copy.longitude)) {
      copy.wgs_84_coordinates = { latitude: copy.latitude, longitude: copy.longitude };
    }
    if (!copy.wgs_84_coordinates) copy.wgs_84_coordinates = { latitude: 13.7367, longitude: 100.5231 };
    copy.id = copy.id || (`inj_${Date.now()}_${idx}`);
    copy.target_identification = copy.target_identification || copy.id.toString();
    copy.flight_level = copy.flight_level || 'FL999';
    copy.theta = copy.theta || Math.random() * Math.PI * 2;
    copy.radius = copy.radius || (1000 + Math.random() * 1000);
    return copy;
  });

  // Merge strategy: append incoming items to existing array (you may replace if wanted)
  cat21Data = cat21Data.concat(normalized);

  // Optionally persist to file (comment out if not wanted)
  try {
    fs.writeFileSync(CAT21_FILE, JSON.stringify(cat21Data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[server] failed to write file', e.message);
  }

  // broadcast immediately
  broadcast({ cat21: cat21Data });

  return res.json({ ok: true, added: normalized.length, total: cat21Data.length });
});

// optional: endpoint to replace dataset
app.post('/replace', requireApiKey, (req, res) => {
  if (!Array.isArray(req.body.cat21)) return res.status(400).json({ error: 'cat21 array required' });
  cat21Data = req.body.cat21;
  // normalize
  cat21Data.forEach((p, i) => {
    if (!p.theta) p.theta = Math.random() * Math.PI * 2;
    if (!p.radius) p.radius = 1000 + Math.random() * 1000;
  });
  try { fs.writeFileSync(CAT21_FILE, JSON.stringify(cat21Data, null, 2)); } catch(e){}
  broadcast({ cat21: cat21Data });
  res.json({ ok: true, total: cat21Data.length });
});

const httpServer = http.createServer(app);
httpServer.listen(API_PORT, () => console.log(`[http] api listening on ${API_PORT}`));

// ---- WebSocket Server (broadcast updated cat21Data) ----
const wss = new WebSocket.Server({ port: PORT });
console.log(`[ws] listening ws://localhost:${PORT}`);

// broadcast helper
function broadcast(obj) {
  const msg = JSON.stringify(obj);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

// Per-connection logging / immediate send
wss.on('connection', (ws) => {
  console.log('[ws] client connected');
  // send immediate snapshot
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ cat21: cat21Data }));

  ws.on('close', () => console.log('[ws] client disconnected'));
});

// ---- Background updater: move targets and broadcast on interval ----
const UPDATE_MS = 500;
setInterval(() => {
  if (!cat21Data.length) return;
  const centerLat = 13.7367;
  const centerLon = 100.5231;
  cat21Data.forEach((p) => {
    p.theta = (p.theta || 0) + 0.05; // speed
    p.wgs_84_coordinates = p.wgs_84_coordinates || { latitude: centerLat, longitude: centerLon };
    p.wgs_84_coordinates.latitude = centerLat + (p.radius / 10000) * Math.cos(p.theta);
    p.wgs_84_coordinates.longitude = centerLon + (p.radius / 10000) * Math.sin(p.theta);
  });
  broadcast({ cat21: cat21Data });
}, UPDATE_MS);

// ---- Watch file changes (reload if someone edits file manually) ----
try {
  chokidar.watch(CAT21_FILE).on('change', () => {
    console.log('[watch] cat21.json changed, reloading');
    loadFile();
    broadcast({ cat21: cat21Data });
  });
} catch (e) {
  console.warn('[watch] chokidar not available', e.message);
}

