const { json } = require('./_supabase');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

    let body;
    try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }

    return json(200, {
        message: `Password reset instructions queued for ${body.id || 'the supplied account'}.`
    });
};
