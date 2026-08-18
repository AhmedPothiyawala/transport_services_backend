import { Request, Response } from 'express';
import { query } from '../db/pool';

const memoryExpenses: any[] = [];

export const addExpense = async (req: Request, res: Response) => {
  const { builty_id, branch_id, expense_title, amount, notes } = req.body;

  if (!expense_title || !amount) {
    return res.status(400).json({ status: false, message: 'Expense Title and Amount are required' });
  }

  const amt = parseFloat(amount);

  try {
    const dbRes = await query(
      'INSERT INTO expenses (builty_id, branch_id, expense_title, amount, notes) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [builty_id || null, branch_id || 1, expense_title, amt, notes || '']
    );
    return res.json({ status: true, message: 'Expense recorded successfully', expense: dbRes.rows[0] });
  } catch (err) {
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

export const getExpenses = async (req: Request, res: Response) => {
  try {
    const dbRes = await query('SELECT * FROM expenses ORDER BY id DESC');
    return res.json({ status: true, expenses: dbRes.rows });
  } catch (err) {
    return res.json({ status: true, expenses: memoryExpenses });
  }
};
