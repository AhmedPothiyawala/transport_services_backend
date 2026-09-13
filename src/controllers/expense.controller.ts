import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

const memoryExpenses: any[] = [];

export const addExpense = async (req: AuthRequest, res: Response) => {
  const { builty_id, branch_id, customer_id, expense_title, category, amount, expense_date, notes } = req.body;

  if (!expense_title || !expense_title.trim()) {
    return res.status(400).json({ status: false, message: 'Expense Title / Reason is required' });
  }

  if (amount === undefined || amount === null || String(amount).trim() === '') {
    return res.status(400).json({ status: false, message: 'Expense Amount is required' });
  }

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ status: false, message: 'Expense amount must be a valid positive number greater than zero' });
  }

  let finalBranchId: number | null = branch_id ? parseInt(branch_id.toString(), 10) : 1;
  const user = req.user;
  const subAdminId = user?.id || null;
  const customerIdNum = customer_id ? parseInt(customer_id.toString(), 10) : null;

  try {
    // Sub-Admin (Branch Manager) authorization & branch scoping guard
    if (user?.role === 'SUB_ADMIN') {
      let subBranchId = user.branch_id;
      if (!subBranchId) {
        const uRes = await query('SELECT branch_id FROM users WHERE id = $1', [user.id]);
        if (uRes.rows.length > 0) subBranchId = uRes.rows[0].branch_id;
      }
      finalBranchId = subBranchId || 1;

      // Verify that customer belongs to this Sub-Admin's branch
      if (customerIdNum) {
        const custRes = await query('SELECT id, branch_id FROM users WHERE id = $1', [customerIdNum]);
        if (custRes.rows.length === 0 || custRes.rows[0].branch_id !== finalBranchId) {
          return res.status(403).json({
            status: false,
            message: 'Access Denied: Branch Managers can only log expenses for customers within their own branch.',
          });
        }
      }
    }

    const expDate = expense_date && String(expense_date).trim().length > 0
      ? String(expense_date).trim()
      : new Date().toISOString().split('T')[0];

    const cat = category ? String(category).trim().toUpperCase() : 'MISC';

    const dbRes = await query(
      `INSERT INTO expenses (builty_id, branch_id, sub_admin_id, customer_id, expense_title, category, amount, expense_date, notes) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [builty_id || null, finalBranchId, subAdminId, customerIdNum, expense_title.trim(), cat, amt, expDate, notes || '']
    );

    return res.json({
      status: true,
      message: 'Customer expense recorded successfully',
      expense: dbRes.rows[0],
    });
  } catch (err: any) {
    const expDate = expense_date || new Date().toISOString().split('T')[0];
    const newExp = {
      id: memoryExpenses.length + 1,
      builty_id: builty_id || null,
      branch_id: finalBranchId,
      sub_admin_id: subAdminId,
      customer_id: customerIdNum,
      expense_title: expense_title.trim(),
      category: category || 'MISC',
      amount: amt,
      expense_date: expDate,
      notes: notes || '',
    };
    memoryExpenses.push(newExp);
    return res.json({ status: true, message: 'Customer expense recorded successfully', expense: newExp });
  }
};

export const getExpenses = async (req: AuthRequest, res: Response) => {
  const { branch_id, customer_id, start_date, end_date } = req.query;
  const user = req.user;

  try {
    let sql = `
      SELECT e.*, 
             c.name AS customer_name, c.mobile AS customer_mobile,
             s.name AS added_by_name, s.role AS added_by_role,
             b.branch_name, b.city AS branch_city,
             bt.builty_number
      FROM expenses e
      LEFT JOIN users c ON e.customer_id = c.id
      LEFT JOIN users s ON e.sub_admin_id = s.id
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN builtys bt ON e.builty_id = bt.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Branch scoping for Sub-Admin (Branch Manager)
    if (user?.role === 'SUB_ADMIN') {
      let subBranchId = user.branch_id;
      if (!subBranchId) {
        const uRes = await query('SELECT branch_id FROM users WHERE id = $1', [user.id]);
        if (uRes.rows.length > 0) subBranchId = uRes.rows[0].branch_id;
      }
      params.push(subBranchId || -1);
      sql += ` AND e.branch_id = $${params.length}`;
    } else if (branch_id && branch_id !== 'ALL' && branch_id !== 'all') {
      params.push(parseInt(String(branch_id), 10));
      sql += ` AND e.branch_id = $${params.length}`;
    }

    // Role scoping for Customer (USER)
    if (user?.role === 'USER') {
      params.push(user.id);
      sql += ` AND e.customer_id = $${params.length}`;
    } else if (customer_id && customer_id !== 'ALL' && customer_id !== 'all') {
      params.push(parseInt(String(customer_id), 10));
      sql += ` AND e.customer_id = $${params.length}`;
    }

    if (start_date && end_date) {
      params.push(start_date, end_date);
      sql += ` AND e.expense_date BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    // High-Scale Universal Pagination (Default 50, Max 200)
    const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const whereIndex = sql.indexOf('WHERE 1=1');
    const whereClause = whereIndex !== -1 ? sql.slice(whereIndex) : 'WHERE 1=1';
    const countSql = `SELECT COUNT(*) AS total FROM expenses e LEFT JOIN users c ON e.customer_id = c.id LEFT JOIN users s ON e.sub_admin_id = s.id LEFT JOIN branches b ON e.branch_id = b.id ${whereClause}`;

    const pagedSql = `${sql} ORDER BY e.expense_date DESC, e.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const pagedParams = [...params, limitNum, offset];

    const [countRes, dbRes] = await Promise.all([
      query(countSql, params).catch(() => ({ rows: [{ total: '0' }] })),
      query(pagedSql, pagedParams),
    ]);

    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10) || dbRes.rows.length;
    return res.json({
      status: true,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(totalCount / limitNum),
      expenses: dbRes.rows,
    });
  } catch (err) {
    let filtered = [...memoryExpenses];
    if (user?.role === 'SUB_ADMIN') {
      filtered = filtered.filter(e => e.branch_id === user.branch_id);
    } else if (user?.role === 'USER') {
      filtered = filtered.filter(e => e.customer_id === user.id);
    }
    return res.json({ status: true, total: filtered.length, page: 1, limit: filtered.length, total_pages: 1, expenses: filtered });
  }
};
