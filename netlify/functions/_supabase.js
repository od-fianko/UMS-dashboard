const { createClient } = require('@supabase/supabase-js');

function adminClient() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
    );
}

function json(status, body) {
    return {
        statusCode: status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body)
    };
}

function getToken(event) {
    const auth = event.headers.authorization || event.headers.Authorization || '';
    if (!auth.startsWith('Bearer ')) return null;
    return auth.slice(7);
}

async function getSessionUser(event) {
    const token = getToken(event);
    if (!token) return null;
    const supabase = adminClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
    return profile || null;
}

module.exports = { adminClient, json, getToken, getSessionUser };
