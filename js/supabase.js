// ============================================================
// DevWar — Supabase Client
// ============================================================

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Auth helpers ──────────────────────────────────────────────

async function getUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}

async function getSession() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session;
}

async function requireAuth() {
    const user = await getUser();
    if (!user) {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

// ── Profile helpers ──────────────────────────────────────────

async function getProfile(userId) {
    let { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

    // If profile is missing (e.g. signed up before trigger was active), create it
    if (error && error.code === 'PGRST116') {
        console.log('Profile missing, creating one now...');
        const user = await getUser();
        const username = user?.user_metadata?.username || 'user_' + userId.substring(0, 5);

        const { data: newData, error: insertError } = await supabaseClient
            .from('profiles')
            .insert({ id: userId, username })
            .select()
            .single();

        if (insertError) {
            console.error('Failed to create missing profile:', insertError);
            return null;
        }
        return newData;
    }

    if (error) console.error('getProfile error:', error);
    return data;
}

async function updateProfile(userId, updates) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    if (error) console.error('updateProfile error:', error);
    return data;
}

// ── XP & Level calculation ───────────────────────────────────

async function recalculateStats(userId) {
    // Get all logs
    const { data: logs } = await supabaseClient
        .from('daily_logs')
        .select('hours, log_date')
        .eq('user_id', userId)
        .order('log_date', { ascending: true });

    // Get completed tasks count
    const { count: taskCount } = await supabaseClient
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', true);

    // Get projects count
    const { count: projectCount } = await supabaseClient
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

    const totalHours = (logs || []).reduce((sum, l) => sum + Number(l.hours), 0);
    const totalXP = Math.round(totalHours * 10) + (taskCount || 0) * 5 + (projectCount || 0) * 50;
    const level = Math.floor(Math.sqrt(totalXP / 100));

    // Calculate streak
    let currentStreak = 0;
    if (logs && logs.length > 0) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sortedDates = logs
            .filter(l => Number(l.hours) > 0)
            .map(l => {
                const d = new Date(l.log_date + 'T00:00:00');
                d.setHours(0, 0, 0, 0);
                return d.getTime();
            })
            .sort((a, b) => b - a); // newest first

        if (sortedDates.length > 0) {
            const oneDay = 86400000;
            // Check if today or yesterday has a log
            const latest = sortedDates[0];
            const diff = Math.floor((today.getTime() - latest) / oneDay);
            if (diff <= 1) {
                currentStreak = 1;
                for (let i = 1; i < sortedDates.length; i++) {
                    const gap = Math.floor((sortedDates[i - 1] - sortedDates[i]) / oneDay);
                    if (gap === 1) {
                        currentStreak++;
                    } else {
                        break;
                    }
                }
            }
        }
    }

    // Calculate longest streak
    let longestStreak = currentStreak;
    if (logs && logs.length > 0) {
        const sortedAsc = logs
            .filter(l => Number(l.hours) > 0)
            .map(l => new Date(l.log_date + 'T00:00:00').getTime())
            .sort((a, b) => a - b);
        let tempStreak = 1;
        const oneDay = 86400000;
        for (let i = 1; i < sortedAsc.length; i++) {
            const gap = Math.floor((sortedAsc[i] - sortedAsc[i - 1]) / oneDay);
            if (gap === 1) {
                tempStreak++;
                longestStreak = Math.max(longestStreak, tempStreak);
            } else if (gap > 1) {
                tempStreak = 1;
            }
        }
    }

    await updateProfile(userId, {
        total_xp: totalXP,
        level: level,
        current_streak: currentStreak,
        longest_streak: longestStreak
    });

    return { totalXP, level, currentStreak, longestStreak, totalHours };
}

// ── Toast notifications ──────────────────────────────────────

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
