const { adminClient, getSessionUser, json } = require('./_supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Invalid JSON' }); }

    const { currentPassword, newPassword } = body;
    if (!currentPassword || !newPassword) return json(400, { error: 'Missing fields.' });
    if (newPassword.length < 8) return json(400, { error: 'Password must be at least 8 characters.' });

    const supabase = adminClient();

    // Verify current password by attempting sign-in
    const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
    });
    if (verifyErr) return json(400, { error: 'Current password is incorrect.' });

    // Update password using admin API
    const { error: updateErr } = await supabase.auth.admin.updateUserById(user.id, {
        password: newPassword
    });
    if (updateErr) return json(500, { error: 'Failed to update password.' });

    return json(200, { ok: true });
};
