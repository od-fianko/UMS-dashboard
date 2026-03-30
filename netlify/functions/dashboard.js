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

function buildTimetableObj(rows) {
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
        const dayRows = dedupeDayRows(rows.filter((r) => r.day_of_week === d));
        tt[d] = dayRows.length
            ? dayRows.map((r) => ({ t: r.time, r: r.room, s: r.subject, l: r.lesson_type }))
            : [{ t: '-', r: '-', s: 'No classes - Rest Day', l: '' }];
    }
    return tt;
}

exports.handler = async (event) => {
    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    const supabase = adminClient();

    if (user.role === 'lecturer') {
        // ── Lecturer dashboard ──────────────────────────────────
        const [lecturerRes, timetableRes, examRes, consultRes, resourceRes] = await Promise.all([
            supabase.from('lecturers').select('*').eq('id', user.student_id).single(),
            supabase.from('timetable').select('*'),
            supabase.from('exam_items').select('*'),
            supabase.from('consultations').select('*').eq('lecturer_id', user.student_id).order('created_at', { ascending: false }),
            supabase.from('resources').select('*').order('created_at', { ascending: false }).limit(20)
        ]);

        const lecturer = lecturerRes.data || {};
        const courses = lecturer.courses || [];
        const myResourceRows = (resourceRes.data || []).filter((item) => {
            if (!item.lecturer || !lecturer.name) return false;
            return item.lecturer.trim().toLowerCase() === lecturer.name.trim().toLowerCase();
        }).slice(0, 4);

        // Teaching schedule — filtered by lecturer's courses
        const teachingSchedule = {};
        for (let d = 0; d <= 6; d++) {
            const rows = (timetableRes.data || []).filter(
                (r) => r.day_of_week === d && courses.includes(r.subject)
            );
            const seen = new Set();
            const uniqueRows = rows.filter((row) => {
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
            teachingSchedule[d] = uniqueRows.length
                ? uniqueRows.map((r) => ({ t: r.time, r: r.room, s: r.subject, l: r.lesson_type }))
                : [{ t: '-', r: '-', s: 'No lectures scheduled', l: '' }];
        }

        // Enrich consultations with student names
        const studentIds = [...new Set((consultRes.data || []).map((c) => c.student_id))];
        let profileMap = {};
        if (studentIds.length) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, name, program, level')
                .in('id', studentIds);
            (profiles || []).forEach((p) => { profileMap[p.id] = p; });
        }

        const consultations = (consultRes.data || []).map((c) => {
            const p = profileMap[c.student_id];
            return {
                ...c,
                studentName: p ? p.name : c.student_id,
                studentProgram: p ? `${p.program}, ${p.level}` : ''
            };
        });

        return json(200, {
            teachingSchedule,
            exams: {
                semester: '',
                items: dedupeExamItems((examRes.data || []).filter((e) => courses.includes(e.subject)))
            },
            consultations,
            myResources: myResourceRows,
            courses,
            lecturerInfo: lecturer
        });
    }

    // ── Student dashboard ───────────────────────────────────────
    const [attRes, announcRes, ttRes, lecRes, resRes] = await Promise.all([
        supabase.from('attendance').select('*'),
        supabase.from('announcements').select('*').order('created_at', { ascending: false }),
        supabase.from('timetable').select('*'),
        supabase.from('lecturers').select('*').limit(3),
        supabase.from('resources').select('*').order('created_at', { ascending: false }).limit(3)
    ]);

    return json(200, {
        attendance: attRes.data || [],
        announcements: announcRes.data || [],
        timetable: buildTimetableObj(ttRes.data || []),
        lecturers: lecRes.data || [],
        sharedResources: resRes.data || []
    });
};
