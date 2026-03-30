document.addEventListener('DOMContentLoaded', async () => {
    UMS.bindTheme();
    const user = await UMS.requireAuth();
    const data = await UMS.api('/api/dashboard');

    if (user.role === 'lecturer') {
        renderLecturerDashboard(data, user);
    } else {
        renderStudentDashboard(data, user);
    }
});

/* ── Shared greeting banner ── */
function renderGreeting(user) {
    const greetEl = document.getElementById('dash-greeting');
    if (!greetEl) return;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const today = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
    const subtitle = user.role === 'lecturer' ? UMS.esc(user.program) : `${UMS.esc(user.program)}, ${UMS.esc(user.level)}`;

    const links = user.role === 'lecturer' ? `
        <a href="resources.html" style="display:inline-flex;align-items:center;gap:.35rem;padding:.55rem .9rem;background:rgba(61,90,241,.09);color:var(--primary);border:1px solid rgba(61,90,241,.14);border-radius:10px;font-size:.76rem;font-weight:700;text-decoration:none;transition:all .2s;" onmouseover="this.style.background='rgba(61,90,241,.16)'" onmouseout="this.style.background='rgba(61,90,241,.09)'">
            <span class="material-icons-sharp" style="font-size:1rem">folder_open</span>Resources
        </a>
        <a href="consultations.html" style="display:inline-flex;align-items:center;gap:.35rem;padding:.55rem .9rem;background:rgba(34,200,138,.08);color:#16a870;border:1px solid rgba(34,200,138,.14);border-radius:10px;font-size:.76rem;font-weight:700;text-decoration:none;transition:all .2s;" onmouseover="this.style.background='rgba(34,200,138,.15)'" onmouseout="this.style.background='rgba(34,200,138,.08)'">
            <span class="material-icons-sharp" style="font-size:1rem">forum</span>Consultations
        </a>` : `
        <a href="exam.html" style="display:inline-flex;align-items:center;gap:.35rem;padding:.55rem .9rem;background:rgba(61,90,241,.09);color:var(--primary);border:1px solid rgba(61,90,241,.14);border-radius:10px;font-size:.76rem;font-weight:700;text-decoration:none;transition:all .2s;" onmouseover="this.style.background='rgba(61,90,241,.16)'" onmouseout="this.style.background='rgba(61,90,241,.09)'">
            <span class="material-icons-sharp" style="font-size:1rem">event</span>Exams
        </a>
        <a href="timetable.html" style="display:inline-flex;align-items:center;gap:.35rem;padding:.55rem .9rem;background:rgba(34,200,138,.08);color:#16a870;border:1px solid rgba(34,200,138,.14);border-radius:10px;font-size:.76rem;font-weight:700;text-decoration:none;transition:all .2s;" onmouseover="this.style.background='rgba(34,200,138,.15)'" onmouseout="this.style.background='rgba(34,200,138,.08)'">
            <span class="material-icons-sharp" style="font-size:1rem">calendar_today</span>Schedule
        </a>`;

    greetEl.innerHTML = `
        <div style="margin-bottom:1.6rem;padding:1.3rem 1.5rem;background:linear-gradient(135deg,rgba(61,90,241,.09),rgba(34,200,138,.08)),var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-sm);display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;">
            <div>
                <div style="font-family:'DM Serif Display',serif;font-size:1.45rem;color:var(--text);letter-spacing:-.02em">${UMS.esc(greeting)}, ${UMS.esc(user.name)}.</div>
                <div style="font-size:.8rem;color:var(--text-dim);margin-top:.25rem">${UMS.esc(today)} &nbsp;·&nbsp; ${subtitle}</div>
            </div>
            <div style="display:flex;gap:.5rem;flex-shrink:0;">${links}</div>
        </div>
    `;
}

/* ── Announcements (shared) ── */
function renderAnnouncements(announcements) {
    const el = document.getElementById('announcements-list');
    if (!el) return;
    const uniqueAnnouncements = [];
    const seenAnnouncements = new Set();

    announcements.forEach((item) => {
        const key = [
            String(item.title || '').trim().toLowerCase(),
            String(item.time || '').trim().toLowerCase()
        ].join('|');
        if (seenAnnouncements.has(key)) return;
        seenAnnouncements.add(key);
        uniqueAnnouncements.push(item);
    });

    el.innerHTML = uniqueAnnouncements.map((item) => `
        <div class="ann-row">
            <div class="ann-dot" style="background:${UMS.esc(item.color)}"></div>
            <div>
                <div class="ann-txt">${UMS.esc(item.title)}</div>
                <div class="ann-time">${UMS.esc(item.time)}</div>
            </div>
        </div>
    `).join('');
}

/* ── STUDENT DASHBOARD ── */
function renderStudentDashboard(data, user) {
    renderGreeting(user);
    renderAnnouncements(data.announcements);

    /* Attendance cards */
    const R = 32;
    const C = 2 * Math.PI * R;
    const card = (s) => {
        const fill = (s.pct / 100) * C;
        const statusColor = s.pct >= 85 ? '#22c88a' : s.pct >= 70 ? '#f5a623' : '#e85d75';
        const statusLabel = s.pct >= 85 ? 'Good' : s.pct >= 70 ? 'Moderate' : 'Low';
        return `<div class="att-card">
            <div class="att-label" style="color:${UMS.esc(s.color)}">
                <span class="material-icons-sharp" style="color:${UMS.esc(s.color)};font-size:.95rem">${UMS.esc(s.icon)}</span>
            </div>
            <div class="att-name">${UMS.esc(s.name)}</div>
            <div class="att-score">${UMS.esc(s.score)}</div>
            <div class="donut">
                <svg viewBox="0 0 78 78">
                    <circle class="d-track" cx="39" cy="39" r="${R}"></circle>
                    <circle class="d-fill" cx="39" cy="39" r="${R}" stroke="${UMS.esc(s.color)}" stroke-dasharray="0 ${C}" data-fill="${fill}"></circle>
                </svg>
                <div class="donut-label" style="color:${UMS.esc(s.color)}">${UMS.esc(String(s.pct))}%</div>
            </div>
            <div class="att-last" style="color:${statusColor};font-weight:600;font-size:.7rem">${statusLabel}</div>
        </div>`;
    };
    const uniqueAttendance = [];
    const seenAttendance = new Set();

    data.attendance.forEach((item) => {
        const key = String(item.name || '').trim().toLowerCase();
        if (seenAttendance.has(key)) return;
        seenAttendance.add(key);
        uniqueAttendance.push(item);
    });

    document.getElementById('att-grid').innerHTML = uniqueAttendance.map(card).join('');

    requestAnimationFrame(() => {
        document.querySelectorAll('.d-fill').forEach((el) => {
            const fill = Number(el.dataset.fill);
            setTimeout(() => { el.style.strokeDasharray = `${fill} ${C - fill}`; }, 80);
        });
    });

    /* Lecturer preview */
    const lecturers = document.getElementById('lecturer-preview');
    if (lecturers) {
        lecturers.innerHTML = data.lecturers.map((item) => `
            <div class="lec-row" style="cursor:pointer" title="View all lecturers">
                <div class="lec-av" style="background:${UMS.esc(item.bg)}22;color:${UMS.esc(item.bg)};border:2px solid ${UMS.esc(item.bg)}33">${UMS.esc(item.av)}</div>
                <div>
                    <div class="lec-name">${UMS.esc(item.name)}</div>
                    <div class="lec-sub">${UMS.esc(item.dept)}</div>
                </div>
                <div class="lec-more"><span class="material-icons-sharp" style="font-size:1.1rem">chevron_right</span></div>
            </div>
        `).join('');
        lecturers.addEventListener('click', () => { location.href = 'lecturers.html'; });
    }

    /* Shared Resources preview */
    const resourcePreview = document.getElementById('resource-preview');
    if (resourcePreview) {
        resourcePreview.innerHTML = `
            ${data.sharedResources.map((item) => `
                <div class="resource-row">
                    <div class="resource-icon"><span class="material-icons-sharp">${UMS.esc(item.icon)}</span></div>
                    <div class="resource-main">
                        <div class="resource-top">
                            <div class="resource-name">${UMS.esc(item.title)}</div>
                            <span class="resource-badge">${UMS.esc(item.type)}</span>
                        </div>
                        <div class="resource-meta">${UMS.esc(item.course)} &middot; ${UMS.esc(item.lecturer)}<br>${UMS.esc(item.uploaded)}</div>
                        <a class="resource-open" href="resources.html">
                            Open hub<span class="material-icons-sharp" style="font-size:.95rem">arrow_forward</span>
                        </a>
                    </div>
                </div>
            `).join('')}
            <div class="resource-footer">
                <p>Lecturers can share slides, notes and assignment files from one place.</p>
                <a href="resources.html"><span class="material-icons-sharp" style="font-size:1rem">folder</span>View all</a>
            </div>
        `;
    }

    /* Timetable */
    const tt = data.timetable;
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayNum = new Date().getDay();
    const hasClasses = (rows) => Array.isArray(rows) && rows.length && rows[0].r !== '-';
    const findNextScheduledDay = (startDay) => {
        for (let offset = 0; offset < 7; offset += 1) {
            const candidate = (startDay + offset) % 7;
            if (hasClasses(tt[candidate])) return candidate;
        }
        return startDay;
    };
    let day = todayNum;

    function renderTT() {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        document.getElementById('tt-title').textContent = day === todayNum ? "Today's Timetable" : `${days[day]}'s Timetable`;
        const rows = tt[day];
        document.getElementById('tt-body').innerHTML = rows.map((row, idx) => {
            const rowMins = UMS.getMinutes(row.t);
            const nextMins = idx + 1 < rows.length ? UMS.getMinutes(rows[idx + 1].t) : rowMins + 60;
            let rowStyle = '';
            if (day === todayNum && rowMins >= 0) {
                if (currentMins >= rowMins && currentMins < nextMins) rowStyle = ' class="current-class"';
                else if (rowMins < currentMins) rowStyle = ' style="opacity:.55"';
            }
            return `<tr${rowStyle}>
                <td>${UMS.esc(row.t)}</td><td>${UMS.esc(row.r)}</td>
                <td><strong>${UMS.esc(row.s)}</strong></td>
                <td>${row.l ? `<span class="pill pill-${UMS.esc(row.l.toLowerCase())}">${UMS.esc(row.l)}</span>` : ''}</td>
            </tr>`;
        }).join('');
    }

    document.getElementById('nextDay').onclick = () => { day = (day + 1) % 7; renderTT(); };
    document.getElementById('prevDay').onclick = () => { day = (day + 6) % 7; renderTT(); };
    renderTT();
}

/* ── LECTURER DASHBOARD ── */
function renderLecturerDashboard(data, user) {
    renderGreeting(user);

    /* Teaching schedule */
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayNum = new Date().getDay();
    const tt = data.teachingSchedule;
    const hasClasses = (rows) => Array.isArray(rows) && rows.length && rows[0].r !== '-';
    const findNextScheduledDay = (startDay) => {
        for (let offset = 0; offset < 7; offset += 1) {
            const candidate = (startDay + offset) % 7;
            if (hasClasses(tt[candidate])) return candidate;
        }
        return startDay;
    };
    let day = findNextScheduledDay(todayNum);

    function renderSchedule() {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const titleEl = document.getElementById('lec-tt-title');
        if (titleEl) titleEl.textContent = day === todayNum ? "Today's Teaching Schedule" : `${days[day]}'s Teaching Schedule`;
        const rows = (tt && tt[day]) ? tt[day] : [{ t: '-', r: '-', s: 'No lectures scheduled', l: '' }];
        const tbody = document.getElementById('lec-tt-body');
        if (tbody) {
            tbody.innerHTML = rows.map((row, idx) => {
                const rowMins = UMS.getMinutes(row.t);
                const nextMins = idx + 1 < rows.length ? UMS.getMinutes(rows[idx + 1].t) : rowMins + 60;
                let rowStyle = '';
                if (day === todayNum && rowMins >= 0) {
                    if (currentMins >= rowMins && currentMins < nextMins) rowStyle = ' class="current-class"';
                    else if (rowMins < currentMins) rowStyle = ' style="opacity:.55"';
                }
                return `<tr${rowStyle}>
                    <td>${UMS.esc(row.t)}</td><td>${UMS.esc(row.r)}</td>
                    <td><strong>${UMS.esc(row.s)}</strong></td>
                    <td>${row.l ? `<span class="pill pill-${UMS.esc(row.l.toLowerCase())}">${UMS.esc(row.l)}</span>` : ''}</td>
                </tr>`;
            }).join('');
        }
    }

    const nextDayBtn = document.getElementById('lec-nextDay');
    const prevDayBtn = document.getElementById('lec-prevDay');
    if (nextDayBtn) nextDayBtn.onclick = () => { day = (day + 1) % 7; renderSchedule(); };
    if (prevDayBtn) prevDayBtn.onclick = () => { day = (day + 6) % 7; renderSchedule(); };
    renderSchedule();

    /* Exam dates */
    const examsWrap = document.getElementById('lec-exams-wrap');
    if (examsWrap) {
        if (!data.exams.items || !data.exams.items.length) {
            examsWrap.innerHTML = `
                <div style="padding:1.2rem 1.5rem;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);font-size:.83rem;color:var(--text-dim)">
                    No upcoming exam dates for your courses.
                </div>`;
        } else {
            examsWrap.innerHTML = `<div class="lec-exam-grid">${data.exams.items.map((e, i) => `
                <div class="lec-exam-card" style="animation-delay:${i * 0.06}s">
                    <div class="lec-exam-date">
                        <div class="lec-exam-day">${UMS.esc(e.date.day)}</div>
                        <div class="lec-exam-month">${UMS.esc(e.date.month)}</div>
                    </div>
                    <div class="lec-exam-info">
                        <div class="lec-exam-subject">
                            <span class="material-icons-sharp" style="font-size:1rem;vertical-align:middle;margin-right:.3rem">${UMS.esc(e.icon)}</span>${UMS.esc(e.subject)}
                        </div>
                        <div class="lec-exam-meta">${UMS.esc(e.date.weekday)} &middot; ${UMS.esc(e.time)}</div>
                        <div class="lec-exam-meta">Room ${UMS.esc(e.room)}</div>
                    </div>
                    <span class="lec-exam-badge">${UMS.esc(e.status)}</span>
                </div>
            `).join('')}</div>`;
        }
    }

    /* Consultations */
    const consultList = document.getElementById('consultations-list');
    if (consultList) {
        if (!data.consultations.length) {
            consultList.innerHTML = '<div style="padding:1.2rem 1.5rem;font-size:.83rem;color:var(--text-dim)">No consultation requests yet.</div>';
        } else {
            consultList.innerHTML = data.consultations.map((c) => {
                const initials = c.studentName.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
                const date = new Date(c.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return `<div class="consult-item">
                    <div class="consult-av">${UMS.esc(initials)}</div>
                    <div class="consult-info">
                        <div class="consult-name">${UMS.esc(c.studentName)}</div>
                        <div class="consult-meta">${UMS.esc(c.studentProgram || 'Student')}</div>
                    </div>
                    <div class="consult-date">${UMS.esc(date)}</div>
                </div>`;
            }).join('');
        }
    }

    /* My resources */
    const resPreview = document.getElementById('lec-resource-preview');
    if (resPreview) {
        if (!data.myResources.length) {
            resPreview.innerHTML = `
                <div style="padding:1.2rem 1.5rem;font-size:.83rem;color:var(--text-dim)">You haven't uploaded any resources yet.</div>
                <div class="resource-footer">
                    <p>Share slides, notes and assignment files with students.</p>
                    <a href="resources.html"><span class="material-icons-sharp" style="font-size:1rem">upload_file</span>Upload</a>
                </div>`;
        } else {
            resPreview.innerHTML = `
                ${data.myResources.map((item) => `
                    <div class="resource-row">
                        <div class="resource-icon"><span class="material-icons-sharp">${UMS.esc(item.icon)}</span></div>
                        <div class="resource-main">
                            <div class="resource-top">
                                <div class="resource-name">${UMS.esc(item.title)}</div>
                                <span class="resource-badge">${UMS.esc(item.type)}</span>
                            </div>
                            <div class="resource-meta">${UMS.esc(item.course)} &middot; ${UMS.esc(item.uploaded)}</div>
                        </div>
                    </div>
                `).join('')}
                <div class="resource-footer">
                    <p>Upload new slides or assignment files for students.</p>
                    <a href="resources.html"><span class="material-icons-sharp" style="font-size:1rem">upload_file</span>Manage</a>
                </div>`;
        }
    }
}
