const { adminClient, getSessionUser, json } = require('./_supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'PATCH') return json(405, { error: 'Method not allowed' });

    const user = await getSessionUser(event);
    if (!user || user.role !== 'lecturer') return json(401, { error: 'Unauthorized' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

    const { id, status, preferred_time } = body;
    if (!id || !status) return json(400, { error: 'Missing id or status.' });
    if (!['accepted', 'declined'].includes(status)) return json(400, { error: 'Invalid status.' });

    const supabase = adminClient();

    // Verify this consultation belongs to this lecturer
    const { data: consultation, error: fetchErr } = await supabase
        .from('consultations')
        .select('id, lecturer_id')
        .eq('id', id)
        .eq('lecturer_id', user.student_id)
        .single();

    if (fetchErr || !consultation) return json(404, { error: 'Consultation not found.' });

    const update = { status };
    if (preferred_time) update.preferred_time = preferred_time;

    const { error: updateErr } = await supabase
        .from('consultations')
        .update(update)
        .eq('id', id);

    if (updateErr) return json(500, { error: updateErr.message });

    return json(200, { ok: true });
};
