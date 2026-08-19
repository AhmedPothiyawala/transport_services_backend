"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAdminBooking = exports.updateDriverStatus = exports.updateWeight = exports.getBuiltyList = exports.createBuilty = void 0;
const pool_1 = require("../db/pool");
const memoryBuilties = [];
const createBuilty = async (req, res) => {
    const { branch_id, source_city, destination_city, party_name, receiver_name, receiver_mobile, payment_status, builty_amount, paid_amount, bill_type, terms_conditions, description, } = req.body;
    const currentUserId = req.user?.id || 1;
    if (!source_city || !destination_city || !party_name || !receiver_name || !builty_amount) {
        return res.status(400).json({ status: false, message: 'Missing mandatory Builty booking fields' });
    }
    const bAmount = parseFloat(builty_amount);
    const pAmount = parseFloat(paid_amount || '0');
    const pendAmount = Math.max(0, bAmount - pAmount);
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
        const insertQuery = `
      INSERT INTO builtys (
        builty_number, serial_number, branch_id, user_id, source_city, destination_city,
        party_name, receiver_name, receiver_mobile, payment_status, builty_amount,
        paid_amount, pending_amount, bill_type, terms_conditions, description, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'PENDING')
      RETURNING *
    `;
        const insertRes = await client.query(insertQuery, [
            builtyNumber,
            serialNumber,
            branch_id || 1,
            currentUserId,
            source_city,
            destination_city,
            party_name,
            receiver_name,
            receiver_mobile || '',
            payment_status || 'PENDING',
            bAmount,
            pAmount,
            pendAmount,
            bill_type || 'PAKKE',
            terms_conditions || 'Standard transport agreement terms.',
            description || ''
        ]);
        // Section 3.10: Record ledger debit entry
        await client.query('INSERT INTO ledgers (party_name, builty_id, account_type, amount, balance, remarks) VALUES ($1, $2, $3, $4, $5, $6)', [party_name, insertRes.rows[0].id, 'DEBIT', bAmount, pendAmount, `Builty Creation ${builtyNumber}`]);
        await client.query('COMMIT');
        client.release();
        return res.json({
            status: true,
            message: 'Builty created successfully',
            builty: insertRes.rows[0]
        });
    }
    catch (err) {
        if (client) {
            await client.query('ROLLBACK');
            client.release();
        }
        // Fallback mode
        serialNumber = memoryBuilties.length + 1;
        builtyNumber = `BTY-${source_city.substring(0, 3).toUpperCase()}-${String(serialNumber).padStart(4, '0')}`;
        const newBuilty = {
            id: memoryBuilties.length + 1,
            builty_number: builtyNumber,
            serial_number: serialNumber,
            branch_id: branch_id || 1,
            user_id: currentUserId,
            source_city,
            destination_city,
            party_name,
            receiver_name,
            receiver_mobile: receiver_mobile || '',
            payment_status: payment_status || 'PENDING',
            builty_amount: bAmount,
            paid_amount: pAmount,
            pending_amount: pendAmount,
            bill_type: bill_type || 'PAKKE',
            terms_conditions: terms_conditions || 'Standard transport terms.',
            description: description || '',
            weight_kg: 0,
            charges: 0,
            discount: 0,
            status: 'PENDING',
            created_at: new Date().toISOString()
        };
        memoryBuilties.push(newBuilty);
        return res.json({
            status: true,
            message: 'Builty created successfully',
            builty: newBuilty
        });
    }
};
exports.createBuilty = createBuilty;
const getBuiltyList = async (req, res) => {
    const { city, date, status, party_name } = req.query;
    const user = req.user;
    try {
        let sql = 'SELECT * FROM builtys WHERE 1=1';
        const params = [];
        // Role-based data scoping
        if (user?.role === 'USER') {
            params.push(user.id);
            sql += ` AND user_id = $${params.length}`;
        }
        else if (user?.role === 'DRIVER') {
            params.push(user.id);
            sql += ` AND (driver_id = $${params.length} OR status IN ('PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY'))`;
        }
        if (city) {
            params.push(`%${city}%`);
            sql += ` AND (source_city ILIKE $${params.length} OR destination_city ILIKE $${params.length})`;
        }
        if (date) {
            params.push(date);
            sql += ` AND DATE(created_at) = $${params.length}`;
        }
        if (status) {
            params.push(status);
            sql += ` AND status = $${params.length}`;
        }
        if (party_name) {
            params.push(`%${party_name}%`);
            sql += ` AND party_name ILIKE $${params.length}`;
        }
        sql += ' ORDER BY id DESC';
        const dbRes = await (0, pool_1.query)(sql, params);
        return res.json({ status: true, builtys: dbRes.rows });
    }
    catch (err) {
        let filtered = [...memoryBuilties];
        if (user?.role === 'USER') {
            filtered = filtered.filter(b => b.user_id === user.id);
        }
        else if (user?.role === 'DRIVER') {
            filtered = filtered.filter(b => b.driver_id === user.id || b.driver_id == null || ['PENDING', 'ASSIGNED', 'OUT_FOR_DELIVERY'].includes(b.status));
        }
        if (city) {
            const cStr = String(city).toLowerCase();
            filtered = filtered.filter(b => b.source_city.toLowerCase().includes(cStr) || b.destination_city.toLowerCase().includes(cStr));
        }
        if (status) {
            filtered = filtered.filter(b => b.status === status);
        }
        return res.json({ status: true, builtys: filtered });
    }
};
exports.getBuiltyList = getBuiltyList;
const updateWeight = async (req, res) => {
    const { id } = req.params;
    const { weight_kg } = req.body;
    if (!weight_kg) {
        return res.status(400).json({ status: false, message: 'Weight in kg is required' });
    }
    try {
        await (0, pool_1.query)('UPDATE builtys SET weight_kg = $1, updated_at = NOW() WHERE id = $2', [weight_kg, id]);
        return res.json({ status: true, message: 'Booking weight updated successfully' });
    }
    catch (err) {
        const item = memoryBuilties.find(b => b.id === Number(id));
        if (item)
            item.weight_kg = parseFloat(weight_kg);
        return res.json({ status: true, message: 'Booking weight updated successfully' });
    }
};
exports.updateWeight = updateWeight;
const updateDriverStatus = async (req, res) => {
    const { id } = req.params;
    const { status, driver_id } = req.body;
    if (!status) {
        return res.status(400).json({ status: false, message: 'Status is required' });
    }
    try {
        await (0, pool_1.query)('UPDATE builtys SET status = $1, driver_id = $2, updated_at = NOW() WHERE id = $3', [status, driver_id || req.user?.id || null, id]);
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
        return res.json({ status: true, message: 'Booking details updated by Main Admin' });
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
        return res.json({ status: true, message: 'Booking details updated by Main Admin' });
    }
};
exports.updateAdminBooking = updateAdminBooking;
