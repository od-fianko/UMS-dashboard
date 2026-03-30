/**
 * Updates LEC005 to DR. (MRS.) ROSE-MARY OWUSUAA MENSAH GYENING (CSM 357)
 * and uploads her assignment to Supabase Storage.
 * Usage: node update-lecturer-csm357.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

const LECTURER_ID  = 'LEC005';
const NEW_NAME     = 'DR. (MRS.) ROSE-MARY OWUSUAA MENSAH GYENING';
const DEPT         = 'Human-Computer Interaction';
const COURSES      = ['CSM 357'];
const PDF_PATH     = 'c:/Users/odeif/Downloads/course stuff/l300/Semester 1/CSM 357 - Human Computer Interaction/CSM 357 HUMAN-COMPUTER INTERACTION TERM PROJECT.pdf';
const STORAGE_NAME = 'CSM357_HCI_Term_Project.pdf';

async function run() {
    // ── 1. Update lecturer row ──────────────────────────────────
    console.log('Updating lecturer LEC005...');
    const { error: lecErr } = await supabase.from('lecturers').update({
        name:     NEW_NAME,
        dept:     DEPT,
        av:       'RG',
        bg:       '#7c3aed',
        status:   'available',
        slabel:   'Available',
        sclass:   'sp-avail',
        courses:  COURSES,
        hours:    'Mon, Wed - 09:00 AM - 11:00 AM',
        location: 'Block 34, Room 301',
        mode:     'Physical',
        micon:    'meeting_room'
    }).eq('id', LECTURER_ID);

    if (lecErr) { console.error('  Lecturer update failed:', lecErr.message); process.exit(1); }
    console.log('  Done.\n');

    // ── 2. Upload PDF to Supabase Storage ───────────────────────
    console.log('Uploading assignment PDF...');
    if (!fs.existsSync(PDF_PATH)) {
        console.error('  PDF not found at:', PDF_PATH);
        process.exit(1);
    }
    const buffer = fs.readFileSync(PDF_PATH);
    const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('resources')
        .upload(STORAGE_NAME, buffer, { contentType: 'application/pdf', upsert: true });

    if (uploadErr) { console.error('  Upload failed:', uploadErr.message); process.exit(1); }

    const { data: { publicUrl } } = supabase.storage.from('resources').getPublicUrl(uploadData.path);
    console.log('  Public URL:', publicUrl, '\n');

    // ── 3. Insert resource record ───────────────────────────────
    console.log('Creating resource record...');
    const uploaded = new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const { error: resErr } = await supabase.from('resources').upsert({
        title:       'CSM 357 Term Project Brief',
        type:        'Assignment',
        course:      'CSM 357',
        lecturer:    NEW_NAME,
        description: 'Interface Design and Development term project for CSM 357 Human-Computer Interaction. Apply Nielsen\'s heuristics and UCD principles to design and implement a usable web or mobile application.',
        file_name:   STORAGE_NAME,
        size:        `${(buffer.length / 1024).toFixed(0)} KB`,
        uploaded,
        due_date:    '2025-02-25',
        icon:        'assignment',
        file_path:   publicUrl
    });

    if (resErr) { console.error('  Resource insert failed:', resErr.message); process.exit(1); }
    console.log('  Done.\n');

    // ── 4. Sync db.json ─────────────────────────────────────────
    console.log('Syncing db.json...');
    const db = JSON.parse(fs.readFileSync('./data/db.json', 'utf8'));
    const idx = db.lecturers.findIndex((l) => l.id === LECTURER_ID);
    if (idx !== -1) {
        db.lecturers[idx] = {
            ...db.lecturers[idx],
            name:    NEW_NAME,
            dept:    DEPT,
            av:      'RG',
            bg:      '#7c3aed',
            status:  'available',
            slabel:  'Available',
            sclass:  'sp-avail',
            courses: COURSES,
            hours:   'Mon, Wed - 09:00 AM - 11:00 AM',
            location:'Block 34, Room 301',
            mode:    'Physical',
            micon:   'meeting_room'
        };
        fs.writeFileSync('./data/db.json', JSON.stringify(db, null, 2));
        console.log('  Done.\n');
    } else {
        console.warn('  LEC005 not found in db.json, skipping.\n');
    }

    console.log('All done. Lecturer updated and assignment uploaded.');
}

run().catch((err) => { console.error(err); process.exit(1); });
