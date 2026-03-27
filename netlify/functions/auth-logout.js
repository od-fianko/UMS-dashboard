const { adminClient, getToken, json } = require('./_supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    const token = getToken(event);
    if (token) {
        const supabase = adminClient();
        await supabase.auth.admin.signOut(token);
    }

    return json(200, { ok: true });
};
