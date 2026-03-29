document.addEventListener('DOMContentLoaded', async () => {
    UMS.bindTheme();
    const user = await UMS.requireAuth();
    const isLecturer = user.role === 'lecturer';
    const { timetable } = await UMS.api('/api/timetable');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date().getDay();
    const titleEl = document.querySelector('.stitle');
    const tableHeaders = document.querySelectorAll('thead th');
    const hasClasses = (rows) => Array.isArray(rows) && rows.length && rows[0].r !== '-';
    const findNextScheduledDay = (startDay) => {
        for (let offset = 0; offset < 7; offset += 1) {
            const candidate = (startDay + offset) % 7;
            if (hasClasses(timetable[candidate])) return candidate;
        }
        return startDay;
    };
    let cur = findNextScheduledDay(today);

    if (titleEl) titleEl.textContent = isLecturer ? 'Teaching Schedule' : 'Timetable';
    if (tableHeaders[2]) tableHeaders[2].textContent = isLecturer ? 'Course' : 'Subject';

    function renderStrip() {
        document.getElementById('week-strip').innerHTML = days.map((day, index) => `
            <button class="wt${index === cur ? ' active' : ''}${index === today ? ' today-mark' : ''}" onclick="setCur(${index})">${day}</button>
        `).join('');
    }

    window.setCur = function setCur(index) {
        cur = index;
        renderStrip();
        renderTT();
    };

    function renderTT() {
        const rows = timetable[cur];
        const isHoliday = rows[0].r === '-';
        const sessionLabel = isLecturer ? 'session' : 'class';
        const todayTitle = isLecturer ? "Today's Teaching Schedule" : "Today's Classes";
        const nextTitle = isLecturer ? `${days[cur]}'s Teaching Schedule` : `${days[cur]}'s Classes`;
        document.getElementById('card-title').textContent = cur === today ? todayTitle : nextTitle;
        document.getElementById('class-count').textContent = isHoliday ? 'Free day' : `${rows.length} ${sessionLabel}${rows.length !== 1 ? 's' : ''}`;

        if (isHoliday) {
            const emptyLabel = isLecturer ? 'No teaching scheduled' : rows[0].s;
            document.getElementById('tt-body').innerHTML = `<tr><td colspan="4"><div class="holiday-row"><span class="material-icons-sharp">beach_access</span>${emptyLabel}</div></td></tr>`;
            return;
        }

        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        let nextClassIdx = -1;

        document.getElementById('tt-body').innerHTML = rows.map((row, idx) => {
            const rowMins = UMS.getMinutes(row.t);
            const nextRowMins = idx + 1 < rows.length ? UMS.getMinutes(rows[idx + 1].t) : rowMins + 60;
            let trClass = '';
            let trStyle = '';
            let indicator = '';

            if (cur === today && rowMins >= 0) {
                if (currentMins >= rowMins && currentMins < nextRowMins) {
                    /* Currently in this class */
                    trClass = ' class="current-class-row"';
                    indicator = '<span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.66rem;font-weight:700;color:#22c88a;margin-left:.5rem;"><span class="material-icons-sharp" style="font-size:.8rem">fiber_manual_record</span>Now</span>';
                } else if (rowMins > currentMins && nextClassIdx === -1) {
                    /* Next upcoming class */
                    nextClassIdx = idx;
                    trClass = ' class="next-class-row"';
                    const minsUntil = rowMins - currentMins;
                    const hoursUntil = Math.floor(minsUntil / 60);
                    const minsRem = minsUntil % 60;
                    const untilLabel = hoursUntil > 0 ? `in ${hoursUntil}h ${minsRem}m` : `in ${minsRem}m`;
                    indicator = `<span style="display:inline-flex;align-items:center;gap:.25rem;font-size:.66rem;font-weight:700;color:#3d5af1;margin-left:.5rem;"><span class="material-icons-sharp" style="font-size:.8rem">schedule</span>Next · ${untilLabel}</span>`;
                } else if (rowMins < currentMins) {
                    trStyle = ' style="opacity:.5"';
                }
            }

            return `<tr${trClass}${trStyle}>
                <td>${row.t}</td>
                <td>${row.r}</td>
                <td><strong>${row.s}</strong>${indicator}</td>
                <td>${row.l ? `<span class="pill pill-${row.l.toLowerCase()}">${row.l}</span>` : ''}</td>
            </tr>`;
        }).join('');
    }

    renderStrip();
    renderTT();
});
