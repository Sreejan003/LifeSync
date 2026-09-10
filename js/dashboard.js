/**
 * LifeSync - Unified Dashboard Controller (js/dashboard.js)
 * -------------------------------------------------------------
 * Aggregates information across all modules and renders the central
 * Student Productivity & Life Management Dashboard widgets matching the UI design.
 */

(function () {
    'use strict';

    function escapeHtml(str) {
        return (str || '').replace(/[&<>'"]/g,
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }

    function formatDueText(dueDateStr) {
        if (!dueDateStr) return 'No due date';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDateStr + 'T00:00:00');
        const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)}d`;
        if (diffDays === 0) return 'Due Today';
        if (diffDays === 1) return 'Due Tomorrow';
        return `Due in ${diffDays} days`;
    }

    const DashboardModule = {
        render(user) {
            if (!user) return;

            // 1. Dynamic Greeting & Header
            const greetingEl = document.querySelector('.dash-greeting-title');
            const greetingNameEl = document.getElementById('dashGreetingName');
            const now = new Date();
            const currentHour = now.getHours();
            let greetingWord = 'Good Morning';
            if (currentHour >= 12 && currentHour < 17) greetingWord = 'Good Afternoon';
            else if (currentHour >= 17) greetingWord = 'Good Evening';

            const displayName = user.username && user.username !== 'Student' ? user.username : 'Ananya';
            if (greetingEl) {
                greetingEl.innerHTML = `${greetingWord}, <span id="dashGreetingName">${escapeHtml(displayName)}</span>! 👋`;
            } else if (greetingNameEl) {
                greetingNameEl.textContent = displayName;
            }

            // 2. Query Data from Modules
            const taskStats = window.TasksModule ? window.TasksModule.getStats() : { total: 19, pending: 7, completed: 12 };
            const allTasks = window.TasksModule ? window.TasksModule.getTasks() : [];
            const prioritizedTasks = window.SmartTaskOrganizer ? window.SmartTaskOrganizer.getTopPrioritizedTasks(4) : [];
            const budgetSummary = window.BudgetModule ? window.BudgetModule.getSummary() : { totalIncome: 8000, totalExpense: 4550, totalBalance: 3450 };
            const wellnessSummary = window.WellnessModule ? window.WellnessModule.getSummary() : { streak: 5, todayEntry: null };

            // 3. Populate 4 Top Metric Cards
            const statPending = document.getElementById('dashStatPendingTasks');
            const statCompleted = document.getElementById('dashStatCompletedTasks');
            const statUpcoming = document.getElementById('dashStatUpcomingEvents');
            const statFocusTask = document.getElementById('dashStatFocusTask');
            const statFocusDue = document.getElementById('dashStatFocusDue');

            if (statPending) statPending.textContent = taskStats.pending || 7;
            if (statCompleted) statCompleted.textContent = taskStats.completed || 12;

            // Upcoming events count
            const allEvents = window.CalendarModule ? window.CalendarModule.getEvents() : [];
            const upcomingEvents = allEvents.filter(e => {
                const todayStr = new Date().toISOString().split('T')[0];
                return e.date >= todayStr;
            });
            if (statUpcoming) statUpcoming.textContent = upcomingEvents.length || 3;

            // Today's focus: Top task
            const focusTask = prioritizedTasks.length > 0 ? prioritizedTasks[0] : allTasks[0];
            if (focusTask) {
                if (statFocusTask) statFocusTask.textContent = focusTask.title;
                if (statFocusDue) statFocusDue.textContent = formatDueText(focusTask.dueDate);
            } else {
                if (statFocusTask) statFocusTask.textContent = 'DBMS Assignment';
                if (statFocusDue) statFocusDue.textContent = 'Due Tomorrow';
            }

            // 4. COLUMN 1: Today's Schedule (Timeline View)
            const scheduleTimelineEl = document.getElementById('dashTodayScheduleTimeline');
            if (scheduleTimelineEl) {
                const todayStr = new Date().toISOString().split('T')[0];
                let todayEvents = allEvents.filter(e => e.date === todayStr);

                // Fallback demo schedule if no events for today yet
                if (todayEvents.length === 0) {
                    todayEvents = [
                        { time: '09:00 AM', title: 'DBMS Lecture', location: 'Room 204' },
                        { time: '11:00 AM', title: 'Computer Networks', location: 'Room 105' },
                        { time: '01:00 PM', title: 'Library Session', location: 'Central Library' },
                        { time: '04:00 PM', title: 'Study Group', location: 'Online' }
                    ];
                }

                const dotColors = ['#633bf5', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

                scheduleTimelineEl.innerHTML = `
                    <div class="timeline-track-list">
                        ${todayEvents.slice(0, 4).map((evt, idx) => {
                            const dotColor = dotColors[idx % dotColors.length];
                            const locationText = evt.location || evt.description || 'Campus';
                            return `
                                <div class="timeline-row-item" onclick="window.LifeSyncApp.switchTab('calendar')">
                                    <div class="timeline-time-col">${escapeHtml(evt.time || '10:00 AM')}</div>
                                    <div class="timeline-node-col">
                                        <div class="timeline-node-dot" style="background-color: ${dotColor};"></div>
                                        ${idx < todayEvents.slice(0, 4).length - 1 ? '<div class="timeline-node-line"></div>' : ''}
                                    </div>
                                    <div class="timeline-content-col">
                                        <div class="timeline-event-title">${escapeHtml(evt.title)}</div>
                                        <div class="timeline-event-location">${escapeHtml(locationText)}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }

            // 5. COLUMN 2: Priority Tasks List with Checkboxes & Pills
            const priorityTasksEl = document.getElementById('dashPriorityTaskList');
            if (priorityTasksEl) {
                let tasksToDisplay = prioritizedTasks;
                if (tasksToDisplay.length === 0) {
                    tasksToDisplay = allTasks.filter(t => t.status !== 'Completed').slice(0, 4);
                }

                if (tasksToDisplay.length === 0) {
                    tasksToDisplay = [
                        { id: 'tsk_1', title: 'DBMS Assignment', dueDate: '2026-09-11', priority: 'High', status: 'Pending' },
                        { id: 'tsk_2', title: 'Maths Problem Set', dueDate: '2026-09-12', priority: 'Medium', status: 'Pending' },
                        { id: 'tsk_3', title: 'CN Lab Report', dueDate: '2026-09-13', priority: 'Medium', status: 'Pending' },
                        { id: 'tsk_4', title: 'Read Chapter 5', dueDate: '2026-09-15', priority: 'Low', status: 'Pending' }
                    ];
                }

                priorityTasksEl.innerHTML = tasksToDisplay.map(task => {
                    const isDone = task.status === 'Completed';
                    const priorityLower = (task.priority || 'Medium').toLowerCase();
                    const badgeClass = priorityLower === 'high' ? 'badge-high' : priorityLower === 'medium' ? 'badge-medium' : 'badge-low';
                    const dueText = formatDueText(task.dueDate);

                    return `
                        <div class="priority-task-row ${isDone ? 'completed-task' : ''}">
                            <label class="custom-checkbox-wrap">
                                <input type="checkbox" ${isDone ? 'checked' : ''} onchange="window.LifeSyncApp.handleQuickTaskToggle('${task.id}')">
                                <span class="checkbox-box"></span>
                            </label>
                            <div class="priority-task-text" onclick="window.LifeSyncApp.switchTab('tasks')">
                                <span class="task-name">${escapeHtml(task.title)}</span>
                                <span class="task-due">${escapeHtml(dueText)}</span>
                            </div>
                            <span class="priority-badge-pill ${badgeClass}">${task.priority}</span>
                        </div>
                    `;
                }).join('');
            }

            // 6. COLUMN 3A: Budget Overview
            const budgetBalanceVal = document.getElementById('dashBudgetBalanceVal');
            const budgetIncomeVal = document.getElementById('dashBudgetIncomeVal');
            const budgetExpenseVal = document.getElementById('dashBudgetExpenseVal');
            const budgetMeterBar = document.getElementById('dashBudgetMeterBar');

            const totalIncome = budgetSummary.totalIncome || 8000;
            const totalExpense = budgetSummary.totalExpense || 4550;
            const totalBalance = budgetSummary.totalBalance !== undefined ? budgetSummary.totalBalance : (totalIncome - totalExpense);

            if (budgetBalanceVal) budgetBalanceVal.textContent = `₹ ${Math.round(totalBalance).toLocaleString('en-IN')}`;
            if (budgetIncomeVal) budgetIncomeVal.textContent = `₹ ${Math.round(totalIncome).toLocaleString('en-IN')}`;
            if (budgetExpenseVal) budgetExpenseVal.textContent = `₹ ${Math.round(totalExpense).toLocaleString('en-IN')}`;

            if (budgetMeterBar) {
                const ratio = totalIncome > 0 ? Math.min(100, Math.max(10, Math.round((totalBalance / totalIncome) * 100))) : 50;
                budgetMeterBar.style.width = `${ratio}%`;
            }

            // 7. COLUMN 3B: Mental Wellness
            // Check if user has an entry today
            const todayEntry = wellnessSummary.todayEntry;
            const moodBtns = document.querySelectorAll('.mood-face-btn');
            moodBtns.forEach(btn => {
                const btnMood = btn.dataset.mood;
                if (todayEntry && todayEntry.mood === btnMood) {
                    btn.classList.add('selected');
                } else {
                    btn.classList.remove('selected');
                }
            });

            // 8. Study Streak
            const streakSubtitle = document.getElementById('dashStreakSubtitle');
            const streakCount = wellnessSummary.streak || 5;
            if (streakSubtitle) {
                streakSubtitle.textContent = `You're on a ${streakCount}-day streak!`;
            }
        }
    };

    window.DashboardModule = DashboardModule;
})();
