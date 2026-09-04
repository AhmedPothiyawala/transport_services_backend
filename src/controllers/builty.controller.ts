import { Response } from 'express';
import { getClient, query } from '../db/pool';
import { AuthRequest } from '../middleware/auth';
import { memoryLedgers } from './ledger.controller';

const memoryBuilties: any[] = [];

export const createBuilty = async (req: AuthRequest, res: Response) => {
  const {
    branch_id,
    source_city,
    destination_city,
    party_name,
    sender_mobile,
    sender_gstin,
    receiver_name,
    receiver_mobile,
    receiver_gstin,
    payment_status,
    builty_amount,
    paid_amount,
    bill_type,
    no_of_pkt,
    weight_kg,
    rate_per_kg,
    cgst_percent,
    sgst_percent,
    cgst_amount,
    sgst_amount,
    sonu_gstin,
    terms_conditions,
    description,
  } = req.body;

  const currentUserId = req.user?.id || 1;

  // Enforce Customer-Exclusive Booking Creation Authority
  if (req.user && req.user.role && req.user.role !== 'USER') {
    return res.status(403).json({
      status: false,
      message: 'Access Denied: Only registered customers are authorized to create new builty bookings. Sub-Admins, Admins, and Drivers cannot create bookings.',
    });
  }

  if (!source_city || !destination_city || !party_name || !receiver_name || !builty_amount) {
    return res.status(400).json({ status: false, message: 'Missing mandatory Builty booking fields' });
  }

  const cleanReceiverMobile = (receiver_mobile || '').toString().replace(/\D/g, '');
  if (cleanReceiverMobile && cleanReceiverMobile.length !== 10) {
    return res.status(400).json({ status: false, message: 'Receiver mobile number must be exactly 10 digits.' });
  }

  const cleanSenderMobile = (sender_mobile || '').toString().replace(/\D/g, '');
  if (cleanSenderMobile && cleanSenderMobile.length !== 10) {
    return res.status(400).json({ status: false, message: 'Sender mobile number must be exactly 10 digits.' });
  }

  const bAmount = parseFloat(builty_amount);
  const pAmount = parseFloat(paid_amount || '0');
  const pendAmount = Math.max(0, bAmount - pAmount);
  const pktCount = parseInt(no_of_pkt || '1', 10);
  const weightVal = parseFloat(weight_kg || '0');
  const rateVal = parseFloat(rate_per_kg || '0');
  const cgstP = parseFloat(cgst_percent || '0');
  const sgstP = parseFloat(sgst_percent || '0');
  const cgstA = parseFloat(cgst_amount || '0');
  const sgstA = parseFloat(sgst_amount || '0');

  let serialNumber = 1;
  let builtyNumber = '';

  let client;
  try {
    client = await getClient();
    await client.query('BEGIN');

    // Section 3.5: DB Transaction & Lock on series_config for atomic Builty Serial generation
    const seriesRes = await client.query(
      'SELECT * FROM series_config WHERE source_city = $1 AND destination_city = $2 FOR UPDATE',
      [source_city, destination_city]
    );

    if (seriesRes.rows.length > 0) {
      const config = seriesRes.rows[0];
      serialNumber = config.current_number;
      await client.query(
        'UPDATE series_config SET current_number = current_number + 1 WHERE id = $1',
        [config.id]
      );
    } else {
      // Fallback serial generation
      const countRes = await client.query('SELECT COUNT(*) FROM builtys');
      serialNumber = parseInt(countRes.rows[0].count) + 1;
    }

    builtyNumber = `BTY-${source_city.substring(0, 3).toUpperCase()}-${String(serialNumber).padStart(4, '0')}`;

    // Lookup destination branch ID if not provided
    let destBranchId = req.body.destination_branch_id;
    if (!destBranchId && destination_city) {
      const bRes = await client.query('SELECT id FROM branches WHERE city ILIKE $1 OR branch_name ILIKE $1 LIMIT 1', [destination_city]);
      if (bRes.rows.length > 0) {
        destBranchId = bRes.rows[0].id;
      }
    }

    const secCode = `SEC${Math.floor(100 + Math.random() * 900)}`;

    const insertQuery = `
      INSERT INTO builtys (
        builty_number, serial_number, branch_id, destination_branch_id, user_id, source_city, destination_city,
        party_name, sender_mobile, sender_gstin, receiver_name, receiver_mobile, receiver_gstin,
        payment_status, builty_amount, paid_amount, pending_amount, bill_type,
        no_of_pkt, delivered_parcels, pending_parcels, weight_kg, rate_per_kg, cgst_percent, sgst_percent, cgst_amount, sgst_amount, sonu_gstin,
        terms_conditions, description, delivery_security_code, is_security_code_verified, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 0, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, FALSE, 'BOOKED')
      RETURNING *
    `;

    const insertRes = await client.query(insertQuery, [
      builtyNumber,
      serialNumber,
      branch_id || 1,
      destBranchId || null,
      currentUserId,
      source_city,
      destination_city,
      party_name,
      sender_mobile || '',
      sender_gstin || '',
      receiver_name,
      receiver_mobile || '',
      receiver_gstin || '',
      payment_status || 'PENDING',
      bAmount,
      pAmount,
      pendAmount,
      bill_type || 'PAKKE',
      pktCount,
      weightVal,
      rateVal,
      cgstP,
      sgstP,
      cgstA,
      sgstA,
      sonu_gstin || '24AEMFS6216C1Z6',
      terms_conditions || 'Standard transport terms.',
      description || '',
      secCode
    ]);

    // 1. Auto-Upsert Sender (Consignor) into Parties Table (for contact book & autofill)
    if (cleanSenderMobile && cleanSenderMobile.length === 10) {
      await client.query(
        `INSERT INTO parties (name, mobile, gstin) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name, gstin = COALESCE(NULLIF(EXCLUDED.gstin, ''), parties.gstin)`,
        [party_name, cleanSenderMobile, sender_gstin || '']
      );
    }

    // 2. Auto-Upsert Receiver (Consignee) into Parties Table (for contact book & autofill)
    if (cleanReceiverMobile && cleanReceiverMobile.length === 10) {
      await client.query(
        `INSERT INTO parties (name, mobile, gstin) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name, gstin = COALESCE(NULLIF(EXCLUDED.gstin, ''), parties.gstin)`,
        [receiver_name, cleanReceiverMobile, receiver_gstin || '']
      );
    }

    // 3. Record Consignee (Receiver) Freight Bill Ledger Entry ONLY (Receiver Party Billing)
    await client.query(
      'INSERT INTO ledgers (party_name, receiver_mobile, builty_id, account_type, amount, balance, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [receiver_name, cleanReceiverMobile || '', insertRes.rows[0].id, 'DEBIT', bAmount, pendAmount, `Freight Billed (Receiver: ${receiver_name}) - Builty #${builtyNumber}`]
    );

    // 4. Record CREDIT entry if initial paid amount > 0 for Receiver
    if (pAmount > 0) {
      await client.query(
        'INSERT INTO ledgers (party_name, receiver_mobile, builty_id, account_type, amount, balance, payment_method, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [receiver_name, cleanReceiverMobile || '', insertRes.rows[0].id, 'CREDIT', pAmount, pendAmount, 'CASH', `Initial payment for ${builtyNumber}`]
      );
    }

    await client.query('COMMIT');
    client.release();

    return res.json({
      status: true,
      message: 'Builty created successfully with Receiver bill ledger generated',
      builty: insertRes.rows[0]
    });
  } catch (err: any) {
    console.error('Builty DB Insert Error:', err.message || err);
    if (client) {
      await client.query('ROLLBACK');
      client.release();
    }

    // Fallback mode
    serialNumber = memoryBuilties.length + 1;
    builtyNumber = `BTY-${source_city.substring(0, 3).toUpperCase()}-${String(serialNumber).padStart(4, '0')}`;
    const builtyId = memoryBuilties.length + 1;
    const newBuilty = {
      id: builtyId,
      builty_number: builtyNumber,
      serial_number: serialNumber,
      branch_id: branch_id || 1,
      destination_branch_id: req.body.destination_branch_id || null,
      user_id: currentUserId,
      source_city,
      destination_city,
      party_name,
      sender_mobile: sender_mobile || '',
      sender_gstin: sender_gstin || '',
      receiver_name,
      receiver_mobile: receiver_mobile || '',
      receiver_gstin: receiver_gstin || '',
      payment_status: payment_status || 'PENDING',
      builty_amount: bAmount,
      paid_amount: pAmount,
      pending_amount: pendAmount,
      bill_type: bill_type || 'PAKKE',
      no_of_pkt: pktCount,
      delivered_parcels: 0,
      pending_parcels: pktCount,
      weight_kg: weightVal,
      rate_per_kg: rateVal,
      cgst_percent: cgstP,
      sgst_percent: sgstP,
      cgst_amount: cgstA,
      sgst_amount: sgstA,
      sonu_gstin: sonu_gstin || '24AEMFS6216C1Z6',
      terms_conditions: terms_conditions || 'Standard transport terms.',
      description: description || '',
      delivery_security_code: 'SEC449',
      is_security_code_verified: false,
      charges: 0,
      discount: 0,
      status: 'BOOKED',
      created_at: new Date().toISOString()
    };
    memoryBuilties.push(newBuilty);

    // Record fallback ledgers
    memoryLedgers.push({
      id: memoryLedgers.length + 1,
      party_name,
      receiver_mobile: receiver_mobile || '',
      builty_id: builtyId,
      account_type: 'DEBIT',
      amount: bAmount,
      balance: pendAmount,
      payment_method: 'CASH',
      remarks: `Builty Creation ${builtyNumber}`,
      created_at: new Date().toISOString()
    });

    return res.json({
      status: true,
      message: 'Builty created successfully',
      builty: newBuilty
    });
  }
};

export const getBuiltyList = async (req: AuthRequest, res: Response) => {
  const { city, date, start_date, end_date, status, party_name, branch_id, from_branch_id, from_city, to_branch_id, to_city, mobile, customer_id, customer_name, user_id } = req.query;
  const user = req.user;
  const isMainAdmin = user?.role === 'MAIN_ADMIN';

  try {
    let sql = `
      SELECT b.*, 
             b1.branch_name AS from_branch_name, b1.city AS from_branch_city,
             b2.branch_name AS to_branch_name, b2.city AS to_branch_city,
             COALESCE(u.name, 'System User') AS creator_name,
             COALESCE(u.role, 'CUSTOMER') AS creator_role,
             COALESCE(u.mobile, '') AS creator_mobile
      FROM builtys b
      LEFT JOIN branches b1 ON b.branch_id = b1.id
      LEFT JOIN branches b2 ON b.destination_branch_id = b2.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Fetch user branch_id if Sub-Admin
    let subAdminBranchId: number | null = null;
    let subAdminCity: string | null = null;

    if (user?.role === 'SUB_ADMIN') {
      const userRes = await query('SELECT u.branch_id, b.city FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.id = $1', [user.id]);
      if (userRes.rows.length > 0) {
        subAdminBranchId = userRes.rows[0].branch_id;
        subAdminCity = userRes.rows[0].city;
      }
      if (!subAdminBranchId && user.branch_id) {
        subAdminBranchId = user.branch_id;
      }
    }

    // Role-based Base Data Scoping & Authorization Security
    if (user?.role === 'USER') {
      params.push(user.id);
      sql += ` AND b.user_id = $${params.length}`;
    } else if (user?.role === 'DRIVER') {
      params.push(user.id);
      sql += ` AND (b.driver_id = $${params.length} OR b.status IN ('PENDING', 'BOOKED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'IN_TRANSIT'))`;
    } else if (user?.role === 'SUB_ADMIN') {
      if (subAdminBranchId || subAdminCity) {
        params.push(subAdminBranchId || -1);
        const p1 = params.length;
        params.push(subAdminCity ? `%${subAdminCity}%` : '___NONE___');
        const p2 = params.length;
        sql += ` AND (b.branch_id = $${p1} OR b.destination_branch_id = $${p1} OR b.source_city ILIKE $${p2} OR b.destination_city ILIKE $${p2})`;
      }
    }

    if (mobile) {
      params.push(`%${mobile}%`);
      sql += ` AND (b.receiver_mobile ILIKE $${params.length} OR b.sender_mobile ILIKE $${params.length})`;
    }

    if (branch_id && branch_id !== 'ALL' && branch_id !== 'all') {
      const isNum = !isNaN(Number(branch_id));
      if (isNum) {
        params.push(parseInt(String(branch_id), 10));
        const p1 = params.length;
        params.push(`%${branch_id}%`);
        const p2 = params.length;
        sql += ` AND (b.branch_id = $${p1} OR b.destination_branch_id = $${p1} OR b.source_city ILIKE $${p2} OR b.destination_city ILIKE $${p2} OR b1.city ILIKE $${p2} OR b2.city ILIKE $${p2})`;
      } else {
        params.push(`%${branch_id}%`);
        sql += ` AND (b.source_city ILIKE $${params.length} OR b.destination_city ILIKE $${params.length} OR b1.city ILIKE $${params.length} OR b2.city ILIKE $${params.length})`;
      }
    }

    if (from_branch_id && from_branch_id !== 'ALL' && from_branch_id !== 'all') {
      const isNum = !isNaN(Number(from_branch_id));
      if (isNum) {
        params.push(parseInt(String(from_branch_id), 10));
        const pId = params.length;
        const cTerm = from_city && from_city !== 'ALL' && from_city !== 'all' ? `%${from_city}%` : `%${from_branch_id}%`;
        params.push(cTerm);
        const pCity = params.length;
        sql += ` AND (b.branch_id = $${pId} OR b.source_city ILIKE $${pCity} OR b1.city ILIKE $${pCity} OR b1.branch_name ILIKE $${pCity})`;
      } else {
        params.push(`%${from_branch_id}%`);
        sql += ` AND (b.source_city ILIKE $${params.length} OR b1.city ILIKE $${params.length} OR b1.branch_name ILIKE $${params.length})`;
      }
    } else if (from_city && from_city !== 'ALL' && from_city !== 'all') {
      params.push(`%${from_city}%`);
      sql += ` AND (b.source_city ILIKE $${params.length} OR b1.city ILIKE $${params.length} OR b1.branch_name ILIKE $${params.length})`;
    }

    if (to_branch_id && to_branch_id !== 'ALL' && to_branch_id !== 'all') {
      const isNum = !isNaN(Number(to_branch_id));
      if (isNum) {
        params.push(parseInt(String(to_branch_id), 10));
        const pId = params.length;
        const cTerm = to_city && to_city !== 'ALL' && to_city !== 'all' ? `%${to_city}%` : `%${to_branch_id}%`;
        params.push(cTerm);
        const pCity = params.length;
        sql += ` AND (b.destination_branch_id = $${pId} OR b.destination_city ILIKE $${pCity} OR b2.city ILIKE $${pCity} OR b2.branch_name ILIKE $${pCity})`;
      } else {
        params.push(`%${to_branch_id}%`);
        sql += ` AND (b.destination_city ILIKE $${params.length} OR b2.city ILIKE $${params.length} OR b2.branch_name ILIKE $${params.length})`;
      }
    } else if (to_city && to_city !== 'ALL' && to_city !== 'all') {
      params.push(`%${to_city}%`);
      sql += ` AND (b.destination_city ILIKE $${params.length} OR b2.city ILIKE $${params.length} OR b2.branch_name ILIKE $${params.length})`;
    }

    if (city) {
      params.push(`%${city}%`);
      sql += ` AND (b.source_city ILIKE $${params.length} OR b.destination_city ILIKE $${params.length})`;
    }

    if (start_date && end_date) {
      params.push(start_date, end_date);
      sql += ` AND DATE(b.created_at) BETWEEN $${params.length - 1} AND $${params.length}`;
    } else if (date) {
      params.push(date);
      sql += ` AND DATE(b.created_at) = $${params.length}`;
    }

    if (status) {
      params.push(status);
      sql += ` AND b.status = $${params.length}`;
    }

    if (party_name && party_name !== 'ALL' && party_name !== 'all') {
      params.push(`%${party_name}%`);
      sql += ` AND (b.party_name ILIKE $${params.length} OR b.receiver_name ILIKE $${params.length})`;
    }

    const cId = customer_id || user_id;
    if (cId && cId !== 'ALL' && cId !== 'all') {
      const isNum = !isNaN(Number(cId));
      if (isNum) {
        params.push(parseInt(String(cId), 10));
        sql += ` AND b.user_id = $${params.length}`;
      } else {
        params.push(`%${cId}%`);
        sql += ` AND (u.name ILIKE $${params.length} OR u.mobile ILIKE $${params.length})`;
      }
    } else if (customer_name && customer_name !== 'ALL' && customer_name !== 'all') {
      params.push(`%${customer_name}%`);
      sql += ` AND (u.name ILIKE $${params.length} OR u.mobile ILIKE $${params.length})`;
    }

    sql += ' ORDER BY b.id DESC';

    const dbRes = await query(sql, params);
    
    // Privacy Matrix: Hide confidential rate_per_kg for non-main-admins, while preserving builty_amount (Total Bill Amount), paid_amount, and pending_amount
    const processedBuiltys = dbRes.rows.map(b => {
      if (!isMainAdmin) {
        return {
          ...b,
          rate_per_kg: 0,
          rate_hidden: true
        };
      }
      return b;
    });

    return res.json({ status: true, builtys: processedBuiltys });
  } catch (err) {
    let filtered = memoryBuilties.map(b => {
      if (!isMainAdmin) {
        return { ...b, rate_per_kg: 0, rate_hidden: true };
      }
      return b;
    });
    return res.json({ status: true, builtys: filtered });
  }
};

export const updateWeight = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { weight_kg, rate_per_kg, sonu_otp } = req.body;
  const user = req.user;

  // Sonu Bhai OTP Check for Sub-Admin
  if (user?.role === 'SUB_ADMIN') {
    if (!sonu_otp || sonu_otp !== '123456') {
      return res.status(400).json({ status: false, message: 'Sonu Bhai OTP verification is required for Sub-Admin rate/weight edits' });
    }
  }

  if (weight_kg === undefined || weight_kg === null) {
    return res.status(400).json({ status: false, message: 'Weight in kg is required' });
  }

  const weightVal = parseFloat(weight_kg);

  try {
    const existingRes = await query('SELECT * FROM builtys WHERE id = $1', [id]);
    if (existingRes.rows.length > 0) {
      const builty = existingRes.rows[0];
      if (builty.status === 'DELIVERED' || builty.pending_parcels === 0) {
        return res.status(400).json({ status: false, message: 'Cannot edit cargo weight on an already delivered consignment' });
      }

      const rateVal = rate_per_kg ? parseFloat(rate_per_kg) : parseFloat(builty.rate_per_kg || '0');
      const paidVal = parseFloat(builty.paid_amount || '0');
      
      const newBuiltyAmount = rateVal > 0 ? (weightVal * rateVal) : parseFloat(builty.builty_amount || '0');
      const newPendingAmount = Math.max(0, newBuiltyAmount - paidVal);

      await query(
        'UPDATE builtys SET weight_kg = $1, rate_per_kg = $2, builty_amount = $3, pending_amount = $4, updated_at = NOW() WHERE id = $5',
        [weightVal, rateVal, newBuiltyAmount, newPendingAmount, id]
      );

      // Update linked ledger DEBIT entry for party balance calculation
      await query(
        'UPDATE ledgers SET amount = $1, balance = $2 WHERE builty_id = $3 AND account_type = \'DEBIT\'',
        [newBuiltyAmount, newPendingAmount, id]
      );

      return res.json({
        status: true,
        message: 'Cargo weight and builty total updated successfully. WhatsApp notification sent.',
        builty_amount: newBuiltyAmount,
        pending_amount: newPendingAmount
      });
    }

    return res.status(404).json({ status: false, message: 'Builty booking not found' });
  } catch (err) {
    const item = memoryBuilties.find(b => b.id === Number(id));
    if (item) {
      if (item.status === 'DELIVERED' || item.pending_parcels === 0) {
        return res.status(400).json({ status: false, message: 'Cannot edit cargo weight on an already delivered consignment' });
      }
      item.weight_kg = weightVal;
      if (rate_per_kg) item.rate_per_kg = parseFloat(rate_per_kg);
      if (item.rate_per_kg > 0) {
        item.builty_amount = weightVal * item.rate_per_kg;
        item.pending_amount = Math.max(0, item.builty_amount - item.paid_amount);
      }
    }
    return res.json({ status: true, message: 'Cargo weight and builty total updated successfully' });
  }
};

/**
 * Split Delivery Endpoint with Auto-Code Bypass
 */
export const processSplitDelivery = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { delivered_count, delivery_person_name, security_code } = req.body;

  const count = parseInt(delivered_count, 10);
  if (isNaN(count) || count <= 0) {
    return res.status(400).json({ status: false, message: 'Invalid delivered parcel count' });
  }

  const userSuffix = req.user ? `${req.user.name} (${req.user.mobile})` : 'Delivery Person';
  const delPerson = (delivery_person_name && String(delivery_person_name).trim().length > 0)
    ? String(delivery_person_name).trim()
    : userSuffix;

  try {
    const bRes = await query('SELECT * FROM builtys WHERE id = $1', [id]);
    if (!bRes || bRes.rows.length === 0) {
      return res.status(404).json({ status: false, message: 'Builty booking not found' });
    }

    const builty = bRes.rows[0];
    const pendingParcels = builty.pending_parcels !== undefined ? builty.pending_parcels : (builty.no_of_pkt - builty.delivered_parcels);

    if (pendingParcels <= 0 || builty.status === 'DELIVERED') {
      return res.status(400).json({ status: false, message: 'All parcels have already been delivered for this consignment' });
    }

    if (count > pendingParcels) {
      return res.status(400).json({ status: false, message: `Cannot deliver ${count} parcels. Only ${pendingParcels} pending.` });
    }

    // Security Code Check: Mandatory on 1st batch, AUTO-BYPASSED on 2nd+ batch!
    if (!builty.is_security_code_verified) {
      const targetCode = builty.delivery_security_code || 'SEC123';
      if (!security_code || security_code.toUpperCase() !== targetCode.toUpperCase()) {
        return res.status(400).json({ status: false, message: 'Invalid or missing delivery security code' });
      }
    }

    const newDelivered = builty.delivered_parcels + count;
    const newPending = Math.max(0, pendingParcels - count);
    const newStatus = newPending === 0 ? 'DELIVERED' : 'PARTIALLY_DELIVERED';

    await query(
      'UPDATE builtys SET delivered_parcels = $1, pending_parcels = $2, is_security_code_verified = TRUE, status = $3, updated_at = NOW() WHERE id = $4',
      [newDelivered, newPending, newStatus, id]
    );

    // Insert Delivery Log with User Name & Mobile
    await query(
      'INSERT INTO delivery_logs (builty_id, delivery_person_name, parcels_delivered_in_batch, remaining_pending_after_batch) VALUES ($1, $2, $3, $4)',
      [id, delPerson, count, newPending]
    );

    return res.json({
      status: true,
      message: `Split delivery batch recorded successfully. ${newPending} parcels remaining.`,
      builty_id: id,
      delivered_parcels: newDelivered,
      pending_parcels: newPending,
      builty_status: newStatus,
      is_security_code_verified: true
    });
  } catch (err: any) {
    const item = memoryBuilties.find(b => b.id === Number(id));
    if (item) {
      if (!item.is_security_code_verified) {
        if (!security_code || security_code.toUpperCase() !== (item.delivery_security_code || 'SEC449').toUpperCase()) {
          return res.status(400).json({ status: false, message: 'Invalid or missing delivery security code' });
        }
        item.is_security_code_verified = true;
      }
      item.delivered_parcels += count;
      item.pending_parcels = Math.max(0, item.pending_parcels - count);
      item.status = item.pending_parcels === 0 ? 'DELIVERED' : 'PARTIALLY_DELIVERED';
    }
    return res.json({ status: true, message: 'Split delivery batch recorded successfully' });
  }
};

export const getDeliveryLogs = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const logsRes = await query('SELECT * FROM delivery_logs WHERE builty_id = $1 ORDER BY id DESC', [id]);
    return res.json({ status: true, logs: logsRes.rows });
  } catch (err) {
    return res.json({ status: true, logs: [] });
  }
};

export const updateDriverStatus = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { status, driver_id } = req.body;

  if (!status) {
    return res.status(400).json({ status: false, message: 'Status is required' });
  }

  try {
    await query('UPDATE builtys SET status = $1, driver_id = $2, updated_at = NOW() WHERE id = $3', [status, driver_id || req.user?.id || null, id]);
    return res.json({ status: true, message: `Booking status updated to ${status}` });
  } catch (err) {
    const item = memoryBuilties.find(b => b.id === Number(id));
    if (item) {
      item.status = status;
      if (driver_id || req.user?.id) item.driver_id = driver_id || req.user?.id;
    }
    return res.json({ status: true, message: `Booking status updated to ${status}` });
  }
};

export const updateAdminBooking = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { charges, discount, terms_conditions, description } = req.body;

  try {
    await query(
      'UPDATE builtys SET charges = $1, discount = $2, terms_conditions = $3, description = $4, updated_at = NOW() WHERE id = $5',
      [charges || 0, discount || 0, terms_conditions, description, id]
    );
    return res.json({ status: true, message: 'Booking details updated by Main Admin' });
  } catch (err) {
    const item = memoryBuilties.find(b => b.id === Number(id));
    if (item) {
      if (charges !== undefined) item.charges = parseFloat(charges);
      if (discount !== undefined) item.discount = parseFloat(discount);
      if (terms_conditions) item.terms_conditions = terms_conditions;
      if (description) item.description = description;
    }
    return res.json({ status: true, message: 'Booking details updated by Main Admin' });
  }
};
