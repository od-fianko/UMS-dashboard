let role = 'student';

const DEMO = {
    student: { label: 'Student ID', placeholder: 'e.g. 0005678', id: '0005678', pw: 'student123' },
    lecturer: { label: 'Staff ID',   placeholder: 'e.g. LEC001',  id: 'LEC001',  pw: 'lecturer123' }
};

function selectRole(btn) {
    document.querySelectorAll('.role-btn').forEach((b) => b.classList.remove('selected'));
    btn.classList.add('selected');
    role = btn.dataset.role;
    const d = DEMO[role];
    document.getElementById('id-label').textContent = d.label;
    document.getElementById('uid').placeholder = d.placeholder;
    const hint = document.getElementById('demo-hint');
    if (hint) {
        hint.innerHTML = `Use <strong>${d.label}:</strong> ${d.id} &nbsp;|&nbsp; <strong>Password:</strong> ${d.pw}<br>
            <span style="font-size:.72rem;color:var(--text-dim);">Click "Sign In" to enter the dashboard.</span>`;
    }
}

function togglePw() {
    const inp = document.getElementById('pwd');
    const eye = document.querySelector('.eye');
    const hidden = inp.type === 'password';
    inp.type = hidden ? 'text' : 'password';
    eye.textContent = hidden ? 'visibility' : 'visibility_off';
}

async function doLogin() {
    const uid = document.getElementById('uid').value.trim();
    const pwd = document.getElementById('pwd').value;
    const remember = document.getElementById('remember').checked;
    const errBox = document.getElementById('error-msg');
    const errTxt = document.getElementById('error-text');
    const btn = document.getElementById('login-btn');

    errBox.style.display = 'none';
    if (!uid || !pwd) {
        errTxt.textContent = 'Please enter your ID and password.';
        errBox.style.display = 'flex';
        return;
    }

    document.getElementById('spinner').style.display = 'block';
    document.getElementById('btn-text').textContent = 'Signing in...';
    document.getElementById('btn-icon').style.display = 'none';
    btn.disabled = true;

    try {
        const data = await UMS.api('/api/auth/login', {
            method: 'POST',
            body: { id: uid, password: pwd, role }
        });
        UMS.setStoredToken(data.token, remember);
        UMS.rememberId(uid, remember);
        window.location.href = 'index.html';
    } catch (error) {
        errTxt.textContent = error.message;
        errBox.style.display = 'flex';
        document.getElementById('pwd').value = '';
        document.getElementById('pwd').focus();
    } finally {
        document.getElementById('spinner').style.display = 'none';
        document.getElementById('btn-text').textContent = 'Sign In';
        document.getElementById('btn-icon').style.display = 'block';
        btn.disabled = false;
    }
}

async function showForgot() {
    const id = document.getElementById('uid').value.trim();
    const response = await UMS.api('/api/auth/forgot', {
        method: 'POST',
        body: { id, role },
        auth: false
    });
    alert(response.message);
}

document.addEventListener('DOMContentLoaded', () => {
    let dark = localStorage.getItem('ums-dark') === 'true';
    const applyTheme = () => {
        document.body.classList.toggle('dark', dark);
        document.getElementById('theme-icon').textContent = dark ? 'light_mode' : 'dark_mode';
    };
    applyTheme();
    document.getElementById('theme-btn').onclick = () => {
        dark = !dark;
        localStorage.setItem('ums-dark', dark);
        applyTheme();
    };

    const savedId = UMS.getRememberedId();
    if (savedId) {
        document.getElementById('uid').value = savedId;
        document.getElementById('remember').checked = true;
    }

    if (UMS.getStoredToken()) {
        UMS.api('/api/auth/me').then(() => {
            window.location.href = 'index.html';
        }).catch(() => {
            UMS.clearAuth(false);
        });
    }
});
