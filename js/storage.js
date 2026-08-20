/**
 * LifeSync - Storage Module (js/storage.js)
 * -------------------------------------------------------------
 * Manages user-scoped task persistence using LocalStorage.
 */

(function () {
    'use strict';

    /**
     * Determines LocalStorage key scoped to current user session.
     */
    function getTaskStorageKey(user) {
        if (user && user.id) {
            return `lifesyncTasks_${user.id}`;
        }
        return 'lifesyncTasks_guest';
    }

    /**
     * Loads tasks array for the given user context.
     */
    function loadTasks(user) {
        const key = getTaskStorageKey(user);
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch (e) {
            console.error('Failed to parse tasks from localStorage:', e);
            return [];
        }
    }

    /**
     * Saves tasks array for the given user context.
     */
    function saveTasks(user, tasks) {
        const key = getTaskStorageKey(user);
        try {
            localStorage.setItem(key, JSON.stringify(tasks));
        } catch (e) {
            console.error('Failed to save tasks to localStorage:', e);
        }
    }

    // Expose Storage module globally
    window.TaskStorage = {
        loadTasks,
        saveTasks
    };
})();
