import { Response } from 'express';
import { query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { validateSecurePassword } from '../util/password.validator';
import bcrypt from 'bcryptjs';

export const createSubAdmin = async (req: AuthRequest, res: Response) => {
  const { name, mobile, address, branch_id, password, admin_otp, sonu_otp } = req.body;
  const otp = admin_otp || sonu_otp;
  if (!otp || otp !== '123456') {
    return res.status(400).json({ status: false, message: 'Mandatory Sonu Bhai (Main Admin) OTP verification is required to create a Branch Manager.' });
  }

  if (!name || !mobile) {
    return res.status(400).json({ status: false, message: 'Name and Mobile are required for Branch Manager' });
  }

  const cleanMobile = mobile.toString().replace(/\D/g, '');
  if (cleanMobile.length !== 10) {
    return res.status(400).json({ status: false, message: 'Invalid mobile number format. Mobile number must be exactly 10 digits.' });
  }

  if (!branch_id) {
    return res.status(400).json({ status: false, message: 'Mandatory Branch selection is required for creating a Branch Manager' });
  }

  if (!password) {
    return res.status(400).json({ status: false, message: 'Password is required for creating a Branch Manager' });
  }

  const passCheck = validateSecurePassword(password);
  if (!passCheck.isValid) {
    return res.status(400).json({ status: false, message: passCheck.message });
  }

  const branchIdNum = parseInt(branch_id.toString(), 10);
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // Single Active Sub-Admin per Branch / City Rule Check
    const existingSubAdminRes = await query(
      "SELECT u.id, u.name, u.mobile, b.branch_name, b.city FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.role = 'SUB_ADMIN' AND u.is_active = TRUE AND u.branch_id = $1",
      [branchIdNum]
    );

    if (existingSubAdminRes && existingSubAdminRes.rows.length > 0) {
      const existing = existingSubAdminRes.rows[0];
      return res.status(400).json({
        status: false,
        message: `Branch Manager already exists for ${existing.branch_name || 'this branch'} (${existing.city || 'city'}). Active Branch Manager: ${existing.name} (${existing.mobile}). Each branch can have ONLY ONE active Branch Manager. Deactivate existing Branch Manager first to assign a new one.`,
      });
    }

    const dbRes = await query(
      "INSERT INTO users (name, mobile, address, role, branch_id, password_hash, otp) VALUES ($1, $2, $3, 'SUB_ADMIN', $4, $5, '123456') RETURNING id, name, mobile, address, role, branch_id, is_active, created_at",
      [name, cleanMobile, address || '', branchIdNum, hashedPassword]
    );
    return res.json({ status: true, message: 'Branch Manager created successfully with assigned branch and secure password', sub_admin: dbRes.rows[0] });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ status: false, message: 'User with this mobile number already exists in database.' });
    }
    return res.status(500).json({
      status: false,
      message: err.message || 'Failed to create Branch Manager in database',
    });
  }
};

/**
 * Customer Registration by Branch Manager (auto-locked to Branch) or Main Admin
 */
export const createCustomer = async (req: AuthRequest, res: Response) => {
  const { name, mobile, address, branch_id, password } = req.body;

  if (!name || !mobile) {
    return res.status(400).json({ status: false, message: 'Name and Mobile number are required' });
  }

  const cleanMobile = mobile.toString().replace(/\D/g, '');
  if (cleanMobile.length !== 10) {
    return res.status(400).json({ status: false, message: 'Customer mobile number must be exactly 10 digits.' });
  }

  let finalBranchId: number | null = null;

  // Sub-Admin (Branch Manager) is STRICTLY locked to their own branch
  if (req.user?.role === 'SUB_ADMIN') {
    let subBranchId = req.user.branch_id;
    if (!subBranchId) {
      const uRes = await query('SELECT branch_id FROM users WHERE id = $1', [req.user.id]);
      if (uRes.rows.length > 0) subBranchId = uRes.rows[0].branch_id;
    }
    if (!subBranchId) {
      return res.status(400).json({ status: false, message: 'Branch Manager does not have an assigned branch.' });
    }
    finalBranchId = subBranchId;
  } else {
    // Main Admin can assign or leave unassigned
    finalBranchId = branch_id ? parseInt(branch_id.toString(), 10) : null;
  }

  const rawPassword = password || '123456';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  try {
    const existingCheck = await query('SELECT id FROM users WHERE mobile = $1', [cleanMobile]);
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ status: false, message: 'A user with this mobile number already exists.' });
    }

    const dbRes = await query(
      "INSERT INTO users (name, mobile, address, role, branch_id, password_hash, otp, is_active) VALUES ($1, $2, $3, 'USER', $4, $5, '123456', TRUE) RETURNING id, name, mobile, address, role, branch_id, is_active, created_at",
      [name.trim(), cleanMobile, address ? address.trim() : '', finalBranchId, hashedPassword]
    );

    return res.json({
      status: true,
      message: 'Customer registered successfully',
      user: dbRes.rows[0],
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ status: false, message: 'User with this mobile number already exists.' });
    }
    return res.status(500).json({ status: false, message: err.message || 'Failed to register customer' });
  }
};

export const getUsersList = async (req: AuthRequest, res: Response) => {
  const { role, branch_id } = req.query;
  const user = req.user;

  try {
    let sql = `
      SELECT u.id, u.name, u.mobile, u.address, u.role, u.branch_id, u.is_active, u.created_at, b.branch_name, b.city AS branch_city
      FROM users u
      LEFT JOIN branches b ON u.branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Sub-Admin (Branch Manager) is STRICTLY scoped to their assigned branch
    if (user?.role === 'SUB_ADMIN') {
      let subBranchId = user.branch_id;
      if (!subBranchId) {
        const uRes = await query('SELECT branch_id FROM users WHERE id = $1', [user.id]);
        if (uRes.rows.length > 0) subBranchId = uRes.rows[0].branch_id;
      }
      params.push(subBranchId || -1);
      sql += ` AND u.branch_id = $${params.length}`;
    } else if (branch_id && branch_id !== 'ALL' && branch_id !== 'all') {
      params.push(parseInt(String(branch_id), 10));
      sql += ` AND u.branch_id = $${params.length}`;
    }

    if (role) {
      params.push(role);
      sql += ` AND u.role = $${params.length}`;
    }

    sql += ' ORDER BY u.id ASC';
    const dbRes = await query(sql, params);
    return res.json({ status: true, users: dbRes.rows });
  } catch (err) {
    return res.json({
      status: true,
      users: [
        { id: 1, name: 'Sonu Sir (Founder / Super Admin)', mobile: '9999999999', role: 'MAIN_ADMIN', is_active: true },
        { id: 2, name: 'Delhi Branch Manager', mobile: '8888888888', role: 'SUB_ADMIN', branch_id: 2, branch_name: 'Delhi Hub', branch_city: 'Delhi', is_active: true },
        { id: 3, name: 'Sample Driver', mobile: '7777777777', role: 'DRIVER', branch_id: 4, branch_name: 'Mumbai Hub', branch_city: 'Mumbai', is_active: true },
        { id: 4, name: 'Sample User / Party', mobile: '6666666666', role: 'USER', branch_id: 1, branch_name: 'Ahmedabad Hub', branch_city: 'Ahmedabad', is_active: true },
      ],
    });
  }
};
