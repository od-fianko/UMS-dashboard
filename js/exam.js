function renderStats(stats) {
    document.getElementById('exam-stats').innerHTML = `
        <div class="sc"><div class="sc-icon ic-blue"><span class="material-icons-sharp">event</span></div><div><div class="sc-val">${UMS.esc(String(stats.scheduled))}</div><div class="sc-lbl">Scheduled Exams</div></div></div>
        <div class="sc"><div class="sc-icon ic-red"><span class="material-icons-sharp">timer</span></div><div><div class="sc-val">${UMS.esc(String(stats.countdown))}</div><div class="sc-lbl">Until First Exam</div></div></div>
        <div class="sc"><div class="sc-icon ic-green"><span class="material-icons-sharp">room</span></div><div><div class="sc-val">${UMS.esc(String(stats.hall))}</div><div class="sc-lbl">Primary Hall</div></div></div>
    `;
}

function renderRow(item) {
    const statusClass = String(item.status).toLowerCase() === 'completed' ? 'completed-badge' : 'upcoming-badge';
    return `
        <tr>
            <td data-label="Date"><div class="date-cell"><div class="date-box"><div class="dd">${UMS.esc(item.date.day)}</div><div class="mm">${UMS.esc(item.date.month)}</div></div>${UMS.esc(item.date.weekday)}</div></td>
            <td data-label="Time">${UMS.esc(item.time)}</td>
            <td data-label="Subject"><span class="subj-pill"><span class="material-icons-sharp" style="font-size:.85rem">${UMS.esc(item.icon)}</span>${UMS.esc(item.subject)}</span></td>
            <td data-label="Room"><span class="room-chip">${UMS.esc(item.room)}</span></td>
            <td data-label="Status"><span class="${statusClass}">${UMS.esc(item.status)}</span></td>
        </tr>
    `;
}

function renderEmptyState() {
    document.getElementById('exam-body').innerHTML = `
        <tr>
            <td colspan="5">
                <div class="state-panel">
                    <span class="material-icons-sharp">event_busy</span>
                    <h3>No exams scheduled yet</h3>
                    <p>Your exam timetable has not been published yet. Check back later or contact your department for the latest release.</p>
                </div>
            </td>
        </tr>
    `;
}

function renderErrorState(message) {
    document.getElementById('exam-body').innerHTML = `
        <tr>
            <td colspan="5">
                <div class="state-panel">
                    <span class="material-icons-sharp">error_outline</span>
                    <h3>Unable to load exams</h3>
                    <p>${UMS.esc(message)}</p>
                    <button class="retry-btn" type="button" id="retry-exams">Try again</button>
                </div>
            </td>
        </tr>
    `;
    const retryButton = document.getElementById('retry-exams');
    if (retryButton) retryButton.addEventListener('click', loadExams);
}

function setStatusNote(text) {
    const note = document.getElementById('exam-status-note');
    if (note) note.textContent = text;
}

async function loadExams() {
    setStatusNote('Loading the latest exam timetable...');

    try {
        const data = await UMS.api('/api/exams');
        renderStats(data.stats);
        const semEl = document.getElementById('exam-semester');
        if (semEl) semEl.textContent = data.semester;

        const uniqueItems = Array.isArray(data.items) ? data.items.filter((item, index, list) => {
            const key = [
                item.date && item.date.day,
                item.date && item.date.month,
                item.date && item.date.weekday,
                item.time,
                item.subject,
                item.room,
                item.status
            ].map((value) => String(value || '').trim().toLowerCase()).join('|');
            return index === list.findIndex((entry) => {
                const entryKey = [
                    entry.date && entry.date.day,
                    entry.date && entry.date.month,
                    entry.date && entry.date.weekday,
                    entry.time,
                    entry.subject,
                    entry.room,
                    entry.status
                ].map((value) => String(value || '').trim().toLowerCase()).join('|');
                return entryKey === key;
            });
        }) : [];

        if (!uniqueItems.length) {
            renderEmptyState();
            setStatusNote('No published exams yet.');
            return;
        }

        renderStats(Object.assign({}, data.stats, { scheduled: uniqueItems.length }));
        document.getElementById('exam-body').innerHTML = uniqueItems.map(renderRow).join('');
        setStatusNote(`${uniqueItems.length} exam${uniqueItems.length === 1 ? '' : 's'} published for ${data.semester}.`);
    } catch (error) {
        setStatusNote('There was a problem loading your exam schedule.');
        renderErrorState(error.message || 'Please refresh the page and try again.');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    UMS.bindTheme();

    try {
        await UMS.requireAuth();
        await loadExams();
    } catch (error) {
        // Auth failures are already handled in UMS.requireAuth.
    }
});
