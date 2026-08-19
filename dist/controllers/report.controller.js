"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = exports.getProfitAndLossReport = void 0;
const pool_1 = require("../db/pool");
const getProfitAndLossReport = async (req, res) => {
    const { branch_id, start_date, end_date } = req.query;
    try {
        let incomeQuery = 'SELECT COALESCE(SUM(builty_amount + charges - discount), 0) as total_income FROM builtys WHERE 1=1';
        let expenseQuery = 'SELECT COALESCE(SUM(amount), 0) as total_expense FROM expenses WHERE 1=1';
        const params = [];
        if (branch_id) {
            params.push(branch_id);
            incomeQuery += ` AND branch_id = $${params.length}`;
            expenseQuery += ` AND branch_id = $${params.length}`;
        }
        if (start_date && end_date) {
            params.push(start_date, end_date);
            incomeQuery += ` AND DATE(created_at) BETWEEN $${params.length - 1} AND $${params.length}`;
            expenseQuery += ` AND DATE(expense_date) BETWEEN $${params.length - 1} AND $${params.length}`;
        }
        const incomeRes = await (0, pool_1.query)(incomeQuery, params);
        const expenseRes = await (0, pool_1.query)(expenseQuery, params);
        const totalIncome = parseFloat(incomeRes.rows[0].total_income || '0');
        const totalExpense = parseFloat(expenseRes.rows[0].total_expense || '0');
        const netProfit = totalIncome - totalExpense;
        return res.json({
            status: true,
            report: {
                total_income: totalIncome,
                total_expense: totalExpense,
                net_profit: netProfit,
                is_profit: netProfit >= 0,
            },
        });
    }
    catch (err) {
        return res.json({
            status: true,
            report: {
                total_income: 0.0,
                total_expense: 0.0,
                net_profit: 0.0,
                is_profit: true,
            },
        });
    }
};
exports.getProfitAndLossReport = getProfitAndLossReport;
const getDashboardStats = async (req, res) => {
    try {
        const totalRes = await (0, pool_1.query)('SELECT COUNT(*) FROM builtys');
        const todayRes = await (0, pool_1.query)('SELECT COUNT(*) FROM builtys WHERE DATE(created_at) = CURRENT_DATE');
        const pendingRes = await (0, pool_1.query)("SELECT COUNT(*) FROM builtys WHERE status = 'PENDING'");
        const completedRes = await (0, pool_1.query)("SELECT COUNT(*) FROM builtys WHERE status = 'DELIVERED'");
        return res.json({
            status: true,
            stats: {
                total_bookings: parseInt(totalRes.rows[0].count),
                today_bookings: parseInt(todayRes.rows[0].count),
                pending_bookings: parseInt(pendingRes.rows[0].count),
                completed_bookings: parseInt(completedRes.rows[0].count),
            },
        });
    }
    catch (err) {
        return res.json({
            status: true,
            stats: {
                total_bookings: 0,
                today_bookings: 0,
                pending_bookings: 0,
                completed_bookings: 0,
            },
        });
    }
};
exports.getDashboardStats = getDashboardStats;
