const { adminClient, getSessionUser, json } = require('./_supabase');

exports.handler = async (event) => {
    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    const supabase = adminClient();
    const { data: lecturers } = await supabase.from('lecturers').select('*');
    const response = { lecturers: lecturers || [] };

    // Students also get their own consultations
    if (user.role === 'student') {
        const { data: consultations } = await supabase
            .from('consultations')
            .select('*')
            .eq('student_id', user.id);
        response.consultations = consultations || [];
    }

    return json(200, response);
};
