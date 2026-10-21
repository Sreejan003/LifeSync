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

    function getLocalDateString(d) {
        const dateObj = d instanceof Date ? d : new Date(d);
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function recordUserDailyLogin(userId) {
        if (!userId) return;
        const todayStr = getLocalDateString(new Date());
        const storageKey = `lifesync_login_history_${userId}`;
        let dates = [];
        try {
            dates = JSON.parse(localStorage.getItem(storageKey)) || [];
        } catch (e) {
            dates = [];
        }
        if (!dates.includes(todayStr)) {
            dates.push(todayStr);
            if (dates.length > 120) dates = dates.slice(-120);
            try {
                localStorage.setItem(storageKey, JSON.stringify(dates));
            } catch (e) {}
        }
    }

    function computeActiveStreak(userId, wellnessSummary) {
        const today = new Date();
        const todayStr = getLocalDateString(today);
        const storageKey = `lifesync_login_history_${userId}`;
        let dates = [];
        try {
            dates = JSON.parse(localStorage.getItem(storageKey)) || [];
        } catch (e) {
            dates = [];
        }
        const activeDatesSet = new Set(dates);
        // Current user session is active today
        activeDatesSet.add(todayStr);

        // Also incorporate mental wellness check-in dates
        if (wellnessSummary) {
            if (Array.isArray(wellnessSummary.weeklyDays)) {
                wellnessSummary.weeklyDays.forEach(d => {
                    if (d && d.mood && d.date) activeDatesSet.add(d.date);
                });
            }
            if (Array.isArray(wellnessSummary.history)) {
                wellnessSummary.history.forEach(item => {
                    if (item && item.date) {
                        const dStr = item.date instanceof Date 
                            ? getLocalDateString(item.date) 
                            : String(item.date).split('T')[0];
                        if (dStr) activeDatesSet.add(dStr);
                    }
                });
            }
        }

        // Calculate consecutive streak backwards starting from today
        let streak = 0;
        let checkDate = new Date(today);
        while (true) {
            const dStr = getLocalDateString(checkDate);
            if (activeDatesSet.has(dStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        if (wellnessSummary && typeof wellnessSummary.streak === 'number' && wellnessSummary.streak > streak) {
            streak = wellnessSummary.streak;
        }

        return { streak: Math.max(1, streak), activeDatesSet };
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

            const displayName = (user && (user.username || user.name) && user.username !== 'Student') ? (user.username || user.name) : ((user && (user.username || user.name)) || 'Student');
            if (greetingEl) {
                if (displayName) {
                    greetingEl.innerHTML = `${greetingWord}, <span id="dashGreetingName">${escapeHtml(displayName)}</span>! 👋`;
                } else {
                    greetingEl.innerHTML = `${greetingWord}! 👋`;
                }
            } else if (greetingNameEl) {
                greetingNameEl.textContent = displayName;
            }

            // 2. Query Data from Modules
            const taskStats = window.TasksModule ? window.TasksModule.getStats() : { total: 0, pending: 0, completed: 0 };
            const allTasks = window.TasksModule ? window.TasksModule.getTasks() : [];
            const prioritizedTasks = window.SmartTaskOrganizer ? window.SmartTaskOrganizer.getTopPrioritizedTasks(4) : [];
            const budgetSummary = window.BudgetModule ? window.BudgetModule.getSummary() : { totalIncome: 0, totalExpense: 0, totalBalance: 0 };
            const wellnessSummary = window.WellnessModule ? window.WellnessModule.getSummary() : { streak: 0, todayEntry: null };

            // 3. Populate 4 Top Metric Cards
            const statPending = document.getElementById('dashStatPendingTasks');
            const statCompleted = document.getElementById('dashStatCompletedTasks');
            const statUpcoming = document.getElementById('dashStatUpcomingEvents');
            const statFocusTask = document.getElementById('dashStatFocusTask');
            const statFocusDue = document.getElementById('dashStatFocusDue');

            if (statPending) statPending.textContent = taskStats.pending !== undefined ? taskStats.pending : 0;
            if (statCompleted) statCompleted.textContent = taskStats.completed !== undefined ? taskStats.completed : 0;

            // Upcoming events count
            const allEvents = window.CalendarModule ? window.CalendarModule.getEvents() : [];
            const upcomingEvents = allEvents.filter(e => {
                const todayStr = new Date().toISOString().split('T')[0];
                return e.date >= todayStr;
            });
            if (statUpcoming) statUpcoming.textContent = upcomingEvents.length;

            // Today's focus: Top task
            const focusTask = prioritizedTasks.length > 0 ? prioritizedTasks[0] : (allTasks.find(t => t.status !== 'Completed') || allTasks[0]);
            if (focusTask) {
                if (statFocusTask) statFocusTask.textContent = focusTask.title;
                if (statFocusDue) statFocusDue.textContent = formatDueText(focusTask.dueDate);
            } else {
                if (statFocusTask) statFocusTask.textContent = 'No active tasks';
                if (statFocusDue) statFocusDue.textContent = 'Enjoy your break!';
            }

            // 4. COLUMN 1: Today's Schedule (Timeline View)
            const scheduleTimelineEl = document.getElementById('dashTodayScheduleTimeline');
            if (scheduleTimelineEl) {
                const todayStr = new Date().toISOString().split('T')[0];
                const todayEvents = allEvents.filter(e => e.date === todayStr);

                if (todayEvents.length === 0) {
                    scheduleTimelineEl.innerHTML = `
                        <div class="schedule-empty-state" style="padding: 28px 16px; text-align: center; color: var(--text-muted); font-size: 13.5px;">
                            <div style="font-size: 28px; margin-bottom: 8px;">📅</div>
                            <strong style="color: var(--text-primary); font-size: 14px;">No events scheduled for today</strong>
                            <p style="margin: 6px 0 12px; font-size: 12px; color: var(--text-muted);">Add your classes, exams, or study sessions to stay on track.</p>
                            <button type="button" class="btn-xs-primary" onclick="window.LifeSyncApp.openAddEventModal('${todayStr}')">+ Add Event for Today</button>
                        </div>
                    `;
                } else {
                    // Sort today's events chronologically by time
                    todayEvents.sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));

                    const dotColors = ['#818cf8', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6'];

                    scheduleTimelineEl.innerHTML = `
                        <div class="timeline-track-list">
                            ${todayEvents.map((evt, idx) => {
                                const dotColor = dotColors[idx % dotColors.length];
                                const locationText = evt.location || evt.description || 'Campus';
                                return `
                                    <div class="timeline-row-item interactive-schedule-row" title="Click to edit event" onclick="window.LifeSyncApp.openEditEventModal('${evt.id}')">
                                        <div class="timeline-time-col">${escapeHtml(evt.time || '10:00 AM')}</div>
                                        <div class="timeline-node-col">
                                            <div class="timeline-node-dot" style="background-color: ${dotColor};"></div>
                                            ${idx < todayEvents.length - 1 ? '<div class="timeline-node-line"></div>' : ''}
                                        </div>
                                        <div class="timeline-content-col">
                                            <div class="timeline-event-title">${escapeHtml(evt.title)}</div>
                                            <div class="timeline-event-location">${escapeHtml(locationText)}</div>
                                        </div>
                                        <div class="timeline-actions-col">
                                            <button type="button" class="btn-schedule-mini" title="Edit Event" onclick="event.stopPropagation(); window.LifeSyncApp.openEditEventModal('${evt.id}')">✏️</button>
                                            <button type="button" class="btn-schedule-mini btn-schedule-delete" title="Delete Event" onclick="event.stopPropagation(); window.LifeSyncApp.deleteEvent('${evt.id}')">🗑️</button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                    `;
                }
            }

            // 5. COLUMN 2: Priority Tasks List with Checkboxes & Pills
            const priorityTasksEl = document.getElementById('dashPriorityTaskList');
            if (priorityTasksEl) {
                let tasksToDisplay = prioritizedTasks;
                if (tasksToDisplay.length === 0 && allTasks.length > 0) {
                    // Filter pending and prioritize High and Medium tasks
                    tasksToDisplay = allTasks.filter(t => t.status !== 'Completed')
                        .sort((a, b) => {
                            const score = p => p === 'High' ? 3 : p === 'Medium' ? 2 : 1;
                            return score(b.priority) - score(a.priority);
                        }).slice(0, 4);
                }

                if (tasksToDisplay.length === 0) {
                    priorityTasksEl.innerHTML = `
                        <div class="priority-empty-state" style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 13.5px;">
                            <div style="font-size: 26px; margin-bottom: 6px;">🎉</div>
                            <strong>All caught up!</strong>
                            <p style="margin: 4px 0 10px; font-size: 12px; color: var(--text-muted);">All pending tasks are completed.</p>
                            <button type="button" class="btn-xs-primary" onclick="window.LifeSyncApp.openAddTaskModal()">+ Add Task</button>
                        </div>
                    `;
                } else {
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
                                <div class="priority-task-text" onclick="window.LifeSyncApp.switchTab('smart')" title="View in Smart Task Organizer">
                                    <span class="task-name">${escapeHtml(task.title)}</span>
                                    <span class="task-due">${escapeHtml(dueText)}</span>
                                </div>
                                <span class="priority-badge-pill ${badgeClass}">${task.priority}</span>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 6. COLUMN 3A: Student Finance Hub & Integrated Budget
            const budgetBalanceVal = document.getElementById('dashBudgetBalanceVal');
            const budgetIncomeVal = document.getElementById('dashBudgetIncomeVal');
            const budgetExpenseVal = document.getElementById('dashBudgetExpenseVal');
            const budgetMeterBar = document.getElementById('dashBudgetMeterBar');
            const dashBudgetStreakBadge = document.getElementById('dashBudgetStreakBadge');
            const dashBudgetRemainingVal = document.getElementById('dashBudgetRemainingVal');
            const dashBudgetMonthlyLimitVal = document.getElementById('dashBudgetMonthlyLimitVal');

            const profile = window.ProfileModule ? window.ProfileModule.getProfile() : (window.LifeSyncStorage.getProfile(user) || {});
            const totalIncome = Number(budgetSummary.totalIncome) || 0;
            const totalExpense = Number(budgetSummary.totalExpense) || 0;
            const totalBalance = Number(budgetSummary.totalBalance !== undefined ? budgetSummary.totalBalance : (totalIncome - totalExpense));
            const spentThisMonth = Number(budgetSummary.spentThisMonth !== undefined ? budgetSummary.spentThisMonth : totalExpense);
            const monthlyLimit = Number(budgetSummary.monthlyBudget) || 15000;
            const remainingBudget = Number(budgetSummary.remainingBudget !== undefined ? budgetSummary.remainingBudget : Math.max(0, monthlyLimit - spentThisMonth));
            const budgetStreak = (budgetSummary && budgetSummary.streak !== undefined) ? budgetSummary.streak : ((profile && (profile.budgetStreak !== undefined ? profile.budgetStreak : profile.streak)) || 0);

            if (budgetBalanceVal) {
                const formatted = Math.abs(Math.round(totalBalance)).toLocaleString('en-IN');
                budgetBalanceVal.textContent = totalBalance < 0 ? `-₹${formatted}` : `₹${formatted}`;
                budgetBalanceVal.style.color = totalBalance < 0 ? '#ef4444' : '';
            }
            if (budgetIncomeVal) budgetIncomeVal.textContent = `₹ ${Math.round(totalIncome).toLocaleString('en-IN')}`;
            if (budgetExpenseVal) budgetExpenseVal.textContent = `₹ ${Math.round(spentThisMonth).toLocaleString('en-IN')}`;
            if (dashBudgetRemainingVal) dashBudgetRemainingVal.textContent = `₹${Math.round(remainingBudget).toLocaleString('en-IN')}`;
            if (dashBudgetMonthlyLimitVal) dashBudgetMonthlyLimitVal.textContent = `₹${Math.round(monthlyLimit).toLocaleString('en-IN')}`;
            if (dashBudgetStreakBadge) dashBudgetStreakBadge.textContent = `${budgetStreak}d`;

            if (budgetMeterBar) {
                const pct = budgetSummary.budgetUsagePct !== undefined ? budgetSummary.budgetUsagePct : (monthlyLimit > 0 ? Math.min(100, Math.round((spentThisMonth / monthlyLimit) * 100)) : 0);
                budgetMeterBar.style.width = `${pct}%`;
                budgetMeterBar.style.background = pct >= 100 ? '#db4665' : pct >= 80 ? '#f5a623' : '#10b981';
            }

            // Feature 1: Late-Night Safe Widget on Dashboard
            const night = budgetSummary.nightSafe || { limit: 0, spent: 0, locked: false };
            const nightRemaining = Math.max(0, (Number(night.limit) || 0) - (Number(night.spent) || 0));
            const dashNightSafeIcon = document.getElementById('dashNightSafeIcon');
            const dashNightSafeStatus = document.getElementById('dashNightSafeStatus');
            const dashBtnToggleNightSafe = document.getElementById('dashBtnToggleNightSafe');

            if (dashNightSafeIcon) dashNightSafeIcon.textContent = night.locked ? '🔒' : '🌙';
            if (dashNightSafeStatus) {
                if (night.locked) {
                    dashNightSafeStatus.textContent = '🔒 Locked';
                    dashNightSafeStatus.className = 'night-safe-status-pill locked';
                } else {
                    dashNightSafeStatus.textContent = `₹${nightRemaining} Safe`;
                    dashNightSafeStatus.className = 'night-safe-status-pill unlocked';
                }
            }
            if (dashBtnToggleNightSafe) {
                dashBtnToggleNightSafe.textContent = night.locked ? '🔓 Unlock' : '🔒 Lock';
                dashBtnToggleNightSafe.className = night.locked ? 'btn-xs-toggle unlocked-mode' : 'btn-xs-toggle locked-mode';
            }

            // Feature 2: Upcoming Roommate Bills on Dashboard
            const nextBill = budgetSummary.nextDueBill || (budgetSummary.bills && budgetSummary.bills.find(b => !b.paid)) || null;
            const dashNextBillLabel = document.getElementById('dashNextBillLabel');
            const dashNextBillTitle = document.getElementById('dashNextBillTitle');
            const dashBtnPayNextBill = document.getElementById('dashBtnPayNextBill');

            if (nextBill) {
                const share = Math.round((Number(nextBill.amount) || 0) / (Number(nextBill.split) || 1));
                if (dashNextBillLabel) dashNextBillLabel.textContent = `Due ${nextBill.date || 'Soon'} (₹${share}):`;
                if (dashNextBillTitle) dashNextBillTitle.textContent = `${escapeHtml(nextBill.title || 'Bill')} (₹${share})`;
                if (dashBtnPayNextBill) {
                    dashBtnPayNextBill.style.display = 'inline-block';
                    dashBtnPayNextBill.textContent = 'Paid';
                    dashBtnPayNextBill.onclick = (e) => {
                        e.stopPropagation();
                        window.LifeSyncApp.toggleBill(nextBill.id);
                    };
                }
            } else {
                if (dashNextBillLabel) dashNextBillLabel.textContent = 'Roommate Bills:';
                if (dashNextBillTitle) dashNextBillTitle.textContent = 'All Bills Settled ✓';
                if (dashBtnPayNextBill) dashBtnPayNextBill.style.display = 'none';
            }

            // Feature 3: Shared Savings Goal Tracker on Dashboard
            const goal = budgetSummary.sharedGoal;
            const dashGoalTitle = document.getElementById('dashGoalTitle');
            const dashGoalPct = document.getElementById('dashGoalPct');
            const dashGoalMiniBar = document.getElementById('dashGoalMiniBar');

            if (goal && Number(goal.target) > 0) {
                const goalCurrent = Number(goal.current !== undefined ? goal.current : goal.saved) || 0;
                const goalTarget = Number(goal.target);
                const goalPct = Math.min(100, Math.round((goalCurrent / goalTarget) * 100));
                if (dashGoalTitle) dashGoalTitle.textContent = escapeHtml(goal.title || 'Shared Savings Goal');
                if (dashGoalPct) dashGoalPct.textContent = `${goalPct}% (₹${Math.round(goalCurrent).toLocaleString('en-IN')})`;
                if (dashGoalMiniBar) dashGoalMiniBar.style.width = `${goalPct}%`;
            } else {
                if (dashGoalTitle) dashGoalTitle.textContent = 'Shared Savings Goal';
                if (dashGoalPct) dashGoalPct.textContent = '0%';
                if (dashGoalMiniBar) dashGoalMiniBar.style.width = '0%';
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
            const streakBubblesContainer = document.getElementById('dashStreakBubbles');
            const streakBadge = document.getElementById('dashStreakBadge');

            const userId = (user && (user.id || user.email || user.username)) || 'current_user';
            recordUserDailyLogin(userId);
            const { streak: studyStreak, activeDatesSet } = computeActiveStreak(userId, wellnessSummary);

            if (streakBadge) {
                streakBadge.textContent = `${studyStreak}d`;
            }

            if (streakSubtitle) {
                if (studyStreak > 1) {
                    streakSubtitle.textContent = `You're on a ${studyStreak}-day study streak! Keep it going 🔥`;
                } else {
                    streakSubtitle.textContent = `Day 1 of your study streak! Great job logging in today 🔥`;
                }
            }

            if (streakBubblesContainer) {
                const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
                const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                const todayDayIndex = (now.getDay() + 6) % 7; // Monday = 0, Tuesday = 1, ... Sunday = 6

                // Calculate Monday date of the current calendar week
                const mondayDate = new Date(now);
                mondayDate.setDate(now.getDate() - todayDayIndex);

                streakBubblesContainer.innerHTML = dayLetters.map((letter, idx) => {
                    const bubbleDate = new Date(mondayDate);
                    bubbleDate.setDate(mondayDate.getDate() + idx);
                    const bubbleDateStr = getLocalDateString(bubbleDate);

                    const isToday = (idx === todayDayIndex);
                    const isPast = (idx < todayDayIndex);

                    // A day is lit up / completed if:
                    // 1) It is today (user is logged in right now!)
                    // 2) User logged in on that past date in activeDatesSet
                    // 3) Or falls within the consecutive study streak leading up to today
                    const isCompleted = isToday || activeDatesSet.has(bubbleDateStr) || (isPast && (todayDayIndex - idx) < studyStreak);

                    const bubbleClasses = ['streak-day-bubble'];
                    if (isCompleted) {
                        bubbleClasses.push('completed', 'active');
                    }
                    if (isToday) {
                        bubbleClasses.push('current', 'today');
                    }

                    const tooltip = `${dayNames[idx]} (${bubbleDateStr}): ${isToday ? 'Today (Logged in ✓)' : isCompleted ? 'Active Streak Day ✓' : 'Upcoming'}`;

                    return `
                        <div class="${bubbleClasses.join(' ')}" data-day="${dayNames[idx]}" title="${tooltip}">
                            ${isCompleted ? '<span class="check-mark">✓</span>' : `<span class="day-letter">${letter}</span>`}
                            <span class="day-label">${letter}</span>
                        </div>
                    `;
                }).join('');
            }
        },
        recordLogin(user) {
            const uid = (user && (user.id || user.email || user.username)) || 'current_user';
            recordUserDailyLogin(uid);
        }
    };

    window.DashboardModule = DashboardModule;
})();
