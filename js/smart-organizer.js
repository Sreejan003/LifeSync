/**
 * LifeSync - Smart Task Organizer (js/smart-organizer.js)
 * -------------------------------------------------------------
 * INTEGRATION ENGINE:
 * To-Do List (Tasks, Deadlines, Priority)
 * + Calendar & Reminders (Events, Exams, Classes)
 * = Smart Prioritized Task List -> Feeds Dashboard & Tasks View
 *
 * Correlates task deadlines, priority levels, and academic calendar
 * events (exams, classes, project reviews) into an intelligent urgency rank.
 */

(function () {
    'use strict';

    function getDaysDiff(dateStr) {
        if (!dateStr) return 999;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr + 'T00:00:00');
        const diffMs = target.getTime() - today.getTime();
        return Math.round(diffMs / (1000 * 60 * 60 * 24));
    }

    const SmartTaskOrganizer = {
        /**
         * Analyzes pending tasks alongside calendar events and returns
         * a smart prioritized task list ordered by real-world academic urgency.
         */
        getPrioritizedTasks() {
            const allTasks = window.TasksModule ? window.TasksModule.getTasks() : [];
            const activeTasks = allTasks.filter(t => t.status !== 'Completed');
            const allEvents = window.CalendarModule ? window.CalendarModule.getEvents() : [];

            // Find upcoming exams/classes within the next 4 days
            const upcomingAcademicEvents = allEvents.filter(e => {
                const diff = getDaysDiff(e.date);
                const isAcademic = ['exam', 'study', 'class', 'assignment'].includes((e.category || '').toLowerCase());
                return isAcademic && diff >= 0 && diff <= 4;
            });

            const scoredTasks = activeTasks.map(task => {
                let score = 0;
                let reasonTag = 'Normal Priority';
                let reasonType = 'info'; // 'danger', 'warning', 'exam', 'info'

                const daysDiff = getDaysDiff(task.dueDate);

                // 1. Deadline urgency scoring
                if (task.dueDate) {
                    if (daysDiff < 0) {
                        score += 120;
                        reasonTag = `🚨 Overdue (${Math.abs(daysDiff)}d ago)`;
                        reasonType = 'danger';
                    } else if (daysDiff === 0) {
                        score += 90;
                        reasonTag = '⚡ Due Today';
                        reasonType = 'danger';
                    } else if (daysDiff === 1) {
                        score += 70;
                        reasonTag = '⏰ Due Tomorrow';
                        reasonType = 'warning';
                    } else if (daysDiff <= 3) {
                        score += 45;
                        reasonTag = `📅 Due in ${daysDiff} days`;
                        reasonType = 'warning';
                    } else {
                        score += 20;
                        reasonTag = `Due in ${daysDiff} days`;
                        reasonType = 'info';
                    }
                } else {
                    score += 5;
                    reasonTag = 'No deadline set';
                    reasonType = 'info';
                }

                // 2. Base priority weighting
                if (task.priority === 'High') {
                    score += 35;
                } else if (task.priority === 'Medium') {
                    score += 20;
                } else {
                    score += 10;
                }

                // 3. Momentum bonus
                if (task.status === 'In Progress') {
                    score += 15;
                    if (reasonType === 'info') {
                        reasonTag = '⏳ In Progress';
                        reasonType = 'warning';
                    }
                }

                // 4. Calendar Integration: Boost tasks correlated with upcoming exams/classes
                const taskCat = (task.category || '').toLowerCase();
                const matchedEvent = upcomingAcademicEvents.find(e => {
                    const eCat = (e.category || '').toLowerCase();
                    // Match study/assignment tasks with exams or tests
                    if (eCat === 'exam' && (taskCat === 'study' || taskCat === 'assignment' || task.title.toLowerCase().includes('exam') || task.title.toLowerCase().includes('test'))) {
                        return true;
                    }
                    return false;
                });

                if (matchedEvent) {
                    score += 40;
                    const eventDays = getDaysDiff(matchedEvent.date);
                    const eventWhen = eventDays === 0 ? 'Today' : eventDays === 1 ? 'Tomorrow' : `in ${eventDays}d`;
                    reasonTag = `🎯 Boost: ${matchedEvent.title} (${eventWhen})`;
                    reasonType = 'exam';
                }

                return {
                    ...task,
                    smartScore: score,
                    reasonTag,
                    reasonType,
                    daysDiff
                };
            });

            // Sort descending by smartScore
            scoredTasks.sort((a, b) => b.smartScore - a.smartScore);
            return scoredTasks;
        },

        /**
         * Returns top N prioritized tasks specifically tailored for the Dashboard widget.
         */
        getTopPrioritizedTasks(limit = 4) {
            return this.getPrioritizedTasks().slice(0, limit);
        }
    };

    window.SmartTaskOrganizer = SmartTaskOrganizer;
})();
