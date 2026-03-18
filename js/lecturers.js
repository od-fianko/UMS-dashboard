let filt = 'all';
let lecturers = [];
let currentUser = null;

function setF(btn) {
    document.querySelectorAll('.ft').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    filt = btn.dataset.f;
    render();
}

async function book(id) {
    const btn = document.querySelector(`.consult-btn[data-id="${id}"]`);
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons-sharp" style="font-size:.95rem;animation:spin .6s linear infinite">refresh</span> Sending…';
    }
    try {
        const response = await UMS.api('/api/consultations', {
            method: 'POST',
            body: { lecturerId: id }
        });
        UMS.toast(response.message + ' They will confirm via your student email.', 'success', 4000);
        if (btn) {
            btn.innerHTML = '<span class="material-icons-sharp" style="font-size:.95rem">check_circle</span> Requested';
            btn.style.background = '#22c88a';
        }
    } catch (error) {
        UMS.toast(error.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-sharp" style="font-size:.95rem">calendar_month</span> Book Consultation';
            btn.style.background = '';
        }
    }
}

function render() {
    const query = document.getElementById('search-inp').value.toLowerCase();
    const filtered = lecturers.filter((item) => {
        const matchFilter = filt === 'all' || item.status === filt || (filt === 'away' && (item.status === 'away' || item.status === 'busy'));
        const matchSearch = !query || item.name.toLowerCase().includes(query) || item.courses.some((course) => course.toLowerCase().includes(query)) || item.dept.toLowerCase().includes(query);
        return matchFilter && matchSearch;
    });
    const grid = document.getElementById('lec-grid');
    if (!filtered.length) {
        grid.innerHTML = `<div class="no-results"><span class="material-icons-sharp">search_off</span>No lecturers found.</div>`;
        return;
    }

    const unavail = (item) => item.status === 'away' || item.status === 'busy';
    // Use data-id attribute instead of inline onclick to avoid injection via item.id
    grid.innerHTML = filtered.map((item) => `
        <div class="lec-card">
            <div class="lc-top">
                <div class="lc-av" style="background:${UMS.esc(item.bg)}">${UMS.esc(item.av)}</div>
                <div class="lc-meta">
                    <div class="lc-name">${UMS.esc(item.name)}</div>
                    <div class="lc-dept">${UMS.esc(item.dept)}</div>
                    <span class="status-pill ${UMS.esc(item.sclass)}">${UMS.esc(item.slabel)}</span>
                </div>
            </div>
            <div class="lc-divider"></div>
            <div class="lc-body">
                <div class="info-row"><span class="material-icons-sharp">schedule</span><div><div class="info-lbl">Office Hours</div><div class="info-val">${UMS.esc(item.hours)}</div></div></div>
                <div class="info-row"><span class="material-icons-sharp">location_on</span><div><div class="info-lbl">Location</div><div class="info-val">${UMS.esc(item.location)}</div></div></div>
                <div class="info-row"><span class="material-icons-sharp">${UMS.esc(item.micon)}</span><div><div class="info-lbl">Mode</div><div class="info-val">${UMS.esc(item.mode)}</div></div></div>
            </div>
            <div class="lc-footer">
                <div class="chips">${item.courses.map((course) => `<span class="chip">${UMS.esc(course)}</span>`).join('')}</div>
                ${currentUser && currentUser.role === 'lecturer' ? `
                    <div class="info-val" style="font-size:.78rem;color:var(--text-dim)">Colleague directory only. Consultation booking is available to students.</div>
                ` : `
                    <button class="consult-btn" data-id="${UMS.esc(item.id)}" ${unavail(item) ? 'disabled' : ''}>
                        <span class="material-icons-sharp" style="font-size:.95rem">${unavail(item) ? 'block' : 'calendar_month'}</span>
                        ${unavail(item) ? 'Unavailable' : 'Book Consultation'}
                    </button>
                `}
            </div>
        </div>
    `).join('');
}

document.addEventListener('DOMContentLoaded', async () => {
    UMS.bindTheme();
    const user = await UMS.requireAuth();
    currentUser = user;
    const data = await UMS.api('/api/lecturers');
    lecturers = data.lecturers;
    if (user.role === 'lecturer') {
        const title = document.querySelector('.stitle');
        const sub = document.querySelector('.subtitle');
        if (title) title.textContent = 'Staff Directory';
        if (sub) sub.textContent = 'Browse colleague profiles, office hours and teaching areas across departments.';
    }
    render();

    // Event delegation for consultation booking buttons (avoids inline onclick with user-supplied IDs)
    document.getElementById('lec-grid').addEventListener('click', (e) => {
        const btn = e.target.closest('.consult-btn');
        if (btn && !btn.disabled) book(btn.dataset.id);
    });
});
