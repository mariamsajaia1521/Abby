import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const ROOT = resolve(import.meta.dirname);
const DIST_DIR = join(ROOT, 'dist');
const DATA_DIR = resolve(process.env.PETLOG_DATA_DIR || join(ROOT, 'data'));
const PORT = Number(process.env.PORT || 4173);
const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY = 8 * 1024 * 1024;
const MAX_VIDEO = 24 * 1024 * 1024;
const MEDIA_DIR = join(DATA_DIR, 'media');
const COLLECTIONS = ['dog', 'routineEntries', 'healthRecords', 'weightEntries', 'memories', 'walkSpots', 'vet', 'reminders'] as const;
type Collection = typeof COLLECTIONS[number];
type State = Record<string, unknown>;
const SINGLETONS = new Set<string>(['dog', 'vet']);

await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
await mkdir(MEDIA_DIR, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(DATA_DIR, 'petlog.sqlite'));
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
  CREATE TABLE IF NOT EXISTS records (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    collection TEXT NOT NULL, record_id TEXT NOT NULL, data TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(user_id, collection, record_id)
  );
  CREATE INDEX IF NOT EXISTS records_owner_collection ON records(user_id, collection);
  CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS media_owner ON media(user_id);
`);

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg'
};

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}
function fail(res: ServerResponse, status: number, message: string) { send(res, status, { error: message }); }
function cookie(req: IncomingMessage, name: string) {
  return req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(name + '='))?.slice(name.length + 1);
}
function tokenHash(token: string) { return createHash('sha256').update(token).digest('hex'); }
function currentUser(req: IncomingMessage) {
  const token = cookie(req, 'petlog_session');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return db.prepare(`SELECT users.id, users.email FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?`).get(tokenHash(token), Date.now()) as { id: string; email: string } | undefined || null;
}
function sessionCookie(token: string, req: IncomingMessage) {
  const secure = process.env.PETLOG_SECURE_COOKIES === '1' || ('encrypted' in req.socket && Boolean(req.socket.encrypted));
  return `petlog_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
}
function issueSession(res: ServerResponse, req: IncomingMessage, userId: string) {
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(tokenHash(token), userId, Date.now() + SESSION_MS);
  res.setHeader('Set-Cookie', sessionCookie(token, req));
}
function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
function verifyPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(':');
  if (!salt || !digest) return false;
  const expected = Buffer.from(digest, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function body(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) throw new Error('REQUEST_TOO_LARGE');
    chunks.push(chunk);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  if (!object(parsed)) throw new SyntaxError('Expected a JSON object');
  return parsed;
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown, max: number, required = false) {
  return typeof value === 'string' && value.length <= max && (!required || value.trim().length > 0);
}
function optionalText(item: Record<string, unknown>, key: string, max: number) {
  return item[key] === undefined || text(item[key], max);
}
function date(value: unknown) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function optionalDate(item: Record<string, unknown>, key: string) {
  return item[key] === undefined || item[key] === '' || item[key] === null || date(item[key]);
}
function validRecord(collection: Collection, value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  if (collection === 'dog') return text(item.name, 40, true) && text(item.breed, 60) && ['male','female'].includes(String(item.gender))
    && optionalText(item, 'species', 60) && optionalDate(item, 'birthDate') && optionalText(item, 'microchip', 100)
    && (item.sterilization === undefined || ['unknown','yes','no'].includes(String(item.sterilization)))
    && optionalDate(item, 'sterilizationDate') && optionalText(item, 'allergies', 5000)
    && optionalText(item, 'conditions', 5000) && optionalText(item, 'emergencyContact', 500);
  if (collection === 'vet') return text(item.name, 120) && text(item.clinic, 120)
    && (Boolean(String(item.name).trim()) || Boolean(String(item.clinic).trim()))
    && text(item.phone, 80) && text(item.emergencyPhone, 80) && text(item.address, 300)
    && text(item.email, 254) && text(item.notes, 5000);
  if (!text(item.id, 100, true)) return false;
  if (collection === 'reminders') return text(item.title, 100, true)
    && ['appointment','vaccination','medication','prevention','followup'].includes(String(item.category))
    && date(item.date) && ['open','done'].includes(String(item.status)) && text(item.notes, 5000)
    && ['none','daily','weekly','monthly','yearly'].includes(String(item.recurrence))
    && (item.anchorDay === undefined || (Number.isInteger(item.anchorDay) && Number(item.anchorDay) >= 1 && Number(item.anchorDay) <= 31))
    && typeof item.createdAt === 'number' && Number.isFinite(item.createdAt);
  if (collection === 'routineEntries') return ['feeding','walk'].includes(String(item.type)) && typeof item.timestamp === 'number' && Number.isFinite(item.timestamp);
  if (collection === 'healthRecords') return ['analysis','vaccination','document','visit','medication','prevention','surgery','other'].includes(String(item.type))
    && text(item.title, 80) && typeof item.date === 'string'
    && (['analysis','vaccination','document'].includes(String(item.type)) || (text(item.title, 80, true) && date(item.date)))
    && optionalText(item, 'notes', 5000) && optionalText(item, 'veterinarian', 120)
    && optionalText(item, 'clinic', 120) && optionalText(item, 'medication', 200)
    && optionalText(item, 'dosage', 200) && optionalDate(item, 'endDate')
    && (['analysis','vaccination','document'].includes(String(item.type)) || optionalText(item, 'note', 5000));
  if (collection === 'weightEntries') return typeof item.date === 'string' && typeof item.weightKg === 'number' && item.weightKg > 0 && item.weightKg <= 120;
  if (collection === 'memories') return (typeof item.photo === 'string' && item.photo.startsWith('data:image/') && item.photo.length < 3_000_000) || (typeof item.videoUrl === 'string' && /^\/api\/media\/[a-f0-9]{32}$/.test(item.videoUrl));
  if (collection === 'walkSpots') return typeof item.name === 'string' && item.name.length <= 60 && typeof item.lat === 'number' && Math.abs(item.lat) <= 90 && typeof item.lng === 'number' && Math.abs(item.lng) <= 180;
  return false;
}
function stateFor(userId: string): State {
  const state = Object.assign(Object.create(null) as State, Object.fromEntries(COLLECTIONS.map(collection => [collection, SINGLETONS.has(collection) ? null : []])));
  const rows = db.prepare('SELECT collection, data FROM records WHERE user_id=? ORDER BY updated_at ASC').all(userId) as { collection: string; data: string }[];
  for (const row of rows) {
    const value = JSON.parse(row.data);
    if (SINGLETONS.has(row.collection)) state[row.collection] = value;
    else {
      if (!Object.hasOwn(state, row.collection)) state[row.collection] = [];
      (state[row.collection] as unknown[]).push(value);
    }
  }
  return state;
}
function itemsFor(collection: string, payload: unknown): unknown[] | null {
  const items = SINGLETONS.has(collection) ? (payload === null ? [] : [payload]) : payload;
  return Array.isArray(items) && items.length <= 1000 ? items : null;
}
function recordId(collection: string, item: unknown, index: number) {
  if (SINGLETONS.has(collection)) return 'profile';
  if (!(COLLECTIONS as readonly string[]).includes(collection)) return `legacy-${index}`;
  return object(item) && typeof item.id === 'string' ? item.id : `legacy-${index}`;
}
function validCollection(userId: string, collection: string, payload: unknown): boolean {
  const items = itemsFor(collection, payload);
  if (!items) return false;
  const known = (COLLECTIONS as readonly string[]).includes(collection);
  const ids = new Set<string>();
  return items.every((item, index) => {
    const id = recordId(collection, item, index);
    if (!id || id.length > 100 || ids.has(id)) return false;
    ids.add(id);
    return !known || (validRecord(collection as Collection, item) && (collection !== 'memories' || ownsMedia(userId, item)));
  });
}
function ownsMedia(userId: string, item: unknown) {
  const videoUrl = (item as { videoUrl?: unknown }).videoUrl;
  if (!videoUrl) return true;
  const id = /^\/api\/media\/([a-f0-9]{32})$/.exec(String(videoUrl))?.[1];
  return Boolean(id && db.prepare('SELECT 1 FROM media WHERE id=? AND user_id=?').get(id, userId));
}
function putCollection(userId: string, collection: Collection, payload: unknown) {
  if (collection === 'dog' && object(payload)) {
    const existing = db.prepare('SELECT data FROM records WHERE user_id=? AND collection=? AND record_id=?').get(userId, 'dog', 'profile') as { data: string } | undefined;
    if (existing) payload = { ...JSON.parse(existing.data), ...payload };
  }
  if (!validCollection(userId, collection, payload)) return false;
  const items = itemsFor(collection, payload)!;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('DELETE FROM records WHERE user_id=? AND collection=?').run(userId, collection);
    const insert = db.prepare('INSERT INTO records(user_id,collection,record_id,data,updated_at) VALUES(?,?,?,?,?)');
    items.forEach((item, index) => insert.run(userId, collection, recordId(collection, item, index), JSON.stringify(item), Date.now()));
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
function originAllowed(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
const attempts = new Map<string, { count: number; reset: number }>();
function rateLimited(req: IncomingMessage) {
  const key = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const previous = attempts.get(key);
  const entry = previous && previous.reset > now ? previous : { count: 0, reset: now + 15 * 60_000 };
  entry.count++;
  attempts.set(key, entry);
  return entry.count > 25;
}

const server = createServer(async (req, res) => {
  try {
    const path = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');

    if (path.startsWith('/api/')) {
      if (req.method !== 'GET' && !originAllowed(req)) return fail(res, 403, 'არასწორი მოთხოვნის წყარო.');
      if (path === '/api/auth/register' && req.method === 'POST') {
        if (rateLimited(req)) return fail(res, 429, 'ცოტა ხანში სცადე ხელახლა.');
        const input = await body(req);
        const email = String(input.email || '').trim().toLowerCase();
        const password = String(input.password || '');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128) return fail(res, 400, 'შეიყვანე სწორი ელფოსტა და მინიმუმ 12-სიმბოლოიანი პაროლი.');
        if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return fail(res, 409, 'ეს ელფოსტა უკვე გამოყენებულია.');
        const userId = randomBytes(16).toString('hex');
        db.prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(userId, email, passwordHash(password), Date.now());
        issueSession(res, req, userId);
        return send(res, 201, { user: { id: userId, email }, state: stateFor(userId) });
      }
      if (path === '/api/auth/login' && req.method === 'POST') {
        if (rateLimited(req)) return fail(res, 429, 'ცოტა ხანში სცადე ხელახლა.');
        const input = await body(req);
        const email = String(input.email || '').trim().toLowerCase();
        const password = String(input.password || '');
        const user = db.prepare('SELECT id,email,password_hash FROM users WHERE email=?').get(email) as { id: string; email: string; password_hash: string } | undefined;
        if (!user || !verifyPassword(password, user.password_hash)) return fail(res, 401, 'ელფოსტა ან პაროლი არასწორია.');
        issueSession(res, req, user.id);
        return send(res, 200, { user: { id: user.id, email: user.email }, state: stateFor(user.id) });
      }
      const user = currentUser(req);
      if (!user) return fail(res, 401, 'გაიარე ავტორიზაცია.');
      if (path === '/api/auth/me' && req.method === 'GET') return send(res, 200, { user, state: stateFor(user.id) });
      if (path === '/api/auth/logout' && req.method === 'POST') {
        const token = cookie(req, 'petlog_session');
        if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(tokenHash(token));
        res.setHeader('Set-Cookie', 'petlog_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
        return send(res, 200, { ok: true });
      }
      if (path === '/api/state' && req.method === 'GET') return send(res, 200, { state: stateFor(user.id) });
      if ((path === '/api/state/import' || path === '/api/state/restore') && req.method === 'POST') {
        const input = await body(req);
        const replacing = path === '/api/state/restore';
        if (!replacing && db.prepare('SELECT 1 FROM records WHERE user_id=? LIMIT 1').get(user.id)) return fail(res, 409, 'ანგარიშს უკვე აქვს მონაცემები.');
        const state = input.state;
        if (!object(state)) return fail(res, 400, 'არასწორი მონაცემები.');
        const collections = Object.keys(state);
        if (collections.length > 100 || collections.some(collection => !collection || collection.length > 100)) return fail(res, 400, 'არასწორი მონაცემები.');
        for (const collection of collections) {
          if (!validCollection(user.id, collection, state[collection])) return fail(res, 400, `${collection}: არასწორი მონაცემები.`);
        }
        db.exec('BEGIN IMMEDIATE');
        try {
          const remove = db.prepare('DELETE FROM records WHERE user_id=? AND collection=?');
          const insert = db.prepare('INSERT INTO records(user_id,collection,record_id,data,updated_at) VALUES(?,?,?,?,?)');
          for (const collection of collections) {
            if (replacing) remove.run(user.id, collection);
            const items = itemsFor(collection, state[collection])!;
            items.forEach((item, index) => insert.run(user.id, collection, recordId(collection, item, index), JSON.stringify(item), Date.now()));
          }
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return send(res, 200, { state: stateFor(user.id) });
      }
      if (path === '/api/state/reset' && req.method === 'POST') {
        const files = db.prepare('SELECT filename FROM media WHERE user_id=?').all(user.id) as { filename: string }[];
        db.prepare('DELETE FROM records WHERE user_id=?').run(user.id);
        db.prepare('DELETE FROM media WHERE user_id=?').run(user.id);
        await Promise.all(files.map(file => unlink(join(MEDIA_DIR, file.filename)).catch(() => {})));
        return send(res, 200, { state: stateFor(user.id) });
      }
      if (path === '/api/media' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes > MAX_VIDEO) return fail(res, 413, 'ვიდეო მაქსიმუმ 24 MB შეიძლება იყოს.');
          chunks.push(chunk);
        }
        const data = Buffer.concat(chunks);
        const isMp4 = data.length > 12 && data.toString('ascii', 4, 8) === 'ftyp';
        const isWebm = data.length > 4 && data.subarray(0, 4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
        if (!isMp4 && !isWebm) return fail(res, 400, 'გამოიყენე MP4 ან WebM ვიდეო.');
        const id = randomBytes(16).toString('hex');
        const extension = isMp4 ? 'mp4' : 'webm';
        const filename = `${id}.${extension}`;
        await writeFile(join(MEDIA_DIR, filename), data, { flag: 'wx', mode: 0o600 });
        db.prepare('INSERT INTO media(id,user_id,filename,mime,bytes,created_at) VALUES(?,?,?,?,?,?)').run(id, user.id, filename, isMp4 ? 'video/mp4' : 'video/webm', bytes, Date.now());
        return send(res, 201, { url: `/api/media/${id}` });
      }
      const mediaMatch = /^\/api\/media\/([a-f0-9]{32})$/.exec(path);
      if (mediaMatch && req.method === 'DELETE') {
        const media = db.prepare('SELECT filename FROM media WHERE id=? AND user_id=?').get(mediaMatch[1], user.id) as { filename: string } | undefined;
        if (!media) return fail(res, 404, 'ვიდეო ვერ მოიძებნა.');
        db.prepare('DELETE FROM media WHERE id=? AND user_id=?').run(mediaMatch[1], user.id);
        await unlink(join(MEDIA_DIR, media.filename)).catch(() => {});
        return send(res, 200, { ok: true });
      }
      if (mediaMatch && req.method === 'GET') {
        const media = db.prepare('SELECT filename,mime,bytes FROM media WHERE id=? AND user_id=?').get(mediaMatch[1], user.id) as { filename: string; mime: string; bytes: number } | undefined;
        if (!media) return fail(res, 404, 'ვიდეო ვერ მოიძებნა.');
        const data = await readFile(join(MEDIA_DIR, media.filename));
        const range = /^bytes=(\d+)-(\d*)$/.exec(String(req.headers.range || ''));
        if (range) {
          const start = Number(range[1]);
          const end = range[2] ? Math.min(Number(range[2]), data.length - 1) : data.length - 1;
          if (start >= data.length || end < start) {
            res.writeHead(416, { 'Content-Range': `bytes */${data.length}` });
            return res.end();
          }
          res.writeHead(206, { 'Content-Type': media.mime, 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${data.length}`, 'Content-Length': end - start + 1, 'Cache-Control': 'private, max-age=3600' });
          return res.end(data.subarray(start, end + 1));
        }
        res.writeHead(200, { 'Content-Type': media.mime, 'Accept-Ranges': 'bytes', 'Content-Length': data.length, 'Cache-Control': 'private, max-age=3600' });
        return res.end(data);
      }
      const match = /^\/api\/state\/(dog|routineEntries|healthRecords|weightEntries|memories|walkSpots|vet|reminders)$/.exec(path);
      if (match && req.method === 'PUT') {
        const input = await body(req);
        if (!putCollection(user.id, match[1] as Collection, input.value)) return fail(res, 400, 'არასწორი მონაცემები.');
        return send(res, 200, { ok: true });
      }
      return fail(res, 404, 'მისამართი ვერ მოიძებნა.');
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return fail(res, 405, 'მეთოდი დაუშვებელია.');
    const asset = path === '/' ? 'index.html' : decodeURIComponent(path).replace(/^\/+/, '');
    if (asset.includes('..') || asset.startsWith('.') || asset.includes('\\') || asset.includes('\0')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    const file = join(DIST_DIR, asset);
    if (!existsSync(file)) return fail(res, 404, 'ფაილი ვერ მოიძებნა.');
    const contents = await readFile(file);
    const revalidate = asset === 'index.html' || asset === 'sw.js' || asset.endsWith('.webmanifest');
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': revalidate ? 'no-cache' : 'public, max-age=31536000, immutable' });
    res.end(req.method === 'HEAD' ? undefined : contents);
  } catch (error) {
    if (error instanceof SyntaxError) return fail(res, 400, 'არასწორი JSON მონაცემები.');
    if (error instanceof Error && error.message === 'REQUEST_TOO_LARGE') return fail(res, 413, 'ფაილი ძალიან დიდია.');
    console.error('Request failed:', error);
    return fail(res, 500, 'მოთხოვნა ვერ შესრულდა.');
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`PetLog running at http://127.0.0.1:${PORT}`));
