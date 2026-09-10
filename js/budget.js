/**
 * LifeSync - Budget Planner Module (js/budget.js)
 * -------------------------------------------------------------
 * INDEPENDENT MODULE: Tracks student finances, income, expenses,
 * runway, late-night safe, and bills.
 * Reports summary data directly to Dashboard.
 */

(function () {
    'use strict';

    let currentBudget = {
        monthlyBudget: 15000,
        runway: { sum: 20000, bufferPct: 15 },
        nightSafe: { limit: 500, spent: 120, locked: false, lastResetDate: new Date().toISOString().split('T')[0] },
        sharedGoal: { title: 'Emergency / Tech Fund', current: 4500, target: 8000, etaWeeks: 4 },
        transactions: [],
        bills: []
    };

    const budgetChangeListeners = [];

    function notifyChange() {
        budgetChangeListeners.forEach(fn => {
            try { fn(currentBudget); } catch (e) { console.error('Budget listener error:', e); }
        });
    }

    const BudgetModule = {
        init(user) {
            currentBudget = window.LifeSyncStorage.getBudget(user);
            return currentBudget;
        },

        getBudget() {
            return currentBudget;
        },

        onChange(callback) {
            if (typeof callback === 'function') {
                budgetChangeListeners.push(callback);
            }
        },

        addTransaction(user, txData) {
            const amount = Number(txData.amount);
            if (!amount || amount <= 0) throw new Error('Valid amount is required.');
            if (!txData.title || !txData.title.trim()) throw new Error('Title is required.');

            const newTx = {
                id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                title: txData.title.trim(),
                amount: amount,
                type: txData.type === 'income' ? 'income' : 'expense',
                category: txData.category || (txData.type === 'income' ? 'Allowance' : 'Food'),
                date: txData.date || new Date().toISOString().split('T')[0],
                description: (txData.description || '').trim()
            };

            currentBudget.transactions.unshift(newTx);
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
            return newTx;
        },

        deleteTransaction(user, txId) {
            currentBudget.transactions = currentBudget.transactions.filter(t => t.id !== txId);
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
        },

        setMonthlyBudget(user, limit) {
            const num = Number(limit);
            if (num > 0) {
                currentBudget.monthlyBudget = num;
                window.LifeSyncStorage.saveBudget(user, currentBudget);
                notifyChange();
            }
        },

        // --- BILLS ---
        addBill(user, billData) {
            const amount = Number(billData.amount);
            if (!amount || !billData.title) throw new Error('Valid bill title and amount are required.');

            const newBill = {
                id: 'b_' + Date.now(),
                title: billData.title.trim(),
                amount: amount,
                split: Math.max(1, Number(billData.split) || 1),
                date: billData.date || new Date().toISOString().split('T')[0],
                paid: false
            };

            currentBudget.bills.push(newBill);
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
            return newBill;
        },

        toggleBillPaid(user, billId) {
            const bill = currentBudget.bills.find(b => b.id === billId);
            if (bill) {
                bill.paid = !bill.paid;
                window.LifeSyncStorage.saveBudget(user, currentBudget);
                notifyChange();
            }
        },

        deleteBill(user, billId) {
            currentBudget.bills = currentBudget.bills.filter(b => b.id !== billId);
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
        },

        // --- NIGHT SAFE ---
        toggleNightSafeLock(user) {
            currentBudget.nightSafe.locked = !currentBudget.nightSafe.locked;
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
            return currentBudget.nightSafe.locked;
        },

        recordNightSpend(user, amount) {
            const val = Number(amount);
            if (!val || val <= 0) return false;
            if (currentBudget.nightSafe.locked) throw new Error('Wallet is locked! Protect your night budget 🌙');

            if (currentBudget.nightSafe.spent + val > currentBudget.nightSafe.limit) {
                throw new Error('This purchase would exceed tonight’s safety limit 🚫');
            }

            currentBudget.nightSafe.spent += val;
            // Also log as an expense transaction
            currentBudget.transactions.unshift({
                id: 'tx_ns_' + Date.now(),
                title: 'Late-Night Spend',
                amount: val,
                type: 'expense',
                category: 'Food',
                date: new Date().toISOString().split('T')[0],
                description: 'Late-night safe logged expenditure'
            });

            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
            return true;
        },

        // --- RUNWAY ---
        updateRunway(user, sum, bufferPct) {
            currentBudget.runway.sum = Math.max(0, Number(sum) || 0);
            currentBudget.runway.bufferPct = Math.max(0, Math.min(100, Number(bufferPct) || 15));
            window.LifeSyncStorage.saveBudget(user, currentBudget);
            notifyChange();
        },

        // --- SUMMARY REPORT (Exported directly to Dashboard) ---
        getSummary() {
            const now = new Date();
            const curMonth = String(now.getMonth() + 1).padStart(2, '0');
            const curYear = String(now.getFullYear());
            const curMonthPrefix = `${curYear}-${curMonth}`;

            let totalIncome = 0;
            let totalExpense = 0;
            let spentThisMonth = 0;
            const categorySpending = {};

            currentBudget.transactions.forEach(tx => {
                const amt = Number(tx.amount) || 0;
                if (tx.type === 'income') {
                    totalIncome += amt;
                } else {
                    totalExpense += amt;
                    if (tx.date && tx.date.startsWith(curMonthPrefix)) {
                        spentThisMonth += amt;
                    }
                    categorySpending[tx.category] = (categorySpending[tx.category] || 0) + amt;
                }
            });

            const monthlyBudget = currentBudget.monthlyBudget || 15000;
            const remainingBudget = Math.max(0, monthlyBudget - spentThisMonth);
            const budgetUsagePct = Math.min(100, Math.round((spentThisMonth / monthlyBudget) * 100));
            const totalBalance = totalIncome - totalExpense;

            return {
                totalIncome,
                totalExpense,
                totalBalance,
                monthlyBudget,
                spentThisMonth,
                remainingBudget,
                budgetUsagePct,
                isWarning: budgetUsagePct >= 80 && budgetUsagePct < 100,
                isExceeded: spentThisMonth > monthlyBudget,
                categorySpending,
                runway: currentBudget.runway,
                nightSafe: currentBudget.nightSafe,
                recentTransactions: currentBudget.transactions.slice(0, 5)
            };
        }
    };

    window.BudgetModule = BudgetModule;
})();
