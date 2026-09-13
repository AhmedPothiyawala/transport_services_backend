"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAdminBooking = exports.updateDriverStatus = exports.updateStatusByCode = exports.verifyCodeForStatusUpdate = exports.getAllDeliveryLogs = exports.getDeliveryLogs = exports.processSplitDelivery = exports.updateWeight = exports.getBuiltyList = exports.createBuilty = void 0;
const pool_1 = require("../db/pool");
const ledger_controller_1 = require("./ledger.controller");
const memoryBuilties = [];
const createBuilty = async (req, res) => {
    const { branch_id, source_city, destination_city, party_name, sender_mobile, sender_gstin, receiver_name, receiver_mobile, receiver_gstin, payment_status, builty_amount, paid_amount, bill_type, no_of_pkt, weight_kg, rate_per_kg, cgst_percent, sgst_percent, cgst_amount, sgst_amount, sonu_gstin, terms_conditions, description, } = req.body;
    const currentUserId = req.user?.id || 1;
    // Booking Creation Authority: Customers, Branch Managers (Sub-Admin), and Founder (Main Admin)
    if (req.user && req.user.role && !['USER', 'CUSTOMER', 'SUB_ADMIN', 'MAIN_ADMIN', 'ADMIN'].includes(req.user.role)) {
        return res.status(403).json({
            status: false,
            message: 'Access Denied: You do not have permission to create builty bookings.',
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
    if (isNaN(bAmount) || bAmount <= 0) {
        return res.status(400).json({ status: false, message: 'Builty amount must be a positive number greater than zero.' });
    }
    const pAmount = parseFloat(paid_amount || '0');
    if (isNaN(pAmount) || pAmount < 0) {
        return res.status(400).json({ status: false, message: 'Paid amount cannot be negative.' });
    }
    const pendAmount = Math.max(0, bAmount - pAmount);
    const pktCount = parseInt(no_of_pkt || '1', 10);
    if (isNaN(pktCount) || pktCount <= 0) {
        return res.status(400).json({ status: false, message: 'Number of parcels (no_of_pkt) must be at least 1.' });
    }
    const weightVal = parseFloat(weight_kg || '0');
    if (isNaN(weightVal) || weightVal < 0) {
        return res.status(400).json({ status: false, message: 'Weight (kg) cannot be negative.' });
    }
    const rateVal = parseFloat(rate_per_kg || '0');
    if (isNaN(rateVal) || rateVal < 0) {
        return res.status(400).json({ status: false, message: 'Rate per kg cannot be negative.' });
    }
    const cgstP = parseFloat(cgst_percent || '0');
    const sgstP = parseFloat(sgst_percent || '0');
    if (isNaN(cgstP) || cgstP < 0 || isNaN(sgstP) || sgstP < 0) {
        return res.status(400).json({ status: false, message: 'Tax percentages cannot be negative.' });
    }
    const cgstA = parseFloat(cgst_amount || '0');
    const sgstA = parseFloat(sgst_amount || '0');
    // Generic Customer Branch Locking: If customer has an assigned branch, lock origin branch to it
    let finalBranchId = branch_id ? parseInt(branch_id.toString(), 10) : 1;
    if (req.user?.branch_id) {
        finalBranchId = req.user.branch_id;
    }
    let serialNumber = 1;
    let builtyNumber = '';
    let client;
    try {
        client = await (0, pool_1.getClient)();
        await client.query('BEGIN');
        // Section 3.5: DB Transaction & Lock on series_config for atomic Builty Serial generation
        const seriesRes = await client.query('SELECT * FROM series_config WHERE source_city = $1 AND destination_city = $2 FOR UPDATE', [source_city, destination_city]);
        if (seriesRes.rows.length > 0) {
            const config = seriesRes.rows[0];
            serialNumber = config.current_number;
            await client.query('UPDATE series_config SET current_number = current_number + 1 WHERE id = $1', [config.id]);
        }
        else {
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
            finalBranchId,
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
            await client.query(`INSERT INTO parties (name, mobile, gstin) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name, gstin = COALESCE(NULLIF(EXCLUDED.gstin, ''), parties.gstin)`, [party_name, cleanSenderMobile, sender_gstin || '']);
        }
        // 2. Auto-Upsert Receiver (Consignee) into Parties Table (for contact book & autofill)
        if (cleanReceiverMobile && cleanReceiverMobile.length === 10) {
            await client.query(`INSERT INTO parties (name, mobile, gstin) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (mobile) DO UPDATE SET name = EXCLUDED.name, gstin = COALESCE(NULLIF(EXCLUDED.gstin, ''), parties.gstin)`, [receiver_name, cleanReceiverMobile, receiver_gstin || '']);
        }
        // 3. Record Consignee (Receiver) Freight Bill Ledger Entry ONLY (Receiver Party Billing)
        await client.query('INSERT INTO ledgers (party_name, receiver_mobile, builty_id, account_type, amount, balance, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7)', [receiver_name, cleanReceiverMobile || '', insertRes.rows[0].id, 'DEBIT', bAmount, pendAmount, `Freight Billed (Receiver: ${receiver_name}) - Builty #${builtyNumber}`]);
        // 4. Record CREDIT entry if initial paid amount > 0 for Receiver
        if (pAmount > 0) {
            await client.query('INSERT INTO ledgers (party_name, receiver_mobile, builty_id, account_type, amount, balance, payment_method, remarks) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', [receiver_name, cleanReceiverMobile || '', insertRes.rows[0].id, 'CREDIT', pAmount, pendAmount, 'CASH', `Initial payment for ${builtyNumber}`]);
        }
        await client.query('COMMIT');
        client.release();
        return res.json({
            status: true,
            message: 'Builty created successfully with Receiver bill ledger generated',
            builty: insertRes.rows[0]
        });
    }
    catch (err) {
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
        ledger_controller_1.memoryLedgers.push({
            id: ledger_controller_1.memoryLedgers.length + 1,
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
exports.createBuilty = createBuilty;
const getBuiltyList = async (req, res) => {
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
        const params = [];
        // Fetch user branch_id if Sub-Admin
        let subAdminBranchId = null;
        let subAdminCity = null;
        if (user?.role === 'SUB_ADMIN') {
            const userRes = await (0, pool_1.query)('SELECT u.branch_id, b.city FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.id = $1', [user.id]);
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
            let userBranchId = user.branch_id;
            if (!userBranchId) {
                const uRes = await (0, pool_1.query)('SELECT branch_id FROM users WHERE id = $1', [user.id]);
                if (uRes.rows.length > 0)
                    userBranchId = uRes.rows[0].branch_id;
            }
            if (userBranchId) {
                params.push(user.id);
                const pUid = params.length;
                params.push(userBranchId);
                const pBid = params.length;
                sql += ` AND (b.user_id = $${pUid} OR b.branch_id = $${pBid} OR b.destination_branch_id = $${pBid})`;
            }
            else {
                params.push(user.id);
                sql += ` AND b.user_id = $${params.length}`;
            }
        }
        else if (user?.role === 'DRIVER') {
            params.push(user.id);
            sql += ` AND (b.driver_id = $${params.length} OR b.status IN ('PENDING', 'BOOKED', 'ASSIGNED', 'OUT_FOR_DELIVERY', 'IN_TRANSIT'))`;
        }
        else if (user?.role === 'SUB_ADMIN') {
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
            }
            else {
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
            }
            else {
                params.push(`%${from_branch_id}%`);
                sql += ` AND (b.source_city ILIKE $${params.length} OR b1.city ILIKE $${params.length} OR b1.branch_name ILIKE $${params.length})`;
            }
        }
        else if (from_city && from_city !== 'ALL' && from_city !== 'all') {
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
            }
            else {
                params.push(`%${to_branch_id}%`);
                sql += ` AND (b.destination_city ILIKE $${params.length} OR b2.city ILIKE $${params.length} OR b2.branch_name ILIKE $${params.length})`;
            }
        }
        else if (to_city && to_city !== 'ALL' && to_city !== 'all') {
            params.push(`%${to_city}%`);
            sql += ` AND (b.destination_city ILIKE $${params.length} OR b2.city ILIKE $${params.length} OR b2.branch_name ILIKE $${params.length})`;
        }
        if (city) {
            params.push(`%${city}%`);
            sql += ` AND (b.source_city ILIKE $${params.length} OR b.destination_city ILIKE $${params.length})`;
        }
        if (start_date && end_date) {
            params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59.999`);
            sql += ` AND b.created_at >= $${params.length - 1} AND b.created_at <= $${params.length}`;
        }
        else if (date) {
            params.push(`${date} 00:00:00`, `${date} 23:59:59.999`);
            sql += ` AND b.created_at >= $${params.length - 1} AND b.created_at <= $${params.length}`;
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
            }
            else {
                params.push(`%${cId}%`);
                sql += ` AND (u.name ILIKE $${params.length} OR u.mobile ILIKE $${params.length})`;
            }
        }
        else if (customer_name && customer_name !== 'ALL' && customer_name !== 'all') {
            params.push(`%${customer_name}%`);
            sql += ` AND (u.name ILIKE $${params.length} OR u.mobile ILIKE $${params.length})`;
        }
        // High-Scale Universal Pagination (Default 50, Max 200)
        const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limitNum = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        // Fast count query using identical where criteria
        const whereIndex = sql.indexOf('WHERE 1=1');
        const whereClause = whereIndex !== -1 ? sql.slice(whereIndex) : 'WHERE 1=1';
        const countSql = `SELECT COUNT(*) AS total FROM builtys b LEFT JOIN branches b1 ON b.branch_id = b1.id LEFT JOIN branches b2 ON b.destination_branch_id = b2.id LEFT JOIN users u ON b.user_id = u.id ${whereClause}`;
        const pagedSql = `${sql} ORDER BY b.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const pagedParams = [...params, limitNum, offset];
        const [countRes, dbRes] = await Promise.all([
            (0, pool_1.query)(countSql, params).catch(() => ({ rows: [{ total: '0' }] })),
            (0, pool_1.query)(pagedSql, pagedParams),
        ]);
        const totalCount = parseInt(countRes.rows[0]?.total || '0', 10) || dbRes.rows.length;
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
        return res.json({
            status: true,
            total: totalCount,
            page: pageNum,
            limit: limitNum,
            total_pages: Math.ceil(totalCount / limitNum),
            builtys: processedBuiltys,
        });
    }
    catch (err) {
        let filtered = memoryBuilties.map(b => {
            if (!isMainAdmin) {
                return { ...b, rate_per_kg: 0, rate_hidden: true };
            }
            return b;
        });
        return res.json({ status: true, total: filtered.length, page: 1, limit: filtered.length, total_pages: 1, builtys: filtered });
    }
};
exports.getBuiltyList = getBuiltyList;
const updateWeight = async (req, res) => {
    const { id } = req.params;
    const { weight_kg, rate_per_kg, sonu_otp } = req.body;
    const user = req.user;
    // Sonu Bhai OTP Check: Mandatory for all rate/weight edits
    if (!sonu_otp || sonu_otp !== '123456') {
        return res.status(400).json({ status: false, message: 'Sonu Bhai OTP verification is required for rate/weight edits' });
    }
    const hasWeight = weight_kg !== undefined && weight_kg !== null && String(weight_kg).trim() !== '';
    const hasRate = rate_per_kg !== undefined && rate_per_kg !== null && String(rate_per_kg).trim() !== '';
    if (!hasWeight && !hasRate) {
        return res.status(400).json({ status: false, message: 'At least weight (kg) or rate per kg is required' });
    }
    try {
        const existingRes = await (0, pool_1.query)('SELECT * FROM builtys WHERE id = $1', [id]);
        if (existingRes.rows.length > 0) {
            const builty = existingRes.rows[0];
            if (user?.role !== 'MAIN_ADMIN' && (builty.status === 'DELIVERED' || builty.pending_parcels === 0)) {
                return res.status(400).json({ status: false, message: 'Cannot edit cargo weight on an already delivered consignment' });
            }
            const weightVal = hasWeight ? parseFloat(String(weight_kg)) : parseFloat(builty.weight_kg || '0');
            const rateVal = hasRate ? parseFloat(String(rate_per_kg)) : parseFloat(builty.rate_per_kg || '0');
            const paidVal = parseFloat(builty.paid_amount || '0');
            const newBuiltyAmount = (rateVal > 0 && weightVal > 0) ? (weightVal * rateVal) : parseFloat(builty.builty_amount || '0');
            const newPendingAmount = Math.max(0, newBuiltyAmount - paidVal);
            await (0, pool_1.query)('UPDATE builtys SET weight_kg = $1, rate_per_kg = $2, builty_amount = $3, pending_amount = $4, updated_at = NOW() WHERE id = $5', [weightVal, rateVal, newBuiltyAmount, newPendingAmount, id]);
            // Update linked ledger DEBIT entry for party balance calculation
            await (0, pool_1.query)('UPDATE ledgers SET amount = $1, balance = $2 WHERE builty_id = $3 AND account_type = \'DEBIT\'', [newBuiltyAmount, newPendingAmount, id]);
            return res.json({
                status: true,
                message: 'Cargo weight/rate and builty total updated successfully.',
                builty_amount: newBuiltyAmount,
                pending_amount: newPendingAmount,
                weight_kg: weightVal,
                rate_per_kg: rateVal
            });
        }
        return res.status(404).json({ status: false, message: 'Builty booking not found' });
    }
    catch (err) {
        const item = memoryBuilties.find(b => b.id === Number(id));
        if (item) {
            if (user?.role !== 'MAIN_ADMIN' && (item.status === 'DELIVERED' || item.pending_parcels === 0)) {
                return res.status(400).json({ status: false, message: 'Cannot edit cargo weight on an already delivered consignment' });
            }
            if (hasWeight)
                item.weight_kg = parseFloat(String(weight_kg));
            if (hasRate)
                item.rate_per_kg = parseFloat(String(rate_per_kg));
            if (item.rate_per_kg > 0 && item.weight_kg > 0) {
                item.builty_amount = item.weight_kg * item.rate_per_kg;
                item.pending_amount = Math.max(0, item.builty_amount - item.paid_amount);
            }
        }
        return res.json({ status: true, message: 'Cargo weight and rate updated successfully' });
    }
};
exports.updateWeight = updateWeight;
/**
 * Split Delivery Endpoint with Auto-Code Bypass
 */
const processSplitDelivery = async (req, res) => {
    const { id } = req.params;
    const { delivered_count, delivery_person_name, delivery_person_mobile, security_code, new_status } = req.body;
    const count = parseInt(delivered_count, 10);
    if (isNaN(count) || count <= 0) {
        return res.status(400).json({ status: false, message: 'Invalid delivered parcel count' });
    }
    let delPerson = '';
    if (delivery_person_name && String(delivery_person_name).trim().length > 0) {
        const pName = String(delivery_person_name).trim();
        const pMobile = delivery_person_mobile ? String(delivery_person_mobile).trim().replace(/\D/g, '') : '';
        delPerson = pMobile ? `${pName} (${pMobile})` : pName;
    }
    else {
        delPerson = req.user ? `${req.user.name} (${req.user.mobile})` : 'Delivery Person';
    }
    try {
        const bRes = await (0, pool_1.query)('SELECT * FROM builtys WHERE id = $1', [id]);
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
        const finalStatus = newPending === 0 ? 'DELIVERED' : (new_status || 'PARTIALLY_DELIVERED');
        await (0, pool_1.query)('UPDATE builtys SET delivered_parcels = $1, pending_parcels = $2, is_security_code_verified = TRUE, status = $3, updated_at = NOW() WHERE id = $4', [newDelivered, newPending, finalStatus, id]);
        // Insert Delivery Log with User Name & Mobile
        await (0, pool_1.query)('INSERT INTO delivery_logs (builty_id, delivery_person_name, parcels_delivered_in_batch, remaining_pending_after_batch, status, delivered_at) VALUES ($1, $2, $3, $4, $5, NOW())', [id, delPerson, count, newPending, finalStatus]);
        return res.json({
            status: true,
            message: `Split delivery batch recorded successfully. ${newPending} parcels remaining.`,
            builty_id: id,
            delivered_parcels: newDelivered,
            pending_parcels: newPending,
            builty_status: finalStatus,
            is_security_code_verified: true
        });
    }
    catch (err) {
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
exports.processSplitDelivery = processSplitDelivery;
const getDeliveryLogs = async (req, res) => {
    const { id } = req.params;
    try {
        const logsRes = await (0, pool_1.query)('SELECT * FROM delivery_logs WHERE builty_id = $1 ORDER BY id DESC', [id]);
        return res.json({ status: true, logs: logsRes.rows });
    }
    catch (err) {
        return res.json({ status: true, logs: [] });
    }
};
exports.getDeliveryLogs = getDeliveryLogs;
/**
 * System-Wide Grouped & Date-Time Sorted Delivery Logs Engine
 */
const getAllDeliveryLogs = async (req, res) => {
    const { start_date, end_date, branch_id, customer_name, search } = req.query;
    const user = req.user;
    try {
        let sql = `
      SELECT dl.id, dl.builty_id, dl.delivery_person_name, dl.parcels_delivered_in_batch,
             dl.remaining_pending_after_batch, COALESCE(dl.status, 'DELIVERED') AS status, dl.delivered_at,
             b.builty_number, b.party_name, b.receiver_name, b.receiver_mobile,
             b.sender_mobile, b.builty_amount, b.paid_amount, b.pending_amount,
             b.no_of_pkt, b.weight_kg, b.rate_per_kg, b.bill_type, b.payment_status,
             b.delivery_security_code, b.created_at AS booking_date,
             b.source_city, b.destination_city,
             b1.branch_name AS from_branch_name, b1.city AS from_branch_city,
             b2.branch_name AS to_branch_name, b2.city AS to_branch_city
      FROM delivery_logs dl
      JOIN builtys b ON dl.builty_id = b.id
      LEFT JOIN branches b1 ON b.branch_id = b1.id
      LEFT JOIN branches b2 ON b.destination_branch_id = b2.id
      WHERE 1=1
    `;
        const params = [];
        // Sub-Admin (Branch Manager) authorization scoping: only shipments involving assigned branch
        if (user?.role === 'SUB_ADMIN') {
            let subBranchId = user.branch_id;
            if (!subBranchId) {
                const uRes = await (0, pool_1.query)('SELECT branch_id FROM users WHERE id = $1', [user.id]);
                if (uRes.rows.length > 0)
                    subBranchId = uRes.rows[0].branch_id;
            }
            params.push(subBranchId || -1);
            sql += ` AND (b.branch_id = $${params.length} OR b.destination_branch_id = $${params.length})`;
        }
        else if (branch_id && branch_id !== 'ALL' && branch_id !== 'all') {
            params.push(parseInt(String(branch_id), 10));
            sql += ` AND (b.branch_id = $${params.length} OR b.destination_branch_id = $${params.length})`;
        }
        if (start_date && end_date) {
            params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59.999`);
            sql += ` AND dl.delivered_at >= $${params.length - 1} AND dl.delivered_at <= $${params.length}`;
        }
        if (customer_name && customer_name !== 'ALL' && customer_name !== 'all') {
            params.push(`%${customer_name}%`);
            sql += ` AND dl.delivery_person_name ILIKE $${params.length}`;
        }
        if (search && search.toString().trim().length > 0) {
            params.push(`%${search.toString().trim()}%`);
            sql += ` AND (b.builty_number ILIKE $${params.length} OR b.party_name ILIKE $${params.length} OR b.receiver_name ILIKE $${params.length} OR dl.delivery_person_name ILIKE $${params.length})`;
        }
        // High-Scale Universal Pagination (Default 50, Max 200)
        const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limitNum = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const offset = (pageNum - 1) * limitNum;
        const whereIndex = sql.indexOf('WHERE 1=1');
        const whereClause = whereIndex !== -1 ? sql.slice(whereIndex) : 'WHERE 1=1';
        const countSql = `SELECT COUNT(*) AS total FROM delivery_logs dl JOIN builtys b ON dl.builty_id = b.id LEFT JOIN branches b1 ON b.branch_id = b1.id LEFT JOIN branches b2 ON b.destination_branch_id = b2.id ${whereClause}`;
        const pagedSql = `${sql} ORDER BY dl.delivered_at DESC, dl.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        const pagedParams = [...params, limitNum, offset];
        const [countRes, dbRes] = await Promise.all([
            (0, pool_1.query)(countSql, params).catch(() => ({ rows: [{ total: '0' }] })),
            (0, pool_1.query)(pagedSql, pagedParams),
        ]);
        const totalCount = parseInt(countRes.rows[0]?.total || '0', 10) || dbRes.rows.length;
        return res.json({
            status: true,
            total: totalCount,
            page: pageNum,
            limit: limitNum,
            total_pages: Math.ceil(totalCount / limitNum),
            logs: dbRes.rows,
        });
    }
    catch (err) {
        return res.json({ status: true, total: 0, page: 1, limit: 50, total_pages: 0, logs: [] });
    }
};
exports.getAllDeliveryLogs = getAllDeliveryLogs;
// In-Memory Rate Limiting Guard for Verification Code Attempts (Key: booking_code/ID -> { attempts, lockUntil })
const codeAttemptsMap = new Map();
/**
 * Verification Code Authentication Gate for Status Updates
 */
const verifyCodeForStatusUpdate = async (req, res) => {
    const { builty_number, builty_id, security_code } = req.body;
    if ((!builty_number && !builty_id) || !security_code) {
        return res.status(400).json({ status: false, message: 'Booking identifier and Verification Code are required' });
    }
    const key = (builty_number || builty_id).toString().trim().toUpperCase();
    const now = Date.now();
    const attemptRecord = codeAttemptsMap.get(key);
    if (attemptRecord && attemptRecord.attempts >= 5 && now < attemptRecord.lockUntil) {
        const waitMins = Math.ceil((attemptRecord.lockUntil - now) / 60000);
        return res.status(429).json({
            status: false,
            message: `Too many failed verification code attempts. Account locked for ${waitMins} minute(s) to protect against unauthorized updates.`,
        });
    }
    try {
        let sql = 'SELECT * FROM builtys WHERE ';
        const params = [];
        if (builty_id) {
            params.push(parseInt(builty_id.toString(), 10));
            sql += 'id = $1';
        }
        else {
            params.push(builty_number.toString().trim());
            sql += 'builty_number ILIKE $1';
        }
        const dbRes = await (0, pool_1.query)(sql, params);
        if (dbRes.rows.length === 0) {
            return res.status(404).json({ status: false, message: 'Builty consignment booking not found' });
        }
        const builty = dbRes.rows[0];
        const inputCode = security_code.toString().trim().toUpperCase();
        const targetCode = (builty.delivery_security_code || '').toString().trim().toUpperCase();
        if (inputCode !== targetCode) {
            const curAttempts = (attemptRecord?.attempts || 0) + 1;
            const lockUntil = curAttempts >= 5 ? now + 15 * 60 * 1000 : 0;
            codeAttemptsMap.set(key, { attempts: curAttempts, lockUntil });
            const rem = Math.max(0, 5 - curAttempts);
            return res.status(400).json({
                status: false,
                message: `Invalid verification code. ${rem} attempt(s) remaining before a 15-minute security lockout.`,
            });
        }
        // Reset attempts on successful code verification
        codeAttemptsMap.delete(key);
        return res.json({
            status: true,
            message: 'Verification code validated successfully',
            builty: {
                id: builty.id,
                builty_number: builty.builty_number,
                status: builty.status,
                source_city: builty.source_city,
                destination_city: builty.destination_city,
                party_name: builty.party_name,
                receiver_name: builty.receiver_name,
                receiver_mobile: builty.receiver_mobile,
                no_of_pkt: builty.no_of_pkt,
                pending_parcels: builty.pending_parcels,
                delivered_parcels: builty.delivered_parcels,
                builty_amount: builty.builty_amount,
            },
            allowed_statuses: ['BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
        });
    }
    catch (err) {
        return res.status(500).json({ status: false, message: err.message || 'Failed to verify booking code' });
    }
};
exports.verifyCodeForStatusUpdate = verifyCodeForStatusUpdate;
/**
 * Status Update Execution via Validated Verification Code
 */
const updateStatusByCode = async (req, res) => {
    const { builty_id, builty_number, security_code, new_status, updater_name, updater_mobile } = req.body;
    if ((!builty_id && !builty_number) || !security_code || !new_status) {
        return res.status(400).json({ status: false, message: 'Booking identifier, Verification Code, and New Status are required' });
    }
    const allowed = ['BOOKED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(new_status)) {
        return res.status(400).json({ status: false, message: `Invalid status. Allowed values: ${allowed.join(', ')}` });
    }
    try {
        let sql = 'SELECT * FROM builtys WHERE ';
        const params = [];
        if (builty_id) {
            params.push(parseInt(builty_id.toString(), 10));
            sql += 'id = $1';
        }
        else {
            params.push(builty_number.toString().trim());
            sql += 'builty_number ILIKE $1';
        }
        const dbRes = await (0, pool_1.query)(sql, params);
        if (dbRes.rows.length === 0) {
            return res.status(404).json({ status: false, message: 'Builty consignment booking not found' });
        }
        const builty = dbRes.rows[0];
        const inputCode = security_code.toString().trim().toUpperCase();
        const targetCode = (builty.delivery_security_code || '').toString().trim().toUpperCase();
        if (inputCode !== targetCode) {
            return res.status(400).json({ status: false, message: 'Invalid verification code' });
        }
        const uName = (updater_name && String(updater_name).trim().length > 0)
            ? String(updater_name).trim()
            : (req.user ? `${req.user.name} (${req.user.mobile})` : 'Delivery Person');
        const isDelivered = new_status === 'DELIVERED';
        const totalPkt = builty.no_of_pkt || 1;
        const delCount = parseInt(req.body.delivered_count || '0', 10);
        let newDelivered = builty.delivered_parcels;
        let newPending = builty.pending_parcels;
        if (delCount > 0) {
            newDelivered = Math.min(totalPkt, builty.delivered_parcels + delCount);
            newPending = Math.max(0, totalPkt - newDelivered);
        }
        else if (isDelivered) {
            newDelivered = totalPkt;
            newPending = 0;
        }
        const finalStatus = (newPending === 0 && delCount > 0 && new_status !== 'CANCELLED') ? 'DELIVERED' : new_status;
        await (0, pool_1.query)(`UPDATE builtys 
       SET status = $1, delivered_parcels = $2, pending_parcels = $3, is_security_code_verified = TRUE, updated_at = NOW() 
       WHERE id = $4`, [finalStatus, newDelivered, newPending, builty.id]);
        const actualBatchCount = delCount > 0 ? delCount : (isDelivered ? (builty.pending_parcels || 1) : 0);
        // Record entry in delivery_logs with full timestamp and attribution
        await (0, pool_1.query)(`INSERT INTO delivery_logs (builty_id, delivery_person_name, parcels_delivered_in_batch, remaining_pending_after_batch, status, delivered_at) 
       VALUES ($1, $2, $3, $4, $5, NOW())`, [builty.id, `${uName} [Code Verified]`, actualBatchCount, newPending, finalStatus]);
        return res.json({
            status: true,
            message: `Consignment status successfully updated to ${new_status}`,
            builty_id: builty.id,
            builty_status: new_status,
            delivered_parcels: newDelivered,
            pending_parcels: newPending,
        });
    }
    catch (err) {
        return res.status(500).json({ status: false, message: err.message || 'Failed to update status by code' });
    }
};
exports.updateStatusByCode = updateStatusByCode;
const updateDriverStatus = async (req, res) => {
    const { id } = req.params;
    const { status, driver_id } = req.body;
    if (!status) {
        return res.status(400).json({ status: false, message: 'Status is required' });
    }
    try {
        const existing = await (0, pool_1.query)('SELECT * FROM builtys WHERE id = $1', [id]);
        const builty = existing.rows.length > 0 ? existing.rows[0] : null;
        await (0, pool_1.query)('UPDATE builtys SET status = $1, driver_id = $2, updated_at = NOW() WHERE id = $3', [status, driver_id || req.user?.id || null, id]);
        // Also log to delivery_logs for system tracking
        const userSuffix = req.user ? `${req.user.name} (${req.user.mobile})` : 'Delivery Person';
        await (0, pool_1.query)('INSERT INTO delivery_logs (builty_id, delivery_person_name, parcels_delivered_in_batch, remaining_pending_after_batch, status, delivered_at) VALUES ($1, $2, $3, $4, $5, NOW())', [id, userSuffix, status === 'DELIVERED' ? (builty?.pending_parcels || 1) : 0, status === 'DELIVERED' ? 0 : (builty?.pending_parcels || 1), status]);
        return res.json({ status: true, message: `Booking status updated to ${status}` });
    }
    catch (err) {
        const item = memoryBuilties.find(b => b.id === Number(id));
        if (item) {
            item.status = status;
            if (driver_id || req.user?.id)
                item.driver_id = driver_id || req.user?.id;
        }
        return res.json({ status: true, message: `Booking status updated to ${status}` });
    }
};
exports.updateDriverStatus = updateDriverStatus;
const updateAdminBooking = async (req, res) => {
    const { id } = req.params;
    const { charges, discount, terms_conditions, description } = req.body;
    try {
        await (0, pool_1.query)('UPDATE builtys SET charges = $1, discount = $2, terms_conditions = $3, description = $4, updated_at = NOW() WHERE id = $5', [charges || 0, discount || 0, terms_conditions, description, id]);
        return res.json({ status: true, message: 'Booking details updated by Founder / Super Admin' });
    }
    catch (err) {
        const item = memoryBuilties.find(b => b.id === Number(id));
        if (item) {
            if (charges !== undefined)
                item.charges = parseFloat(charges);
            if (discount !== undefined)
                item.discount = parseFloat(discount);
            if (terms_conditions)
                item.terms_conditions = terms_conditions;
            if (description)
                item.description = description;
        }
        return res.json({ status: true, message: 'Booking details updated by Founder / Super Admin' });
    }
};
exports.updateAdminBooking = updateAdminBooking;
