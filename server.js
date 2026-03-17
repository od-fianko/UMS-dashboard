const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function readDb() {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.startsWith('scrypt$')) return password === stored;
    const [, salt, hash] = stored.split('$');
    const next = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(next, 'hex'));
}

function migratePasswords() {
    const db = readDb();
    let changed = false;
    db.users = db.users.map((user) => {
        if (!user.password.startsWith('scrypt$')) {
            changed = true;
            return { ...user, password: hashPassword(user.password) };
        }
        return user;
    });
    if (changed) writeDb(db);
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

function getSessionUser(req) {
    const token = getToken(req);
    if (!token) return null;
    const db = readDb();
    const session = db.sessions.find((item) => item.token === token);
    if (!session) return null;
    const user = db.users.find((item) => item.id === session.userId);
    return user ? { db, session, user } : null;
}

function requireAuth(req, res) {
    const sessionUser = getSessionUser(req);
    if (!sessionUser) {
        sendJson(res, 401, { error: 'Unauthorized' });
        return null;
    }
    return sessionUser;
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
    const lecturer = db.lecturers.find((l) => l.id === user.id);
    const courses = lecturer ? lecturer.courses : [];

    const teachingSchedule = {};
    Object.keys(db.timetable).forEach((day) => {
        const rows = db.timetable[day].filter((r) => courses.includes(r.s));
        teachingSchedule[day] = rows.length > 0 ? rows : [{ t: '-', r: '-', s: 'No lectures scheduled', l: '' }];
    });

    const examItems = (db.exams.items || []).filter((e) => courses.includes(e.subject));

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

    const myResources = db.resources.filter((r) => r.lecturer === user.name).slice(0, 4);

    return {
        announcements: db.announcements,
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
        const body = await parseBody(req);
        const db = readDb();
        const user = db.users.find((item) => item.id === body.id && item.role === body.role);
        if (!user || !verifyPassword(body.password || '', user.password)) {
            sendJson(res, 401, { error: body.role === 'lecturer' ? 'Invalid Staff ID or password.' : 'Invalid Student ID or password.' });
            return;
        }
        const token = crypto.randomBytes(24).toString('hex');
        db.sessions = db.sessions.filter((item) => item.userId !== user.id);
        db.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() });
        writeDb(db);
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
        const sessionUser = requireAuth(req, res);
        if (!sessionUser) return;
        sendJson(res, 200, { user: publicUser(sessionUser.user) });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
        const token = getToken(req);
        const db = readDb();
        db.sessions = db.sessions.filter((item) => item.token !== token);
        writeDb(db);
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/users/password') {
        const sessionUser = requireAuth(req, res);
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
        writeDb(sessionUser.db);
        sendJson(res, 200, { ok: true });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/dashboard') {
        const sessionUser = requireAuth(req, res);
        if (!sessionUser) return;
        sendJson(res, 200, buildDashboard(sessionUser.db, sessionUser.user));
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/timetable') {
        const sessionUser = requireAuth(req, res);
        if (!sessionUser) return;
        sendJson(res, 200, { timetable: sessionUser.db.timetable });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/exams') {
        const sessionUser = requireAuth(req, res);
        if (!sessionUser) return;
        sendJson(res, 200, sessionUser.db.exams);
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/lecturers') {
        const sessionUser = requireAuth(req, res);
        if (!sessionUser) return;
        sendJson(res, 200, {
            lecturers: sessionUser.db.lecturers,
            consultations: sessionUser.db.consultations
        });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/consultations') {
        const sessionUser = requireAuth(req, res);
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
        writeDb(sessionUser.db);
        sendJson(res, 200, { ok: true, message: `Consultation request sent to ${lecturer.name}.` });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/resources') {
        const sessionUser = requireAuth(req, res);
        if (!sessionUser) return;
        sendJson(res, 200, { resources: sessionUser.db.resources });
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/resources') {
        const sessionUser = requireAuth(req, res);
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

        let filePath = '';
        let fileName = body.fileName || 'shared-file.txt';
        if (body.fileData) {
            const match = String(body.fileData).match(/^data:(.+);base64,(.+)$/);
            if (!match) {
                sendJson(res, 400, { error: 'Invalid file payload.' });
                return;
            }
            const safeName = `${Date.now()}-${sanitizeFileName(fileName)}`;
            const outPath = path.join(UPLOAD_DIR, safeName);
            fs.writeFileSync(outPath, Buffer.from(match[2], 'base64'));
            filePath = `/uploads/${safeName}`;
        }

        const item = {
            id: crypto.randomUUID(),
            title: body.title,
            type: body.type,
            course: body.course,
            lecturer: sessionUser.user.name,
            description: body.description,
            fileName,
            size: body.size || 'Unknown size',
            uploaded: formatUploadDate(),
            dueDate: body.dueDate || '',
            icon: body.icon || ({
                Slides: 'slideshow',
                Assignment: 'assignment',
                Handout: 'description',
                Lab: 'science'
            }[body.type] || 'description'),
            filePath
        };
        sessionUser.db.resources.unshift(item);
        sessionUser.db.announcements.unshift({
            title: `${body.course}: new ${body.type.toLowerCase()} uploaded`,
            time: 'Just now',
            color: '#3d5af1'
        });
        writeDb(sessionUser.db);
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

migratePasswords();

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

server.listen(PORT, () => {
    console.log(`UMS server running at http://localhost:${PORT}`);
});
