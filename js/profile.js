// ============================================================
// DevWar — Profile Logic
// ============================================================

let currentUser = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireAuth();
    if (!currentUser) return;

    await loadProfile();
});

// ── Load Profile ─────────────────────────────────────────────

async function loadProfile() {
    currentProfile = await getProfile(currentUser.id);
    if (!currentProfile) return;

    // Avatar
    const initial = (currentProfile.username || '?')[0].toUpperCase();
    document.getElementById('profileAvatar').textContent = initial;

    // Info
    document.getElementById('profileUsername').textContent = currentProfile.username;
    document.getElementById('profileJoined').textContent =
        `Member since ${new Date(currentProfile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;

    // Stats
    document.getElementById('pStatXP').textContent = formatNumber(currentProfile.total_xp);
    document.getElementById('pStatLevel').textContent = currentProfile.level;
    document.getElementById('pStatStreak').textContent = `${currentProfile.current_streak}d`;
    document.getElementById('pStatLongest').textContent = `${currentProfile.longest_streak}d`;

    // Edit form
    document.getElementById('editUsername').value = currentProfile.username;
    document.getElementById('editAvatar').value = currentProfile.avatar_url || '';

    // Account email
    document.getElementById('accountEmail').textContent = `Signed in as ${currentUser.email}`;

    // Load war record
    await loadWarRecord();
}

// ── Update Profile ───────────────────────────────────────────

async function handleUpdateProfile(e) {
    e.preventDefault();
    const btn = document.getElementById('saveProfileBtn');
    btn.disabled = true;
    btn.textContent = 'Saving…';

    const username = document.getElementById('editUsername').value.trim();
    const avatar_url = document.getElementById('editAvatar').value.trim();

    if (username.length < 3) {
        showToast('Username must be at least 3 characters', 'error');
        btn.disabled = false;
        btn.textContent = 'Save Changes';
        return;
    }

    const result = await updateProfile(currentUser.id, { username, avatar_url });

    btn.disabled = false;
    btn.textContent = 'Save Changes';

    if (result) {
        showToast('Profile updated! ✨');
        await loadProfile();
    } else {
        showToast('Failed to update profile. Username may be taken.', 'error');
    }
}

// ── War Record ───────────────────────────────────────────────

async function loadWarRecord() {
    // Wars won
    const { count: won } = await supabaseClient
        .from('wars')
        .select('*', { count: 'exact', head: true })
        .eq('winner_id', currentUser.id)
        .eq('status', 'completed');

    // Wars lost
    const { data: completedWars } = await supabaseClient
        .from('wars')
        .select('*')
        .eq('status', 'completed')
        .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`);

    const lost = (completedWars || []).filter(w => w.winner_id && w.winner_id !== currentUser.id).length;

    // Active wars
    const { count: active } = await supabaseClient
        .from('wars')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`);

    document.getElementById('warsWon').textContent = won || 0;
    document.getElementById('warsLost').textContent = lost;
    document.getElementById('warsActive').textContent = active || 0;
}

// ── Logout ───────────────────────────────────────────────────

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'index.html';
}

// ── Helpers ──────────────────────────────────────────────────

function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(n * 10) / 10;
}
