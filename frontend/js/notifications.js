/**
 * LifeSync - Smart Persistent & Real-time Notification System (js/notifications.js)
 * --------------------------------------------------------------------------
 * Integrates:
 * 1. Client-derived alerts (Overdue tasks, exams within 48h, budget thresholds, wellness).
 * 2. PostgreSQL / Supabase server-persisted notifications (/api/notifications).
 * 3. Browser Push / Desktop Web Notifications API.
 * 4. Quiet hours deduplication & read/unread state management.
 */

(function () {
    'use strict';

    let serverNotifications = [];
    let serverUnreadCount = 0;
    let browserPermissionRequested = false;

    // Deduplication map: key -> timestamp (milliseconds)
    const recentDesktopAlerts = new Map();
    const DEDUPLICATION_WINDOW_MS = 30000; // 30 seconds

    function getTodayString() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    /**
     * Get current browser notification permission state
     * Returns: 'granted' | 'denied' | 'default' | 'unsupported'
     */
    function getPermissionState() {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return 'unsupported';
        }
        return Notification.permission;
    }

    /**
     * Update all notification alert buttons and indicators in the UI
     */
    function updateAlertsUI() {
        if (typeof document === 'undefined') return;
        const state = getPermissionState();
        const buttons = document.querySelectorAll('#notifBrowserPermBtn, .notif-browser-perm-btn');

        buttons.forEach(btn => {
            btn.classList.remove('perm-granted', 'perm-denied', 'perm-default', 'perm-unsupported');
            if (state === 'granted') {
                btn.classList.add('perm-granted');
                btn.innerHTML = '<span>✅ Desktop Alerts Active</span>';
                btn.title = 'Desktop alerts are enabled. Click to send a test alert.';
            } else if (state === 'denied') {
                btn.classList.add('perm-denied');
                btn.innerHTML = '<span>🚫 Alerts Blocked (Click for Info)</span>';
                btn.title = 'Notifications are blocked in browser settings. Click for instructions to unblock.';
            } else if (state === 'unsupported') {
                btn.classList.add('perm-unsupported');
                btn.innerHTML = '<span>⚠️ Alerts Unsupported</span>';
                btn.title = 'Desktop notifications are not supported in this browser.';
            } else {
                btn.classList.add('perm-default');
                btn.innerHTML = '<span>🔔 Enable Desktop Alerts</span>';
                btn.title = 'Click to enable desktop notifications for study reminders and focus sessions.';
            }
        });
    }

    /**
     * Convert URL-safe base64 VAPID public key to Uint8Array for PushManager subscription
     */
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    /**
     * Register browser with Web Push endpoint (FCM / APNs / Autopush)
     * Enables closed-tab background alerts
     */
    async function registerPushSubscription() {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            return null;
        }
        if (Notification.permission !== 'granted') {
            return null;
        }
        if (!window.LifeSyncAPI || !window.LifeSyncAPI.getVapidPublicKey) {
            return null;
        }

        try {
            const reg = await navigator.serviceWorker.ready;
            if (!reg || !reg.pushManager) return null;

            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                const resp = await window.LifeSyncAPI.getVapidPublicKey();
                const publicKey = resp && resp.publicKey;
                if (!publicKey) return null;

                const convertedVapidKey = urlBase64ToUint8Array(publicKey);
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: convertedVapidKey
                });
            }

            if (sub) {
                const subJson = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
                await window.LifeSyncAPI.subscribePush(subJson);
                return sub;
            }
        } catch (err) {
            console.warn('⚠️ Web Push subscription handshake failed (local notification fallback remains active):', err.message);
        }
        return null;
    }

    /**
     * Request browser desktop notification permissions with comprehensive state handling
     */
    async function requestBrowserPermission() {
        const state = getPermissionState();

        if (state === 'unsupported') {
            if (window.LifeSyncApp && window.LifeSyncApp.showToast) {
                window.LifeSyncApp.showToast('Desktop notifications are not supported by your browser.', 'warning');
            }
            updateAlertsUI();
            return 'unsupported';
        }

        if (state === 'denied') {
            const helpMsg = 'Desktop alerts are blocked in your browser settings.\n\nTo enable them:\n1. Click the lock 🔒 or site settings icon in your browser address bar.\n2. Change "Notifications" to "Allow".\n3. Reload the page to activate alerts.';
            if (typeof window !== 'undefined' && window.alert) {
                window.alert(helpMsg);
            }
            if (window.LifeSyncApp && window.LifeSyncApp.showToast) {
                window.LifeSyncApp.showToast('Alerts blocked. Click the lock 🔒 icon in the address bar to allow.', 'warning');
            }
            updateAlertsUI();
            return 'denied';
        }

        if (state === 'granted') {
            // Already enabled: ensure Web Push subscription is registered and send test alert
            registerPushSubscription().catch(() => {});
            showBrowserNotification(
                'LifeSync Desktop Alerts Active ✦',
                'Desktop alerts are active! You will receive focus breaks, task deadlines, and smart reminders.',
                { tag: 'lifesync-test-alert' }
            );
            if (window.LifeSyncApp && window.LifeSyncApp.showToast) {
                window.LifeSyncApp.showToast('Desktop alerts are active! Sent a test notification 🔔', 'info');
            }
            updateAlertsUI();
            return 'granted';
        }

        // State is 'default': explicitly request permission
        try {
            browserPermissionRequested = true;
            const perm = await Notification.requestPermission();
            updateAlertsUI();

            if (perm === 'granted') {
                registerPushSubscription().catch(() => {});
                showBrowserNotification(
                    'LifeSync Desktop Alerts Active ✦',
                    'Desktop alerts are enabled! You will receive focus breaks, task deadlines, and smart reminders.',
                    { tag: 'lifesync-test-alert' }
                );
                if (window.LifeSyncApp && window.LifeSyncApp.showToast) {
                    window.LifeSyncApp.showToast('Desktop alerts enabled! Sent a test notification 🔔', 'success');
                }
            } else if (perm === 'denied') {
                if (window.LifeSyncApp && window.LifeSyncApp.showToast) {
                    window.LifeSyncApp.showToast('Notification permission was blocked. You can re-enable anytime in site settings.', 'warning');
                }
            }
            return perm;
        } catch (e) {
            console.warn('Notification permission request error:', e);
            updateAlertsUI();
            return getPermissionState();
        }
    }

    /**
     * Trigger browser notification if permitted, using Service Worker with fallback
     * Includes deduplication to prevent alert spamming.
     */
    function showBrowserNotification(title, message, options = {}) {
        if (typeof window === 'undefined' || !('Notification' in window)) return;
        if (Notification.permission !== 'granted') return;

        const tag = options.tag || (title + ':' + message);
        const now = Date.now();

        // Prevent duplicate notification triggers within the deduplication window
        if (recentDesktopAlerts.has(tag)) {
            const lastSent = recentDesktopAlerts.get(tag);
            if (now - lastSent < DEDUPLICATION_WINDOW_MS) {
                return;
            }
        }
        recentDesktopAlerts.set(tag, now);

        // Clean up old deduplication cache entries
        if (recentDesktopAlerts.size > 50) {
            recentDesktopAlerts.forEach((timestamp, key) => {
                if (now - timestamp > DEDUPLICATION_WINDOW_MS * 2) {
                    recentDesktopAlerts.delete(key);
                }
            });
        }

        const icon = options.icon || 'favicon.ico';
        const notifOptions = {
            body: message,
            icon: icon,
            badge: icon,
            tag: tag,
            data: options.data || { targetTab: options.targetTab || 'dashboard' },
            silent: options.silent || false
        };

        // Priority 1: Service Worker Registration (universal support for Chromium, Android, macOS)
        if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready
                .then(reg => {
                    if (reg && reg.showNotification) {
                        return reg.showNotification(title, notifOptions);
                    }
                    throw new Error('SW showNotification unavailable');
                })
                .catch(() => {
                    // Fallback to classic window Notification constructor
                    try {
                        new Notification(title, notifOptions);
                    } catch (err) {
                        // Restricted headless or iframe environment
                    }
                });
        } else {
            // Priority 2: Classic Notification constructor
            try {
                new Notification(title, notifOptions);
            } catch (err) {
                // Restricted headless or iframe environment
            }
        }
    }

    /**
     * Fetch persistent notifications from backend API
     */
    async function fetchServerNotifications() {
        if (window.LifeSyncAPI && window.LifeSyncAPI.getNotifications) {
            try {
                const res = await window.LifeSyncAPI.getNotifications();
                if (res && res.notifications) {
                    serverNotifications = res.notifications;
                    serverUnreadCount = res.unreadCount || 0;
                    return serverNotifications;
                }
            } catch (e) {
                // Ignore if offline
            }
        }
        return [];
    }

    /**
     * Mark single notification as read
     */
    async function markRead(notificationId) {
        // Update local state
        const target = serverNotifications.find(n => String(n.id) === String(notificationId));
        if (target) {
            target.is_read = 1;
            serverUnreadCount = Math.max(0, serverUnreadCount - 1);
        }

        // Persist to server
        if (window.LifeSyncAPI && window.LifeSyncAPI.markNotificationRead) {
            try {
                await window.LifeSyncAPI.markNotificationRead(notificationId);
            } catch (e) {
                console.warn('⚠️ Could not mark notification read on server:', e.message);
            }
        }

        if (window.LifeSyncApp && window.LifeSyncApp.updateNotifications) {
            window.LifeSyncApp.updateNotifications();
        }
    }

    /**
     * Mark all notifications as read
     */
    async function markAllRead() {
        serverNotifications.forEach(n => { n.is_read = 1; });
        serverUnreadCount = 0;

        if (window.LifeSyncAPI && window.LifeSyncAPI.markAllNotificationsRead) {
            try {
                await window.LifeSyncAPI.markAllNotificationsRead();
            } catch (e) {
                console.warn('⚠️ Could not mark all read on server:', e.message);
            }
        }

        if (window.LifeSyncApp && window.LifeSyncApp.updateNotifications) {
            window.LifeSyncApp.updateNotifications();
        }
    }

    /**
     * Clear all notifications
     */
    async function clearAll() {
        serverNotifications = [];
        serverUnreadCount = 0;

        if (window.LifeSyncAPI && window.LifeSyncAPI.clearAllNotifications) {
            try {
                await window.LifeSyncAPI.clearAllNotifications();
            } catch (e) {
                console.warn('⚠️ Could not clear notifications on server:', e.message);
            }
        }

        if (window.LifeSyncApp && window.LifeSyncApp.updateNotifications) {
            window.LifeSyncApp.updateNotifications();
        }
    }

    /**
     * Unified notification retrieval (Derived state + Server notifications)
     */
    function getNotifications() {
        const notifications = [];
        const seenTitles = new Set();
        const todayStr = getTodayString();

        // 1. Task Reminders (Derived)
        if (window.TasksModule) {
            const tasks = window.TasksModule.getTasks();
            tasks.forEach(t => {
                if (t.status !== 'Completed' && t.dueDate) {
                    if (t.dueDate < todayStr) {
                        const title = 'Overdue Task';
                        seenTitles.add(t.title);
                        notifications.push({
                            id: 'notif_overdue_' + t.id,
                            type: 'danger',
                            icon: '🚨',
                            title: title,
                            message: `"${t.title}" is overdue. Take action!`,
                            targetTab: 'tasks',
                            time: 'Overdue'
                        });
                    } else if (t.dueDate === todayStr) {
                        const title = 'Task Due Today';
                        seenTitles.add(t.title);
                        notifications.push({
                            id: 'notif_duetoday_' + t.id,
                            type: 'warning',
                            icon: '⚡',
                            title: title,
                            message: `"${t.title}" is due before midnight.`,
                            targetTab: 'tasks',
                            time: 'Today'
                        });
                    }
                }
            });
        }

        // 2. Calendar Event Reminders (Derived)
        if (window.CalendarModule) {
            const schedule = window.CalendarModule.getUpcomingSchedule(2);
            schedule.forEach(item => {
                if (item.itemType === 'event') {
                    const isExam = (item.category || '').toLowerCase() === 'exam';
                    seenTitles.add(item.title);
                    notifications.push({
                        id: 'notif_evt_' + item.id,
                        type: isExam ? 'danger' : 'info',
                        icon: isExam ? '🎯' : '📅',
                        title: isExam ? 'Upcoming Exam' : 'Scheduled Event',
                        message: `${item.title} at ${item.time || 'scheduled time'}.`,
                        targetTab: 'calendar',
                        time: item.date === todayStr ? 'Today' : 'Tomorrow'
                    });
                }
            });
        }

        // 3. Budget Alerts (Derived)
        if (window.BudgetModule) {
            const summary = window.BudgetModule.getSummary();
            if (summary.isExceeded) {
                notifications.push({
                    id: 'notif_budget_exceeded',
                    type: 'danger',
                    icon: '⚠️',
                    title: 'Budget Limit Exceeded',
                    message: `Monthly spending is ₹${summary.spentThisMonth.toLocaleString()} exceeding limit of ₹${summary.monthlyBudget.toLocaleString()}.`,
                    targetTab: 'budget',
                    time: 'Finance Alert'
                });
            } else if (summary.isWarning) {
                notifications.push({
                    id: 'notif_budget_warning',
                    type: 'warning',
                    icon: '💳',
                    title: 'Budget Alert (80%+)',
                    message: `You have utilized ${summary.budgetUsagePct}% of your monthly budget.`,
                    targetTab: 'budget',
                    time: 'Finance Alert'
                });
            }
        }

        // 4. Wellness Check-in Reminder (Derived)
        if (window.WellnessModule) {
            const todayEntry = window.WellnessModule.getTodayEntry();
            if (!todayEntry) {
                notifications.push({
                    id: 'notif_wellness_prompt',
                    type: 'info',
                    icon: '💜',
                    title: 'Mindful Moment',
                    message: 'How are you feeling today? Complete your 30-second wellness check-in.',
                    targetTab: 'wellness',
                    time: 'Daily Self-Care'
                });
            }
        }

        // 5. Merge server notifications (if not already represented)
        serverNotifications.forEach(sn => {
            const isRead = sn.is_read === 1 || sn.is_read === true;
            if (!isRead && !seenTitles.has(sn.title)) {
                let icon = '🔔';
                let type = 'info';
                if (sn.category === 'task') { icon = '📝'; type = sn.priority === 'urgent' ? 'danger' : 'warning'; }
                if (sn.category === 'exam') { icon = '🎯'; type = 'danger'; }
                if (sn.category === 'budget') { icon = '💳'; type = 'warning'; }
                if (sn.category === 'wellness') { icon = '💜'; type = 'info'; }

                let targetTab = 'dashboard';
                if (sn.action_link && sn.action_link.includes('task')) targetTab = 'tasks';
                if (sn.action_link && sn.action_link.includes('calendar')) targetTab = 'calendar';
                if (sn.action_link && sn.action_link.includes('budget')) targetTab = 'budget';
                if (sn.action_link && sn.action_link.includes('wellness')) targetTab = 'wellness';

                notifications.push({
                    id: sn.id,
                    isServer: true,
                    type,
                    icon,
                    title: sn.title,
                    message: sn.message,
                    targetTab,
                    time: 'Smart Alert'
                });
            }
        });

        return notifications;
    }

    /**
     * Periodic background sync with server
     */
    async function syncWithServer() {
        await fetchServerNotifications();
        if (getPermissionState() === 'granted') {
            registerPushSubscription().catch(() => {});
        }
        if (window.LifeSyncApp && window.LifeSyncApp.updateNotifications) {
            window.LifeSyncApp.updateNotifications();
        }
    }

    /**
     * Accurately explain browser behavior: Web Push vs local notifications
     */
    function explainBrowserBehavior() {
        return {
            localNotifications: 'Local desktop alerts notify you while LifeSync is open or running in an active or background tab.',
            webPush: 'Web Push alerts deliver notifications even when all LifeSync browser tabs are completely closed, via a Service Worker push subscription.'
        };
    }

    const NotificationsModule = {
        getNotifications,
        fetchServerNotifications,
        syncWithServer,
        markRead,
        markAllRead,
        clearAll,
        getPermissionState,
        updateAlertsUI,
        requestBrowserPermission,
        registerPushSubscription,
        showBrowserNotification,
        explainBrowserBehavior
    };

    window.NotificationsModule = NotificationsModule;
})();
