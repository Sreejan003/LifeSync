/**
 * LifeSync - Service Worker (sw.js)
 * -------------------------------------------------------------
 * Provides:
 * 1. Native ServiceWorkerRegistration.showNotification() support
 *    for Chromium, Android Chrome, and Safari.
 * 2. Notification click routing (focuses active LifeSync window or opens root).
 * 3. Web Push event handler for closed-tab background notifications.
 */

const CACHE_NAME = 'lifesync-v1';

// Install event
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const notifData = event.notification.data || {};
    const targetTab = notifData.targetTab || 'dashboard';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If window already open, focus it and switch tab
            for (const client of clientList) {
                if (client.url && 'focus' in client) {
                    client.postMessage({
                        type: 'LIFESYNC_NOTIFICATION_CLICK',
                        targetTab: targetTab
                    });
                    return client.focus();
                }
            }
            // If no window open, open new window with tab parameter
            if (self.clients.openWindow) {
                return self.clients.openWindow('/#' + targetTab);
            }
        })
    );
});

// Push event (Web Push API)
self.addEventListener('push', (event) => {
    let payload = {
        title: 'LifeSync Reminder',
        body: 'You have a new update in LifeSync.',
        icon: 'favicon.ico',
        badge: 'favicon.ico',
        data: { targetTab: 'dashboard' }
    };

    if (event.data) {
        try {
            payload = Object.assign(payload, event.data.json());
        } catch (e) {
            payload.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || 'favicon.ico',
            badge: payload.badge || 'favicon.ico',
            tag: payload.tag || 'lifesync-push',
            data: payload.data || {},
            vibrate: [200, 100, 200]
        })
    );
});
