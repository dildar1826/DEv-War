// ============================================================
// DevWar — Dashboard Logic
// ============================================================

let currentUser = null;
let currentProfile = null;

// ── Initialize ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = await requireAuth();
    if (!currentUser) return;

    // Set today's date display
    const today = new Date();
    document.getElementById('todayDate').textContent = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    });

    await loadDashboard();

    // Allow Enter key for task input
    document.getElementById('taskInput').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTask();
        }
    });
});

async function loadDashboard() {
    try {
        // Fetch/Create profile first
        currentProfile = await getProfile(currentUser.id);

        // Recalculate stats
        const stats = await recalculateStats(currentUser.id);

        // Update welcome text
        document.getElementById('welcomeText').textContent =
            `Welcome back, ${currentProfile?.username || 'Developer'}`;

        // Update stat cards
        document.getElementById('statXP').textContent = formatNumber(stats.totalXP);
        document.getElementById('statLevel').textContent = stats.level;
        document.getElementById('statStreak').textContent = `${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`;
        document.getElementById('statHours').textContent = formatNumber(stats.totalHours);

        // Update XP bar
        updateXPBar(stats.totalXP, stats.level);

        // Load sections
        await Promise.all([
            loadTodayLog(),
            loadChart(),
            loadTasks(),
            loadProjects()
        ]);
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

// ── XP Bar ───────────────────────────────────────────────────

function updateXPBar(totalXP, level) {
    const currentLevelXP = level * level * 100;
    const nextLevelXP = (level + 1) * (level + 1) * 100;
    const progress = nextLevelXP > currentLevelXP
        ? ((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
        : 0;

    document.getElementById('xpCurrent').textContent = `Level ${level}`;
    document.getElementById('xpNext').textContent = `Next: Level ${level + 1} (${formatNumber(nextLevelXP)} XP)`;
    document.getElementById('xpBarFill').style.width = `${Math.min(100, Math.max(0, progress))}%`;
}

// ── Log Hours ────────────────────────────────────────────────

async function loadTodayLog() {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabaseClient
        .from('daily_logs')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('log_date', today)
        .single();

    if (data) {
        document.getElementById('logHours').value = data.hours;
        document.getElementById('logNotes').value = data.notes || '';
        document.getElementById('todayLogStatus').textContent =
            `✅ ${data.hours}h logged today${data.notes ? ' — ' + data.notes : ''}`;
        document.getElementById('todayLogStatus').style.color = 'var(--success)';
    }
}

async function handleLogHours(e) {
    e.preventDefault();
    const btn = document.getElementById('logBtn');
    btn.disabled = true;
    btn.textContent = '…';

    const hours = parseFloat(document.getElementById('logHours').value) || 0;
    const notes = document.getElementById('logNotes').value.trim();
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabaseClient
        .from('daily_logs')
        .upsert({
            user_id: currentUser.id,
            log_date: today,
            hours,
            notes
        }, { onConflict: 'user_id,log_date' });

    btn.disabled = false;
    btn.textContent = 'Log';

    if (error) {
        showToast('Failed to log hours: ' + error.message, 'error');
        return;
    }

    showToast(`Logged ${hours}h — keep grinding! 💪`);
    await loadDashboard();
}

// ── Chart ────────────────────────────────────────────────────

let activityChart = null;

async function loadChart() {
    const today = new Date();
    const dates = [];
    const labels = [];

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
        labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
    }

    const { data: logs } = await supabaseClient
        .from('daily_logs')
        .select('log_date, hours')
        .eq('user_id', currentUser.id)
        .in('log_date', dates);

    const hoursMap = {};
    (logs || []).forEach(l => { hoursMap[l.log_date] = Number(l.hours); });
    const hours = dates.map(d => hoursMap[d] || 0);

    const ctx = document.getElementById('activityChart').getContext('2d');

    if (activityChart) activityChart.destroy();

    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Hours',
                data: hours,
                backgroundColor: hours.map(h => h > 0 ? 'rgba(0, 212, 255, 0.6)' : 'rgba(255,255,255,0.05)'),
                borderColor: hours.map(h => h > 0 ? 'rgba(0, 212, 255, 1)' : 'rgba(255,255,255,0.1)'),
                borderWidth: 1,
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1a1a2e',
                    borderColor: 'rgba(0,212,255,0.3)',
                    borderWidth: 1,
                    titleColor: '#e8e8f0',
                    bodyColor: '#a0a0b0',
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#555570', font: { size: 11 } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#555570', font: { size: 11 } }
                }
            }
        }
    });
}

// ── Tasks ────────────────────────────────────────────────────

async function loadTasks() {
    const today = new Date().toISOString().split('T')[0];
    const { data: tasks } = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('task_date', today)
        .order('created_at', { ascending: true });

    const list = document.getElementById('taskList');
    const completed = (tasks || []).filter(t => t.completed).length;
    document.getElementById('taskCount').textContent = `${completed} / ${(tasks || []).length}`;

    if (!tasks || tasks.length === 0) {
        list.innerHTML = `<div class="empty-state"><p class="text-muted">No tasks yet. Add one above!</p></div>`;
        return;
    }

    list.innerHTML = tasks.map(t => `
    <div class="task-item">
      <div class="task-checkbox ${t.completed ? 'checked' : ''}"
           onclick="toggleTask('${t.id}', ${!t.completed})">
        ${t.completed ? '✓' : ''}
      </div>
      <span class="task-text ${t.completed ? 'completed' : ''}">${escapeHtml(t.title)}</span>
      <button class="task-delete" onclick="deleteTask('${t.id}')">✕</button>
    </div>
  `).join('');
}

async function handleAddTask() {
    const input = document.getElementById('taskInput');
    const title = input.value.trim();
    if (!title) return;

    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabaseClient
        .from('tasks')
        .insert({ user_id: currentUser.id, title, task_date: today });

    if (error) {
        showToast('Failed to add task', 'error');
        return;
    }

    input.value = '';
    await loadTasks();
    // Recalc stats in case task count affects XP
    const stats = await recalculateStats(currentUser.id);
    updateXPBar(stats.totalXP, stats.level);
    document.getElementById('statXP').textContent = formatNumber(stats.totalXP);
}

async function toggleTask(id, completed) {
    await supabaseClient.from('tasks').update({ completed }).eq('id', id);
    await loadTasks();
    const stats = await recalculateStats(currentUser.id);
    document.getElementById('statXP').textContent = formatNumber(stats.totalXP);
    updateXPBar(stats.totalXP, stats.level);
}

async function deleteTask(id) {
    await supabaseClient.from('tasks').delete().eq('id', id);
    await loadTasks();
    const stats = await recalculateStats(currentUser.id);
    document.getElementById('statXP').textContent = formatNumber(stats.totalXP);
    updateXPBar(stats.totalXP, stats.level);
}

// ── Projects ─────────────────────────────────────────────────

async function loadProjects() {
    const { data: projects } = await supabaseClient
        .from('projects')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    const grid = document.getElementById('projectsGrid');

    if (!projects || projects.length === 0) {
        grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚀</div><p>No projects yet. Add your first one!</p></div>`;
        return;
    }

    grid.innerHTML = projects.map(p => `
    <div class="project-card">
      <div class="project-name">${escapeHtml(p.name)}</div>
      ${p.description ? `<div class="project-desc">${escapeHtml(p.description)}</div>` : ''}
      ${p.tech_stack ? `
        <div class="project-tech">
          ${p.tech_stack.split(',').map(t => `<span class="tech-tag">${escapeHtml(t.trim())}</span>`).join('')}
        </div>
      ` : ''}
      <div class="project-actions">
        ${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" class="btn btn-secondary btn-sm">View →</a>` : ''}
        <button class="btn btn-danger btn-sm" onclick="deleteProject('${p.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function openProjectModal() {
    document.getElementById('projectModal').classList.add('show');
}

function closeProjectModal() {
    document.getElementById('projectModal').classList.remove('show');
    document.getElementById('projectForm').reset();
}

async function handleAddProject(e) {
    e.preventDefault();

    const name = document.getElementById('projName').value.trim();
    const description = document.getElementById('projDesc').value.trim();
    const tech_stack = document.getElementById('projTech').value.trim();
    const url = document.getElementById('projUrl').value.trim();

    const { error } = await supabaseClient
        .from('projects')
        .insert({ user_id: currentUser.id, name, description, tech_stack, url });

    if (error) {
        showToast('Failed to add project: ' + error.message, 'error');
        return;
    }

    closeProjectModal();
    showToast('Project added! +50 XP 🎉');
    await loadDashboard();
}

async function deleteProject(id) {
    await supabaseClient.from('projects').delete().eq('id', id);
    showToast('Project deleted');
    await loadDashboard();
}

// Close modal on backdrop click
document.getElementById('projectModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProjectModal();
});

// ── Helpers ──────────────────────────────────────────────────

function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return Math.round(n * 10) / 10;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
