const { getSessionUser, json } = require('./_supabase');

exports.handler = async (event) => {
    const user = await getSessionUser(event);
    if (!user) return json(401, { error: 'Unauthorized' });

    return json(200, {
        user: {
            id: user.student_id,
            role: user.role,
            name: user.name,
            email: user.email,
            address: user.address,
            program: user.program,
            level: user.level
        }
    });
};
