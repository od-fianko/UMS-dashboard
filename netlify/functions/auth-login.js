const { adminClient, json } = require('./_supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

    const { id, password, role } = body;
    if (!id || !password || !role) return json(400, { error: 'Missing id, password or role.' });

    const supabase = adminClient();

    // Look up profile by institutional ID + role
    const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('student_id', id)
        .eq('role', role)
        .single();

    if (profileErr || !profile) {
        return json(401, { error: role === 'lecturer' ? 'Invalid Staff ID or password.' : 'Invalid Student ID or password.' });
    }

    // Sign in via Supabase Auth using email + password
    const { data: session, error: authErr } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password
    });

    if (authErr || !session?.session) {
        return json(401, { error: role === 'lecturer' ? 'Invalid Staff ID or password.' : 'Invalid Student ID or password.' });
    }

    return json(200, {
        token: session.session.access_token,
        user: {
            id: profile.student_id,
            role: profile.role,
            name: profile.name,
            email: profile.email,
            address: profile.address,
            program: profile.program,
            level: profile.level
        }
    });
};
