const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);

// Session TTL: 7 days
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Rate limiting: max 10 failed login attempts per IP per 15 minutes
const loginAttempts = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// Allowed upload file extensions
const ALLOWED_EXTENSIONS = new Set([
    '.pdf', '.doc', '.docx', '.ppt', '.pptx',
    '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg', '.zip'
]);

const MAX_FIELD_LENGTH = 500;

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function readDb() {
    const data = await fsp.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
}

async function writeDb(db) {
    await fsp.writeFile(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.startsWith('scrypt$')) {
        // Timing-safe comparison for plaintext fallback
        const a = Buffer.from(String(password));
        const b = Buffer.from(String(stored || ''));
        if (a.length !== b.length) return false;
        return crypto.timingSafeEqual(a, b);
    }
    const [, salt, hash] = stored.split('$');
    const next = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
}

async function migratePasswords() {
    const db = await readDb();
    let changed = false;
    db.users = db.users.map((user) => {
        if (!user.password.startsWith('scrypt$')) {
            changed = true;
            return { ...user, password: hashPassword(user.password) };
        }
        return user;
    });
    if (changed) await writeDb(db);
}

function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const typeMap = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain; charset=utf-8',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    const contentType = typeMap[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 10 * 1024 * 1024) {
                reject(new Error('Payload too large'));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (!body) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

function publicUser(user) {
    return {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        address: user.address,
        program: user.program,
        level: user.level
    };
}

function getToken(req) {
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ')) return '';
    return auth.slice(7);
}

function isSessionValid(session) {
    return Date.now() - new Date(session.createdAt).getTime() < SESSION_TTL_MS;
}

async function getSessionUser(req) {
    const token = getToken(req);
    if (!token) return null;
    const db = await readDb();
    const session = db.sessions.find((item) => item.token === token);
    if (!session || !isSessionValid(session)) return null;
    const user = db.users.find((item) => item.id === session.userId);
    return user ? { db, session, user } : null;
}

async function requireAuth(req, res) {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return null;
    }
    return sessionUser;
}

function getClientIp(req) {
    return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function checkRateLimit(ip) {
    const now = Date.now();
    const entry = loginAttempts.get(ip) || { count: 0, windowStart: now };
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        entry.count = 0;
        entry.windowStart = now;
    }
    return entry.count < RATE_LIMIT_MAX;
}

function recordFailedLogin(ip) {
    const now = Date.now();
    const entry = loginAttempts.get(ip) || { count: 0, windowStart: now };
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        entry.count = 0;
        entry.windowStart = now;
    }
    entry.count++;
    loginAttempts.set(ip, entry);
}

function clearLoginAttempts(ip) {
    loginAttempts.delete(ip);
}

function sanitizeFileName(fileName) {
    const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '-');
    return safe || `file-${Date.now()}`;
}

function formatUploadDate() {
    return new Date().toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function buildLecturerDashboard(db, user) {
    const dedupeExamItems = (items) => {
        const seen = new Set();
        return (items || []).filter((item) => {
            const key = [
                item.date && item.date.day,
                item.date && item.date.month,
                item.date && item.date.weekday,
                item.time,
                item.subject,
                item.room,
                item.status
            ].map((value) => String(value || '').trim().toLowerCase()).join('|');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const lecturer = db.lecturers.find((l) => l.id === user.id);
    const courses = lecturer ? lecturer.courses : [];

    const teachingSchedule = {};
    Object.keys(db.timetable).forEach((day) => {
        const rows = db.timetable[day].filter((r) => courses.includes(r.s));
        teachingSchedule[day] = rows.length > 0 ? rows : [{ t: '-', r: '-', s: 'No lectures scheduled', l: '' }];
    });

    const examItems = dedupeExamItems((db.exams.items || []).filter((e) => courses.includes(e.subject)));

    const consultations = db.consultations
        .filter((c) => c.lecturerId === user.id)
        .map((c) => {
            const student = db.users.find((u) => u.id === c.studentId);
            return {
                ...c,
                studentName: student ? student.name : c.studentId,
                studentProgram: student ? `${student.program}, ${student.level}` : ''
            };
        })
        .reverse();

    const myResources = db.resources.filter((r) => r.lecturer === (lecturer ? lecturer.name : user.name)).slice(0, 4);

    return {
        teachingSchedule,
        exams: { semester: db.exams.semester, items: examItems },
        consultations,
        myResources,
        courses,
        lecturerInfo: lecturer || {}
    };
}

function buildDashboard(db, user) {
    if (user && user.role === 'lecturer') return buildLecturerDashboard(db, user);
    return {
        attendance: db.attendance,
        announcements: db.announcements,
        timetable: db.timetable,
        lecturers: db.lecturers.slice(0, 3),
        sharedResources: db.resources.slice(0, 3)
    };
}

async function handleApi(req, res, url) {
    if (req.method === 'POST' && url.pathname === '/api/auth/login') {
        const ip = getClientIp(req);
        if (!checkRateLimit(ip)) {
            sendJson(res, 429, { error: 'Too many login attempts. Please try again later.' });
            return;
        }
        const body = await parseBody(req);
        const db = await readDb();
        const user = db.users.find((item) => item.id === body.id && item.role === body.role);
        if (!user || !verifyPassword(body.password || '', user.password)) {
            recordFailedLogin(ip);
            sendJson(res, 401, { error: body.role === 'lecturer' ? 'Invalid Staff ID or password.' : 'Invalid Student ID or password.' });
            return;
        }
        clearLoginAttempts(ip);
        const token = crypto.randomBytes(24).toString('hex');
        db.sessions = db.sessions.filter((item) => item.userId !== user.id);
        db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
        await writeDb(db);
        sendJson(res, 200, { token, user: publicUser(user) });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/forgot') {
        const body = await parseBody(req);
        sendJson(res, 200, {
            message: `Password reset instructions queued for ${body.id || 'the supplied account'}.`
        });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/auth/me') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        sendJson(res, 200, { user: publicUser(sessionUser.user) });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        const token = getToken(req);
        const db = await readDb();
        db.sessions = db.sessions.filter((item) => item.token !== token);
        await writeDb(db);
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users/password') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        const body = await parseBody(req);
        if (!verifyPassword(body.currentPassword || '', sessionUser.user.password)) {
            sendJson(res, 400, { error: 'Current password is incorrect.' });
            return;
        }
        if (!body.newPassword || body.newPassword.length < 8) {
            sendJson(res, 400, { error: 'Password must be at least 8 characters.' });
            return;
        }
        sessionUser.user.password = hashPassword(body.newPassword);
        await writeDb(sessionUser.db);
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        sendJson(res, 200, buildDashboard(sessionUser.db, sessionUser.user));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/timetable') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        if (sessionUser.user.role === 'lecturer') {
            const dashboard = buildLecturerDashboard(sessionUser.db, sessionUser.user);
            sendJson(res, 200, { timetable: dashboard.teachingSchedule, mode: 'lecturer' });
            return;
        }
        sendJson(res, 200, { timetable: sessionUser.db.timetable, mode: 'student' });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/exams') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        const seen = new Set();
        const items = (sessionUser.db.exams.items || []).filter((item) => {
            const key = [
                item.date && item.date.day,
                item.date && item.date.month,
                item.date && item.date.weekday,
                item.time,
                item.subject,
                item.room,
                item.status
            ].map((value) => String(value || '').trim().toLowerCase()).join('|');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
        sendJson(res, 200, {
            ...sessionUser.db.exams,
            stats: {
                ...sessionUser.db.exams.stats,
                scheduled: items.length
            },
            items
        });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/lecturers') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        const response = { lecturers: sessionUser.db.lecturers };
        // Only return the requesting user's own consultations (prevents IDOR)
        if (sessionUser.user.role === 'student') {
            response.consultations = sessionUser.db.consultations.filter(
                (c) => c.studentId === sessionUser.user.id
            );
        }
        sendJson(res, 200, response);
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/consultations') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        const body = await parseBody(req);
        const lecturer = sessionUser.db.lecturers.find((item) => item.id === body.lecturerId);
        if (!lecturer) {
            sendJson(res, 404, { error: 'Lecturer not found.' });
            return;
        }
        sessionUser.db.consultations.push({
            id: crypto.randomUUID(),
            studentId: sessionUser.user.id,
            lecturerId: lecturer.id,
            lecturerName: lecturer.name,
            createdAt: new Date().toISOString()
        });
        await writeDb(sessionUser.db);
        sendJson(res, 200, { ok: true, message: `Consultation request sent to ${lecturer.name}.` });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/resources') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        const lecturer = sessionUser.db.lecturers.find((item) => item.id === sessionUser.user.id);
        const resources = sessionUser.user.role === 'lecturer'
            ? sessionUser.db.resources.filter((item) => item.lecturer === (lecturer ? lecturer.name : sessionUser.user.name))
            : sessionUser.db.resources;
        sendJson(res, 200, { resources });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/resources') {
        const sessionUser = await requireAuth(req, res);
        if (!sessionUser) return;
        if (sessionUser.user.role !== 'lecturer') {
            sendJson(res, 403, { error: 'Only lecturers can upload resources.' });
            return;
        }

        const body = await parseBody(req);
        if (!body.title || !body.course || !body.type || !body.description) {
            sendJson(res, 400, { error: 'Missing required resource fields.' });
            return;
        }

        // Input length validation
        if (
            String(body.title).length > MAX_FIELD_LENGTH ||
            String(body.course).length > MAX_FIELD_LENGTH ||
            String(body.description).length > MAX_FIELD_LENGTH * 2 ||
            String(body.type).length > 50
        ) {
            sendJson(res, 400, { error: 'One or more fields exceed the maximum allowed length.' });
            return;
        }

        let filePath = '';
        let fileName = String(body.fileName || 'shared-file.txt').slice(0, 255);
        if (body.fileData) {
            const match = String(body.fileData).match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                sendJson(res, 400, { error: 'Invalid file payload.' });
                return;
            }

            // File type whitelist
            const ext = path.extname(fileName).toLowerCase();
            if (!ALLOWED_EXTENSIONS.has(ext)) {
                sendJson(res, 400, { error: `File type "${ext || '(none)'}" is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(', ')}` });
                return;
            }

            const safeName = `${Date.now()}-${sanitizeFileName(fileName)}`;
            const outPath = path.join(UPLOAD_DIR, safeName);
            await fsp.writeFile(outPath, Buffer.from(match[2], 'base64'));
            filePath = `/uploads/${safeName}`;
        }

        const ICON_MAP = { Slides: 'slideshow', Assignment: 'assignment', Handout: 'description', Lab: 'science' };
        const lecturer = sessionUser.db.lecturers.find((entry) => entry.id === sessionUser.user.id);
        const item = {
            id: crypto.randomUUID(),
            title: String(body.title).trim(),
            type: String(body.type).trim(),
            course: String(body.course).trim(),
            lecturer: lecturer ? lecturer.name : sessionUser.user.name,
            description: String(body.description).trim(),
            fileName,
            size: String(body.size || 'Unknown size').slice(0, 30),
            uploaded: formatUploadDate(),
            dueDate: body.dueDate || '',
            icon: ICON_MAP[body.type] || 'description',
            filePath
        };
        sessionUser.db.resources.unshift(item);
        await writeDb(sessionUser.db);
        sendJson(res, 201, { resource: item });
        return;
    }

    sendJson(res, 404, { error: 'Not found' });
}

function resolveStaticPath(urlPath) {
    let target = decodeURIComponent(urlPath);
    if (target === '/') target = '/login.html';
    const fullPath = path.join(ROOT, target.replace(/^\/+/, ''));
    if (!fullPath.startsWith(ROOT)) return null;
    if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) return null;
    return fullPath;
}

// Periodically clean up expired sessions and rate limit entries
setInterval(async () => {
    try {
        const db = await readDb();
        const before = db.sessions.length;
        db.sessions = db.sessions.filter(isSessionValid);
        if (db.sessions.length < before) await writeDb(db);
    } catch (e) {}
}, 60 * 60 * 1000);

setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts.entries()) {
        if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) loginAttempts.delete(ip);
    }
}, RATE_LIMIT_WINDOW_MS);

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
        if (url.pathname.startsWith('/api/')) {
            await handleApi(req, res, url);
            return;
        }

        const staticPath = resolveStaticPath(url.pathname);
        if (staticPath) {
            sendFile(res, staticPath);
            return;
        }

        sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
        sendJson(res, 500, { error: error.message || 'Internal server error' });
    }
});

migratePasswords().then(() => {
    server.listen(PORT, () => {
        console.log(`UMS server running at http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
