const { adminClient, getSessionUser, json } = require('./_supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

    const { lecturerId } = body;
    if (!lecturerId) return json(400, { error: 'Missing lecturerId.' });

    const supabase = adminClient();

    const { data: lecturer, error: lecErr } = await supabase
        .from('lecturers')
        .select('id, name')
        .eq('id', lecturerId)
        .single();

    if (lecErr || !lecturer) return json(404, { error: 'Lecturer not found.' });

    const { error: insertErr } = await supabase.from('consultations').insert({
        student_id: user.id,
        lecturer_id: lecturer.id,
        lecturer_name: lecturer.name
    });

    if (insertErr) return json(500, { error: 'Failed to book consultation.' });

    return json(200, { ok: true, message: `Consultation request sent to ${lecturer.name}.` });
};
