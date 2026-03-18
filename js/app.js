(function () {
    const TOKEN_KEY = 'ums-auth-token';
    const REMEMBER_TOKEN_KEY = 'ums-auth-token-remember';
    const REMEMBER_ID_KEY = 'ums-remember-id';

    /* ── Inject global styles ── */
    const _css = `
/* ─── UMS Global Additions ─── */
/* Toast */
.ums-toasts{position:fixed;bottom:5.5rem;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:.5rem;z-index:2000;pointer-events:none;align-items:center;}
.ums-toast{padding:.72rem 1.3rem;border-radius:14px;font-family:'DM Sans',sans-serif;font-size:.82rem;font-weight:600;display:flex;align-items:center;gap:.5rem;box-shadow:0 8px 28px rgba(0,0,0,.22);pointer-events:auto;white-space:nowrap;animation:ums-toast-in .28s cubic-bezier(.4,0,.2,1);transition:opacity .3s,transform .3s;}
.ums-toast.success{background:#22c88a;color:#fff;}
.ums-toast.error{background:#e85d75;color:#fff;}
.ums-toast.info{background:#3d5af1;color:#fff;}
.ums-toast.warning{background:#f5a623;color:#fff;}
.ums-toast .material-icons-sharp{font-size:1.05rem;}
@keyframes ums-toast-in{from{opacity:0;transform:translateY(14px) scale(.95)}to{opacity:1;transform:translateY(0) scale(1)}}

/* Mobile Bottom Nav */
.ums-mobile-nav{display:none;position:fixed;bottom:0;left:0;right:0;background:var(--surface);border-top:1px solid var(--border);padding:.35rem 0 calc(.35rem + env(safe-area-inset-bottom,0px));z-index:900;box-shadow:0 -1px 16px rgba(0,0,0,.07);}
.ums-mobile-nav .mn-items{display:flex;}
.ums-mobile-nav .mn-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:.16rem;padding:.28rem .4rem;color:var(--text-dim);font-size:.59rem;font-weight:600;text-decoration:none;transition:color .18s;line-height:1;}
.ums-mobile-nav .mn-item.active{color:var(--primary);}
.ums-mobile-nav .mn-item .material-icons-sharp{font-size:1.28rem;}
@media(max-width:620px){
    .ums-mobile-nav{display:block;}
    body{padding-bottom:calc(3.8rem + env(safe-area-inset-bottom,0px))!important;}
    .fab{bottom:calc(4.8rem + env(safe-area-inset-bottom,0px))!important;}
    .ums-toasts{bottom:calc(6rem + env(safe-area-inset-bottom,0px));}
}

/* Page progress bar */
#ums-progress{position:fixed;top:0;left:0;height:3px;background:var(--primary,#3d5af1);z-index:9999;transition:width .25s ease;pointer-events:none;border-radius:0 3px 3px 0;}

/* Skeleton shimmer */
.ums-skeleton{background:linear-gradient(90deg,var(--surface2,#f0f0f5) 25%,var(--surface3,#e4e4ee) 50%,var(--surface2,#f0f0f5) 75%);background-size:200% 100%;animation:ums-shimmer 1.5s infinite;border-radius:8px;color:transparent!important;}
.ums-skeleton *{visibility:hidden;}
@keyframes ums-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* Smooth table row transitions */
tbody tr{transition:background .15s,opacity .2s;}

/* Active nav item transition */
.nav-item{transition:color .18s,background .18s;}
`;
    const styleEl = document.createElement('style');
    styleEl.textContent = _css;
    document.head.appendChild(styleEl);

    /* ── Progress bar ── */
    let _progressEl = null;
    function showProgress() {
        if (!_progressEl) {
            _progressEl = document.createElement('div');
            _progressEl.id = 'ums-progress';
            document.body.appendChild(_progressEl);
        }
        _progressEl.style.width = '30%';
        _progressEl.style.opacity = '1';
    }
    function advanceProgress() {
        if (_progressEl) _progressEl.style.width = '75%';
    }
    function hideProgress() {
        if (_progressEl) {
            _progressEl.style.width = '100%';
            setTimeout(() => {
                if (_progressEl) { _progressEl.style.opacity = '0'; }
                setTimeout(() => { if (_progressEl) _progressEl.style.width = '0'; }, 350);
            }, 200);
        }
    }

    /* ── HTML escaper (prevents XSS when inserting into innerHTML) ── */
    function esc(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;');
    }

    /* ── Time parser (shared across pages) ── */
    function getMinutes(timeStr) {
        if (!timeStr || timeStr === '-') return -1;
        const m = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!m) return -1;
        let h = parseInt(m[1]);
        if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
        if (m[3].toUpperCase() === 'AM' && h === 12) h = 0;
        return h * 60 + parseInt(m[2]);
    }

    /* ── Toast ── */
    function toast(message, type, duration) {
        type = type || 'info';
        duration = duration === undefined ? 3000 : duration;
        let container = document.getElementById('ums-toasts');
        if (!container) {
            container = document.createElement('div');
            container.id = 'ums-toasts';
            container.className = 'ums-toasts';
            document.body.appendChild(container);
        }
        const icons = { success: 'check_circle', error: 'error_outline', info: 'info', warning: 'warning' };
        const el = document.createElement('div');
        el.className = 'ums-toast ' + type;
        el.innerHTML = '<span class="material-icons-sharp">' + (icons[type] || 'info') + '</span>' + esc(message);
        container.appendChild(el);
        setTimeout(function () {
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px) scale(.95)';
            setTimeout(function () { el.remove(); }, 320);
        }, duration);
    }

    function getNavPages(role) {
        if (role === 'lecturer') {
            return [
                { href: 'index.html', icon: 'home', label: 'Home' },
                { href: 'timetable.html', icon: 'calendar_today', label: 'Schedule' },
                { href: 'resources.html', icon: 'folder_open', label: 'Resources' }
            ];
        }
        return [
            { href: 'index.html', icon: 'home', label: 'Home' },
            { href: 'timetable.html', icon: 'calendar_today', label: 'Timetable' },
            { href: 'exam.html', icon: 'grid_view', label: 'Exams' },
            { href: 'resources.html', icon: 'folder_open', label: 'Resources' },
            { href: 'lecturers.html', icon: 'person_outline', label: 'Lecturers' }
        ];
    }

    function syncDesktopNav(role) {
        const nav = document.querySelector('.nav-center');
        if (!nav) return;
        const allowed = getNavPages(role).map(function (page) { return page.href; });
        nav.querySelectorAll('a.nav-item').forEach(function (item) {
            const href = item.getAttribute('href');
            item.style.display = allowed.includes(href) ? '' : 'none';
        });
    }

    /* ── Mobile bottom navigation ── */
    function buildMobileNav(role) {
        if (document.querySelector('.ums-mobile-nav')) return;
        const pages = getNavPages(role);
        const current = window.location.pathname.split('/').pop() || 'index.html';
        const nav = document.createElement('nav');
        nav.className = 'ums-mobile-nav';
        nav.innerHTML = '<div class="mn-items">' + pages.map(function (p) {
            return '<a class="mn-item' + (current === p.href ? ' active' : '') + '" href="' + p.href + '">'
                + '<span class="material-icons-sharp">' + p.icon + '</span>'
                + '<span>' + p.label + '</span>'
                + '</a>';
        }).join('') + '</div>';
        document.body.appendChild(nav);
    }

    function refreshNav(role) {
        syncDesktopNav(role);
        const existingMobileNav = document.querySelector('.ums-mobile-nav');
        if (existingMobileNav) existingMobileNav.remove();
        buildMobileNav(role);
    }

    /* ── Token helpers ── */
    function getStoredToken() {
        return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(REMEMBER_TOKEN_KEY) || '';
    }

    function setStoredToken(token, remember) {
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REMEMBER_TOKEN_KEY);
        if (!token) return;
        if (remember) localStorage.setItem(REMEMBER_TOKEN_KEY, token);
        else sessionStorage.setItem(TOKEN_KEY, token);
    }

    /* ── API ── */
    async function api(path, options) {
        options = options || {};
        const headers = Object.assign({}, options.headers || {});
        const token = getStoredToken();
        if (token && options.auth !== false) headers.Authorization = 'Bearer ' + token;
        if (options.json !== false) headers['Content-Type'] = 'application/json';
        const response = await fetch(path, {
            method: options.method || 'GET',
            headers,
            body: options.body && options.json !== false ? JSON.stringify(options.body) : options.body
        });

        let payload = {};
        try { payload = await response.json(); } catch (e) {}

        if (!response.ok) {
            const message = payload.error || ('Request failed with status ' + response.status);
            const err = new Error(message);
            err.status = response.status;
            throw err;
        }
        return payload;
    }

    /* ── Theme ── */
    function bindTheme(toggleSelector, iconSelector) {
        toggleSelector = toggleSelector || '#fab';
        iconSelector = iconSelector || '#fab-icon';
        let dark = localStorage.getItem('ums-dark') === 'true';
        const apply = function () {
            document.body.classList.toggle('dark', dark);
            const icon = document.querySelector(iconSelector);
            if (icon) icon.textContent = dark ? 'light_mode' : 'dark_mode';
        };
        apply();
        const toggle = document.querySelector(toggleSelector);
        if (toggle) {
            toggle.onclick = function () {
                dark = !dark;
                localStorage.setItem('ums-dark', dark);
                apply();
            };
        }
        return apply;
    }

    /* ── User hydration ── */
    function hydrateUser(user) {
        if (!user) return;
        refreshNav(user.role);
        document.querySelectorAll('.u-name').forEach(function (el) { el.textContent = user.name; });
        document.querySelectorAll('.u-role').forEach(function (el) { el.textContent = user.role === 'lecturer' ? 'Lecturer' : 'Student'; });
        document.querySelectorAll('.u-avatar').forEach(function (el) {
            el.textContent = user.name.split(/\s+/).map(function (part) { return part[0]; }).slice(0, 2).join('').toUpperCase();
        });
        document.querySelectorAll('.dd-row').forEach(function (row) {
            const label = row.querySelector('.dd-label');
            const value = row.querySelector('.dd-value');
            if (!label || !value) return;
            const text = label.textContent.trim().toLowerCase();
            if (text === 'course') value.innerHTML = esc(user.program) + '<br>' + esc(user.level);
            if (text === 'student id') {
                label.textContent = user.role === 'lecturer' ? 'Staff ID' : 'Student ID';
                value.textContent = user.id;
            }
            if (text === 'email') value.textContent = user.email;
            if (text === 'address') value.textContent = user.address;
        });
        document.querySelectorAll('[data-lecturer-only]').forEach(function (el) {
            el.style.display = user.role === 'lecturer' ? '' : 'none';
        });
        document.querySelectorAll('[data-student-only]').forEach(function (el) {
            el.style.display = user.role === 'student' ? '' : 'none';
        });
    }

    /* ── Auth ── */
    async function requireAuth() {
        showProgress();
        try {
            const data = await api('/api/auth/me');
            advanceProgress();
            hydrateUser(data.user);
            hideProgress();
            return data.user;
        } catch (error) {
            hideProgress();
            clearAuth(false);
            window.location.href = 'login.html';
            throw error;
        }
    }

    async function logout() {
        try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
        clearAuth(true);
    }

    function clearAuth(redirect) {
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REMEMBER_TOKEN_KEY);
        if (redirect) window.location.href = 'login.html';
    }

    function rememberId(id, remember) {
        if (remember) localStorage.setItem(REMEMBER_ID_KEY, id);
        else localStorage.removeItem(REMEMBER_ID_KEY);
    }

    function getRememberedId() {
        return localStorage.getItem(REMEMBER_ID_KEY) || '';
    }

    /* ── Global click handlers ── */
    document.addEventListener('click', function (event) {
        const wrap = document.querySelector('.menu-wrap');
        const dropdown = document.getElementById('dropdown');
        if (wrap && dropdown && !wrap.contains(event.target)) dropdown.classList.remove('open');
    });

    window.toggleMenu = function toggleMenu() {
        const dropdown = document.getElementById('dropdown');
        if (dropdown) dropdown.classList.toggle('open');
    };

    window.logout = logout;

    /* ── Build mobile nav on DOM ready ── */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildMobileNav);
    } else {
        buildMobileNav();
    }

    window.UMS = {
        api,
        bindTheme,
        requireAuth,
        hydrateUser,
        setStoredToken,
        getStoredToken,
        clearAuth,
        rememberId,
        getRememberedId,
        toast,
        showProgress,
        advanceProgress,
        hideProgress,
        esc,
        getMinutes
    };
})();
