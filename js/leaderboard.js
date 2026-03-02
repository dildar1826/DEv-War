// ============================================================
// DevWar — Leaderboard Logic
// ============================================================

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = await requireAuth();
  if (!currentUser) return;

  await loadLeaderboard();
  await loadPendingWars();
});

// ── Leaderboard ──────────────────────────────────────────────

async function loadLeaderboard() {
  const { data: profiles, error } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('total_xp', { ascending: false });

  const tbody = document.getElementById('leaderboardBody');

  if (error || !profiles || profiles.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="6">
        <div class="empty-state">
          <div class="empty-state-icon">👥</div>
          <p>No developers yet. Be the first!</p>
        </div>
      </td></tr>`;
    return;
  }

  tbody.innerHTML = profiles.map((p, i) => {
    const rank = i + 1;
    const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const rankLabel = rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`;
    const initial = (p.username || '?')[0].toUpperCase();
    const isSelf = p.id === currentUser.id;

    return `
      <tr style="animation: slideUp 0.3s ease ${i * 0.05}s both">
        <td><span class="rank ${rankClass}">${rankLabel}</span></td>
        <td>
          <div class="lb-user">
            <div class="lb-avatar">${initial}</div>
            <span class="lb-username">${escapeHtml(p.username)}${isSelf ? ' <span class="text-muted" style="font-size:0.75rem">(you)</span>' : ''}</span>
          </div>
        </td>
        <td><span class="lb-xp">${formatNumber(p.total_xp)} XP</span></td>
        <td><span class="lb-level">Lv. ${p.level}</span></td>
        <td><span class="lb-streak">🔥 ${p.current_streak}d</span></td>
        <td>
          ${!isSelf ? `<button class="btn btn-primary btn-sm" onclick="challengeUser('${p.id}', '${escapeHtml(p.username)}')">⚔️ War</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

// ── War Challenges ───────────────────────────────────────────

async function challengeUser(opponentId, opponentName) {
  // Check for existing active/pending war between these two
  const { data: existing } = await supabaseClient
    .from('wars')
    .select('*')
    .or(`and(challenger_id.eq.${currentUser.id},opponent_id.eq.${opponentId}),and(challenger_id.eq.${opponentId},opponent_id.eq.${currentUser.id})`)
    .in('status', ['pending', 'active']);

  if (existing && existing.length > 0) {
    showToast('You already have an active war with this user!', 'error');
    return;
  }

  const { error } = await supabaseClient
    .from('wars')
    .insert({
      challenger_id: currentUser.id,
      opponent_id: opponentId,
      status: 'pending'
    });

  if (error) {
    showToast('Failed to send challenge: ' + error.message, 'error');
    return;
  }

  showToast(`⚔️ Challenge sent to ${opponentName}!`);
}

// ── Pending Wars ─────────────────────────────────────────────

async function loadPendingWars() {
  const { data: wars } = await supabaseClient
    .from('wars')
    .select('*')
    .eq('opponent_id', currentUser.id)
    .eq('status', 'pending');

  const bar = document.getElementById('pendingWarsBar');
  const list = document.getElementById('pendingWarsList');

  if (!wars || wars.length === 0) {
    bar.classList.add('hidden');
    return;
  }

  // Get challenger profiles
  const challengerIds = wars.map(w => w.challenger_id);
  const { data: challengers } = await supabaseClient
    .from('profiles')
    .select('id, username')
    .in('id', challengerIds);

  const nameMap = {};
  (challengers || []).forEach(c => { nameMap[c.id] = c.username; });

  bar.classList.remove('hidden');
  list.innerHTML = wars.map(w => `
    <div class="war-notification">
      <span class="war-notification-text">
        ⚔️ <strong>${escapeHtml(nameMap[w.challenger_id] || 'Unknown')}</strong> challenged you!
      </span>
      <div class="war-notification-actions">
        <button class="btn btn-primary btn-sm" onclick="acceptWar('${w.id}')">Accept</button>
        <button class="btn btn-danger btn-sm" onclick="declineWar('${w.id}')">Decline</button>
      </div>
    </div>
  `).join('');
}

async function acceptWar(warId) {
  const { error } = await supabaseClient
    .from('wars')
    .update({ status: 'active' })
    .eq('id', warId);

  if (error) {
    showToast('Failed to accept war', 'error');
    return;
  }

  showToast('⚔️ War accepted! Let the battle begin!');
  window.location.href = `war.html?id=${warId}`;
}

async function declineWar(warId) {
  const { error } = await supabaseClient
    .from('wars')
    .update({ status: 'declined' })
    .eq('id', warId);

  if (error) {
    showToast('Failed to decline war', 'error');
    return;
  }

  showToast('War declined');
  await loadPendingWars();
}

// ── Helpers ──────────────────────────────────────────────────

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return Math.round(n * 10) / 10;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
