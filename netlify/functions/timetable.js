const { adminClient, getSessionUser, json } = require('./_supabase');

exports.handler = async (event) => {
    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    const supabase = adminClient();
    const { data: rows } = await supabase.from('timetable').select('*');
    const dedupeDayRows = (dayRows) => {
        const seen = new Set();
        return dayRows.filter((row) => {
            const key = [
                row.time,
                row.subject,
                row.room,
                row.lesson_type
            ].map((value) => String(value || '').trim().toLowerCase()).join('|');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const tt = {};
    for (let d = 0; d <= 6; d++) {
        const dayRows = dedupeDayRows((rows || []).filter((r) => r.day_of_week === d));
        tt[d] = dayRows.length
            ? dayRows.map((r) => ({ t: r.time, r: r.room, s: r.subject, l: r.lesson_type }))
            : [{ t: '-', r: '-', s: 'No classes - Rest Day', l: '' }];
    }

    if (user.role === 'lecturer') {
        const { data: lecturer } = await supabase
            .from('lecturers')
            .select('courses')
            .eq('id', user.student_id)
            .single();
        const courses = lecturer?.courses || [];

        const teachingSchedule = {};
        for (let d = 0; d <= 6; d++) {
            const dayRows = dedupeDayRows((rows || []).filter(
                (r) => r.day_of_week === d && courses.includes(r.subject)
            ));
            teachingSchedule[d] = dayRows.length
                ? dayRows.map((r) => ({ t: r.time, r: r.room, s: r.subject, l: r.lesson_type }))
                : [{ t: '-', r: '-', s: 'No lectures scheduled', l: '' }];
        }
        return json(200, { timetable: teachingSchedule, mode: 'lecturer' });
    }

    return json(200, { timetable: tt, mode: 'student' });
};
