/**
 * LifeSync - Main Application Controller (js/app.js)
 * -------------------------------------------------------------
 * Application entry point linking AuthSystem, TaskStorage, and UI.
 */

(function () {
    'use strict';

    let tasks = [];

    // ==========================================
    // 1. STATE & DATA SYNCHRONIZATION
    // ==========================================

    function syncStateAndRender() {
        const currentUser = AuthSystem.getCurrentUser();
        
        // Enforce Sign Up / Sign In first before accessing To-Do List
        if (!currentUser) {
            window.location.href = "auth.html";
            return;
        }

        tasks = TaskStorage.loadTasks(currentUser);

        UI.renderUserHeader(currentUser, {
            onEditUsername: () => UI.openEditUserModal(currentUser ? currentUser.username : ""),
            onSignOut: () => {
                AuthSystem.signOut();
                UI.showToast("Signed out successfully", "info");
                setTimeout(() => {
                    window.location.href = "auth.html";
                }, 500);
            }
        });

        UI.renderTasks(tasks, {
            onToggleTask: handleToggleTask,
            onDeleteTask: handleDeleteTask
        });
    }

    // ==========================================
    // 2. TASK HANDLERS
    // ==========================================

    function handleAddTask() {
        const text = UI.elements.taskInput.value.trim();

        if (text === "") {
            UI.showToast("Please enter a task description.", "error");
            return;
        }

        const newTask = {
            id: Date.now(),
            text: text,
            completed: false
        };

        tasks.push(newTask);
        const currentUser = AuthSystem.getCurrentUser();
        TaskStorage.saveTasks(currentUser, tasks);

        UI.elements.taskInput.value = "";
        UI.renderTasks(tasks, {
            onToggleTask: handleToggleTask,
            onDeleteTask: handleDeleteTask
        });
    }

    function handleToggleTask(taskId, isCompleted) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = isCompleted;
            const currentUser = AuthSystem.getCurrentUser();
            TaskStorage.saveTasks(currentUser, tasks);

            UI.renderTasks(tasks, {
                onToggleTask: handleToggleTask,
                onDeleteTask: handleDeleteTask
            });
        }
    }

    function handleDeleteTask(taskId) {
        tasks = tasks.filter(t => t.id !== taskId);
        const currentUser = AuthSystem.getCurrentUser();
        TaskStorage.saveTasks(currentUser, tasks);

        UI.renderTasks(tasks, {
            onToggleTask: handleToggleTask,
            onDeleteTask: handleDeleteTask
        });
    }

    function handleDeleteAllTasks() {
        if (tasks.length === 0) return;

        const confirmDelete = confirm("Delete all your tasks?");
        if (!confirmDelete) return;

        tasks = [];
        const currentUser = AuthSystem.getCurrentUser();
        TaskStorage.saveTasks(currentUser, tasks);

        UI.renderTasks(tasks, {
            onToggleTask: handleToggleTask,
            onDeleteTask: handleDeleteTask
        });
    }

    // ==========================================
    // 3. EVENT LISTENERS
    // ==========================================

    function setupEventListeners() {
        // Task Input & Add Button
        document.querySelector("#addi").addEventListener("click", handleAddTask);
        UI.elements.taskInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") handleAddTask();
        });

        // Delete All
        document.querySelector("#deleteAll").addEventListener("click", handleDeleteAllTasks);

        // Edit User Modal Controls
        const closeEditBtn = document.querySelector("#closeEditUserModal");
        const cancelEditBtn = document.querySelector("#cancelEditUser");
        if (closeEditBtn) closeEditBtn.addEventListener("click", UI.closeEditUserModal);
        if (cancelEditBtn) cancelEditBtn.addEventListener("click", UI.closeEditUserModal);
        if (UI.elements.editUserModal) {
            UI.elements.editUserModal.addEventListener("click", (e) => {
                if (e.target === UI.elements.editUserModal) UI.closeEditUserModal();
            });
        }

        // Edit Username Submission
        if (UI.elements.editUserForm) {
            UI.elements.editUserForm.addEventListener("submit", (e) => {
                e.preventDefault();
                const newName = UI.elements.newUsernameInput.value;

                try {
                    const updatedUser = AuthSystem.updateUsername(newName);
                    UI.closeEditUserModal();
                    UI.showToast(`Username updated to ${updatedUser.username}!`, "success");
                } catch (err) {
                    UI.showEditUserError(err.message);
                }
            });
        }

        // Subscribe to Auth State Changes
        AuthSystem.onAuthStateChanged(() => {
            syncStateAndRender();
        });
    }

    // ==========================================
    // 4. INIT
    // ==========================================

    document.addEventListener("DOMContentLoaded", () => {
        setupEventListeners();
        syncStateAndRender();
    });

    // Fallback immediate initialization if DOM already loaded
    if (document.readyState === "interactive" || document.readyState === "complete") {
        setupEventListeners();
        syncStateAndRender();
    }
})();
