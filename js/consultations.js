document.addEventListener('DOMContentLoaded', async () => {
    UMS.bindTheme();
    const user = await UMS.requireAuth();
    if (user.role !== 'lecturer') {
        window.location.href = 'index.html';
        return;
    }

    const data = await UMS.api('/api/dashboard');
    const consultations = data.consultations || [];
    renderAll(consultations);

    function renderAll(items) {
        const pending = items.filter((c) => (c.status || 'pending') === 'pending').length;
        const accepted = items.filter((c) => c.status === 'accepted').length;

        document.getElementById('consultation-stats').innerHTML = `
            <div class="hero-card mini-card">
                <div class="mini-label">Pending Requests</div>
                <div class="mini-value">${pending}</div>
            </div>
            <div class="hero-card mini-card">
                <div class="mini-label">Accepted</div>
                <div class="mini-value" style="color:#22c88a">${accepted}</div>
            </div>
        `;

        const wrap = document.getElementById('consultations-wrap');
        if (!items.length) {
            wrap.innerHTML = '<div class="empty">No consultation requests have been booked yet.</div>';
            return;
        }

        wrap.innerHTML = items.map((item, idx) => {
            const initials = item.studentName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
            const date = new Date(item.created_at);
            const label = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const status = item.status || 'pending';

            const badge = status === 'accepted'
                ? `<div class="consult-badge cb-accepted"><span class="material-icons-sharp" style="font-size:.85rem">check_circle</span>Accepted</div>`
                : status === 'declined'
                ? `<div class="consult-badge cb-declined"><span class="material-icons-sharp" style="font-size:.85rem">cancel</span>Declined</div>`
                : `<div class="consult-badge cb-pending"><span class="material-icons-sharp" style="font-size:.85rem">schedule</span>Pending</div>`;

            const acceptedTime = status === 'accepted' && item.preferred_time
                ? `<div class="preferred-time"><span class="material-icons-sharp" style="font-size:.9rem">schedule</span>${UMS.esc(item.preferred_time)}</div>`
                : '';

            const actions = status === 'pending' ? `
                <div class="consult-actions" id="actions-${idx}">
                    <button class="btn-accept" onclick="startAccept(${idx})">
                        <span class="material-icons-sharp" style="font-size:.9rem">check</span>Accept
                    </button>
                    <button class="btn-decline" onclick="doDecline(${idx}, '${item.id}')">
                        <span class="material-icons-sharp" style="font-size:.9rem">close</span>Decline
                    </button>
                </div>
                <div class="accept-form" id="accept-form-${idx}" style="display:none">
                    <input type="text" class="time-input" id="time-input-${idx}"
                        placeholder="e.g. Monday 10:00 AM">
                    <div class="accept-form-btns">
                        <button class="btn-confirm" onclick="doAccept(${idx}, '${item.id}')">Confirm</button>
                        <button class="btn-cancel-sm" onclick="cancelAccept(${idx})">Cancel</button>
                    </div>
                </div>` : acceptedTime;

            return `
                <article class="consult-card" id="card-${idx}">
                    <div class="consult-av">${UMS.esc(initials)}</div>
                    <div class="consult-body">
                        <div class="consult-name">${UMS.esc(item.studentName)}</div>
                        <div class="consult-meta">${UMS.esc(item.studentProgram || 'Student')}<br>Requested a consultation.</div>
                        ${actions}
                    </div>
                    <div class="consult-date">
                        <div class="consult-day">${UMS.esc(label)} • ${UMS.esc(time)}</div>
                        ${badge}
                    </div>
                </article>
            `;
        }).join('');
    }

    window.startAccept = function (idx) {
        document.getElementById(`actions-${idx}`).style.display = 'none';
        document.getElementById(`accept-form-${idx}`).style.display = 'block';
        document.getElementById(`time-input-${idx}`).focus();
    };

    window.cancelAccept = function (idx) {
        document.getElementById(`accept-form-${idx}`).style.display = 'none';
        document.getElementById(`actions-${idx}`).style.display = 'flex';
    };

    window.doAccept = async function (idx, id) {
        const preferredTime = document.getElementById(`time-input-${idx}`).value.trim();
        if (!preferredTime) {
            UMS.toast('Please enter a preferred time.', 'warning');
            return;
        }
        try {
            await UMS.api('/api/consultations/update', {
                method: 'PATCH',
                body: { id, status: 'accepted', preferred_time: preferredTime }
            });
            consultations[idx].status = 'accepted';
            consultations[idx].preferred_time = preferredTime;
            renderAll(consultations);
            UMS.toast('Consultation accepted.', 'success');
        } catch (e) {
            UMS.toast(e.message || 'Failed to update.', 'error');
        }
    };

    window.doDecline = async function (idx, id) {
        try {
            await UMS.api('/api/consultations/update', {
                method: 'PATCH',
                body: { id, status: 'declined' }
            });
            consultations[idx].status = 'declined';
            renderAll(consultations);
            UMS.toast('Consultation declined.', 'info');
        } catch (e) {
            UMS.toast(e.message || 'Failed to update.', 'error');
        }
    };
});
