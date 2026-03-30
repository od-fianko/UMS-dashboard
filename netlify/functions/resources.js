const { adminClient, getSessionUser, json } = require('./_supabase');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.png', '.jpg', '.jpeg', '.zip']);
const MAX_FIELD_LENGTH = 500;
const ICON_MAP = { Slides: 'slideshow', Assignment: 'assignment', Handout: 'description', Lab: 'science' };

function formatUploadDate() {
    return new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

exports.handler = async (event) => {
    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    const supabase = adminClient();

    // ── GET /api/resources ─────────────────────────────────────
    if (event.httpMethod === 'GET') {
        let lecturerName = user.name;
        if (user.role === 'lecturer') {
            const { data: lecturer } = await supabase
                .from('lecturers')
                .select('name')
                .eq('id', user.student_id)
                .single();
            if (lecturer && lecturer.name) lecturerName = lecturer.name;
        }

        let query = supabase
            .from('resources')
            .select('*')
            .order('created_at', { ascending: false });

        if (user.role === 'lecturer') query = query.eq('lecturer', lecturerName);

        const { data: resources } = await query;

        // Normalize field names to match frontend expectations
        const normalized = (resources || []).map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            course: r.course,
            lecturer: r.lecturer,
            description: r.description,
            fileName: r.file_name,
            size: r.size,
            uploaded: r.uploaded,
            dueDate: r.due_date,
            icon: r.icon,
            filePath: r.file_path
        }));

        return json(200, { resources: normalized });
    }

    // ── POST /api/resources ────────────────────────────────────
    if (event.httpMethod === 'POST') {
        if (user.role !== 'lecturer') return json(403, { error: 'Only lecturers can upload resources.' });

        let body;
        try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

        const { title, course, type, description, dueDate, fileName, fileData, size } = body;
        if (!title || !course || !type || !description) return json(400, { error: 'Missing required resource fields.' });

        if (
            String(title).length > MAX_FIELD_LENGTH ||
            String(course).length > MAX_FIELD_LENGTH ||
            String(description).length > MAX_FIELD_LENGTH * 2 ||
            String(type).length > 50
        ) {
            return json(400, { error: 'One or more fields exceed the maximum allowed length.' });
        }

        let filePath = '';
        const safeFileName = String(fileName || 'file.txt').slice(0, 255);

        if (fileData) {
            const match = String(fileData).match(/^data:(.+);base64,(.+)$/);
            if (!match) return json(400, { error: 'Invalid file payload.' });

            const mimeType = match[1];
            const base64Data = match[2];
            const ext = path.extname(safeFileName).toLowerCase();

            if (!ALLOWED_EXTENSIONS.has(ext)) {
                return json(400, { error: `File type "${ext || '(none)'}" is not allowed.` });
            }

            const buffer = Buffer.from(base64Data, 'base64');
            const storageName = `${Date.now()}-${safeFileName.replace(/[^a-zA-Z0-9._-]/g, '-')}`;

            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from('resources')
                .upload(storageName, buffer, { contentType: mimeType, upsert: false });

            if (uploadErr) return json(500, { error: 'File upload failed: ' + uploadErr.message });

            const { data: { publicUrl } } = supabase.storage
                .from('resources')
                .getPublicUrl(uploadData.path);

            filePath = publicUrl;
        }

        const item = {
            title: String(title).trim(),
            type: String(type).trim(),
            course: String(course).trim(),
            lecturer: user.name,
            description: String(description).trim(),
            file_name: safeFileName,
            size: String(size || 'Unknown size').slice(0, 30),
            uploaded: formatUploadDate(),
            due_date: dueDate || '',
            icon: ICON_MAP[type] || 'description',
            file_path: filePath
        };

        const { data: saved, error: insertErr } = await supabase
            .from('resources')
            .insert(item)
            .select()
            .single();

        if (insertErr) return json(500, { error: 'Failed to save resource.' });

        return json(201, {
            resource: {
                id: saved.id,
                title: saved.title,
                type: saved.type,
                course: saved.course,
                lecturer: saved.lecturer,
                description: saved.description,
                fileName: saved.file_name,
                size: saved.size,
                uploaded: saved.uploaded,
                dueDate: saved.due_date,
                icon: saved.icon,
                filePath: saved.file_path
            }
        });
    }

    return json(405, { error: 'Method not allowed' });
};
