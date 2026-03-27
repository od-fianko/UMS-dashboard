const { adminClient, getSessionUser, json } = require('./_supabase');

exports.handler = async (event) => {
    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    const supabase = adminClient();
    const [configRes, itemsRes] = await Promise.all([
        supabase.from('exam_config').select('*').eq('id', 1).single(),
        supabase.from('exam_items').select('*')
    ]);

    const config = configRes.data || {};
    const items = (itemsRes.data || []).map((e) => ({
        date: { day: e.day, month: e.month, weekday: e.weekday },
        time: e.time,
        subject: e.subject,
        icon: e.icon,
        room: e.room,
        status: e.status
    }));

    return json(200, {
        semester: config.semester || '',
        stats: {
            scheduled: config.scheduled || items.length,
            countdown: config.countdown || '',
            hall: config.hall || ''
        },
        items
    });
};
