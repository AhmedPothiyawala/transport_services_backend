"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getExpenses = exports.addExpense = void 0;
const pool_1 = require("../db/pool");
const memoryExpenses = [];
const addExpense = async (req, res) => {
    const { builty_id, branch_id, expense_title, amount, notes } = req.body;
    if (!expense_title || !amount) {
        return res.status(400).json({ status: false, message: 'Expense Title and Amount are required' });
    }
    const amt = parseFloat(amount);
    try {
        const dbRes = await (0, pool_1.query)('INSERT INTO expenses (builty_id, branch_id, expense_title, amount, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *', [builty_id || null, branch_id || 1, expense_title, amt, notes || '']);
        return res.json({ status: true, message: 'Expense recorded successfully', expense: dbRes.rows[0] });
    }
    catch (err) {
        const newExp = {
            id: memoryExpenses.length + 1,
            builty_id: builty_id || null,
            branch_id: branch_id || 1,
            expense_title,
            amount: amt,
            expense_date: new Date().toISOString().split('T')[0],
            notes: notes || ''
        };
        memoryExpenses.push(newExp);
        return res.json({ status: true, message: 'Expense recorded successfully', expense: newExp });
    }
};
exports.addExpense = addExpense;
const getExpenses = async (req, res) => {
    try {
        const dbRes = await (0, pool_1.query)('SELECT * FROM expenses ORDER BY id DESC');
        return res.json({ status: true, expenses: dbRes.rows });
    }
    catch (err) {
        return res.json({ status: true, expenses: memoryExpenses });
    }
};
exports.getExpenses = getExpenses;
