import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const getProfitAndLossReport = async (req: AuthRequest, res: Response) => {
  const { branch_id, start_date, end_date } = req.query;

  try {
    let incomeQuery = 'SELECT COALESCE(SUM(builty_amount + charges - discount), 0) as total_income FROM builtys WHERE 1=1';
    let expenseQuery = 'SELECT COALESCE(SUM(amount), 0) as total_expense FROM expenses WHERE 1=1';
    const params: any[] = [];

    if (branch_id && branch_id !== 'ALL' && branch_id !== 'all') {
      params.push(branch_id);
      incomeQuery += ` AND (branch_id = $${params.length} OR destination_branch_id = $${params.length})`;
      expenseQuery += ` AND branch_id = $${params.length}`;
    }

    if (start_date && end_date) {
      params.push(start_date, end_date);
      incomeQuery += ` AND DATE(created_at) BETWEEN $${params.length - 1} AND $${params.length}`;
      expenseQuery += ` AND DATE(expense_date) BETWEEN $${params.length - 1} AND $${params.length}`;
    }

    const incomeRes = await query(incomeQuery, params);
    const expenseRes = await query(expenseQuery, params);

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
  } catch (err) {
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

export const getDashboardStats = async (req: AuthRequest, res: Response) => {
  const { branch_id } = req.query;
  const user = req.user;

  try {
    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    let targetBranchId: any = branch_id;
    let targetCity: string | null = null;

    if (user?.role === 'SUB_ADMIN') {
      const userRes = await query('SELECT u.branch_id, b.city FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.id = $1', [user.id]);
      if (userRes.rows.length > 0) {
        targetBranchId = userRes.rows[0].branch_id;
        targetCity = userRes.rows[0].city;
      }
      if (!targetBranchId && user.branch_id) {
        targetBranchId = user.branch_id;
      }
    }

    if (targetBranchId && targetBranchId !== 'ALL' && targetBranchId !== 'all') {
      params.push(targetBranchId);
      const p1 = params.length;
      params.push(targetCity ? `%${targetCity}%` : '___NONE___');
      const p2 = params.length;
      whereClause += ` AND (branch_id = $${p1} OR destination_branch_id = $${p1} OR source_city ILIKE $${p2} OR destination_city ILIKE $${p2})`;
    }

    const totalRes = await query(`SELECT COUNT(*) FROM builtys${whereClause}`, params);
    const todayRes = await query(`SELECT COUNT(*) FROM builtys${whereClause} AND DATE(created_at) = CURRENT_DATE`, params);
    const pendingRes = await query(`SELECT COUNT(*) FROM builtys${whereClause} AND status = 'PENDING'`, params);
    const completedRes = await query(`SELECT COUNT(*) FROM builtys${whereClause} AND status = 'DELIVERED'`, params);

    return res.json({
      status: true,
      stats: {
        total_bookings: parseInt(totalRes.rows[0].count),
        today_bookings: parseInt(todayRes.rows[0].count),
        pending_bookings: parseInt(pendingRes.rows[0].count),
        completed_bookings: parseInt(completedRes.rows[0].count),
      },
    });
  } catch (err) {
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
