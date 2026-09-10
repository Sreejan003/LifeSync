/**
 * LifeSync - Main Orchestrator & App Controller (js/app.js)
 * -------------------------------------------------------------
 * Bridges AuthSystem, Storage, and all domain modules:
 * Tasks, Calendar, Smart Task Organizer, Budget, Wellness, Analytics, Notifications.
 */

(function () {
    'use strict';

    let currentUser = null;
    let currentTab = 'dashboard';

    function escapeHtml(str) {
        return (str || '').replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    // ==========================================
    // 1. AUTH GUARD & SESSION CHECK
    // ==========================================
    function checkAuthAndInit() {
        if (typeof AuthSystem === 'undefined') {
            console.error('AuthSystem is not loaded.');
            return;
        }

        // FRESH-OPEN GUARD: sessionStorage is cleared when the browser/tab closes.
        // If no 'ls_session_active' flag exists, the user opened a fresh browser session.
        // Force them to log in again regardless of any stored JWT token.
        const sessionActive = sessionStorage.getItem('ls_session_active');
        if (!sessionActive) {
            // Do NOT sign out here — just redirect to auth.html.
            // The JWT stays intact so auth.html can re-validate without losing the account.
            // auth-page.js will only auto-skip login if BOTH jwt AND sessionActive are present.
            window.location.replace('auth.html');
            return;
        }

        currentUser = AuthSystem.getCurrentUser();
        if (!currentUser) {
            sessionStorage.removeItem('ls_session_active');
            window.location.replace('auth.html');
            return;
        }

        // Initialize modules with current user context
        window.TasksModule.init(currentUser);
        window.CalendarModule.init(currentUser);
        window.BudgetModule.init(currentUser);
        window.WellnessModule.init(currentUser);
        window.ProfileModule.init(currentUser);

        // Initialize theme
        initTheme();

        // Render UI
        renderHeader();
        updateNotifications();

        // Check URL hash for initial tab
        const hash = window.location.hash.replace('#', '').trim();
        const validTabs = ['dashboard', 'tasks', 'calendar', 'smart', 'budget', 'wellness', 'analytics', 'profile', 'settings'];
        if (hash && validTabs.includes(hash)) {
            switchTab(hash);
        } else {
            switchTab('dashboard');
        }

        setupGlobalListeners();
    }

    // ==========================================
    // 2. TAB ROUTING & NAVIGATION
    // ==========================================
    function switchTab(tabId) {
        currentTab = tabId;
        // Use replaceState instead of location.hash to avoid triggering page reloads
        // or hashchange-based navigation that could cause redirect loops
        try {
            history.replaceState(null, '', '#' + tabId);
        } catch (e) { /* ignore security errors in some envs */ }

        // Update active class on views
        const views = document.querySelectorAll('.app-view');
        views.forEach(v => {
            if (v.id === `view-${tabId}`) {
                v.classList.add('active');
            } else {
                v.classList.remove('active');
            }
        });

        // Update navigation buttons
        const navBtns = document.querySelectorAll('.nav-item-btn, .mobile-nav-btn');
        navBtns.forEach(btn => {
            if (btn.dataset.tab === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Close mobile drawer if open
        closeMobileSidebar();

        // Render tab-specific view
        renderCurrentView();

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function renderCurrentView() {
        if (!currentUser) return;

        if (currentTab === 'dashboard') {
            window.DashboardModule.render(currentUser);
        } else if (currentTab === 'tasks') {
            renderTasksView();
        } else if (currentTab === 'smart') {
            renderSmartOrganizerView();
        } else if (currentTab === 'calendar') {
            renderCalendarView();
        } else if (currentTab === 'budget') {
            renderBudgetView();
        } else if (currentTab === 'wellness') {
            renderWellnessView();
        } else if (currentTab === 'analytics') {
            renderAnalyticsView();
        } else if (currentTab === 'profile' || currentTab === 'settings') {
            renderProfileView();
        }

        updateNotifications();
    }

    // ==========================================
    // 3. HEADER & NOTIFICATIONS
    // ==========================================
    function renderHeader() {
        if (!currentUser) return;

        const userAvatarLetter = document.getElementById('userAvatarLetter');
        const dashGreetingName = document.getElementById('dashGreetingName');

        if (userAvatarLetter) {
            userAvatarLetter.textContent = currentUser.avatarLetter || currentUser.username.charAt(0).toUpperCase();
        }
        if (dashGreetingName) {
            dashGreetingName.textContent = currentUser.username;
        }

        const userAvatarEl = document.getElementById('userAvatarDisplay');
        const userDisplayNameEl = document.getElementById('userDisplayName');
        if (userAvatarEl) userAvatarEl.textContent = currentUser.avatarLetter || currentUser.username.charAt(0).toUpperCase();
        if (userDisplayNameEl) userDisplayNameEl.textContent = currentUser.username;
    }

    // ==========================================
    // THEME MANAGEMENT (DARK / LIGHT MODE)
    // ==========================================
    function initTheme() {
        const savedTheme = localStorage.getItem('lifesync_theme');
        if (savedTheme) {
            applyTheme(savedTheme, false);
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            applyTheme('dark', false);
        } else {
            applyTheme('light', false);
        }
    }

    function applyTheme(theme) {
        const isDark = theme === 'dark';
        if (isDark) {
            document.documentElement.classList.add('dark-theme');
            document.body.classList.add('dark-theme');
        } else {
            document.documentElement.classList.remove('dark-theme');
            document.body.classList.remove('dark-theme');
        }

        const sunIcon = document.getElementById('themeIconSun');
        const moonIcon = document.getElementById('themeIconMoon');
        const btnToggle = document.getElementById('btnThemeToggle');

        if (sunIcon) sunIcon.style.display = isDark ? 'block' : 'none';
        if (moonIcon) moonIcon.style.display = isDark ? 'none' : 'block';
        if (btnToggle) btnToggle.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';

        const pillLight = document.getElementById('btnThemePillLight');
        const pillDark = document.getElementById('btnThemePillDark');
        if (pillLight) pillLight.classList.toggle('active', !isDark);
        if (pillDark) pillDark.classList.toggle('active', isDark);

        try {
            localStorage.setItem('lifesync_theme', theme);
        } catch (e) {}
    }

    function toggleTheme() {
        const isDark = document.documentElement.classList.contains('dark-theme');
        applyTheme(isDark ? 'light' : 'dark');
    }

    function setTheme(theme) {
        applyTheme(theme);
    }

    function updateNotifications() {
        const notifBadge = document.getElementById('notifBadge');
        const notifListEl = document.getElementById('notifDropdownList');

        const notifications = window.NotificationsModule ? window.NotificationsModule.getNotifications() : [];

        if (notifBadge) {
            if (notifications.length > 0) {
                notifBadge.textContent = notifications.length;
                notifBadge.style.display = 'inline-flex';
            } else {
                notifBadge.style.display = 'none';
            }
        }

        if (notifListEl) {
            if (notifications.length === 0) {
                notifListEl.innerHTML = `
                    <div class="empty-notifs">
                        <span>🎉</span>
                        <p>You're all caught up! No active alerts.</p>
                    </div>
                `;
            } else {
                notifListEl.innerHTML = notifications.map(n => `
                    <div class="notif-item ${n.type}" onclick="window.LifeSyncApp.handleNotifClick('${n.targetTab}')">
                        <div class="notif-item-icon">${n.icon}</div>
                        <div class="notif-item-content">
                            <div class="notif-item-title">${escapeHtml(n.title)}</div>
                            <div class="notif-item-msg">${escapeHtml(n.message)}</div>
                            <span class="notif-item-time">${n.time}</span>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    function toggleNotificationDropdown() {
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) {
            dropdown.classList.toggle('show');
        }
    }

    function handleNotifClick(targetTab) {
        const dropdown = document.getElementById('notifDropdown');
        if (dropdown) dropdown.classList.remove('show');
        if (targetTab) switchTab(targetTab);
    }

    // ==========================================
    // 4. TASKS VIEW RENDERER
    // ==========================================
    function renderTasksView() {
        const taskListEl = document.getElementById('taskListContainer');
        const emptyStateEl = document.getElementById('taskEmptyState');
        const smartOrganizerContainer = document.getElementById('tasksSmartOrganizerBanner');

        // Render Smart Task Organizer Priority Banner on Tasks View
        if (smartOrganizerContainer && window.SmartTaskOrganizer) {
            const topTask = window.SmartTaskOrganizer.getTopPrioritizedTasks(1)[0];
            if (topTask) {
                smartOrganizerContainer.innerHTML = `
                    <div class="smart-task-alert-card">
                        <div class="smart-alert-badge">⚡ SMART TASK ORGANIZER PRIORITY</div>
                        <div class="smart-alert-body">
                            <div class="smart-alert-title">${escapeHtml(topTask.title)}</div>
                            <div class="smart-alert-meta">
                                <span>${topTask.reasonTag}</span>
                                <span>•</span>
                                <span>Priority: ${topTask.priority}</span>
                                <span>•</span>
                                <span>Due: ${topTask.dueDate || 'No Date'}</span>
                            </div>
                        </div>
                        <button class="btn-sm-primary" onclick="window.LifeSyncApp.handleQuickTaskToggle('${topTask.id}')">✓ Mark Done</button>
                    </div>
                `;
                smartOrganizerContainer.style.display = 'block';
            } else {
                smartOrganizerContainer.style.display = 'none';
            }
        }

        const tasks = window.TasksModule.getFilteredAndSortedTasks();
        const stats = window.TasksModule.getStats();

        // Update task stats cards
        const countTotal = document.getElementById('taskCountTotal');
        const countPending = document.getElementById('taskCountPending');
        const countCompleted = document.getElementById('taskCountCompleted');
        const countOverdue = document.getElementById('taskCountOverdue');

        if (countTotal) countTotal.textContent = stats.total;
        if (countPending) countPending.textContent = stats.pending;
        if (countCompleted) countCompleted.textContent = stats.completed;
        if (countOverdue) countOverdue.textContent = stats.overdue;

        if (!taskListEl) return;

        if (tasks.length === 0) {
            taskListEl.innerHTML = '';
            if (emptyStateEl) emptyStateEl.style.display = 'block';
        } else {
            if (emptyStateEl) emptyStateEl.style.display = 'none';
            taskListEl.innerHTML = tasks.map(task => {
                const isCompleted = task.status === 'Completed';
                const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && !isCompleted;
                const priorityClass = task.priority.toLowerCase() === 'high' ? 'priority-high' : task.priority.toLowerCase() === 'medium' ? 'priority-med' : 'priority-low';

                return `
                    <div class="task-card-row ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue-border' : ''}">
                        <label class="custom-checkbox-wrap" title="Toggle task completion">
                            <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="window.LifeSyncApp.toggleTask('${task.id}')">
                            <span class="checkbox-box"></span>
                        </label>
                        <div class="task-info-block">
                            <div class="task-row-title ${isCompleted ? 'line-through' : ''}">${escapeHtml(task.title)}</div>
                            ${task.description ? `<div class="task-row-desc">${escapeHtml(task.description)}</div>` : ''}
                            <div class="task-row-badges">
                                <span class="priority-pill ${priorityClass}">${task.priority}</span>
                                <span class="category-pill">${task.category}</span>
                                ${task.dueDate ? `<span class="deadline-pill ${isOverdue ? 'pill-overdue' : ''}">📅 ${task.dueDate}</span>` : ''}
                                <span class="status-pill status-${task.status.toLowerCase().replace(' ', '-')}">${task.status}</span>
                            </div>
                        </div>
                        <div class="task-actions-btns">
                            <button class="btn-icon-soft" title="Edit Task" onclick="window.LifeSyncApp.openEditTaskModal('${task.id}')">✏️</button>
                            <button class="btn-icon-soft btn-icon-danger" title="Delete Task" onclick="window.LifeSyncApp.deleteTask('${task.id}')">🗑️</button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // ==========================================
    // 4b. SMART TASK ORGANIZER VIEW RENDERER
    // ==========================================
    function renderSmartOrganizerView() {
        const container = document.getElementById('smartOrganizerTaskList');
        const emptyState = document.getElementById('smartOrganizerEmpty');
        const topBannerEl = document.getElementById('smartTopPriorityBanner');
        const totalBadge = document.getElementById('smartTotalBadge');

        if (!container) return;

        const prioritizedTasks = window.SmartTaskOrganizer ? window.SmartTaskOrganizer.getPrioritizedTasks() : [];

        if (totalBadge) totalBadge.textContent = prioritizedTasks.length + ' tasks';

        if (prioritizedTasks.length === 0) {
            container.innerHTML = '';
            if (emptyState) emptyState.style.display = 'block';
            if (topBannerEl) topBannerEl.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Top priority banner (top 1 task)
        const topTask = prioritizedTasks[0];
        if (topBannerEl && topTask) {
            const urgencyClass = topTask.reasonType === 'danger' ? 'urgency-danger' : topTask.reasonType === 'warning' ? 'urgency-warning' : topTask.reasonType === 'exam' ? 'urgency-exam' : 'urgency-info';
            topBannerEl.innerHTML = `
                <div class="smart-top-banner ${urgencyClass}">
                    <div class="smart-top-icon">⚡</div>
                    <div class="smart-top-info">
                        <div class="smart-top-label">TOP PRIORITY RIGHT NOW</div>
                        <div class="smart-top-title">${escapeHtml(topTask.title)}</div>
                        <div class="smart-top-meta">
                            <span class="reason-tag reason-${topTask.reasonType}">${topTask.reasonTag}</span>
                            <span class="smart-score-badge">Score: ${topTask.smartScore}</span>
                        </div>
                    </div>
                    <button class="btn-sm-primary" onclick="window.LifeSyncApp.handleQuickTaskToggle('${topTask.id}')">✓ Mark Done</button>
                </div>
            `;
            topBannerEl.style.display = 'block';
        }

        // Full ranked task list
        container.innerHTML = prioritizedTasks.map((task, idx) => {
            const priorityClass = task.priority === 'High' ? 'priority-high' : task.priority === 'Medium' ? 'priority-med' : 'priority-low';
            const urgencyBarWidth = Math.min(100, Math.round((task.smartScore / 200) * 100));
            const urgencyColor = task.reasonType === 'danger' ? '#ef4444' : task.reasonType === 'warning' ? '#f59e0b' : task.reasonType === 'exam' ? '#8b5cf6' : '#3b82f6';
            return `
                <div class="smart-task-row">
                    <div class="smart-rank-badge">#${idx + 1}</div>
                    <label class="custom-checkbox-wrap" title="Mark done & re-rank">
                        <input type="checkbox" onchange="window.LifeSyncApp.toggleTaskAndRefreshSmart('${task.id}')">
                        <span class="checkbox-box"></span>
                    </label>
                    <div class="smart-task-info">
                        <div class="smart-task-title">${escapeHtml(task.title)}</div>
                        <div class="smart-task-meta">
                            <span class="priority-pill ${priorityClass}">${task.priority}</span>
                            <span class="category-pill">${task.category}</span>
                            ${task.dueDate ? `<span class="deadline-pill">📅 ${task.dueDate}</span>` : ''}
                            <span class="reason-tag reason-${task.reasonType}">${task.reasonTag}</span>
                        </div>
                        <div class="smart-urgency-bar-wrap">
                            <div class="smart-urgency-bar" style="width: ${urgencyBarWidth}%; background: ${urgencyColor};"></div>
                        </div>
                    </div>
                    <div class="smart-score-col">
                        <div class="smart-score-circle" style="border-color: ${urgencyColor};">${task.smartScore}</div>
                        <span class="smart-score-label">score</span>
                    </div>
                    <div class="task-actions-btns">
                        <button class="btn-icon-soft" title="Edit Task" onclick="window.LifeSyncApp.openEditTaskModal('${task.id}')">✏️</button>
                        <button class="btn-icon-soft btn-icon-danger" title="Delete Task" onclick="window.LifeSyncApp.deleteTask('${task.id}')">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==========================================
    // 5. CALENDAR VIEW RENDERER
    // ==========================================
    function renderCalendarView() {
        const monthYearEl = document.getElementById('calMonthYear');
        const calendarGrid = document.getElementById('calendarDaysGrid');
        const dayItemsList = document.getElementById('calSelectedDayItems');
        const selectedDateDisplay = document.getElementById('calSelectedDateDisplay');

        if (!calendarGrid) return;

        const activeDate = window.CalendarModule.getActiveDate();
        const selectedDate = window.CalendarModule.getSelectedDate();

        const year = activeDate.getFullYear();
        const month = activeDate.getMonth();

        if (monthYearEl) {
            monthYearEl.textContent = activeDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }

        // Days calculation
        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

        calendarGrid.innerHTML = '';

        // Empty padding cells for start of month
        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'cal-day-cell cal-empty-cell';
            calendarGrid.appendChild(emptyCell);
        }

        // Active month day cells
        for (let day = 1; day <= totalDaysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'cal-day-cell';

            const cellDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (cellDateStr === todayStr) cell.classList.add('today');
            if (cellDateStr === selectedDateStr) cell.classList.add('selected');

            // Find items for this date
            const items = window.CalendarModule.getItemsForDate(cellDateStr);

            let dotsHtml = '';
            if (items.length > 0) {
                dotsHtml = `<div class="cal-cell-dots">` + items.slice(0, 3).map(item => {
                    const isExam = (item.category || '').toLowerCase() === 'exam';
                    const isTask = item.itemType === 'task';
                    return `<span class="cell-dot ${isExam ? 'dot-exam' : isTask ? 'dot-task' : 'dot-event'}" title="${escapeHtml(item.title)}"></span>`;
                }).join('') + (items.length > 3 ? `<span class="cell-dot-more">+${items.length - 3}</span>` : '') + `</div>`;
            }

            cell.innerHTML = `
                <span class="day-number">${day}</span>
                ${dotsHtml}
            `;

            cell.addEventListener('click', () => {
                window.CalendarModule.setSelectedDate(new Date(year, month, day));
                renderCalendarView();
            });

            calendarGrid.appendChild(cell);
        }

        // Render selected day's items drawer
        if (selectedDateDisplay) {
            selectedDateDisplay.textContent = selectedDate.toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
            });
        }

        if (dayItemsList) {
            const dayItems = window.CalendarModule.getItemsForDate(selectedDateStr);
            if (dayItems.length === 0) {
                dayItemsList.innerHTML = `
                    <div class="empty-day-events">
                        <span>☕</span>
                        <p>No commitments scheduled for this day.</p>
                        <button class="btn-sm-primary" onclick="window.LifeSyncApp.openAddEventModal('${selectedDateStr}')">+ Add Event / Exam</button>
                    </div>
                `;
            } else {
                dayItemsList.innerHTML = dayItems.map(item => {
                    const isTask = item.itemType === 'task';
                    const isExam = (item.category || '').toLowerCase() === 'exam';
                    return `
                        <div class="day-item-card ${isTask ? 'item-task' : 'item-event'} ${isExam ? 'item-exam' : ''}">
                            <div class="day-item-main">
                                <div class="day-item-badge">${isExam ? '🎯 EXAM' : isTask ? '📝 TASK DEADLINE' : '📅 EVENT'}</div>
                                <div class="day-item-title">${escapeHtml(item.title)}</div>
                                ${item.description ? `<div class="day-item-desc">${escapeHtml(item.description)}</div>` : ''}
                                <div class="day-item-meta">
                                    <span>🕒 ${item.time || 'All Day'}</span>
                                    <span>•</span>
                                    <span class="category-pill">${item.category}</span>
                                    <span class="priority-pill priority-${(item.priority || 'medium').toLowerCase()}">${item.priority}</span>
                                </div>
                            </div>
                            <div class="day-item-actions">
                                ${isTask ? `
                                    <button class="btn-sm-action" onclick="window.LifeSyncApp.handleQuickTaskToggle('${item.id}')">✓ Mark Done</button>
                                ` : `
                                    <button class="btn-icon-soft btn-icon-danger" title="Delete Event" onclick="window.LifeSyncApp.deleteEvent('${item.id}')">🗑️</button>
                                `}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    // ==========================================
    // 6. BUDGET VIEW RENDERER (Original Features Retained)
    // ==========================================
    let currentBudgetSubTab = 'overview';

    function switchBudgetSubTab(subTabId) {
        currentBudgetSubTab = subTabId;
        
        // Update subnav buttons
        const subBtns = document.querySelectorAll('.bsub-btn');
        subBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.bsub === subTabId);
        });

        // Update sub-views
        const subViews = document.querySelectorAll('.bsub-view');
        subViews.forEach(v => {
            v.classList.toggle('active', v.id === `bsub-view-${subTabId}`);
        });

        renderBudgetView();
    }

    function renderBudgetView() {
        const summary = window.BudgetModule.getSummary();
        const budgetState = window.BudgetModule.getBudget();
        const profile = window.ProfileModule ? window.ProfileModule.getProfile() : (window.LifeSyncStorage.getProfile(currentUser) || {});

        // 1. Streak & Gamification Header
        const streakCountEl = document.getElementById('budgetStreakCount');
        if (streakCountEl) streakCountEl.textContent = (profile && profile.budgetStreak !== undefined) ? profile.budgetStreak : 0;

        const btnReview = document.getElementById('btnReviewBudget');
        const todayStr = new Date().toISOString().split('T')[0];
        if (btnReview) {
            if (profile.lastBudgetReviewDate === todayStr) {
                btnReview.textContent = '✓ Reviewed Today 🔥';
                btnReview.classList.add('reviewed');
                btnReview.disabled = true;
            } else {
                btnReview.textContent = '✓ Review Budget (+50 XP)';
                btnReview.classList.remove('reviewed');
                btnReview.disabled = false;
            }
        }

        // 2. Overview Metric Cards
        const valTotalIncome = document.getElementById('budgetValTotalIncome');
        const valTotalExpense = document.getElementById('budgetValTotalExpense');
        const valNetBalance = document.getElementById('budgetValNetBalance');
        const valMonthlySpent = document.getElementById('budgetValMonthlySpent');
        const valMonthlyLimit = document.getElementById('budgetValMonthlyLimit');
        const valRemainingBudget = document.getElementById('budgetValRemainingBudget');
        const budgetUsageBar = document.getElementById('budgetViewUsageBar');
        const budgetUsagePctLabel = document.getElementById('budgetUsagePctLabel');
        const budgetViewAlert = document.getElementById('budgetViewAlertBox');

        if (valTotalIncome) valTotalIncome.textContent = '₹' + Math.round(summary.totalIncome).toLocaleString('en-IN');
        if (valTotalExpense) valTotalExpense.textContent = '₹' + Math.round(summary.totalExpense).toLocaleString('en-IN');
        if (valNetBalance) valNetBalance.textContent = '₹' + Math.round(summary.totalBalance).toLocaleString('en-IN');
        if (valMonthlySpent) valMonthlySpent.textContent = '₹' + Math.round(summary.spentThisMonth).toLocaleString('en-IN');
        if (valMonthlyLimit) valMonthlyLimit.textContent = '₹' + Math.round(summary.monthlyBudget).toLocaleString('en-IN');
        if (valRemainingBudget) valRemainingBudget.textContent = '₹' + Math.round(summary.remainingBudget).toLocaleString('en-IN');
        if (budgetUsagePctLabel) budgetUsagePctLabel.textContent = `${summary.budgetUsagePct}%`;

        if (budgetUsageBar) {
            budgetUsageBar.style.width = `${summary.budgetUsagePct}%`;
            budgetUsageBar.style.background = summary.isExceeded ? '#db4665' : summary.isWarning ? '#f5a623' : 'linear-gradient(90deg, #7048e8, #9d74f7)';
        }

        if (budgetViewAlert) {
            if (summary.isExceeded) {
                budgetViewAlert.className = 'budget-warning-banner banner-danger';
                budgetViewAlert.innerHTML = `⚠️ Monthly limit exceeded by ₹${Math.round(summary.spentThisMonth - summary.monthlyBudget).toLocaleString('en-IN')}! Review non-essential spends.`;
                budgetViewAlert.style.display = 'block';
            } else if (summary.isWarning) {
                budgetViewAlert.className = 'budget-warning-banner banner-warning';
                budgetViewAlert.innerHTML = `💳 Spending warning: ${summary.budgetUsagePct}% of your monthly allowance used already.`;
                budgetViewAlert.style.display = 'block';
            } else {
                budgetViewAlert.style.display = 'none';
            }
        }

        // 3. Transactions History (Overview)
        const txListContainer = document.getElementById('budgetTransactionsList');
        if (txListContainer) {
            if (budgetState.transactions.length === 0) {
                txListContainer.innerHTML = `<div class="empty-list-notice">No transactions logged yet. Click "+ Add Transaction" above!</div>`;
            } else {
                txListContainer.innerHTML = budgetState.transactions.slice(0, 10).map(tx => {
                    const isIncome = tx.type === 'income';
                    return `
                        <div class="transaction-row">
                            <div class="tx-icon-pill ${isIncome ? 'icon-income' : 'icon-expense'}">
                                ${isIncome ? '📥' : '📤'}
                            </div>
                            <div class="tx-info">
                                <div class="tx-title">${escapeHtml(tx.title)}</div>
                                <div class="tx-meta">
                                    <span>${tx.date}</span>
                                    <span>•</span>
                                    <span>${tx.category}</span>
                                    ${tx.description ? `<span>•</span> <span>${escapeHtml(tx.description)}</span>` : ''}
                                </div>
                            </div>
                            <div class="tx-amount-col">
                                <span class="tx-amount ${isIncome ? 'income-text' : 'expense-text'}">
                                    ${isIncome ? '+' : '-'}₹${Math.round(tx.amount).toLocaleString('en-IN')}
                                </span>
                                <button class="btn-icon-xs" title="Delete Transaction" onclick="window.LifeSyncApp.deleteTransaction('${tx.id}')">✕</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // 4. Financial Runway Calculations & Bars
        const runwaySum = (budgetState.runway && budgetState.runway.sum) || 20000;
        const runwayBuffer = (budgetState.runway && budgetState.runway.bufferPct !== undefined) ? budgetState.runway.bufferPct : 15;
        const runwayCalc = window.BudgetModule.calculateRunwayValues(runwaySum, runwayBuffer);

        // Update Overview Mini Runway Preview
        const dashRunwayBars = document.getElementById('dashRunwayBars');
        const dashRunwayTotalVal = document.getElementById('dashRunwayTotalVal');
        const dashRunwayCapVal = document.getElementById('dashRunwayCapVal');
        if (dashRunwayTotalVal) dashRunwayTotalVal.textContent = '₹' + runwayCalc.total.toLocaleString('en-IN');
        if (dashRunwayCapVal) dashRunwayCapVal.textContent = '₹' + runwayCalc.base.toLocaleString('en-IN');

        const months = ['Sep', 'Oct', 'Nov', 'Dec'];
        const maxVal = Math.max(...runwayCalc.values, 1);

        if (dashRunwayBars) {
            dashRunwayBars.innerHTML = runwayCalc.values.map((val, idx) => {
                const heightPct = Math.max(25, Math.round((val / maxVal) * 100));
                return `
                    <div class="runway-col">
                        <div class="runway-bar-track">
                            <div class="runway-bar-fill" style="height: ${heightPct}%;"></div>
                        </div>
                        <span class="runway-month-label">${months[idx]}</span>
                        <span class="runway-amount-label">₹${val}</span>
                    </div>
                `;
            }).join('');
        }

        // Update Dedicated Runway Sub-View
        const runwaySumInput = document.getElementById('runwaySumInput');
        const runwayBufferRange = document.getElementById('runwayBufferRange');
        const runwayBufferLabel = document.getElementById('runwayBufferLabel');
        const runwayKpiCap = document.getElementById('runwayKpiCap');
        const runwayResultTotal = document.getElementById('runwayResultTotal');
        const runwayResultBuffer = document.getElementById('runwayResultBuffer');
        const runwayResultUsable = document.getElementById('runwayResultUsable');
        const runwayResultMonthly = document.getElementById('runwayResultMonthly');
        const runwayBarsContainer = document.getElementById('runwayBarsContainer');

        if (runwaySumInput && document.activeElement !== runwaySumInput) runwaySumInput.value = runwayCalc.total;
        if (runwayBufferRange && document.activeElement !== runwayBufferRange) runwayBufferRange.value = runwayCalc.buffer;
        if (runwayBufferLabel) runwayBufferLabel.textContent = `${runwayCalc.buffer}%`;
        if (runwayKpiCap) runwayKpiCap.textContent = '₹' + runwayCalc.base.toLocaleString('en-IN');
        if (runwayResultTotal) runwayResultTotal.textContent = '₹' + runwayCalc.total.toLocaleString('en-IN');
        if (runwayResultBuffer) runwayResultBuffer.textContent = '₹' + Math.round(runwayCalc.total * (runwayCalc.buffer / 100)).toLocaleString('en-IN');
        if (runwayResultUsable) runwayResultUsable.textContent = '₹' + runwayCalc.usable.toLocaleString('en-IN');
        if (runwayResultMonthly) runwayResultMonthly.textContent = '₹' + runwayCalc.base.toLocaleString('en-IN');

        if (runwayBarsContainer) {
            runwayBarsContainer.innerHTML = runwayCalc.values.map((val, idx) => {
                const heightPct = Math.max(20, Math.round((val / maxVal) * 100));
                return `
                    <div class="interactive-bar-col">
                        <span class="bar-val-bubble">₹${val}</span>
                        <div class="interactive-bar-track">
                            <div class="interactive-bar-fill" style="height: ${heightPct}%;"></div>
                        </div>
                        <strong class="bar-month-title">${months[idx]}</strong>
                    </div>
                `;
            }).join('');
        }

        // 5. Peer Benchmark View
        const benchmarkListContainer = document.getElementById('benchmarkListContainer');
        if (benchmarkListContainer) {
            const benchData = window.BudgetModule.getBenchmarkData();
            benchmarkListContainer.innerHTML = benchData.map(item => {
                const max = Math.max(item.you, item.peer);
                const pctYou = Math.round((item.you / max) * 100);
                const pctPeer = Math.round((item.peer / max) * 100);
                const isBelow = item.you < item.peer;
                const diff = Math.abs(item.peer - item.you);

                return `
                    <div class="benchmark-card">
                        <div class="benchmark-card-head">
                            <strong>${escapeHtml(item.name)}</strong>
                            <span class="badge-diff ${isBelow ? 'diff-below' : 'diff-above'}">
                                ${isBelow ? '₹' + diff + ' below avg' : '₹' + diff + ' above avg'}
                            </span>
                        </div>
                        <div class="benchmark-dual-bars">
                            <div class="bench-row">
                                <span class="bench-label">You</span>
                                <div class="bench-track">
                                    <div class="bench-fill fill-you" style="width: ${pctYou}%;"></div>
                                </div>
                                <strong class="bench-amount">₹${item.you}</strong>
                            </div>
                            <div class="bench-row">
                                <span class="bench-label">Peers</span>
                                <div class="bench-track">
                                    <div class="bench-fill fill-peers" style="width: ${pctPeer}%;"></div>
                                </div>
                                <strong class="bench-amount bench-muted">₹${item.peer}</strong>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 6. Late-Night Safe (Overview + Dedicated View)
        const night = budgetState.nightSafe || { limit: 500, spent: 120, locked: false };
        const nightRemaining = Math.max(0, night.limit - night.spent);
        const nightSpentPct = Math.min(100, Math.round((night.spent / night.limit) * 100));

        // Overview night widget
        const nightSafeLimit = document.getElementById('budgetNightSafeLimit');
        const nightSafeRemaining = document.getElementById('budgetNightSafeRemaining');
        const nightSafeBtn = document.getElementById('btnToggleNightSafe');
        if (nightSafeLimit) nightSafeLimit.textContent = '₹' + night.limit;
        if (nightSafeRemaining) nightSafeRemaining.textContent = '₹' + nightRemaining;
        if (nightSafeBtn) nightSafeBtn.textContent = night.locked ? '🔓 Unlock Wallet' : '🔒 Lock Night Spending';

        // Dedicated night sub-view
        const nightSafeBigIcon = document.getElementById('nightSafeBigIcon');
        const nightSafeStatusTitle = document.getElementById('nightSafeStatusTitle');
        const nightSafeStatusSubtitle = document.getElementById('nightSafeStatusSubtitle');
        const btnNightSafeBigToggle = document.getElementById('btnNightSafeBigToggle');
        const nightDedicatedLimit = document.getElementById('nightDedicatedLimit');
        const nightDedicatedSpent = document.getElementById('nightDedicatedSpent');
        const nightDedicatedRemaining = document.getElementById('nightDedicatedRemaining');
        const nightDedicatedUsagePct = document.getElementById('nightDedicatedUsagePct');
        const nightDedicatedBar = document.getElementById('nightDedicatedBar');

        if (nightSafeBigIcon) nightSafeBigIcon.textContent = night.locked ? '🔒' : '🔓';
        if (nightSafeStatusTitle) nightSafeStatusTitle.textContent = night.locked ? 'Night Wallet is Locked 🔒' : 'Night Wallet is Unlocked 🔓';
        if (nightSafeStatusSubtitle) {
            nightSafeStatusSubtitle.textContent = night.locked
                ? 'Curfew protection active. Spends blocked so tomorrow-you stays on track.'
                : `Active limit: ₹${night.limit}. Keep late-night munchies within budget.`;
        }
        if (btnNightSafeBigToggle) {
            btnNightSafeBigToggle.textContent = night.locked ? '🔓 Unlock Wallet' : '🔒 Lock Night Wallet';
            btnNightSafeBigToggle.className = night.locked ? 'btn-secondary' : 'btn-primary';
        }
        if (nightDedicatedLimit) nightDedicatedLimit.textContent = '₹' + night.limit;
        if (nightDedicatedSpent) nightDedicatedSpent.textContent = '₹' + night.spent;
        if (nightDedicatedRemaining) nightDedicatedRemaining.textContent = '₹' + nightRemaining;
        if (nightDedicatedUsagePct) nightDedicatedUsagePct.textContent = `${nightSpentPct}%`;
        if (nightDedicatedBar) nightDedicatedBar.style.width = `${nightSpentPct}%`;

        // 7. Bills & Goals (Splitter + Savings Goal + Dedicated Bills List)
        // Calculator
        calculateBillSplit();

        // Shared Goal
        const goal = budgetState.sharedGoal || { title: 'Emergency / Tech Fund', current: 4500, target: 8000, etaWeeks: 4 };
        const goalCurrent = Number(goal.current) || 0;
        const goalTarget = Number(goal.target) || 8000;
        const goalPct = Math.min(100, Math.round((goalCurrent / goalTarget) * 100));
        const goalRemaining = Math.max(0, goalTarget - goalCurrent);

        const goalTitleDisplay = document.getElementById('goalTitleDisplay');
        const goalCurrentDisplay = document.getElementById('goalCurrentDisplay');
        const goalTargetDisplay = document.getElementById('goalTargetDisplay');
        const goalProgressBar = document.getElementById('goalProgressBar');
        const goalPctDisplay = document.getElementById('goalPctDisplay');
        const goalEtaDisplay = document.getElementById('goalEtaDisplay');
        const goalRemainingDisplay = document.getElementById('goalRemainingDisplay');

        if (goalTitleDisplay) goalTitleDisplay.textContent = goal.title;
        if (goalCurrentDisplay) goalCurrentDisplay.textContent = '₹' + goalCurrent.toLocaleString('en-IN');
        if (goalTargetDisplay) goalTargetDisplay.textContent = '₹' + goalTarget.toLocaleString('en-IN');
        if (goalProgressBar) goalProgressBar.style.width = `${goalPct}%`;
        if (goalPctDisplay) goalPctDisplay.textContent = `${goalPct}%`;
        if (goalEtaDisplay) goalEtaDisplay.textContent = `${goal.etaWeeks || 4} weeks`;
        if (goalRemainingDisplay) goalRemainingDisplay.textContent = '₹' + goalRemaining.toLocaleString('en-IN');

        // Dedicated Bills Grid
        const billsGrid = document.getElementById('budgetBillsDedicatedList');
        if (billsGrid) {
            if (budgetState.bills.length === 0) {
                billsGrid.innerHTML = `<div class="empty-list-notice">No shared bills. Click "+ Add Shared Bill" above to split with roommates!</div>`;
            } else {
                billsGrid.innerHTML = budgetState.bills.map(b => {
                    const yourShare = Math.round(b.amount / (b.split || 1));
                    return `
                        <div class="bill-card ${b.paid ? 'bill-paid' : ''}">
                            <div class="bill-header">
                                <span class="bill-title">${escapeHtml(b.title)}</span>
                                <span class="bill-badge ${b.paid ? 'badge-paid' : 'badge-pending'}">${b.paid ? 'PAID' : 'DUE'}</span>
                            </div>
                            <div class="bill-amount-line">Your share: <strong>₹${yourShare.toLocaleString('en-IN')}</strong> <small>(₹${b.amount} ÷ ${b.split} people)</small></div>
                            <div class="bill-due-date">Due: ${b.date}</div>
                            <div class="bill-actions">
                                <button class="btn-sm-action" onclick="window.LifeSyncApp.toggleBill('${b.id}')">
                                    ${b.paid ? '↩ Mark Pending' : '✓ Mark Paid'}
                                </button>
                                <button class="btn-icon-soft btn-icon-danger" onclick="window.LifeSyncApp.deleteBill('${b.id}')" title="Delete">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    function calculateBillSplit() {
        const billInput = document.getElementById('calcBillAmount');
        const peopleInput = document.getElementById('calcBillPeople');
        const resultEl = document.getElementById('calcBillPerPerson');
        if (!billInput || !peopleInput || !resultEl) return;

        const bill = Math.max(0, Number(billInput.value) || 0);
        const people = Math.max(1, Number(peopleInput.value) || 1);
        const share = Math.round(bill / people);
        resultEl.textContent = '₹' + share.toLocaleString('en-IN');
    }

    // ==========================================
    // 7. WELLNESS VIEW RENDERER (Independent Module)
    // ==========================================
    function renderWellnessView() {
        const todayEntry = window.WellnessModule.getTodayEntry();
        const summary = window.WellnessModule.getSummary();

        const streakEl = document.getElementById('wellnessStreakVal');
        const daysTrackedEl = document.getElementById('wellnessDaysTrackedVal');
        const avgScoreEl = document.getElementById('wellnessAvgScoreVal');
        const chartGridEl = document.getElementById('wellnessChartGrid');
        const statusMsgEl = document.getElementById('wellnessStatusMsg');
        const entriesHistoryEl = document.getElementById('wellnessEntriesHistory');

        if (streakEl) streakEl.textContent = `${summary.streak} Days 🔥`;
        if (daysTrackedEl) daysTrackedEl.textContent = summary.daysTracked;
        if (avgScoreEl) avgScoreEl.textContent = summary.averageScore + (summary.averageScore !== '--' ? '/5' : '');
        if (statusMsgEl) statusMsgEl.textContent = summary.reportMessage;

        // If today's entry exists, pre-select emoji
        const moodButtons = document.querySelectorAll('.mood-pick-btn');
        moodButtons.forEach(btn => {
            if (todayEntry && btn.dataset.mood === todayEntry.mood) {
                btn.classList.add('selected');
            } else {
                btn.classList.remove('selected');
            }
        });

        const stressInput = document.getElementById('wellnessStressInput');
        const energyInput = document.getElementById('wellnessEnergyInput');
        const notesInput = document.getElementById('wellnessNotesInput');

        if (todayEntry) {
            if (stressInput) stressInput.value = todayEntry.stress;
            if (energyInput) energyInput.value = todayEntry.energy;
            if (notesInput) notesInput.value = todayEntry.description || '';
        }

        // Render 7-Day Chart
        if (chartGridEl && summary.weeklyDays) {
            chartGridEl.innerHTML = summary.weeklyDays.map(d => {
                const hasEntry = d.entry !== null;
                const heightPct = hasEntry ? Math.max(25, d.entry.score * 20) : 10;
                const emoji = hasEntry ? d.entry.emoji : '·';
                return `
                    <div class="wellness-bar-col">
                        <div class="bar-fill-track">
                            <div class="bar-fill-actual ${hasEntry ? 'filled' : 'empty'}" style="height: ${heightPct}%;"></div>
                        </div>
                        <span class="bar-emoji">${emoji}</span>
                        <span class="bar-day-name">${d.dayName}</span>
                    </div>
                `;
            }).join('');
        }

        // Render Reflection History
        if (entriesHistoryEl) {
            const entries = window.WellnessModule.getWellness().entries || [];
            if (entries.length === 0) {
                entriesHistoryEl.innerHTML = `<div class="empty-list-notice">No reflections recorded yet. Select how you feel today above!</div>`;
            } else {
                const reversed = [...entries].reverse().slice(0, 7);
                entriesHistoryEl.innerHTML = reversed.map(e => `
                    <div class="wellness-entry-row">
                        <div class="entry-emoji-box">${e.emoji}</div>
                        <div class="entry-details">
                            <div class="entry-header-line">
                                <strong>${e.name}</strong>
                                <span>${e.date}</span>
                            </div>
                            ${e.description ? `<p class="entry-notes-quote">"${escapeHtml(e.description)}"</p>` : ''}
                            <div class="entry-levels-line">
                                <span>Stress: ${e.stress || 2}/5</span>
                                <span>•</span>
                                <span>Energy: ${e.energy || 3}/5</span>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    // ==========================================
    // 8. ANALYTICS VIEW RENDERER
    // ==========================================
    function renderAnalyticsView() {
        const metrics = window.AnalyticsModule.getComprehensiveMetrics();

        // Productivity
        const prodRateEl = document.getElementById('analyticsProdRate');
        const prodCompletedEl = document.getElementById('analyticsProdCompleted');
        const prodOverdueEl = document.getElementById('analyticsProdOverdue');
        const weeklyBarsEl = document.getElementById('analyticsWeeklyBars');

        if (prodRateEl) prodRateEl.textContent = `${metrics.productivity.completionRate}%`;
        if (prodCompletedEl) prodCompletedEl.textContent = metrics.productivity.completed;
        if (prodOverdueEl) prodOverdueEl.textContent = metrics.productivity.overdue;

        if (weeklyBarsEl && metrics.productivity.weeklyTrend) {
            const maxVal = Math.max(...metrics.productivity.weeklyTrend.map(w => w.count), 1);
            weeklyBarsEl.innerHTML = metrics.productivity.weeklyTrend.map(w => {
                const heightPct = Math.max(15, Math.round((w.count / maxVal) * 100));
                return `
                    <div class="analytics-bar-col">
                        <span class="bar-val-label">${w.count}</span>
                        <div class="analytics-bar-track">
                            <div class="analytics-bar-fill" style="height: ${heightPct}%;"></div>
                        </div>
                        <span class="bar-axis-label">${w.day}</span>
                    </div>
                `;
            }).join('');
        }

        // Finance breakdown
        const finIncomeEl = document.getElementById('analyticsFinIncome');
        const finExpenseEl = document.getElementById('analyticsFinExpense');
        const finUsageEl = document.getElementById('analyticsFinUsage');
        const finCatsEl = document.getElementById('analyticsFinCategories');

        if (finIncomeEl) finIncomeEl.textContent = '₹' + Math.round(metrics.finance.totalIncome).toLocaleString('en-IN');
        if (finExpenseEl) finExpenseEl.textContent = '₹' + Math.round(metrics.finance.totalExpense).toLocaleString('en-IN');
        if (finUsageEl) finUsageEl.textContent = `${metrics.finance.budgetUsagePct}%`;

        if (finCatsEl) {
            const cats = metrics.finance.categorySpending || {};
            const keys = Object.keys(cats);
            if (keys.length === 0) {
                finCatsEl.innerHTML = `<div class="empty-list-notice">No categorized expenses recorded yet.</div>`;
            } else {
                const totalSpent = metrics.finance.totalExpense || 1;
                finCatsEl.innerHTML = keys.map(k => {
                    const amt = cats[k];
                    const pct = Math.round((amt / totalSpent) * 100);
                    return `
                        <div class="cat-progress-row">
                            <div class="cat-progress-labels">
                                <span>${k}</span>
                                <strong>₹${Math.round(amt).toLocaleString('en-IN')} (${pct}%)</strong>
                            </div>
                            <div class="cat-progress-track">
                                <div class="cat-progress-fill" style="width: ${pct}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
    }

    // ==========================================
    // 9. PROFILE VIEW RENDERER
    // ==========================================
    function renderProfileView() {
        const profile = window.ProfileModule.getProfile(currentUser);

        const nameInput = document.getElementById('profileNameInput');
        const emailInput = document.getElementById('profileEmailInput');
        const uniInput = document.getElementById('profileUniInput');
        const majorInput = document.getElementById('profileMajorInput');
        const yearInput = document.getElementById('profileYearInput');
        const studentIdInput = document.getElementById('profileStudentIdInput');
        const avatarDisplay = document.getElementById('profileAvatarLetter');

        if (nameInput) nameInput.value = profile.name || '';
        if (emailInput) emailInput.value = profile.email || '';
        if (uniInput) uniInput.value = profile.university || '';
        if (majorInput) majorInput.value = profile.major || '';
        if (yearInput) yearInput.value = profile.yearSemester || '';
        if (studentIdInput) studentIdInput.value = profile.studentId || '';
        if (avatarDisplay) avatarDisplay.textContent = (profile.name || 'S').charAt(0).toUpperCase();
    }

    // ==========================================
    // 10. MODAL ACTIONS & DOM LISTENERS
    // ==========================================
    function showToast(msg, type = 'info') {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(msg)}</span>`;
        container.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    function openMobileSidebar() {
        const sidebar = document.getElementById('appSidebar');
        const backdrop = document.getElementById('appBackdrop');
        if (sidebar) sidebar.classList.add('mobile-open');
        if (backdrop) backdrop.classList.add('show');
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById('appSidebar');
        const backdrop = document.getElementById('appBackdrop');
        if (sidebar) sidebar.classList.remove('mobile-open');
        if (backdrop) backdrop.classList.remove('show');
    }

    function setupGlobalListeners() {
        // Mobile sidebar toggling
        const menuBtn = document.getElementById('btnMobileMenu');
        const backdrop = document.getElementById('appBackdrop');
        if (menuBtn) menuBtn.addEventListener('click', openMobileSidebar);
        if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);

        // Notification Bell
        const notifBtn = document.getElementById('btnNotificationTrigger');
        if (notifBtn) notifBtn.addEventListener('click', toggleNotificationDropdown);
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notifDropdown');
            if (dropdown && !dropdown.contains(e.target) && notifBtn && !notifBtn.contains(e.target)) {
                dropdown.classList.remove('show');
            }
        });

        // Logout
        const logoutBtn = document.getElementById('btnLogout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                // Clear session flag FIRST so auth.html doesn't auto-skip login
                sessionStorage.removeItem('ls_session_active');
                AuthSystem.signOut();
                showToast('Signed out successfully', 'info');
                setTimeout(() => {
                    window.location.replace('auth.html');
                }, 400);
            });
        }

        // Task Filters & Search in Tasks View
        const taskSearchInput = document.getElementById('taskSearchInput');
        const taskFilterStatus = document.getElementById('taskFilterStatus');
        const taskFilterCategory = document.getElementById('taskFilterCategory');
        const taskFilterPriority = document.getElementById('taskFilterPriority');
        const taskSortCriteria = document.getElementById('taskSortCriteria');

        const handleFilterChange = () => {
            window.TasksModule.setFilters({
                query: taskSearchInput ? taskSearchInput.value : '',
                status: taskFilterStatus ? taskFilterStatus.value : 'all',
                category: taskFilterCategory ? taskFilterCategory.value : 'all',
                priority: taskFilterPriority ? taskFilterPriority.value : 'all',
                sort: taskSortCriteria ? taskSortCriteria.value : 'deadline'
            });
            renderTasksView();
        };

        if (taskSearchInput) taskSearchInput.addEventListener('input', handleFilterChange);
        if (taskFilterStatus) taskFilterStatus.addEventListener('change', handleFilterChange);
        if (taskFilterCategory) taskFilterCategory.addEventListener('change', handleFilterChange);
        if (taskFilterPriority) taskFilterPriority.addEventListener('change', handleFilterChange);
        if (taskSortCriteria) taskSortCriteria.addEventListener('change', handleFilterChange);

        // Calendar Month Navigation
        const btnPrevMonth = document.getElementById('btnCalPrevMonth');
        const btnNextMonth = document.getElementById('btnCalNextMonth');
        const btnToday = document.getElementById('btnCalToday');

        if (btnPrevMonth) btnPrevMonth.addEventListener('click', () => {
            window.CalendarModule.prevMonth();
            renderCalendarView();
        });
        if (btnNextMonth) btnNextMonth.addEventListener('click', () => {
            window.CalendarModule.nextMonth();
            renderCalendarView();
        });
        if (btnToday) btnToday.addEventListener('click', () => {
            window.CalendarModule.resetToToday();
            renderCalendarView();
        });

        // Wellness Mood Selection Buttons
        const moodButtons = document.querySelectorAll('.mood-pick-btn');
        moodButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                moodButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });

        // Wellness Save Check-in
        const btnSaveWellness = document.getElementById('btnSaveWellnessCheckin');
        if (btnSaveWellness) {
            btnSaveWellness.addEventListener('click', () => {
                const selectedMoodBtn = document.querySelector('.mood-pick-btn.selected');
                if (!selectedMoodBtn) {
                    showToast('Please pick a mood emoji first!', 'error');
                    return;
                }
                const mood = selectedMoodBtn.dataset.mood;
                const stress = document.getElementById('wellnessStressInput').value;
                const energy = document.getElementById('wellnessEnergyInput').value;
                const notes = document.getElementById('wellnessNotesInput').value;

                try {
                    window.WellnessModule.saveCheckIn(currentUser, { mood, stress, energy, notes });
                    showToast("Today's check-in saved! 💜", 'success');
                    renderWellnessView();
                    updateNotifications();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        // Night Safe Spend Button
        const btnNightSafeSpend = document.getElementById('btnNightSafeSpend');
        if (btnNightSafeSpend) {
            btnNightSafeSpend.addEventListener('click', () => {
                const modal = document.getElementById('nightSpendModalOverlay');
                if (modal) {
                    const form = document.getElementById('nightSpendModalForm');
                    if (form) form.reset();
                    openModal('nightSpendModalOverlay');
                } else {
                    const amount = prompt("Enter amount spent tonight (₹):");
                    if (amount) {
                        window.LifeSyncApp.quickNightSpend(amount);
                    }
                }
            });
        }


        // Profile Form Submit
        const profileForm = document.getElementById('profileEditForm');
        if (profileForm) {
            profileForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const name = document.getElementById('profileNameInput').value;
                const uni = document.getElementById('profileUniInput').value;
                const major = document.getElementById('profileMajorInput').value;
                const year = document.getElementById('profileYearInput').value;
                const sid = document.getElementById('profileStudentIdInput').value;

                try {
                    window.ProfileModule.updateProfile(currentUser, {
                        name, university: uni, major, yearSemester: year, studentId: sid
                    });
                    currentUser.username = name;
                    renderHeader();
                    showToast('Profile updated successfully! ✨', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        // Task Form Submission Modal
        const taskForm = document.getElementById('taskFormModal');
        if (taskForm) {
            taskForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const editId = document.getElementById('taskEditId').value;
                const title = document.getElementById('taskTitleInput').value;
                const desc = document.getElementById('taskDescInput').value;
                const dueDate = document.getElementById('taskDueDateInput').value;
                const priority = document.getElementById('taskPriorityInput').value;
                const category = document.getElementById('taskCategoryInput').value;

                try {
                    if (editId) {
                        window.TasksModule.updateTask(currentUser, editId, {
                            title, description: desc, dueDate, priority, category
                        });
                        showToast('Task updated! ✓', 'success');
                    } else {
                        window.TasksModule.addTask(currentUser, {
                            title, description: desc, dueDate, priority, category
                        });
                        showToast('New task added! ✦', 'success');
                    }
                    closeModal('taskModalOverlay');
                    renderCurrentView();
                    if (currentTab !== 'tasks') {
                        renderTasksView();
                    }
                    updateNotifications();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        // Calendar Event Form Modal
        const eventForm = document.getElementById('eventFormModal');
        if (eventForm) {
            eventForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = document.getElementById('eventTitleInput').value;
                const date = document.getElementById('eventDateInput').value;
                const time = document.getElementById('eventTimeInput').value;
                const category = document.getElementById('eventCategoryInput').value;
                const priority = document.getElementById('eventPriorityInput').value;
                const desc = document.getElementById('eventDescInput').value;

                try {
                    window.CalendarModule.addEvent(currentUser, {
                        title, date, time, category, priority, description: desc, hasReminder: true
                    });
                    showToast('Event / Exam added to schedule! 📅', 'success');
                    closeModal('eventModalOverlay');
                    renderCalendarView();
                    updateNotifications();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        // Budget Transaction Form Modal
        const txForm = document.getElementById('txFormModal');
        if (txForm) {
            txForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = document.getElementById('txTitleInput').value;
                const amount = document.getElementById('txAmountInput').value;
                const type = document.getElementById('txTypeInput').value;
                const category = document.getElementById('txCategoryInput').value;
                const date = document.getElementById('txDateInput').value;
                const desc = document.getElementById('txDescInput').value;

                try {
                    window.BudgetModule.addTransaction(currentUser, {
                        title, amount, type, category, date, description: desc
                    });
                    showToast('Transaction recorded! 💰', 'success');
                    closeModal('txModalOverlay');
                    renderBudgetView();
                    updateNotifications();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        // Budget Bill Form Modal
        const billForm = document.getElementById('billFormModal');
        if (billForm) {
            billForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const title = document.getElementById('billTitleInput').value;
                const amount = document.getElementById('billAmountInput').value;
                const split = document.getElementById('billSplitInput').value;
                const date = document.getElementById('billDateInput').value;

                try {
                    window.BudgetModule.addBill(currentUser, { title, amount, split, date });
                    showToast('New shared bill added! 🧾', 'success');
                    closeModal('billModalOverlay');
                    renderBudgetView();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        // Goal Contribution Form Modal
        const goalForm = document.getElementById('goalContributionForm');
        if (goalForm) {
            goalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const amount = Number(document.getElementById('goalContributionAmount').value);
                const note = document.getElementById('goalContributionNote').value;
                try {
                    window.BudgetModule.addGoalContribution(currentUser, amount, note);
                    showToast(`Added ₹${amount.toLocaleString('en-IN')} to savings goal! 🎉 (+80 XP)`, 'success');
                    closeModal('goalModalOverlay');
                    renderBudgetView();
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        }

        // Real-time Runway Inputs
        const runwaySumInput = document.getElementById('runwaySumInput');
        const runwayBufferRange = document.getElementById('runwayBufferRange');
        if (runwaySumInput) {
            runwaySumInput.addEventListener('input', () => {
                const sum = Number(runwaySumInput.value) || 0;
                const buffer = Number(runwayBufferRange ? runwayBufferRange.value : 15) || 0;
                window.BudgetModule.updateRunway(currentUser, sum, buffer);
                renderBudgetView();
            });
        }
        if (runwayBufferRange) {
            runwayBufferRange.addEventListener('input', () => {
                const sum = Number(runwaySumInput ? runwaySumInput.value : 20000) || 0;
                const buffer = Number(runwayBufferRange.value) || 0;
                window.BudgetModule.updateRunway(currentUser, sum, buffer);
                renderBudgetView();
            });
        }

        // Real-time Bill Splitter Calculator
        const calcBillAmount = document.getElementById('calcBillAmount');
        const calcBillPeople = document.getElementById('calcBillPeople');
        if (calcBillAmount) calcBillAmount.addEventListener('input', calculateBillSplit);
        if (calcBillPeople) calcBillPeople.addEventListener('input', calculateBillSplit);

        // Budget Review Button
        const btnReviewBudget = document.getElementById('btnReviewBudget');
        if (btnReviewBudget) {
            btnReviewBudget.addEventListener('click', () => {
                const res = window.BudgetModule.reviewBudget(currentUser);
                showToast(res.message, res.reviewed ? 'success' : 'info');
                renderBudgetView();
            });
        }

        // Late-Night Safe Big and Small Toggles
        const btnNightSafeBigToggle = document.getElementById('btnNightSafeBigToggle');
        const btnToggleNightSafe = document.getElementById('btnToggleNightSafe');
        if (btnNightSafeBigToggle) btnNightSafeBigToggle.addEventListener('click', () => window.LifeSyncApp.quickNightSafeToggle());
        if (btnToggleNightSafe) btnToggleNightSafe.addEventListener('click', () => window.LifeSyncApp.quickNightSafeToggle());

        // Budget Settings Form
        const budgetSettingsForm = document.getElementById('budgetSettingsForm');
        if (budgetSettingsForm) {
            budgetSettingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const monthly = Number(document.getElementById('settingMonthlyBudgetInput').value);
                const nightLimit = Number(document.getElementById('settingNightLimitInput').value);
                const runwaySum = Number(document.getElementById('settingRunwaySumInput').value);
                const runwayBuffer = Number(document.getElementById('settingRunwayBufferInput').value);

                if (monthly > 0) window.BudgetModule.setMonthlyBudget(currentUser, monthly);
                if (nightLimit > 0) window.BudgetModule.setNightSafeLimit(currentUser, nightLimit);
                if (runwaySum > 0) window.BudgetModule.updateRunway(currentUser, runwaySum, runwayBuffer !== undefined ? runwayBuffer : 15);

                showToast('Budget settings updated successfully! ✨', 'success');
                closeModal('budgetSettingsModalOverlay');
                renderCurrentView();
            });
        }

        // Custom Night Spend Form
        const nightSpendModalForm = document.getElementById('nightSpendModalForm');
        if (nightSpendModalForm) {
            nightSpendModalForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const amount = Number(document.getElementById('customNightSpendAmount').value);
                if (amount > 0) {
                    try {
                        window.BudgetModule.recordNightSpend(currentUser, amount);
                        showToast(`Logged ₹${amount} late-night spend. 🌙`, 'success');
                        closeModal('nightSpendModalOverlay');
                        renderCurrentView();
                    } catch (err) {
                        showToast(err.message, 'warning');
                    }
                }
            });
        }

        // Modal Overlay Backdrop Click & Direct Listeners
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    closeModal(overlay.id);
                }
            });
        });

        // Close/Cut Button Click Listeners (both .modal-close and .modal-close-btn)
        document.querySelectorAll('.modal-overlay .modal-close, .modal-overlay .modal-close-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = btn.closest('.modal-overlay');
                if (overlay) closeModal(overlay.id);
            });
        });

        // Cancel Button Listeners (.btn-secondary inside .modal-actions)
        document.querySelectorAll('.modal-overlay .modal-actions .btn-secondary').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const overlay = btn.closest('.modal-overlay');
                if (overlay) closeModal(overlay.id);
            });
        });

        // Global Escape Key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeAllModals();
            }
        });

        // Listen for bfcache page restorations
        window.addEventListener('pageshow', (e) => {
            if (e.persisted) {
                const sessionActive = sessionStorage.getItem('ls_session_active');
                const user = AuthSystem.getCurrentUser();
                if (!user || !sessionActive) {
                    AuthSystem.signOut();
                    sessionStorage.removeItem('ls_session_active');
                    window.location.replace('auth.html');
                }
            }
        });
    }

    // Modal Helpers
    function openModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) {
            m.classList.remove('hidden');
            m.classList.add('show');
            const firstInput = m.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) setTimeout(() => firstInput.focus(), 50);
        }
    }

    function closeModal(modalId) {
        const m = document.getElementById(modalId);
        if (m) {
            m.classList.remove('show');
            m.classList.add('hidden');
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.remove('show');
            m.classList.add('hidden');
        });
    }

    // Exposed App actions
    window.LifeSyncApp = {
        switchTab,
        toggleTask(taskId) {
            window.TasksModule.toggleComplete(currentUser, taskId);
            renderCurrentView();
            if (currentTab !== 'tasks') {
                renderTasksView();
            }
            updateNotifications();
        },
        handleQuickTaskToggle(taskId) {
            window.TasksModule.toggleComplete(currentUser, taskId);
            showToast('Task marked as completed! 🎯', 'success');
            renderCurrentView();
            if (currentTab !== 'tasks') {
                renderTasksView();
            }
            updateNotifications();
        },
        deleteTask(taskId) {
            if (confirm('Delete this task?')) {
                window.TasksModule.deleteTask(currentUser, taskId);
                showToast('Task removed.', 'info');
                renderCurrentView();
                if (currentTab !== 'tasks') {
                    renderTasksView();
                }
                updateNotifications();
            }
        },
        openAddTaskModal() {
            document.getElementById('taskFormModal').reset();
            document.getElementById('taskEditId').value = '';
            document.getElementById('taskModalTitle').textContent = 'Add New Task';
            document.getElementById('taskDueDateInput').value = new Date().toISOString().split('T')[0];
            openModal('taskModalOverlay');
        },
        openEditTaskModal(taskId) {
            const task = window.TasksModule.getTasks().find(t => t.id === taskId);
            if (!task) return;
            document.getElementById('taskEditId').value = task.id;
            document.getElementById('taskTitleInput').value = task.title;
            document.getElementById('taskDescInput').value = task.description || '';
            document.getElementById('taskDueDateInput').value = task.dueDate || '';
            document.getElementById('taskPriorityInput').value = task.priority;
            document.getElementById('taskCategoryInput').value = task.category;
            document.getElementById('taskModalTitle').textContent = 'Edit Task';
            openModal('taskModalOverlay');
        },
        openAddEventModal(presetDate) {
            document.getElementById('eventFormModal').reset();
            document.getElementById('eventDateInput').value = presetDate || new Date().toISOString().split('T')[0];
            openModal('eventModalOverlay');
        },
        deleteEvent(eventId) {
            if (confirm('Delete this scheduled event?')) {
                window.CalendarModule.deleteEvent(currentUser, eventId);
                showToast('Event removed from schedule.', 'info');
                renderCalendarView();
                updateNotifications();
            }
        },
        openAddTxModal() {
            document.getElementById('txFormModal').reset();
            document.getElementById('txDateInput').value = new Date().toISOString().split('T')[0];
            openModal('txModalOverlay');
        },
        deleteTransaction(txId) {
            if (confirm('Delete this transaction?')) {
                window.BudgetModule.deleteTransaction(currentUser, txId);
                showToast('Transaction deleted.', 'info');
                renderBudgetView();
            }
        },
        openAddBillModal() {
            document.getElementById('billFormModal').reset();
            document.getElementById('billDateInput').value = new Date().toISOString().split('T')[0];
            openModal('billModalOverlay');
        },
        toggleBill(billId) {
            window.BudgetModule.toggleBillPaid(currentUser, billId);
            renderCurrentView();
        },
        deleteBill(billId) {
            if (confirm('Delete this bill?')) {
                window.BudgetModule.deleteBill(currentUser, billId);
                showToast('Bill removed.', 'info');
                renderCurrentView();
            }
        },
        quickCheckInMood(mood, score) {
            try {
                window.WellnessModule.saveCheckIn(currentUser, {
                    mood: mood,
                    score: score,
                    stress: score >= 4 ? 1 : score === 3 ? 2 : 4,
                    energy: score,
                    notes: `Quick check-in logged via dashboard.`
                });
                showToast(`Mood logged: ${mood.toUpperCase()}! 💜 (+50 XP)`, 'success');
                renderCurrentView();
            } catch (err) {
                showToast(err.message, 'error');
            }
        },
        toggleTaskAndRefreshSmart(taskId) {
            window.TasksModule.toggleComplete(currentUser, taskId);
            showToast('Task marked done! Re-ranking priorities... 🧠', 'success');
            renderSmartOrganizerView();
            renderTasksView();
            updateNotifications();
        },
        switchBudgetSubTab,
        switchTabAndBudgetSub(subTab) {
            switchTab('budget');
            switchBudgetSubTab(subTab);
        },
        quickNightSafeToggle() {
            const isLocked = window.BudgetModule.toggleNightSafeLock(currentUser);
            showToast(isLocked ? 'Wallet is now LOCKED 🔒. Late-night spending blocked!' : 'Wallet unlocked 🔓.', isLocked ? 'info' : 'success');
            renderCurrentView();
        },
        quickNightSpend(amount) {
            try {
                window.BudgetModule.recordNightSpend(currentUser, amount);
                showToast(`Logged ₹${amount} late-night spend. 🌙`, 'info');
                renderCurrentView();
                updateNotifications();
            } catch (err) {
                showToast(err.message, 'warning');
            }
        },
        openBudgetSettingsModal() {
            const budget = window.BudgetModule.getBudget();
            const monthlyInput = document.getElementById('settingMonthlyBudgetInput');
            const nightInput = document.getElementById('settingNightLimitInput');
            const runwaySum = document.getElementById('settingRunwaySumInput');
            const runwayBuffer = document.getElementById('settingRunwayBufferInput');
            if (monthlyInput) monthlyInput.value = budget.monthlyBudget || 15000;
            if (nightInput) nightInput.value = (budget.nightSafe && budget.nightSafe.limit) || 500;
            if (runwaySum) runwaySum.value = (budget.runway && budget.runway.sum) || 20000;
            if (runwayBuffer) runwayBuffer.value = (budget.runway && budget.runway.bufferPct) !== undefined ? budget.runway.bufferPct : 15;
            openModal('budgetSettingsModalOverlay');
        },
        handleResetBudgetData() {
            if (confirm('Are you sure you want to reset all budget and expense data to defaults?')) {
                window.BudgetModule.resetToDefault(currentUser);
                showToast('Budget data reset to defaults.', 'info');
                closeModal('budgetSettingsModalOverlay');
                renderCurrentView();
            }
        },
        openGoalContributionModal() {
            document.getElementById('goalContributionForm').reset();
            openModal('goalModalOverlay');
        },
        convertSplitToBill() {
            const bill = Number(document.getElementById('calcBillAmount').value) || 0;
            const people = Number(document.getElementById('calcBillPeople').value) || 1;
            document.getElementById('billFormModal').reset();
            document.getElementById('billTitleInput').value = 'Shared Expense Split';
            document.getElementById('billAmountInput').value = bill;
            document.getElementById('billSplitInput').value = people;
            document.getElementById('billDateInput').value = new Date().toISOString().split('T')[0];
            openModal('billModalOverlay');
        },
        handleNotifClick,
        openModal,
        closeModal,
        closeAllModals,
        showToast,
        toggleTheme,
        setTheme,
        initTheme
    };

    document.addEventListener('DOMContentLoaded', checkAuthAndInit);
})();
