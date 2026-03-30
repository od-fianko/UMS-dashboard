const { adminClient, getSessionUser, json } = require('./_supabase');

function dedupeExamItems(items) {
    const seen = new Set();
    return (items || []).filter((item) => {
        const key = [
            item.day,
            item.month,
            item.weekday,
            item.time,
            item.subject,
            item.room,
            item.status
        ].map((value) => String(value || '').trim().toLowerCase()).join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

exports.handler = async (event) => {
    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    const supabase = adminClient();
    const [configRes, itemsRes] = await Promise.all([
        supabase.from('exam_config').select('*').eq('id', 1).single(),
        supabase.from('exam_items').select('*')
    ]);

    const config = configRes.data || {};
    const uniqueItems = dedupeExamItems(itemsRes.data || []);
    const items = uniqueItems.map((e) => ({
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
            scheduled: items.length,
            countdown: config.countdown || '',
            hall: config.hall || ''
        },
        items
    });
};
