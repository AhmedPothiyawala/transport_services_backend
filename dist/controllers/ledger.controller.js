"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addPaymentEntry = exports.getOutstandingSummary = exports.getPartyLedger = void 0;
const pool_1 = require("../db/pool");
const memoryLedgers = [];
const getPartyLedger = async (req, res) => {
    const { party_name, start_date, end_date } = req.query;
    const user = req.user;
    try {
        let sql = 'SELECT * FROM ledgers WHERE 1=1';
        const params = [];
        if (user?.role === 'USER') {
            params.push(`%${user.name}%`);
            sql += ` AND party_name ILIKE $${params.length}`;
        }
        else if (party_name) {
            params.push(`%${party_name}%`);
            sql += ` AND party_name ILIKE $${params.length}`;
        }
        if (start_date && end_date) {
            params.push(start_date, end_date);
            sql += ` AND DATE(created_at) BETWEEN $${params.length - 1} AND $${params.length}`;
        }
        sql += ' ORDER BY id DESC';
        const dbRes = await (0, pool_1.query)(sql, params);
        return res.json({ status: true, ledgers: dbRes.rows });
    }
    catch (err) {
        let filtered = [...memoryLedgers];
        if (user?.role === 'USER') {
            const pStr = user.name.toLowerCase();
            filtered = filtered.filter(l => l.party_name.toLowerCase().includes(pStr));
        }
        else if (party_name) {
            const pStr = String(party_name).toLowerCase();
            filtered = filtered.filter(l => l.party_name.toLowerCase().includes(pStr));
        }
        return res.json({ status: true, ledgers: filtered });
    }
};
exports.getPartyLedger = getPartyLedger;
const getOutstandingSummary = async (req, res) => {
    const user = req.user;
    try {
        let sql = `
      SELECT 
        party_name,
        SUM(CASE WHEN account_type = 'DEBIT' THEN amount ELSE 0 END) as total_debit,
        SUM(CASE WHEN account_type = 'CREDIT' THEN amount ELSE 0 END) as total_credit,
        (SUM(CASE WHEN account_type = 'DEBIT' THEN amount ELSE 0 END) - SUM(CASE WHEN account_type = 'CREDIT' THEN amount ELSE 0 END)) as outstanding_balance
      FROM ledgers
    `;
        const params = [];
        if (user?.role === 'USER') {
            params.push(`%${user.name}%`);
            sql += ` WHERE party_name ILIKE $1`;
        }
        sql += ` GROUP BY party_name`;
        const dbRes = await (0, pool_1.query)(sql, params);
        return res.json({ status: true, party_summaries: dbRes.rows });
    }
    catch (err) {
        const map = {};
        memoryLedgers.forEach(l => {
            if (user?.role === 'USER' && !l.party_name.toLowerCase().includes(user.name.toLowerCase())) {
                return;
            }
            if (!map[l.party_name]) {
                map[l.party_name] = { party_name: l.party_name, total_debit: 0, total_credit: 0, outstanding_balance: 0 };
            }
            if (l.account_type === 'DEBIT')
                map[l.party_name].total_debit += l.amount;
            if (l.account_type === 'CREDIT')
                map[l.party_name].total_credit += l.amount;
            map[l.party_name].outstanding_balance = map[l.party_name].total_debit - map[l.party_name].total_credit;
        });
        return res.json({ status: true, party_summaries: Object.values(map) });
    }
};
exports.getOutstandingSummary = getOutstandingSummary;
const addPaymentEntry = async (req, res) => {
    const { party_name, builty_id, account_type, amount, payment_method, remarks } = req.body;
    if (!party_name || !account_type || !amount) {
        return res.status(400).json({ status: false, message: 'Party Name, Account Type, and Amount are required' });
    }
    const amt = parseFloat(amount);
    try {
        const insertRes = await (0, pool_1.query)('INSERT INTO ledgers (party_name, builty_id, account_type, amount, balance, payment_method, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *', [party_name, builty_id || null, account_type, amt, amt, payment_method || 'CASH', remarks || '']);
        return res.json({ status: true, message: 'Ledger entry recorded', ledger: insertRes.rows[0] });
    }
    catch (err) {
        const newLedger = {
            id: memoryLedgers.length + 1,
            party_name,
            builty_id: builty_id || null,
            account_type,
            amount: amt,
            balance: amt,
            payment_method: payment_method || 'CASH',
            remarks: remarks || '',
            created_at: new Date().toISOString()
        };
        memoryLedgers.push(newLedger);
        return res.json({ status: true, message: 'Ledger entry recorded', ledger: newLedger });
    }
};
exports.addPaymentEntry = addPaymentEntry;
