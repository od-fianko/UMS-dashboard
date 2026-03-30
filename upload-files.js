/**
 * Uploads local PDF files to Supabase Storage and updates file_path in the resources table.
 * Usage: node upload-files.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load .env
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

const UPLOADS_DIR = path.join(__dirname, 'uploads');

const FILES = [
    { localName: 'Intro_to_HTML.pdf',  dbFileName: 'Intro_to_HTML.pdf' },
    { localName: 'Unit_1A_HTML.pdf',   dbFileName: 'Unit_1A_HTML.pdf' },
    { localName: 'Unit_1B_HTML.pdf',   dbFileName: 'Unit_1B_HTML.pdf' },
];

async function run() {
    console.log('Uploading files to Supabase Storage...\n');

    for (const f of FILES) {
        const localPath = path.join(UPLOADS_DIR, f.localName);
        if (!fs.existsSync(localPath)) {
            console.warn(`  SKIP: ${f.localName} not found locally.`);
            continue;
        }

        const buffer = fs.readFileSync(localPath);
        const storageName = f.localName;

        console.log(`Uploading ${f.localName}...`);

        // Upload (upsert so re-running is safe)
        const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('resources')
            .upload(storageName, buffer, { contentType: 'application/pdf', upsert: true });

        if (uploadErr) {
            console.warn(`  Upload error: ${uploadErr.message}`);
            continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('resources')
            .getPublicUrl(uploadData.path);

        console.log(`  Public URL: ${publicUrl}`);

        // Update the resources table row that matches this file_name
        const { error: updateErr } = await supabase
            .from('resources')
            .update({ file_path: publicUrl })
            .eq('file_name', f.dbFileName);

        if (updateErr) {
            console.warn(`  DB update error: ${updateErr.message}`);
        } else {
            console.log(`  DB updated.\n`);
        }
    }

    console.log('Done.');
}

run().catch((err) => { console.error(err); process.exit(1); });
