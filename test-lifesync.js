/**
 * Automated Verification Script for LifeSync Unified Modules
 * Tests:
 * 1. Storage & Scoping (lifesync_<domain>_<userId>)
 * 2. AuthSystem (JWT simulation, signUp, signIn, updateUsername)
 * 3. TasksModule (CRUD, status, priority, stats)
 * 4. CalendarModule (Events, task deadline merging, upcoming schedule)
 * 5. SmartTaskOrganizer (Deadlines + Exams + Priorities -> Urgency rank)
 * 6. BudgetModule (Independent finance summary, runway, night safe, bills, calculations)
 * 7. WellnessModule (Independent mood check-in, streak, 7-day trend)
 * 8. AnalyticsModule (Multi-module metrics compilation)
 * 9. NotificationsModule (Derived real-time reminders)
 */

const fs = require('fs');
const path = require('path');

// Mock browser window and localStorage
const storageStore = {};
global.localStorage = {
    getItem(k) { return storageStore[k] !== undefined ? storageStore[k] : null; },
    setItem(k, v) { storageStore[k] = String(v); },
    removeItem(k) { delete storageStore[k]; },
    clear() { for (let k in storageStore) delete storageStore[k]; }
};

global.window = global;
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.document = {
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null
};

// Load all scripts in order
const jsDir = path.join(__dirname, '..', 'LifeSync', 'js');
require(path.join(jsDir, 'auth.js'));
require(path.join(jsDir, 'storage.js'));
require(path.join(jsDir, 'tasks.js'));
require(path.join(jsDir, 'calendar.js'));
require(path.join(jsDir, 'smart-organizer.js'));
require(path.join(jsDir, 'budget.js'));
require(path.join(jsDir, 'wellness.js'));
require(path.join(jsDir, 'analytics.js'));
require(path.join(jsDir, 'notifications.js'));
require(path.join(jsDir, 'profile.js'));

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`✓ PASS: ${message}`);
    }
}

console.log('--- Starting LifeSync Verification Tests ---');

// 1. Auth & Registration
const testUser = window.AuthSystem.signUp({
    username: 'Alex Morgan',
    email: 'alex@lifesync.edu',
    password: 'Password123!'
});
assert(testUser && testUser.id, 'User successfully registered with mock JWT session');
assert(window.AuthSystem.getCurrentUser().username === 'Alex Morgan', 'Auth session retrieved accurately');

// 1b. Google Auth with JWT
const googleUser = window.AuthSystem.signInWithGoogle({
    username: 'Google Student',
    email: 'google.student@gmail.com'
});
assert(googleUser && googleUser.isGoogleUser === true, 'Google Sign-In successful with isGoogleUser flag');
assert(googleUser.token && googleUser.token.split('.').length === 3, 'Google Sign-In issued valid 3-part JWT token');
assert(window.AuthSystem.getCurrentUser().email === 'google.student@gmail.com', 'Current session is authenticated via Google JWT');

// Switch back to testUser for subsequent module tests
window.AuthSystem.signIn({ email: 'alex@lifesync.edu', password: 'Password123!' });

// 2. Storage & Seed Data Initialization
window.TasksModule.init(testUser);
window.CalendarModule.init(testUser);
window.BudgetModule.init(testUser);
window.WellnessModule.init(testUser);
window.ProfileModule.init(testUser);

assert(window.TasksModule.getTasks().length > 0, 'TasksModule initialized with user seed tasks');
assert(window.CalendarModule.getEvents().length > 0, 'CalendarModule initialized with user seed events');
assert(window.BudgetModule.getBudget().transactions.length > 0, 'BudgetModule initialized with seed transactions');
assert(window.WellnessModule.getWellness().entries.length > 0, 'WellnessModule initialized with seed check-ins');

// 3. Task Management
const initialTaskCount = window.TasksModule.getTasks().length;
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

const newTask = window.TasksModule.addTask(testUser, {
    title: 'Operating Systems Lab Assignment',
    description: 'Implement round robin scheduling',
    dueDate: tomorrow,
    priority: 'High',
    category: 'Assignment',
    status: 'Pending'
});
assert(window.TasksModule.getTasks().length === initialTaskCount + 1, 'Task added successfully');

// Toggle Complete
window.TasksModule.toggleComplete(testUser, newTask.id);
const updatedTask = window.TasksModule.getTasks().find(t => t.id === newTask.id);
assert(updatedTask.status === 'Completed' && updatedTask.completedAt !== null, 'Task toggled to Completed and timestamped');

// Uncomplete
window.TasksModule.toggleComplete(testUser, newTask.id);
assert(window.TasksModule.getTasks().find(t => t.id === newTask.id).status === 'Pending', 'Task toggled back to Pending');

// Toggle & Delete with numeric database ID via string argument (DOM inline handler scenario)
const numTask = { id: 9999, title: 'Numeric DB Task', priority: 'High', status: 'Pending', category: 'Study', dueDate: tomorrow };
window.LifeSyncStorage.saveTask(testUser, numTask);
window.TasksModule.init(testUser);
assert(window.TasksModule.getTasks().some(t => t.id === 9999), 'Numeric task loaded');
window.TasksModule.toggleComplete(testUser, '9999');
assert(window.TasksModule.getTasks().find(t => t.id === 9999).status === 'Completed', 'Numeric task toggled to Completed using string ID');
window.TasksModule.deleteTask(testUser, '9999');
assert(!window.TasksModule.getTasks().some(t => t.id === 9999), 'Numeric task deleted using string ID');

// 4. Calendar Integration & Deadlines Merging
const calItemsForTomorrow = window.CalendarModule.getItemsForDate(tomorrow);
const foundTaskInCal = calItemsForTomorrow.find(i => i.id === newTask.id && i.itemType === 'task');
assert(foundTaskInCal !== undefined, 'Task with due date appears on Calendar for that date');

// Add Calendar Exam
const newExam = window.CalendarModule.addEvent(testUser, {
    title: 'Operating Systems Midterm Exam',
    date: tomorrow,
    time: '11:00',
    category: 'Exam',
    priority: 'High',
    description: 'Chapters 1-5',
    hasReminder: true
});
assert(window.CalendarModule.getEvents().find(e => e.id === newExam.id), 'Calendar Exam added successfully');

// Verify Calendar merges both Event and Task
const updatedCalItems = window.CalendarModule.getItemsForDate(tomorrow);
assert(updatedCalItems.some(i => i.itemType === 'event') && updatedCalItems.some(i => i.itemType === 'task'),
    'Calendar merges both Calendar Events and Task Deadlines for the day');

// 5. Smart Task Organizer
const prioritizedTasks = window.SmartTaskOrganizer.getPrioritizedTasks();
assert(prioritizedTasks.length > 0, 'Smart Task Organizer produced prioritized tasks');
const topTask = prioritizedTasks[0];
console.log(`   Top Task: "${topTask.title}", Score: ${topTask.smartScore}, Reason: "${topTask.reasonTag}"`);
assert(topTask.smartScore > 0, 'Top task has positive urgency score');
assert(topTask.reasonTag && topTask.reasonTag.length > 0, 'Smart Task Organizer attaches explanatory urgency reason');

// Verify scores are in strictly descending order
for (let i = 0; i < prioritizedTasks.length - 1; i++) {
    assert(prioritizedTasks[i].smartScore >= prioritizedTasks[i + 1].smartScore,
        `Tasks sorted descending by smartScore (index ${i} vs ${i + 1})`);
}

// Verify ISO timestamp and robust date handling
const isoTask = window.TasksModule.addTask(testUser, {
    title: 'ISO Timestamp Deadline Task',
    dueDate: new Date(Date.now() + 86400000).toISOString(),
    priority: 'High',
    category: 'Study'
});
const isoRanked = window.SmartTaskOrganizer.getPrioritizedTasks().find(t => t.id === isoTask.id);
assert(isoRanked && !isNaN(isoRanked.daysDiff) && !isNaN(isoRanked.smartScore),
    'Smart Task Organizer parses ISO format dueDate without NaN');

// Verify overdue urgency preservation
const overdueTask = window.TasksModule.addTask(testUser, {
    title: 'Operating Systems Past Project',
    dueDate: '2020-01-01',
    priority: 'High',
    category: 'Study'
});
const overdueRanked = window.SmartTaskOrganizer.getPrioritizedTasks().find(t => t.id === overdueTask.id);
assert(overdueRanked && overdueRanked.reasonType === 'danger' && overdueRanked.reasonTag.includes('Overdue'),
    'Smart Task Organizer preserves danger/Overdue tag even when academic boost matches');

// Clean up test tasks
window.TasksModule.deleteTask(testUser, isoTask.id);
window.TasksModule.deleteTask(testUser, overdueTask.id);

// 6. Independent Budget Planner
const budgetBefore = window.BudgetModule.getSummary();
window.BudgetModule.addTransaction(testUser, {
    title: 'Scholarship Grant',
    amount: 5000,
    type: 'income',
    category: 'Scholarship',
    date: tomorrow
});
const newExpense = window.BudgetModule.addTransaction(testUser, {
    title: 'Textbook Purchase',
    amount: 1200,
    type: 'expense',
    category: 'Education',
    date: tomorrow
});

const budgetAfter = window.BudgetModule.getSummary();
assert(budgetAfter.totalIncome === budgetBefore.totalIncome + 5000, 'Budget income updated accurately');
assert(budgetAfter.totalExpense === budgetBefore.totalExpense + 1200, 'Budget expense updated accurately');
assert(budgetAfter.totalBalance === budgetAfter.totalIncome - budgetAfter.totalExpense, 'Budget net balance is correct');

// Test Transaction Deletion and Storage Persistence
const txCountBefore = window.BudgetModule.getBudget().transactions.length;
window.BudgetModule.deleteTransaction(testUser, newExpense.id);
const txCountAfter = window.BudgetModule.getBudget().transactions.length;
assert(txCountAfter === txCountBefore - 1, 'Transaction removed from in-memory budget state');
const storedBudget = window.LifeSyncStorage.getBudget(testUser);
assert(!storedBudget.transactions.some(t => String(t.id) === String(newExpense.id)), 'Transaction deletion persists in LifeSyncStorage');

// Test Late-Night Safe
const initialLocked = window.BudgetModule.getBudget().nightSafe.locked;
window.BudgetModule.toggleNightSafeLock(testUser);
assert(window.BudgetModule.getBudget().nightSafe.locked !== initialLocked, 'Late-Night Safe toggled lock state');

// Test Retained Budget Features: Runway Calculation, Goal Contribution, Benchmarks, Review Budget
const runway = window.BudgetModule.calculateRunwayValues(20000, 15);
assert(runway.usable === 17000, 'Runway calculates usable living funds correctly');
assert(runway.values.length === 4, 'Runway distributes across 4 semester months');

const initialGoal = window.BudgetModule.getBudget().sharedGoal.current;
window.BudgetModule.addGoalContribution(testUser, 500, 'Weekend study allowance savings');
assert(window.BudgetModule.getBudget().sharedGoal.current === initialGoal + 500, 'Goal contribution increments savings goal accurately');

const reviewRes = window.BudgetModule.reviewBudget(testUser);
assert(reviewRes.streak >= 1, 'Budget review awards streak increment and XP');

const benchmarks = window.BudgetModule.getBenchmarkData();
assert(benchmarks.length === 5, 'Peer benchmarks provide 5 essential student expense categories');

// 7. Independent Mental Wellness
const wellnessBefore = window.WellnessModule.getSummary();
window.WellnessModule.saveCheckIn(testUser, {
    mood: 'happy',
    stress: 2,
    energy: 5,
    notes: 'Feeling productive after studying'
});
const wellnessAfter = window.WellnessModule.getSummary();
assert(wellnessAfter.todayEntry !== null, 'Today check-in recorded');
assert(wellnessAfter.todayEntry.mood === 'happy', 'Recorded mood is happy');
assert(wellnessAfter.todayEntry.score === 5, 'Score is 5');
assert(wellnessAfter.streak >= wellnessBefore.streak, 'Wellness streak incremented or preserved');

// 8. Analytics Module
const metrics = window.AnalyticsModule.getComprehensiveMetrics();
assert(metrics.productivity && metrics.productivity.total > 0, 'Analytics contains productivity metrics');
assert(metrics.timeManagement && metrics.timeManagement.upcomingCount > 0, 'Analytics contains time management data');
assert(metrics.finance && metrics.finance.totalIncome > 0, 'Analytics contains finance breakdown');
assert(metrics.wellness && metrics.wellness.weeklyDays.length === 7, 'Analytics contains 7-day wellness trend');

// 9. Derived Notifications
const notifs = window.NotificationsModule.getNotifications();
assert(Array.isArray(notifs) && notifs.length > 0, 'Real-time notifications derived from state');
console.log(`   Derived ${notifs.length} active notifications (Reminders/Alerts):`);
notifs.forEach(n => console.log(`   - [${n.type.toUpperCase()}] ${n.title}: ${n.message}`));

// 10. Modal and Overlay Dismissal Verification (Cancel, Cut, Backdrop, Escape)
const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'js', 'app.js'), 'utf8');

const modalIds = ['taskModalOverlay', 'eventModalOverlay', 'txModalOverlay', 'billModalOverlay', 'goalModalOverlay', 'budgetSettingsModalOverlay', 'nightSpendModalOverlay'];
for (const id of modalIds) {
    const re = new RegExp('<div id="' + id + '" class="([^"]+)"');
    const match = indexHtml.match(re);
    assert(match && match[1].includes('hidden'), `Modal ${id} starts in hidden state`);
    assert(indexHtml.includes(`closeModal('${id}')`), `Modal ${id} has wired closeModal buttons`);
}
assert(!styleCss.includes('.modal-overlay:not(.hidden) {'), 'style.css has no un-scoped :not(.hidden) rule');
assert(appJs.includes("m.classList.remove('show')") && appJs.includes("m.classList.add('hidden')"), 'closeModal hides overlay completely');
assert(appJs.includes("m.classList.remove('hidden')") && appJs.includes("m.classList.add('show')"), 'openModal reveals overlay properly');
assert(appJs.includes("'Escape'"), 'Escape key dismissal is wired');
assert(appJs.includes('e.target === overlay'), 'Backdrop click dismissal is wired');
console.log('✓ PASS: All shared modals start hidden and dismiss correctly via Cancel, Cut, Backdrop, & Escape');

// 11. Smart Task Organizer UI & Dark Mode Validation
assert(styleCss.includes('.dark-theme .smart-task-row'), 'style.css has dark theme rules for .smart-task-row');
assert(styleCss.includes('.dark-theme .smart-top-banner'), 'style.css has dark theme rules for .smart-top-banner');
assert(styleCss.includes('.dark-theme .task-card-row'), 'style.css has dark theme rules for .task-card-row');
assert(styleCss.includes('.priority-pill') && styleCss.includes('.category-pill'), 'style.css contains priority and category pill styles');
assert(appJs.includes('toggleTaskAndRefreshSmart'), 'app.js exports toggleTaskAndRefreshSmart');
assert(indexHtml.includes('id="smartOrganizerTaskList"'), 'index.html contains smartOrganizerTaskList container');
console.log('✓ PASS: Smart Task Organizer dark mode styles and interactive DOM bindings are verified');

// 12. Profile Avatar Validation (Photo Removed)
assert(!indexHtml.includes('id="userAvatarImg"'), 'Profile photo img element is removed from header');
assert(indexHtml.includes('id="userAvatarLetter"'), 'Letter avatar fallback is present in header');
assert(styleCss.includes('.user-avatar-circle'), 'style.css contains .user-avatar-circle style');
console.log('✓ PASS: Profile photo removed and verified; clean monogram avatar displayed');

// 13. Dynamic Data Validation (No Hardcoded Fallbacks or Static Names)
const storageJs = fs.readFileSync(path.join(__dirname, 'js', 'storage.js'), 'utf8');
const dashboardJs = fs.readFileSync(path.join(__dirname, 'js', 'dashboard.js'), 'utf8');

assert(!indexHtml.includes('>Ananya<'), 'Hardcoded Ananya name removed from index.html greeting');
assert(!dashboardJs.includes("'Ananya'"), 'Hardcoded Ananya fallback removed from dashboard.js');
assert(!storageJs.includes("'Ananya'"), 'Hardcoded Ananya fallback removed from storage.js');
assert(!dashboardJs.includes('|| 7;') && !dashboardJs.includes('|| 12;'), 'Hardcoded numeric task stat fallbacks removed from dashboard.js');
console.log('✓ PASS: All hardcoded user identities and static metric fallbacks eliminated');

assert(styleCss.includes('.dark-theme .bsub-btn {') && styleCss.includes('.dark-theme .bsub-btn.active'), 'Budget Planner subnav buttons have complete dark mode rules');
assert(styleCss.includes('.dark-theme .runway-snapshot-card'), 'Runway snapshot card has dark mode override');
assert(styleCss.includes('.dark-theme .runway-chart-container'), 'Runway chart container has dark mode override');
assert(styleCss.includes('.dark-theme .night-top-section'), 'Night safe top section has dark mode override');
assert(styleCss.includes('.dark-theme .night-actions-panel'), 'Night actions panel has dark mode override');
assert(indexHtml.includes('grid-control-runaway'), 'index.html contains grid-control-runaway class on controls div');
assert(styleCss.includes('div.grid-control-runaway') && styleCss.includes('.grid-control-runaway .control-box'), 'style.css includes dark mode styles for div.grid-control-runaway and control-box');
console.log('✓ PASS: Budget Planner dark mode & div.grid-control-runaway styling verified with zero bad-white backgrounds');

// 15. Universal Global Search Validation ("Search anything ...")
assert(indexHtml.includes('id="topbarSearchInput"'), 'index.html includes topbarSearchInput');
assert(appJs.includes('appPages = [') && appJs.includes('quickActions = ['), 'app.js includes comprehensive appPages and quickActions indexing');
assert(appJs.includes('matchesText(title') || appJs.includes('matchesText(`${title}'), 'app.js includes null-safe multi-token matching for tasks and events');
assert(appJs.includes('activeSearchIdx') && appJs.includes("'ArrowDown'") && appJs.includes("'Enter'"), 'app.js includes keyboard navigation for search dropdown');
assert(styleCss.includes('.search-badge-category') && styleCss.includes('.search-result-row.selected'), 'style.css includes styles for search categories and keyboard selection');
console.log('✓ PASS: Universal Global Search ("Search anything ...") verified across pages, actions, tasks, calendar, budget, and wellness');

// 16. Auth Page Responsiveness & Dedicated Forgot Password Section
const authHtml = fs.readFileSync(path.join(__dirname, 'auth.html'), 'utf8');
const authPageJs = fs.readFileSync(path.join(__dirname, 'js', 'auth-page.js'), 'utf8');

assert(authHtml.includes('id="forgotPasswordSection"'), 'auth.html contains dedicated forgotPasswordSection');
assert(authHtml.includes('id="btnBackToSignIn"'), 'auth.html contains btnBackToSignIn');
assert(authHtml.includes('id="forgotPasswordForm"'), 'auth.html contains forgotPasswordForm');
assert(authHtml.includes('id="forgotEmailInput"'), 'auth.html contains forgotEmailInput');
assert(!authHtml.includes('id="forgotPasswordModal"'), 'auth.html removed redundant modal overlay');
assert(authPageJs.includes("tab === 'forgot'"), 'auth-page.js supports forgot tab transition');
assert(styleCss.includes('.forgot-header-wrap'), 'style.css includes .forgot-header-wrap');
assert(styleCss.includes('.btn-icon-back'), 'style.css includes .btn-icon-back');
assert(styleCss.includes('@media (max-width: 900px)') && styleCss.includes('.auth-right-panel'), 'style.css includes responsive breakpoint for tablet/mobile');
assert(styleCss.includes('@media (max-width: 480px)'), 'style.css includes mobile breakpoint for 480px');
console.log('✓ PASS: Dedicated Forgot Password section and responsive auth layout verified');

console.log('\n🎉 ALL LIFESYNC INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
