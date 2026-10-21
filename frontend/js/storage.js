/**
 * LifeSync - Unified Storage & Data Layer (js/storage.js)
 * -------------------------------------------------------------
 * Manages user-scoped persistence for all LifeSync modules:
 * - Tasks (To-Do list)
 * - Calendar Events (Exams, Classes, Assignments, Events)
 * - Budget (Transactions, Runway, Night Safe, Bills)
 * - Mental Wellness (Daily Check-ins, Mood, Stress, Energy)
 * - Student Profile & Preferences
 *
 * Prepared with clean abstractions ready for future backend/Supabase connection.
 */

(function () {
    'use strict';

    // Helper: Scoped storage key builder
    function getScopedKey(domain, user) {
        const userId = (user && user.id) ? user.id : 'guest';
        return `lifesync_${domain}_${userId}`;
    }

    function readJson(key, defaultVal) {
        try {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === undefined) return defaultVal;
            return JSON.parse(raw);
        } catch (e) {
            console.error(`Storage read error for ${key}:`, e);
            return defaultVal;
        }
    }

    function writeJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error(`Storage write error for ${key}:`, e);
            return false;
        }
    }

    // ==========================================
    // SEED / DEMO DATA (For initial user onboarding)
    // ==========================================
    function getTodayString(offsetDays = 0) {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function getDefaultTasks() {
        return [
            {
                id: 'tsk_1',
                title: 'DBMS Assignment',
                description: 'Implement SQL queries, normalization, and relational schema for student portal.',
                dueDate: getTodayString(1),
                priority: 'High',
                category: 'Assignment',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                completedAt: null
            },
            {
                id: 'tsk_2',
                title: 'Maths Problem Set',
                description: 'Complete discrete mathematics exercise 4 on graph theory and recurrence relations.',
                dueDate: getTodayString(2),
                priority: 'Medium',
                category: 'Study',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                completedAt: null
            },
            {
                id: 'tsk_3',
                title: 'CN Lab Report',
                description: 'Submit packet tracer simulation report and Wireshark capture analysis.',
                dueDate: getTodayString(3),
                priority: 'Medium',
                category: 'Project',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                completedAt: null
            },
            {
                id: 'tsk_4',
                title: 'Read Chapter 5',
                description: 'Read Operating Systems textbook chapter on CPU scheduling algorithms.',
                dueDate: getTodayString(5),
                priority: 'Low',
                category: 'Study',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                completedAt: null
            },
            {
                id: 'tsk_5',
                title: 'Prepare Presentation Slides for Capstone',
                description: 'Draft system architecture diagram and feature timeline.',
                dueDate: getTodayString(6),
                priority: 'Medium',
                category: 'Project',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                completedAt: null
            },
            {
                id: 'tsk_6',
                title: 'Review Machine Learning Basics',
                description: 'Linear regression math review and python notebook practice.',
                dueDate: getTodayString(7),
                priority: 'Low',
                category: 'Study',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                completedAt: null
            },
            {
                id: 'tsk_7',
                title: 'Register for Inter-College Hackathon',
                description: 'Confirm team members and submit initial proposal.',
                dueDate: getTodayString(8),
                priority: 'Low',
                category: 'Personal',
                status: 'Pending',
                createdAt: new Date().toISOString(),
                completedAt: null
            },
            // Completed tasks (12 completed for achievement tracking)
            ...Array.from({ length: 12 }).map((_, i) => ({
                id: `tsk_done_${i + 1}`,
                title: `Completed Coursework Milestone ${i + 1}`,
                description: 'Successfully verified and completed ahead of time.',
                dueDate: getTodayString(-i - 1),
                priority: i % 3 === 0 ? 'High' : i % 2 === 0 ? 'Medium' : 'Low',
                category: 'Assignment',
                status: 'Completed',
                createdAt: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
                completedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString()
            }))
        ];
    }

    function getDefaultEvents() {
        return [
            {
                id: 'evt_1',
                title: 'DBMS Lecture',
                date: getTodayString(0),
                time: '09:00 AM',
                category: 'Study',
                priority: 'High',
                location: 'Room 2.04',
                description: 'Entity Relationship modeling and B+ Tree indexing.',
                hasReminder: true
            },
            {
                id: 'evt_2',
                title: 'Computer Networks',
                date: getTodayString(0),
                time: '11:00 AM',
                category: 'Study',
                priority: 'Medium',
                location: 'Room 1.05',
                description: 'TCP/IP protocol stack and window flow control.',
                hasReminder: true
            },
            {
                id: 'evt_3',
                title: 'Library Session',
                date: getTodayString(0),
                time: '01:00 PM',
                category: 'Study',
                priority: 'Medium',
                location: 'Central Library',
                description: 'Quiet study sprint for midterms.',
                hasReminder: false
            },
            {
                id: 'evt_4',
                title: 'Study Group',
                date: getTodayString(0),
                time: '04:00 PM',
                category: 'Study',
                priority: 'Low',
                location: 'Online',
                description: 'Group problem solving on Google Meet.',
                hasReminder: false
            },
            {
                id: 'evt_5',
                title: 'Software Engineering Midterm Exam',
                date: getTodayString(2),
                time: '10:00 AM',
                category: 'Exam',
                priority: 'High',
                location: 'Hall A',
                description: 'Agile development, design patterns and testing methodologies.',
                hasReminder: true
            }
        ];
    }

    function getDefaultBudget() {
        return {
            monthlyBudget: 15000,
            runway: {
                sum: 20000,
                bufferPct: 15
            },
            nightSafe: {
                limit: 500,
                spent: 120,
                locked: false,
                lastResetDate: getTodayString(0)
            },
            sharedGoal: {
                title: 'Textbooks & Tech Fund',
                current: 4500,
                target: 8000,
                etaWeeks: 4
            },
            transactions: [
                {
                    id: 'tx_1',
                    title: 'Academic Scholarship Credit',
                    amount: 8000,
                    type: 'income',
                    category: 'Scholarship',
                    date: getTodayString(-5),
                    description: 'Semester merit scholarship credit'
                },
                {
                    id: 'tx_2',
                    title: 'Semester Textbooks & Stationery',
                    amount: 2000,
                    type: 'expense',
                    category: 'Education',
                    date: getTodayString(-3),
                    description: 'Textbooks and scientific calculator'
                },
                {
                    id: 'tx_3',
                    title: 'Campus Dining & Meal Plan',
                    amount: 1550,
                    type: 'expense',
                    category: 'Food',
                    date: getTodayString(-2),
                    description: 'Cafeteria food charges'
                },
                {
                    id: 'tx_4',
                    title: 'Metro Commute Pass',
                    amount: 1000,
                    type: 'expense',
                    category: 'Travel',
                    date: getTodayString(-1),
                    description: 'Monthly student metro pass'
                }
            ],
            bills: [
                { id: 'b1', title: 'Dorm Wi-Fi Fiber', amount: 900, split: 3, date: getTodayString(4), paid: false },
                { id: 'b2', title: 'Shared Electricity', amount: 1500, split: 3, date: getTodayString(8), paid: false },
                { id: 'b3', title: 'Streaming Study Music', amount: 199, split: 1, date: getTodayString(12), paid: true }
            ]
        };
    }

    function getDefaultWellness() {
        return {
            streak: 5,
            entries: [
                {
                    date: getTodayString(-4),
                    mood: 'happy',
                    emoji: '🙂',
                    name: 'Good',
                    score: 4,
                    stress: 2,
                    energy: 4,
                    description: 'Got enough sleep and finished problem set early.'
                },
                {
                    date: getTodayString(-3),
                    mood: 'excited',
                    emoji: '😃',
                    name: 'Great',
                    score: 5,
                    stress: 1,
                    energy: 5,
                    description: 'Aced the lab quiz and went for an evening walk.'
                },
                {
                    date: getTodayString(-2),
                    mood: 'neutral',
                    emoji: '😐',
                    name: 'Okay',
                    score: 3,
                    stress: 3,
                    energy: 3,
                    description: 'Long lecture day, felt a bit tired in the afternoon.'
                },
                {
                    date: getTodayString(-1),
                    mood: 'happy',
                    emoji: '🙂',
                    name: 'Good',
                    score: 4,
                    stress: 2,
                    energy: 4,
                    description: 'Balanced day studying with classmates.'
                },
                {
                    date: getTodayString(0),
                    mood: 'excited',
                    emoji: '😃',
                    name: 'Great',
                    score: 5,
                    stress: 1,
                    energy: 5,
                    description: 'Excited about starting the new semester dashboard!'
                }
            ]
        };
    }

    function getDefaultProfile(user) {
        return {
            name: user && user.username && user.username !== 'Student' ? user.username : 'Alex Morgan',
            email: user ? user.email : 'alex@lifesync.edu',
            university: 'National Institute of Technology',
            major: 'Computer Science & Engineering',
            yearSemester: '3rd Year / 5th Semester',
            studentId: 'STU-2026-8841',
            currency: '₹',
            notificationsEnabled: true,
        };
    }

    /**
     * Check if optional demo seeding is explicitly enabled (dev/test only, never default in production)
     */
    function shouldSeedDemo() {
        if (typeof window !== 'undefined') {
            if (window.__LIFESYNC_SEED_DEMO__ === true) return true;
            try {
                if (localStorage.getItem('lifesync_enable_demo_seed') === 'true') return true;
            } catch (e) {}
        }
        if (typeof process !== 'undefined' && process.env) {
            if (process.env.LIFESYNC_SEED_DEMO === 'true') return true;
            if (process.env.NODE_ENV === 'test') return true;
        }
        return false;
    }

    function getEmptyBudget() {
        return {
            monthlyBudget: 15000,
            runway: { sum: 0, bufferPct: 15 },
            nightSafe: { limit: 500, spent: 0, locked: false },
            sharedGoal: { title: 'Semester Savings', target: 5000, saved: 0 },
            transactions: [],
            bills: []
        };
    }

    function getEmptyWellness() {
        return {
            streak: 0,
            entries: []
        };
    }

    function getCleanProfile(user) {
        return {
            name: (user && (user.username || user.name)) || '',
            email: (user && user.email) || '',
            university: '',
            major: '',
            yearSemester: '',
            studentId: '',
            currency: '₹',
            xp: 0,
            budgetStreak: 0,
            notificationsEnabled: true,
            defaultView: 'dashboard'
        };
    }

    // ==========================================
    // PUBLIC LIFE SYNC STORAGE API
    // ==========================================
    // Helper: Async sync triggers to backend
    function syncTaskToBackend(task) {
        if (typeof window === 'undefined' || !window.LifeSyncAPI || typeof fetch === 'undefined') return;
        const token = window.LifeSyncAPI.getToken();
        if (!token) return;

        // If task has numeric ID (database task), update it; otherwise create it
        if (typeof task.id === 'number' || (typeof task.id === 'string' && !task.id.startsWith('tsk_'))) {
            window.LifeSyncAPI.updateTask(task.id, {
                title: task.title,
                category: task.category,
                deadline: task.dueDate || task.deadline,
                priority: task.priority,
                status: task.status,
                description: task.description
            }).catch(e => console.warn('Background task update sync:', e.message));
        } else {
            window.LifeSyncAPI.createTask({
                title: task.title,
                category: task.category,
                deadline: task.dueDate || task.deadline,
                priority: task.priority,
                status: task.status,
                description: task.description
            }).then(saved => {
                if (saved && saved.id) task.id = saved.id;
            }).catch(e => console.warn('Background task create sync:', e.message));
        }
    }

    function syncEventToBackend(event) {
        if (typeof window === 'undefined' || !window.LifeSyncAPI || typeof fetch === 'undefined') return;
        const token = window.LifeSyncAPI.getToken();
        if (!token) return;

        if (typeof event.id === 'number' || (typeof event.id === 'string' && !event.id.startsWith('evt_'))) {
            window.LifeSyncAPI.updateEvent(event.id, {
                title: event.title,
                description: event.description,
                date: event.date,
                time: event.time,
                event_type: event.category || event.event_type,
                reminder: event.hasReminder || event.reminder
            }).catch(e => console.warn('Background event update sync:', e.message));
        } else {
            window.LifeSyncAPI.createEvent({
                title: event.title,
                description: event.description,
                date: event.date,
                time: event.time,
                event_type: event.category || event.event_type,
                reminder: event.hasReminder || event.reminder
            }).then(saved => {
                if (saved && saved.id) event.id = saved.id;
            }).catch(e => console.warn('Background event create sync:', e.message));
        }
    }

    function deleteTaskFromBackend(taskId) {
        if (!taskId || typeof window === 'undefined' || !window.LifeSyncAPI || typeof fetch === 'undefined') return;
        const token = window.LifeSyncAPI.getToken();
        if (!token) return;

        // If numeric ID or non-tsk_ ID, delete on backend
        if (typeof taskId === 'number' || (typeof taskId === 'string' && !taskId.startsWith('tsk_'))) {
            window.LifeSyncAPI.deleteTask(taskId).catch(e => console.warn('Background task delete sync:', e.message));
        }
    }

    const pendingCancelledTxIds = new Set();

    function deleteTransactionFromBackend(txId) {
        if (!txId || typeof window === 'undefined' || !window.LifeSyncAPI || typeof fetch === 'undefined') return;
        const token = window.LifeSyncAPI.getToken();
        if (!token) return;

        if (typeof txId === 'string' && txId.startsWith('tx_')) {
            pendingCancelledTxIds.add(txId);
            return;
        }

        if (typeof txId === 'number' || (typeof txId === 'string' && !isNaN(Number(txId)))) {
            window.LifeSyncAPI.deleteTransaction(txId).catch(e => console.warn('Background tx delete sync:', e.message));
        }
    }

    function deleteEventFromBackend(eventId) {
        if (!eventId || typeof window === 'undefined' || !window.LifeSyncAPI || typeof fetch === 'undefined') return;
        const token = window.LifeSyncAPI.getToken();
        if (!token) return;

        if (typeof eventId === 'number' || (typeof eventId === 'string' && !eventId.startsWith('evt_'))) {
            if (window.LifeSyncAPI.deleteEvent) {
                window.LifeSyncAPI.deleteEvent(eventId).catch(e => console.warn('Background event delete sync:', e.message));
            }
        }
    }

    // ==========================================
    // PUBLIC LIFE SYNC STORAGE API
    // ==========================================
    const LifeSyncStorage = {
        // --- TASKS ---
        getTasks(user) {
            const key = getScopedKey('tasks', user);
            const stored = localStorage.getItem(key);
            if (!stored) {
                const initial = shouldSeedDemo() ? getDefaultTasks() : [];
                writeJson(key, initial);
                return initial;
            }
            return readJson(key, []);
        },
        saveTasks(user, tasks) {
            const key = getScopedKey('tasks', user);
            return writeJson(key, tasks);
        },
        saveTask(user, task) {
            if (!task) return;
            const key = getScopedKey('tasks', user);
            const tasks = readJson(key, []);
            const idx = tasks.findIndex(t => String(t.id) === String(task.id));
            if (idx >= 0) {
                tasks[idx] = task;
            } else {
                tasks.unshift(task);
            }
            writeJson(key, tasks);
            syncTaskToBackend(task);
        },
        deleteTask(user, taskId) {
            const key = getScopedKey('tasks', user);
            const tasks = readJson(key, []);
            const updated = tasks.filter(t => String(t.id) !== String(taskId));
            writeJson(key, updated);
            deleteTaskFromBackend(taskId);
        },

        // --- CALENDAR EVENTS ---
        getEvents(user) {
            const key = getScopedKey('events', user);
            const stored = localStorage.getItem(key);
            if (!stored) {
                const initial = shouldSeedDemo() ? getDefaultEvents() : [];
                writeJson(key, initial);
                return initial;
            }
            return readJson(key, []);
        },
        deleteEvent(user, eventId) {
            const key = getScopedKey('events', user);
            const events = this.getEvents(user);
            const updated = events.filter(e => String(e.id) !== String(eventId));
            writeJson(key, updated);
            deleteEventFromBackend(eventId);
            return updated;
        },
        saveEvents(user, events) {
            const key = getScopedKey('events', user);
            const saved = writeJson(key, events);
            if (Array.isArray(events) && events.length > 0) {
                syncEventToBackend(events[events.length - 1]);
            }
            return saved;
        },

        // --- BUDGET ---
        getBudget(user) {
            const key = getScopedKey('budget', user);
            const stored = localStorage.getItem(key);
            if (!stored) {
                const initial = shouldSeedDemo() ? getDefaultBudget() : getEmptyBudget();
                writeJson(key, initial);
                return initial;
            }
            const data = readJson(key, {});
            const defaults = shouldSeedDemo() ? getDefaultBudget() : getEmptyBudget();
            return {
                monthlyBudget: Number(data.monthlyBudget) || defaults.monthlyBudget,
                runway: { ...defaults.runway, ...(data.runway || {}) },
                nightSafe: { ...defaults.nightSafe, ...(data.nightSafe || {}) },
                sharedGoal: { ...defaults.sharedGoal, ...(data.sharedGoal || {}) },
                transactions: Array.isArray(data.transactions) ? data.transactions : defaults.transactions,
                bills: Array.isArray(data.bills) ? data.bills : defaults.bills
            };
        },
        deleteTransaction(user, txId) {
            const key = getScopedKey('budget', user);
            const budget = this.getBudget(user);
            budget.transactions = (budget.transactions || []).filter(t => String(t.id) !== String(txId));
            writeJson(key, budget);
            deleteTransactionFromBackend(txId);
            return budget;
        },
        saveBudget(user, budgetData) {
            const key = getScopedKey('budget', user);
            const saved = writeJson(key, budgetData);
            if (typeof window !== 'undefined' && window.LifeSyncAPI && window.LifeSyncAPI.getToken()) {
                // Background sync settings
                window.LifeSyncAPI.updateBudgetSettings({
                    monthlyBudget: budgetData.monthlyBudget,
                    runwaySum: budgetData.runway ? budgetData.runway.sum : undefined,
                    runwayBufferPct: budgetData.runway ? budgetData.runway.bufferPct : undefined,
                    nightSafeLimit: budgetData.nightSafe ? budgetData.nightSafe.limit : undefined,
                    nightSafeSpent: budgetData.nightSafe ? budgetData.nightSafe.spent : undefined,
                    nightSafeLocked: budgetData.nightSafe ? budgetData.nightSafe.locked : undefined
                }).catch(e => console.warn('Background budget settings sync:', e.message));

                // If a new transaction was just added
                if (Array.isArray(budgetData.transactions) && budgetData.transactions.length > 0) {
                    const latestTx = budgetData.transactions[0];
                    const localTxId = latestTx.id;
                    if (typeof localTxId === 'string' && localTxId.startsWith('tx_')) {
                        window.LifeSyncAPI.createTransaction({
                            title: latestTx.title,
                            description: latestTx.description,
                            type: latestTx.type,
                            category: latestTx.category,
                            amount: latestTx.amount,
                            date: latestTx.date
                        }).then(s => {
                            if (s && s.id) {
                                if (pendingCancelledTxIds.has(localTxId)) {
                                    pendingCancelledTxIds.delete(localTxId);
                                    window.LifeSyncAPI.deleteTransaction(s.id).catch(err => console.warn('Delete cancelled tx:', err.message));
                                } else {
                                    latestTx.id = s.id;
                                    const b = readJson(key, {});
                                    if (Array.isArray(b.transactions)) {
                                        const found = b.transactions.find(t => String(t.id) === String(localTxId));
                                        if (found) found.id = s.id;
                                        writeJson(key, b);
                                    }
                                }
                            }
                        }).catch(e => console.warn('Background tx sync:', e.message));
                    }
                }
            }
            return saved;
        },

        // --- WELLNESS ---
        getWellness(user) {
            const key = getScopedKey('wellness', user);
            const stored = localStorage.getItem(key);
            if (!stored) {
                const initial = shouldSeedDemo() ? getDefaultWellness() : getEmptyWellness();
                writeJson(key, initial);
                return initial;
            }
            const data = readJson(key, {});
            const defaults = shouldSeedDemo() ? getDefaultWellness() : getEmptyWellness();
            return {
                streak: typeof data.streak === 'number' ? data.streak : defaults.streak,
                entries: Array.isArray(data.entries) ? data.entries : defaults.entries
            };
        },
        saveWellness(user, wellnessData) {
            const key = getScopedKey('wellness', user);
            const saved = writeJson(key, wellnessData);
            if (typeof window !== 'undefined' && window.LifeSyncAPI && window.LifeSyncAPI.getToken()) {
                if (Array.isArray(wellnessData.entries) && wellnessData.entries.length > 0) {
                    const latest = wellnessData.entries[wellnessData.entries.length - 1];
                    window.LifeSyncAPI.createWellnessCheckIn({
                        mood: latest.mood,
                        stress: latest.stress,
                        energy: latest.energy,
                        note: latest.description || latest.notes,
                        date: latest.date
                    }).catch(e => console.warn('Background wellness sync:', e.message));
                }
            }
            return saved;
        },

        // --- PROFILE & PREFERENCES ---
        getProfile(user) {
            const key = getScopedKey('profile', user);
            const stored = localStorage.getItem(key);
            const defaults = shouldSeedDemo() ? getDefaultProfile(user) : getCleanProfile(user);
            if (!stored) {
                writeJson(key, defaults);
                return defaults;
            }
            const data = readJson(key, {});
            return { ...defaults, ...data };
        },
        saveProfile(user, profileData) {
            const key = getScopedKey('profile', user);
            const saved = writeJson(key, profileData);
            if (typeof window !== 'undefined' && window.LifeSyncAPI && window.LifeSyncAPI.getToken()) {
                window.LifeSyncAPI.updateProfile({
                    name: profileData.name,
                    university: profileData.university,
                    major: profileData.major,
                    yearSemester: profileData.yearSemester,
                    studentId: profileData.studentId,
                    currency: profileData.currency,
                    xp: profileData.xp,
                    notificationsEnabled: profileData.notificationsEnabled
                }).catch(e => console.warn('Background profile sync:', e.message));
            }
            return saved;
        },

        // --- EXPLICIT DEMO SEEDING / CLEANUP HELPERS (Dev & Testing only) ---
        seedDemoData(user) {
            if (!user) return;
            this.saveTasks(user, getDefaultTasks());
            this.saveEvents(user, getDefaultEvents());
            this.saveBudget(user, getDefaultBudget());
            this.saveWellness(user, getDefaultWellness());
            this.saveProfile(user, getDefaultProfile(user));
            console.log('🌱 Explicit demo data populated for user:', user.email || user.username);
        },

        clearUserData(user) {
            if (!user) return;
            this.saveTasks(user, []);
            this.saveEvents(user, []);
            this.saveBudget(user, getEmptyBudget());
            this.saveWellness(user, getEmptyWellness());
            this.saveProfile(user, getCleanProfile(user));
            console.log('🧹 Clean state restored for user:', user.email || user.username);
        },

        // --- BACKEND HYDRATION SYNC ---
        async syncFromBackend(user) {
            if (typeof window === 'undefined' || !window.LifeSyncAPI || typeof fetch === 'undefined') return;
            const token = window.LifeSyncAPI.getToken();
            if (!token) return;

            try {
                // Fetch tasks from backend
                const backendTasks = await window.LifeSyncAPI.getTasks();
                if (Array.isArray(backendTasks)) {
                    const localTasks = LifeSyncStorage.getTasks(user);
                    const taskSyncKey = getScopedKey('tasks_backend_synced', user);
                    const hasSyncedTasks = localStorage.getItem(taskSyncKey);

                    if (!hasSyncedTasks && backendTasks.length === 0 && Array.isArray(localTasks) && localTasks.length > 0) {
                        for (const t of localTasks) {
                            try {
                                const created = await window.LifeSyncAPI.createTask({
                                    title: t.title,
                                    category: t.category,
                                    deadline: t.dueDate,
                                    priority: t.priority,
                                    status: t.status,
                                    description: t.description
                                });
                                if (created && created.id) t.id = created.id;
                            } catch (e) {
                                console.warn('Seed task sync notice:', e.message);
                            }
                        }
                        localStorage.setItem(taskSyncKey, '1');
                        writeJson(getScopedKey('tasks', user), localTasks);
                    } else if (backendTasks.length > 0) {
                        const mappedBackend = backendTasks.map(t => ({
                            id: t.id,
                            title: t.title,
                            description: t.description || '',
                            dueDate: t.deadline || '',
                            priority: t.priority,
                            category: t.category,
                            status: t.status,
                            createdAt: t.created_at,
                            completedAt: t.completed_at
                        }));

                        const localUnsynced = localTasks.filter(lt =>
                            typeof lt.id === 'string' && lt.id.startsWith('tsk_') &&
                            !mappedBackend.some(bt => bt.title.trim().toLowerCase() === lt.title.trim().toLowerCase())
                        );

                        const mergedTasks = [...mappedBackend, ...localUnsynced];
                        writeJson(getScopedKey('tasks', user), mergedTasks);
                        localStorage.setItem(taskSyncKey, '1');
                        if (window.TasksModule && window.TasksModule.init) {
                            window.TasksModule.init(user);
                        }
                    }
                }

                // Fetch events from backend
                const backendEvents = await window.LifeSyncAPI.getEvents();
                if (Array.isArray(backendEvents)) {
                    const localEvents = LifeSyncStorage.getEvents(user);
                    const eventSyncKey = getScopedKey('events_backend_synced', user);
                    const hasSyncedEvents = localStorage.getItem(eventSyncKey);

                    if (!hasSyncedEvents && backendEvents.length === 0 && Array.isArray(localEvents) && localEvents.length > 0) {
                        for (const ev of localEvents) {
                            try {
                                const created = await window.LifeSyncAPI.createEvent({
                                    title: ev.title,
                                    date: ev.date,
                                    time: ev.time,
                                    category: ev.category,
                                    description: ev.description,
                                    reminder: ev.hasReminder
                                });
                                if (created && created.id) ev.id = created.id;
                            } catch (e) {
                                console.warn('Seed event sync notice:', e.message);
                            }
                        }
                        localStorage.setItem(eventSyncKey, '1');
                        writeJson(getScopedKey('events', user), localEvents);
                    } else if (backendEvents.length > 0) {
                        const mappedEvents = backendEvents.map(e => ({
                            id: e.id,
                            title: e.title,
                            date: e.date,
                            time: e.time,
                            category: e.event_type,
                            priority: 'Medium',
                            description: e.description || '',
                            hasReminder: Boolean(e.reminder)
                        }));

                        const localUnsyncedEvents = localEvents.filter(le =>
                            typeof le.id === 'string' && le.id.startsWith('evt_') &&
                            !mappedEvents.some(be => be.title.trim().toLowerCase() === le.title.trim().toLowerCase() && be.date === le.date)
                        );

                        const mergedEvents = [...mappedEvents, ...localUnsyncedEvents];
                        writeJson(getScopedKey('events', user), mergedEvents);
                        localStorage.setItem(eventSyncKey, '1');
                        if (window.CalendarModule && window.CalendarModule.init) {
                            window.CalendarModule.init(user);
                        }
                    }
                }

                // Fetch budget settings and transactions
                try {
                    const [backendTx, backendSettings] = await Promise.all([
                        window.LifeSyncAPI.getTransactions().catch(() => null),
                        window.LifeSyncAPI.getBudgetSettings().catch(() => null)
                    ]);

                    const budget = LifeSyncStorage.getBudget(user);
                    let budgetModified = false;

                    if (backendSettings && (backendSettings.monthly_budget !== undefined || backendSettings.monthlyBudget !== undefined)) {
                        const rawMb = backendSettings.monthly_budget !== undefined ? backendSettings.monthly_budget : backendSettings.monthlyBudget;
                        const mb = parseFloat(rawMb);
                        if (!isNaN(mb) && mb >= 0) {
                            budget.monthlyBudget = mb;
                            budgetModified = true;
                        }
                    }

                    if (Array.isArray(backendTx)) {
                        const syncKey = getScopedKey('budget_backend_synced', user);
                        localStorage.setItem(syncKey, '1');
                        budget.transactions = backendTx.map(t => ({
                            id: t.id,
                            title: t.description || t.category,
                            amount: parseFloat(t.amount) || 0,
                            type: t.type,
                            category: t.category,
                            date: t.date,
                            description: t.description || ''
                        }));
                        budgetModified = true;
                    }

                    if (budgetModified) {
                        writeJson(getScopedKey('budget', user), budget);
                        if (window.BudgetModule && window.BudgetModule.init) {
                            window.BudgetModule.init(user);
                        }
                    }
                } catch (bErr) {
                    console.info('Budget sync notice:', bErr.message);
                }
            } catch (err) {
                console.info('Backend hydration notice: Backend sync unavailable or skipped (' + err.message + '). Continuing in local storage mode.');
            }
        }
    };

    // Backward compatibility for existing TaskStorage calls
    window.TaskStorage = {
        loadTasks: (user) => LifeSyncStorage.getTasks(user),
        saveTasks: (user, tasks) => LifeSyncStorage.saveTasks(user, tasks)
    };

    window.LifeSyncStorage = LifeSyncStorage;
})();
