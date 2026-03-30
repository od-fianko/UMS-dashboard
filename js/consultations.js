document.addEventListener('DOMContentLoaded', async () => {
    UMS.bindTheme();
    const user = await UMS.requireAuth();
    if (user.role !== 'lecturer') {
        window.location.href = 'index.html';
        return;
    }

    const data = await UMS.api('/api/dashboard');
    const consultations = data.consultations || [];
    const wrap = document.getElementById('consultations-wrap');
    const stats = document.getElementById('consultation-stats');

    const latest = consultations[0]
        ? new Date(consultations[0].createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : 'None yet';

    stats.innerHTML = `
        <div class="hero-card mini-card">
            <div class="mini-label">Pending Requests</div>
            <div class="mini-value">${consultations.length}</div>
        </div>
        <div class="hero-card mini-card">
            <div class="mini-label">Latest Request</div>
            <div class="mini-value">${UMS.esc(latest)}</div>
        </div>
    `;

    if (!consultations.length) {
        wrap.innerHTML = '<div class="empty">No consultation requests have been booked yet.</div>';
        return;
    }

    wrap.innerHTML = consultations.map((item) => {
        const initials = item.studentName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
        const date = new Date(item.createdAt);
        const label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        return `
            <article class="consult-card">
                <div class="consult-av">${UMS.esc(initials)}</div>
                <div>
                    <div class="consult-name">${UMS.esc(item.studentName)}</div>
                    <div class="consult-meta">${UMS.esc(item.studentProgram || 'Student')}<br>Requested a consultation for CSM 399.</div>
                </div>
                <div class="consult-date">
                    <div class="consult-day">${UMS.esc(label)} • ${UMS.esc(time)}</div>
                    <div class="consult-badge"><span class="material-icons-sharp" style="font-size:.95rem">schedule</span>Pending</div>
                </div>
            </article>
        `;
    }).join('');
});
