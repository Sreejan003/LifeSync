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
                location: 'Room 204',
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
                location: 'Room 105',
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
            name: user && user.username && user.username !== 'Student' ? user.username : 'Ananya',
            email: user ? user.email : 'ananya@lifesync.edu',
            university: 'National Institute of Technology',
            major: 'Computer Science & Engineering',
            yearSemester: '3rd Year / 5th Semester',
            studentId: 'STU-2026-8841',
            currency: '₹',
            notificationsEnabled: true,
            defaultView: 'dashboard'
        };
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
                const initial = getDefaultTasks();
                writeJson(key, initial);
                return initial;
            }
            return readJson(key, []);
        },
        saveTasks(user, tasks) {
            const key = getScopedKey('tasks', user);
            return writeJson(key, tasks);
        },

        // --- CALENDAR EVENTS ---
        getEvents(user) {
            const key = getScopedKey('events', user);
            const stored = localStorage.getItem(key);
            if (!stored) {
                const initial = getDefaultEvents();
                writeJson(key, initial);
                return initial;
            }
            return readJson(key, []);
        },
        saveEvents(user, events) {
            const key = getScopedKey('events', user);
            return writeJson(key, events);
        },

        // --- BUDGET ---
        getBudget(user) {
            const key = getScopedKey('budget', user);
            const stored = localStorage.getItem(key);
            if (!stored) {
                const initial = getDefaultBudget();
                writeJson(key, initial);
                return initial;
            }
            const data = readJson(key, {});
            const defaults = getDefaultBudget();
            return {
                monthlyBudget: Number(data.monthlyBudget) || defaults.monthlyBudget,
                runway: { ...defaults.runway, ...(data.runway || {}) },
                nightSafe: { ...defaults.nightSafe, ...(data.nightSafe || {}) },
                sharedGoal: { ...defaults.sharedGoal, ...(data.sharedGoal || {}) },
                transactions: Array.isArray(data.transactions) ? data.transactions : defaults.transactions,
                bills: Array.isArray(data.bills) ? data.bills : defaults.bills
            };
        },
        saveBudget(user, budgetData) {
            const key = getScopedKey('budget', user);
            return writeJson(key, budgetData);
        },

        // --- WELLNESS ---
        getWellness(user) {
            const key = getScopedKey('wellness', user);
            const stored = localStorage.getItem(key);
            if (!stored) {
                const initial = getDefaultWellness();
                writeJson(key, initial);
                return initial;
            }
            const data = readJson(key, {});
            const defaults = getDefaultWellness();
            return {
                streak: typeof data.streak === 'number' ? data.streak : defaults.streak,
                entries: Array.isArray(data.entries) ? data.entries : defaults.entries
            };
        },
        saveWellness(user, wellnessData) {
            const key = getScopedKey('wellness', user);
            return writeJson(key, wellnessData);
        },

        // --- PROFILE & PREFERENCES ---
        getProfile(user) {
            const key = getScopedKey('profile', user);
            const stored = localStorage.getItem(key);
            const defaults = getDefaultProfile(user);
            if (!stored) {
                writeJson(key, defaults);
                return defaults;
            }
            const data = readJson(key, {});
            return { ...defaults, ...data };
        },
        saveProfile(user, profileData) {
            const key = getScopedKey('profile', user);
            return writeJson(key, profileData);
        }
    };

    // Backward compatibility for existing TaskStorage calls
    window.TaskStorage = {
        loadTasks: (user) => LifeSyncStorage.getTasks(user),
        saveTasks: (user, tasks) => LifeSyncStorage.saveTasks(user, tasks)
    };

    window.LifeSyncStorage = LifeSyncStorage;
})();
