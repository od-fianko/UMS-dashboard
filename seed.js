/**
 * UMS Seed Script — populates Supabase with demo data from db.json
 * Usage: node seed.js
 * Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 */

require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load .env manually (no dotenv dependency needed)
const fs = require('fs');
if (fs.existsSync('.env')) {
    fs.readFileSync('.env', 'utf8').split('\n').forEach((line) => {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const db = JSON.parse(fs.readFileSync('./data/db.json', 'utf8'));

async function run() {
    console.log('Seeding Supabase...\n');

    // ── Auth users + profiles ──────────────────────────────────
    for (const user of db.users) {
        console.log(`Creating auth user: ${user.email}`);
        const { data, error } = await supabase.auth.admin.createUser({
            email: user.email,
            password: user.role === 'student' ? 'student123' : 'lecturer123',
            email_confirm: true
        });
        if (error) {
            console.warn(`  Skipped (${error.message})`);
            continue;
        }
        const { error: profileErr } = await supabase.from('profiles').upsert({
            id: data.user.id,
            student_id: user.id,
            role: user.role,
            name: user.name,
            email: user.email,
            address: user.address || '',
            program: user.program || '',
            level: user.level || ''
        });
        if (profileErr) console.warn(`  Profile error: ${profileErr.message}`);
        else console.log(`  Profile created.`);
    }

    // ── Attendance ─────────────────────────────────────────────
    console.log('\nSeeding attendance...');
    const { error: attErr } = await supabase.from('attendance').upsert(
        db.attendance.map(({ icon, color, name, score, pct }) => ({ icon, color, name, score, pct }))
    );
    if (attErr) console.warn('  ' + attErr.message);
    else console.log('  Done.');

    // ── Announcements ──────────────────────────────────────────
    console.log('Seeding announcements...');
    const { error: annErr } = await supabase.from('announcements').upsert(
        db.announcements.map(({ title, time, color }) => ({ title, time, color }))
    );
    if (annErr) console.warn('  ' + annErr.message);
    else console.log('  Done.');

    // ── Timetable ──────────────────────────────────────────────
    console.log('Seeding timetable...');
    const ttRows = [];
    Object.entries(db.timetable).forEach(([day, rows]) => {
        rows.forEach((r) => {
            if (r.r !== '-') {
                ttRows.push({ day_of_week: Number(day), time: r.t, room: r.r, subject: r.s, lesson_type: r.l });
            }
        });
    });
    const { error: ttErr } = await supabase.from('timetable').upsert(ttRows);
    if (ttErr) console.warn('  ' + ttErr.message);
    else console.log('  Done.');

    // ── Exam config ────────────────────────────────────────────
    console.log('Seeding exam config...');
    const { error: ecErr } = await supabase.from('exam_config').upsert({
        id: 1,
        semester: db.exams.semester,
        scheduled: db.exams.stats.scheduled,
        countdown: db.exams.stats.countdown,
        hall: db.exams.stats.hall
    });
    if (ecErr) console.warn('  ' + ecErr.message);
    else console.log('  Done.');

    // ── Exam items ─────────────────────────────────────────────
    console.log('Seeding exam items...');
    const { error: eiErr } = await supabase.from('exam_items').upsert(
        db.exams.items.map((e) => ({
            day: e.date.day,
            month: e.date.month,
            weekday: e.date.weekday,
            time: e.time,
            subject: e.subject,
            icon: e.icon,
            room: e.room,
            status: e.status
        }))
    );
    if (eiErr) console.warn('  ' + eiErr.message);
    else console.log('  Done.');

    // ── Lecturers ──────────────────────────────────────────────
    console.log('Seeding lecturers...');
    const { error: lecErr } = await supabase.from('lecturers').upsert(
        db.lecturers.map((l) => ({
            id: l.id,
            name: l.name,
            dept: l.dept,
            av: l.av,
            bg: l.bg,
            status: l.status,
            slabel: l.slabel,
            sclass: l.sclass,
            courses: l.courses,
            hours: l.hours,
            location: l.location,
            mode: l.mode,
            micon: l.micon
        }))
    );
    if (lecErr) console.warn('  ' + lecErr.message);
    else console.log('  Done.');

    // ── Resources (metadata only — no file blobs) ──────────────
    console.log('Seeding resources...');
    const { error: resErr } = await supabase.from('resources').upsert(
        db.resources.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            course: r.course,
            lecturer: r.lecturer,
            description: r.description,
            file_name: r.fileName,
            size: r.size,
            uploaded: r.uploaded,
            due_date: r.dueDate,
            icon: r.icon,
            file_path: r.filePath || ''
        }))
    );
    if (resErr) console.warn('  ' + resErr.message);
    else console.log('  Done.');

    console.log('\nSeed complete.');
}

run().catch((err) => { console.error(err); process.exit(1); });
