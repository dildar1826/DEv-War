// ============================================================
// DevWar — War Logic
// ============================================================

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireAuth();
    if (!currentUser) return;

    // Check if viewing a specific war
    const params = new URLSearchParams(window.location.search);
    const warId = params.get('id');

    if (warId) {
        await loadWarArena(warId);
    } else {
        await loadWarList();
    }
});

// ── War List ─────────────────────────────────────────────────

async function loadWarList() {
    document.getElementById('warArenaSection').classList.add('hidden');

    const { data: wars } = await supabaseClient
        .from('wars')
        .select('*')
        .or(`challenger_id.eq.${currentUser.id},opponent_id.eq.${currentUser.id}`)
        .in('status', ['active', 'pending', 'completed'])
        .order('created_at', { ascending: false });

    const container = document.getElementById('warList');

    if (!wars || wars.length === 0) {
        container.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-icon">⚔️</div>
          <p>No wars yet. Go to the <a href="leaderboard.html">Leaderboard</a> to challenge someone!</p>
        </div>
      </div>`;
        return;
    }

    // Gather all user IDs we need
    const userIds = new Set();
    wars.forEach(w => {
        userIds.add(w.challenger_id);
        userIds.add(w.opponent_id);
    });

    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, username, total_xp, level')
        .in('id', Array.from(userIds));

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    container.innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Your Wars</span>
      </div>
      ${wars.map(w => {
        const opponentId = w.challenger_id === currentUser.id ? w.opponent_id : w.challenger_id;
        const opponent = profileMap[opponentId] || { username: 'Unknown' };
        const isPending = w.status === 'pending';
        const isActive = w.status === 'active';
        const isCompleted = w.status === 'completed';
        const isChallenger = w.challenger_id === currentUser.id;

        let statusBadge = '';
        if (isPending && !isChallenger) {
            statusBadge = '<span style="color:var(--warning);font-size:0.8rem;font-weight:600">⏳ PENDING YOUR RESPONSE</span>';
        } else if (isPending && isChallenger) {
            statusBadge = '<span style="color:var(--text-muted);font-size:0.8rem;font-weight:600">⏳ AWAITING RESPONSE</span>';
        } else if (isActive) {
            statusBadge = '<span style="color:var(--success);font-size:0.8rem;font-weight:600">🟢 ACTIVE</span>';
        } else if (isCompleted) {
            const won = w.winner_id === currentUser.id;
            statusBadge = won
                ? '<span style="color:var(--success);font-size:0.8rem;font-weight:600">🏆 YOU WON</span>'
                : '<span style="color:var(--danger);font-size:0.8rem;font-weight:600">💀 DEFEATED</span>';
        }

        return `
          <div class="war-notification">
            <div>
              <span class="war-notification-text">
                ⚔️ ${isChallenger ? 'You' : '<strong>' + escapeHtml(profileMap[w.challenger_id]?.username || '?') + '</strong>'} 
                vs 
                ${!isChallenger ? 'You' : '<strong>' + escapeHtml(opponent.username) + '</strong>'}
              </span>
              <div class="mt-1">${statusBadge}</div>
            </div>
            <div class="war-notification-actions">
              ${isPending && !isChallenger ? `
                <button class="btn btn-primary btn-sm" onclick="acceptWar('${w.id}')">Accept</button>
                <button class="btn btn-danger btn-sm" onclick="declineWar('${w.id}')">Decline</button>
              ` : ''}
              ${isActive ? `
                <button class="btn btn-primary btn-sm" onclick="viewWar('${w.id}')">View Battle</button>
                <button class="btn btn-danger btn-sm" onclick="endWar('${w.id}')">End War</button>
              ` : ''}
              ${isCompleted ? `
                <button class="btn btn-secondary btn-sm" onclick="viewWar('${w.id}')">View Result</button>
              ` : ''}
            </div>
          </div>
        `;
    }).join('')}
    </div>
  `;
}

// ── War Arena ────────────────────────────────────────────────

async function loadWarArena(warId) {
    document.getElementById('warList').classList.add('hidden');
    document.getElementById('warArenaSection').classList.remove('hidden');

    const { data: war, error } = await supabaseClient
        .from('wars')
        .select('*')
        .eq('id', warId)
        .single();

    if (error || !war) {
        showToast('War not found', 'error');
        window.location.href = 'war.html';
        return;
    }

    // Load both profiles
    const [profile1, profile2] = await Promise.all([
        getProfile(war.challenger_id),
        getProfile(war.opponent_id)
    ]);

    // Load hours for both
    const [hours1, hours2, projects1Count, projects2Count] = await Promise.all([
        getTotalHours(war.challenger_id),
        getTotalHours(war.opponent_id),
        getProjectCount(war.challenger_id),
        getProjectCount(war.opponent_id)
    ]);

    // Populate Player 1
    document.getElementById('player1Avatar').textContent = (profile1?.username || '?')[0].toUpperCase();
    document.getElementById('player1Name').textContent = profile1?.username || 'Unknown';
    document.getElementById('player1XP').textContent = formatNumber(profile1?.total_xp || 0);
    document.getElementById('player1Level').textContent = profile1?.level || 0;
    document.getElementById('player1Hours').textContent = formatNumber(hours1);
    document.getElementById('player1Streak').textContent = `${profile1?.current_streak || 0}d`;
    document.getElementById('player1Projects').textContent = projects1Count;

    // Populate Player 2
    document.getElementById('player2Avatar').textContent = (profile2?.username || '?')[0].toUpperCase();
    document.getElementById('player2Name').textContent = profile2?.username || 'Unknown';
    document.getElementById('player2XP').textContent = formatNumber(profile2?.total_xp || 0);
    document.getElementById('player2Level').textContent = profile2?.level || 0;
    document.getElementById('player2Hours').textContent = formatNumber(hours2);
    document.getElementById('player2Streak').textContent = `${profile2?.current_streak || 0}d`;
    document.getElementById('player2Projects').textContent = projects2Count;

    // Highlight leading player
    const xp1 = profile1?.total_xp || 0;
    const xp2 = profile2?.total_xp || 0;

    document.getElementById('player1Card').classList.toggle('leading', xp1 > xp2);
    document.getElementById('player2Card').classList.toggle('leading', xp2 > xp1);

    // Update subtitle
    document.getElementById('warSubtitle').textContent =
        war.status === 'completed' ? 'Battle completed' :
            war.status === 'active' ? 'Live battle in progress' : 'Waiting for response';

    // War actions
    const actions = document.getElementById('warActions');
    if (war.status === 'active') {
        actions.innerHTML = `
      <button class="btn btn-secondary" onclick="window.location.href='war.html'">← All Wars</button>
      <button class="btn btn-danger" onclick="endWar('${war.id}')" style="margin-left:0.5rem">End War & Declare Winner</button>
    `;
    } else if (war.status === 'completed') {
        const winnerName = war.winner_id === profile1?.id ? profile1.username : profile2.username;
        actions.innerHTML = `
      <p style="font-size:1.2rem;margin-bottom:1rem">🏆 <strong class="text-accent">${escapeHtml(winnerName)}</strong> won this war!</p>
      <button class="btn btn-secondary" onclick="window.location.href='war.html'">← All Wars</button>
    `;
    } else {
        actions.innerHTML = `
      <button class="btn btn-secondary" onclick="window.location.href='war.html'">← All Wars</button>
    `;
    }
}

// ── War Actions ──────────────────────────────────────────────

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
    viewWar(warId);
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
    await loadWarList();
}

async function endWar(warId) {
    // Get war data to determine winner
    const { data: war } = await supabaseClient
        .from('wars')
        .select('*')
        .eq('id', warId)
        .single();

    if (!war) return;

    const [profile1, profile2] = await Promise.all([
        getProfile(war.challenger_id),
        getProfile(war.opponent_id)
    ]);

    const xp1 = profile1?.total_xp || 0;
    const xp2 = profile2?.total_xp || 0;
    const winnerId = xp1 >= xp2 ? war.challenger_id : war.opponent_id;

    const { error } = await supabaseClient
        .from('wars')
        .update({
            status: 'completed',
            winner_id: winnerId,
            ended_at: new Date().toISOString()
        })
        .eq('id', warId);

    if (error) {
        showToast('Failed to end war', 'error');
        return;
    }

    const winnerName = winnerId === currentUser.id ? 'You' : (xp1 >= xp2 ? profile1.username : profile2.username);
    showToast(`🏆 War ended! ${winnerName} won!`);
    await loadWarArena(warId);
}

function viewWar(warId) {
    window.location.href = `war.html?id=${warId}`;
}

// ── Helpers ──────────────────────────────────────────────────

async function getTotalHours(userId) {
    const { data } = await supabaseClient
        .from('daily_logs')
        .select('hours')
        .eq('user_id', userId);
    return (data || []).reduce((sum, l) => sum + Number(l.hours), 0);
}

async function getProjectCount(userId) {
    const { count } = await supabaseClient
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
    return count || 0;
}

function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(n * 10) / 10;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}
