/**
 * LifeSync Pomodoro Focus Timer Module (js/pomodoro.js)
 * -------------------------------------------------------------
 * Features:
 * - 25m Focus, 5m Short Break, 15m Long Break (auto after 4 focus sessions).
 * - High-precision timestamp-based countdown (resilient against backgrounded tabs).
 * - Web Audio API synthesized chimes on completion (zero external asset dependencies).
 * - Task association with Auto Plan My Day integration (selects top urgency task).
 * - Session persistence & XP rewards via /api/pomodoro/session.
 * - Daily focus statistics (minutes today, sessions completed).
 */

(function () {
    'use strict';

    let timerInterval = null;
    let targetEndTime = null;
    let pausedRemainingSeconds = null;

    const DEFAULT_SETTINGS = {
        focus_duration: 25,
        short_break: 5,
        long_break: 15,
        sessions_until_long_break: 4,
        auto_start_breaks: false,
        sound_enabled: true
    };

    const state = {
        mode: 'focus', // 'focus' | 'short_break' | 'long_break'
        status: 'stopped', // 'stopped' | 'running' | 'paused'
        durationSeconds: 25 * 60,
        remainingSeconds: 25 * 60,
        activeTaskId: null,
        sessionStartTime: null,
        cycleCount: 0, // 0 to 4
        todayFocusMinutes: 0,
        todaySessionsCount: 0,
        settings: { ...DEFAULT_SETTINGS }
    };

    /**
     * Synthesize clean bell chime via Web Audio API
     */
    function playChime() {
        if (!state.settings.sound_enabled) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;

            const ctx = new AudioCtx();
            const now = ctx.currentTime;

            // Tone 1: 528 Hz (Love frequency / clarity)
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(528, now);
            gain1.gain.setValueAtTime(0.3, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
            osc1.connect(gain1);
            gain1.connect(ctx.destination);
            osc1.start(now);
            osc1.stop(now + 1.2);

            // Tone 2: 659.25 Hz (E5) harmonic delayed by 250ms
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, now + 0.25);
            gain2.gain.setValueAtTime(0.25, now + 0.25);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
            osc2.start(now + 0.25);
            osc2.stop(now + 1.6);
        } catch (e) {
            // Audio context blocked or unsupported
        }
    }

    /**
     * Format seconds to MM:SS
     */
    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    /**
     * Set timer mode ('focus', 'short_break', 'long_break')
     */
    function setMode(newMode) {
        if (state.status === 'running') {
            pause();
        }

        state.mode = newMode;
        let mins = state.settings.focus_duration || 25;
        if (newMode === 'short_break') mins = state.settings.short_break || 5;
        if (newMode === 'long_break') mins = state.settings.long_break || 15;

        state.durationSeconds = mins * 60;
        state.remainingSeconds = mins * 60;
        state.status = 'stopped';
        targetEndTime = null;
        pausedRemainingSeconds = null;

        renderUI();
    }

    /**
     * Start or resume the timer
     */
    function start() {
        if (state.status === 'running') return;

        if (state.status === 'paused' && pausedRemainingSeconds !== null) {
            targetEndTime = Date.now() + pausedRemainingSeconds * 1000;
        } else {
            state.sessionStartTime = new Date().toISOString();
            targetEndTime = Date.now() + state.remainingSeconds * 1000;
        }

        state.status = 'running';

        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(tick, 200);

        renderUI();
    }

    /**
     * Pause the running timer
     */
    function pause() {
        if (state.status !== 'running') return;

        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        if (targetEndTime) {
            pausedRemainingSeconds = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
            state.remainingSeconds = pausedRemainingSeconds;
        }

        state.status = 'paused';
        renderUI();
    }

    /**
     * Reset the timer to current mode's full duration
     */
    function reset() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        targetEndTime = null;
        pausedRemainingSeconds = null;
        state.status = 'stopped';

        let mins = state.settings.focus_duration || 25;
        if (state.mode === 'short_break') mins = state.settings.short_break || 5;
        if (state.mode === 'long_break') mins = state.settings.long_break || 15;

        state.durationSeconds = mins * 60;
        state.remainingSeconds = mins * 60;

        renderUI();
    }

    /**
     * Skip current mode to next mode
     */
    function skip() {
        if (state.mode === 'focus') {
            state.cycleCount++;
            if (state.cycleCount >= (state.settings.sessions_until_long_break || 4)) {
                setMode('long_break');
            } else {
                setMode('short_break');
            }
        } else {
            setMode('focus');
        }
    }

    /**
     * High precision countdown tick using wall-clock time
     */
    function tick() {
        if (state.status !== 'running' || !targetEndTime) return;

        const now = Date.now();
        const diff = Math.max(0, Math.ceil((targetEndTime - now) / 1000));
        state.remainingSeconds = diff;

        if (diff <= 0) {
            completeSession();
        } else {
            renderTimeOnly();
        }
    }

    /**
     * Handle session completion
     */
    async function completeSession() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }

        playChime();

        const completedMode = state.mode;
        const durationMins = Math.round(state.durationSeconds / 60);

        if (completedMode === 'focus') {
            state.todayFocusMinutes += durationMins;
            state.todaySessionsCount += 1;
            state.cycleCount += 1;

            // Log session to backend if API is present
            if (window.LifeSyncAPI && window.LifeSyncAPI.recordPomodoroSession) {
                try {
                    await window.LifeSyncAPI.recordPomodoroSession({
                        taskId: state.activeTaskId || null,
                        mode: 'focus',
                        durationMinutes: durationMins,
                        startedAt: state.sessionStartTime,
                        completed: true
                    });
                } catch (e) {
                    console.warn('⚠️ Could not log pomodoro session to backend:', e.message);
                }
            }

            // Show alert or browser notification
            if (window.NotificationsModule && window.NotificationsModule.showBrowserNotification) {
                window.NotificationsModule.showBrowserNotification(
                    '🎉 Focus Session Completed!',
                    `Great job! You focused for ${durationMins} minutes. Take a relaxing break.`
                );
            }

            // Transition to break
            if (state.cycleCount >= (state.settings.sessions_until_long_break || 4)) {
                state.cycleCount = 0;
                setMode('long_break');
            } else {
                setMode('short_break');
            }
        } else {
            // Break completed -> Transition to focus
            if (window.NotificationsModule && window.NotificationsModule.showBrowserNotification) {
                window.NotificationsModule.showBrowserNotification(
                    '⚡ Break Ended',
                    'Ready to get back in the zone? Start your next focus sprint!'
                );
            }
            setMode('focus');
        }

        if (state.settings.auto_start_breaks) {
            start();
        }
    }

    /**
     * Associate active task
     */
    function selectTask(taskId) {
        state.activeTaskId = taskId ? parseInt(taskId, 10) : null;
        renderUI();
    }

    /**
     * Automatically pick highest-urgency pending task from Smart Task Organizer
     */
    function autoSelectTopUrgentTask() {
        let tasks = [];
        if (window.TasksModule) {
            tasks = window.TasksModule.getTasks().filter(t => t.status !== 'Completed');
        }

        if (tasks.length === 0) return null;

        if (window.SmartTaskOrganizer) {
            const sorted = window.SmartTaskOrganizer.sortTasks(tasks);
            if (sorted.length > 0) {
                state.activeTaskId = sorted[0].id;
                renderUI();
                return sorted[0];
            }
        }

        state.activeTaskId = tasks[0].id;
        renderUI();
        return tasks[0];
    }

    /**
     * Load daily stats from backend or local cache
     */
    async function loadStats() {
        if (window.LifeSyncAPI && window.LifeSyncAPI.getPomodoroStats) {
            try {
                const res = await window.LifeSyncAPI.getPomodoroStats();
                if (res && res.today) {
                    state.todayFocusMinutes = res.today.focusMinutes || 0;
                    state.todaySessionsCount = res.today.sessionsCount || 0;
                    renderUI();
                }
            } catch (e) {
                // Ignore fallback to local count
            }
        }
    }

    /**
     * Load settings from backend
     */
    async function loadSettings() {
        if (window.LifeSyncAPI && window.LifeSyncAPI.getPomodoroSettings) {
            try {
                const res = await window.LifeSyncAPI.getPomodoroSettings();
                if (res && res.settings) {
                    state.settings = { ...DEFAULT_SETTINGS, ...res.settings };
                    if (state.status === 'stopped') {
                        setMode(state.mode);
                    }
                }
            } catch (e) {
                // Ignore fallback
            }
        }
    }

    /**
     * Save settings to backend
     */
    async function saveSettings(newSettings) {
        state.settings = { ...state.settings, ...newSettings };
        if (window.LifeSyncAPI && window.LifeSyncAPI.updatePomodoroSettings) {
            try {
                await window.LifeSyncAPI.updatePomodoroSettings(state.settings);
            } catch (e) {
                console.warn('⚠️ Could not persist pomodoro settings:', e.message);
            }
        }
        if (state.status === 'stopped') {
            setMode(state.mode);
        }
    }

    /**
     * Fast update for timer countdown display
     */
    function renderTimeOnly() {
        const timeEl = document.getElementById('pomodoroTimeDisplay');
        if (timeEl) {
            timeEl.textContent = formatTime(state.remainingSeconds);
        }

        const barEl = document.getElementById('pomodoroProgressBar');
        if (barEl && state.durationSeconds > 0) {
            const pct = Math.max(0, Math.min(100, (1 - (state.remainingSeconds / state.durationSeconds)) * 100));
            barEl.style.width = `${pct}%`;
        }
    }

    /**
     * Full UI re-render
     */
    function renderUI() {
        renderTimeOnly();

        // Mode tabs
        const modeTabs = document.querySelectorAll('[data-pomodoro-mode]');
        modeTabs.forEach(tab => {
            const tabMode = tab.getAttribute('data-pomodoro-mode');
            if (tabMode === state.mode) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        // Toggle button label & icon
        const toggleBtn = document.getElementById('btnPomodoroToggle');
        if (toggleBtn) {
            if (state.status === 'running') {
                toggleBtn.innerHTML = '<span>⏸</span> Pause';
                toggleBtn.className = 'btn-pomo-action btn-pomo-pause';
            } else if (state.status === 'paused') {
                toggleBtn.innerHTML = '<span>▶</span> Resume';
                toggleBtn.className = 'btn-pomo-action btn-pomo-start';
            } else {
                toggleBtn.innerHTML = '<span>▶</span> Start Focus';
                toggleBtn.className = 'btn-pomo-action btn-pomo-start';
            }
        }

        // Today's stats badge
        const statsEl = document.getElementById('pomodoroTodayStats');
        if (statsEl) {
            statsEl.textContent = `${state.todayFocusMinutes}m Focus · ${state.todaySessionsCount} Sessions`;
        }

        // Cycle dots (e.g. 4 dots indicating progress to long break)
        const cycleDotsContainer = document.getElementById('pomodoroCycleDots');
        if (cycleDotsContainer) {
            const maxSessions = state.settings.sessions_until_long_break || 4;
            let dotsHtml = '';
            for (let i = 0; i < maxSessions; i++) {
                const filled = i < state.cycleCount;
                dotsHtml += `<span class="pomo-dot ${filled ? 'filled' : ''}" title="Session ${i + 1}/${maxSessions}"></span>`;
            }
            cycleDotsContainer.innerHTML = dotsHtml;
        }

        // Populate task dropdown
        populateTaskDropdown();
    }

    /**
     * Populate task select with student's active tasks
     */
    function populateTaskDropdown() {
        const selectEl = document.getElementById('pomodoroTaskSelect');
        if (!selectEl) return;

        let tasks = [];
        if (window.TasksModule) {
            tasks = window.TasksModule.getTasks().filter(t => t.status !== 'Completed');
        }

        const currentVal = state.activeTaskId;
        selectEl.innerHTML = `
            <option value="">-- No linked task (Free Focus) --</option>
            ${tasks.map(t => `
                <option value="${t.id}" ${t.id === currentVal ? 'selected' : ''}>
                    ${t.title} (${t.priority || 'Medium'})
                </option>
            `).join('')}
        `;
    }

    /**
     * Initialize Module
     */
    function init(user) {
        // Tab visibility change handler to prevent time drift
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && state.status === 'running') {
                    tick();
                }
            });
        }

        loadSettings();
        loadStats();
        renderUI();
    }

    const PomodoroModule = {
        init,
        start,
        pause,
        reset,
        skip,
        setMode,
        selectTask,
        autoSelectTopUrgentTask,
        loadStats,
        loadSettings,
        saveSettings,
        playChime,
        renderUI,
        getState: () => ({ ...state })
    };

    if (typeof window !== 'undefined') {
        window.PomodoroModule = PomodoroModule;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PomodoroModule;
    }
})();
