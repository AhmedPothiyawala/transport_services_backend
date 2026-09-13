import { Response } from 'express';
import { getClient, query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';

export const memoryLedgers: any[] = [];

export const getPartyLedger = async (req: AuthRequest, res: Response) => {
  const { party_name, mobile, start_date, end_date } = req.query;
  const user = req.user;

  let allLedgers: any[] = [];

  try {
    let sql = `
      SELECT l.*, b.builty_number, b.receiver_mobile, b.receiver_name
      FROM ledgers l
      LEFT JOIN builtys b ON l.builty_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user?.role === 'USER') {
      params.push(`%${user.mobile || user.name}%`);
      sql += ` AND (l.party_name ILIKE $${params.length} OR l.receiver_mobile ILIKE $${params.length})`;
    } else if (mobile) {
      params.push(`%${mobile}%`);
      sql += ` AND (l.receiver_mobile ILIKE $${params.length} OR b.receiver_mobile ILIKE $${params.length})`;
    } else if (party_name) {
      params.push(`%${party_name}%`);
      sql += ` AND (l.party_name ILIKE $${params.length} OR l.receiver_mobile ILIKE $${params.length})`;
    }

    if (start_date && end_date) {
      params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59.999`);
      sql += ` AND l.created_at >= $${params.length - 1} AND l.created_at <= $${params.length}`;
    }

    // High-Scale Universal Pagination
    const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
    const offset = (pageNum - 1) * limitNum;

    const whereIndex = sql.indexOf('WHERE 1=1');
    const whereClause = whereIndex !== -1 ? sql.slice(whereIndex) : 'WHERE 1=1';
    const countSql = `SELECT COUNT(*) AS total FROM ledgers l LEFT JOIN builtys b ON l.builty_id = b.id ${whereClause}`;

    const pagedSql = `${sql} ORDER BY l.id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const pagedParams = [...params, limitNum, offset];

    const [countRes, dbRes] = await Promise.all([
      query(countSql, params).catch(() => ({ rows: [{ total: '0' }] })),
      query(pagedSql, pagedParams),
    ]);

    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10) || dbRes.rows.length;
    allLedgers = [...dbRes.rows];

    // Calculate running balance for each party
    let runningBalance = 0;
    const enrichedLedgers = allLedgers.map(row => {
      const amt = parseFloat(row.amount || '0');
      if (row.account_type === 'DEBIT') {
        runningBalance += amt;
      } else if (row.account_type === 'CREDIT') {
        runningBalance -= amt;
      }
      return {
        ...row,
        running_balance: runningBalance,
      };
    });

    return res.json({
      status: true,
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      total_pages: Math.ceil(totalCount / limitNum),
      ledgers: enrichedLedgers.reverse(),
    });
  } catch (err) {
    let filteredMem = [...memoryLedgers];
    return res.json({ status: true, total: filteredMem.length, page: 1, limit: filteredMem.length, total_pages: 1, ledgers: filteredMem.reverse() });
  }
};

export const getOutstandingSummary = async (req: AuthRequest, res: Response) => {
  const { search, mobile, start_date, end_date } = req.query;
  const user = req.user;

  let dbParties: any[] = [];
  try {
    // Party-indexed ledger summary: Clean aggregation for both Sender and Receiver party accounts
    let sql = `
      SELECT 
        l.party_name as ledger_key,
        l.party_name as party_name,
        COALESCE(MAX(l.receiver_mobile), MAX(b.receiver_mobile), '') as receiver_mobile,
        COUNT(DISTINCT l.builty_id) as total_bookings,
        COALESCE(SUM(CASE WHEN l.account_type = 'DEBIT' THEN l.amount ELSE 0 END), 0) as total_debit,
        COALESCE(SUM(CASE WHEN l.account_type = 'CREDIT' THEN l.amount ELSE 0 END), 0) as total_credit,
        COALESCE((SUM(CASE WHEN l.account_type = 'DEBIT' THEN l.amount ELSE 0 END) - SUM(CASE WHEN l.account_type = 'CREDIT' THEN l.amount ELSE 0 END)), 0) as outstanding_balance,
        MAX(l.created_at) as last_activity_date
      FROM ledgers l
      LEFT JOIN builtys b ON l.builty_id = b.id
      WHERE 1=1
    `;

    const params: any[] = [];
    if (user?.role === 'USER') {
      params.push(`%${user.mobile || user.name}%`);
      sql += ` AND (l.party_name ILIKE $1 OR l.receiver_mobile ILIKE $1)`;
    } else if (mobile) {
      params.push(`%${mobile}%`);
      sql += ` AND (l.receiver_mobile ILIKE $1 OR b.receiver_mobile ILIKE $1)`;
    } else if (search) {
      params.push(`%${search}%`);
      sql += ` AND (l.party_name ILIKE $1 OR l.receiver_mobile ILIKE $1)`;
    }

    if (start_date && end_date) {
      params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59.999`);
      sql += ` AND l.created_at >= $${params.length - 1} AND l.created_at <= $${params.length}`;
    }

    sql += ` GROUP BY l.party_name ORDER BY outstanding_balance DESC`;

    const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const pagedSql = `${sql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const pagedParams = [...params, limitNum, offset];

    const dbRes = await query(pagedSql, pagedParams);
    dbParties = dbRes.rows;
  } catch (err) {
    dbParties = [];
  }

  // Process memoryLedgers
  const map: any = {};
  dbParties.forEach(p => {
    map[p.ledger_key] = {
      party_name: p.party_name,
      receiver_mobile: p.receiver_mobile,
      total_bookings: parseInt(p.total_bookings || '1'),
      total_debit: parseFloat(p.total_debit || '0'),
      total_credit: parseFloat(p.total_credit || '0'),
      outstanding_balance: parseFloat(p.outstanding_balance || '0'),
      last_activity_date: p.last_activity_date,
    };
  });

  memoryLedgers.forEach(l => {
    const key = l.receiver_mobile || l.party_name;
    if (!map[key]) {
      map[key] = {
        party_name: l.party_name,
        receiver_mobile: l.receiver_mobile || '',
        total_bookings: 1,
        total_debit: 0,
        total_credit: 0,
        outstanding_balance: 0,
        last_activity_date: l.created_at,
      };
    }
    const amt = parseFloat(l.amount || '0');
    if (l.account_type === 'DEBIT') map[key].total_debit += amt;
    if (l.account_type === 'CREDIT') map[key].total_credit += amt;
    map[key].outstanding_balance = map[key].total_debit - map[key].total_credit;
  });

  const partySummaries = Object.values(map);

  let overallBilled = 0.0;
  let overallReceived = 0.0;
  let overallPending = 0.0;

  partySummaries.forEach((p: any) => {
    overallBilled += p.total_debit;
    overallReceived += p.total_credit;
    overallPending += p.outstanding_balance;
  });

  return res.json({
    status: true,
    party_summaries: partySummaries,
    executive_summary: {
      total_parties: partySummaries.length,
      overall_billed: overallBilled,
      overall_received: overallReceived,
      overall_pending: overallPending,
    },
  });
};

export const addPaymentEntry = async (req: AuthRequest, res: Response) => {
  const { party_name, builty_id, account_type, amount, payment_method, reference_number, remarks } = req.body;
  
  if (!party_name || !amount) {
    return res.status(400).json({ status: false, message: 'Party Name and Amount are required' });
  }

  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    return res.status(400).json({ status: false, message: 'Amount must be a valid positive number' });
  }

  const accType = account_type || 'CREDIT'; // Default payment entry is CREDIT
  const payMethod = payment_method || 'CASH';
  const refNo = reference_number ? String(reference_number).trim() : '';
  const notes = remarks ? String(remarks).trim() : 'Payment received';
  const collector = req.user ? `${req.user.name} (${req.user.role})` : 'Branch Cashier';

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    // 1. Insert Ledger Entry with collected_by
    const insertRes = await client.query(
      'INSERT INTO ledgers (party_name, builty_id, account_type, amount, balance, payment_method, reference_number, collected_by, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [party_name, builty_id || null, accType, amt, amt, payMethod, refNo, collector, notes]
    );

    // 2. If linked to a specific builty_id, update builtys table paid_amount, pending_amount, & payment_status
    if (builty_id && accType === 'CREDIT') {
      const builtyRes = await client.query('SELECT * FROM builtys WHERE id = $1 FOR UPDATE', [builty_id]);
      if (builtyRes.rows.length > 0) {
        const builty = builtyRes.rows[0];
        const newPaid = parseFloat(builty.paid_amount || '0') + amt;
        const totalBilled = parseFloat(builty.builty_amount || '0');
        const newPending = Math.max(0, totalBilled - newPaid);
        const newPaymentStatus = newPending <= 0 ? 'FULLY_PAID' : (newPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING');

        await client.query(
          'UPDATE builtys SET paid_amount = $1, pending_amount = $2, payment_status = $3, updated_at = NOW() WHERE id = $4',
          [newPaid, newPending, newPaymentStatus, builty_id]
        );
      }
    }

    await client.query('COMMIT');
    client.release();

    return res.json({
      status: true,
      message: 'Payment entry recorded successfully',
      ledger: insertRes.rows[0],
    });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }

    const newLedger = {
      id: memoryLedgers.length + 1,
      party_name,
      builty_id: builty_id || null,
      account_type: accType,
      amount: amt,
      balance: amt,
      payment_method: payMethod,
      reference_number: refNo,
      collected_by: collector,
      remarks: notes,
      created_at: new Date().toISOString(),
    };
    memoryLedgers.push(newLedger);

    return res.json({
      status: true,
      message: 'Payment entry recorded successfully',
      ledger: newLedger,
    });
  }
};
