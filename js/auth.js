// ============================================================
// DevWar — Authentication
// ============================================================

// ── Tab switching ────────────────────────────────────────────

function switchTab(tab) {
    document.getElementById('loginTab').classList.toggle('active', tab === 'login');
    document.getElementById('signupTab').classList.toggle('active', tab === 'signup');
    document.getElementById('loginForm').classList.toggle('active', tab === 'login');
    document.getElementById('signupForm').classList.toggle('active', tab === 'signup');
    hideError();
}

// ── Error display ────────────────────────────────────────────

function showError(msg) {
    const el = document.getElementById('authError');
    el.textContent = msg;
    el.classList.add('show');
}

function hideError() {
    document.getElementById('authError').classList.remove('show');
}

// ── Login ────────────────────────────────────────────────────

async function handleLogin(e) {
    e.preventDefault();
    hideError();
    console.log('Login attempt started...');

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Logging in…';

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        console.log('Calling supabaseClient.auth.signInWithPassword...');
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        console.log('Response received:', { data, error });

        if (error) {
            showError(error.message);
            btn.disabled = false;
            btn.textContent = 'Log In';
            return;
        }

        console.log('Login successful, redirecting...');
        window.location.href = 'dashboard.html';
    } catch (err) {
        console.error('Login exception:', err);
        showError('An unexpected error occurred. Check console.');
        btn.disabled = false;
        btn.textContent = 'Log In';
    }
}

// ── Signup ───────────────────────────────────────────────────

async function handleSignup(e) {
    e.preventDefault();
    hideError();
    console.log('Signup attempt started...');

    const btn = document.getElementById('signupBtn');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    const username = document.getElementById('signupUsername').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    if (username.length < 3) {
        showError('Username must be at least 3 characters.');
        btn.disabled = false;
        btn.textContent = 'Create Account';
        return;
    }

    try {
        console.log('Calling supabaseClient.auth.signUp...');
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { username }
            }
        });
        console.log('Response received:', { data, error });

        if (error) {
            showError(error.message);
            btn.disabled = false;
            btn.textContent = 'Create Account';
            return;
        }

        console.log('Signup successful, redirecting...');
        window.location.href = 'dashboard.html';
    } catch (err) {
        console.error('Signup exception:', err);
        showError('An unexpected error occurred. Check console.');
        btn.disabled = false;
        btn.textContent = 'Create Account';
    }
}

// ── Auto-redirect if already logged in ───────────────────────

(async function checkAuth() {
    const session = await getSession();
    if (session) {
        window.location.href = 'dashboard.html';
    }
})();
