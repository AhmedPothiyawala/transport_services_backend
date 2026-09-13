"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getParties = exports.togglePartyStatus = exports.updateParty = exports.createParty = void 0;
const pool_1 = require("../db/pool");
const memoryParties = [];
const createParty = async (req, res) => {
    const { name, mobile, gstin, address, branch_id } = req.body;
    if (!name || !name.trim()) {
        return res.status(400).json({ status: false, message: 'Party name is required' });
    }
    if (!mobile || !mobile.trim()) {
        return res.status(400).json({ status: false, message: 'Mobile number is required' });
    }
    const cleanMobile = mobile.toString().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
        return res.status(400).json({ status: false, message: 'Invalid mobile number format. Party mobile number must be exactly 10 digits.' });
    }
    const cleanName = name.trim();
    const cleanGstin = gstin ? gstin.trim() : '';
    const cleanAddress = address ? address.trim() : '';
    const branchIdNum = branch_id ? parseInt(branch_id.toString(), 10) : null;
    try {
        // Validate duplicate party name within the same branch
        if (branchIdNum) {
            const dupCheck = await (0, pool_1.query)('SELECT id FROM parties WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND branch_id = $2 AND is_active = TRUE', [cleanName, branchIdNum]);
            if (dupCheck.rows.length > 0) {
                return res.status(400).json({
                    status: false,
                    message: 'A party with this name already exists in the selected branch.',
                });
            }
        }
        const dbRes = await (0, pool_1.query)('INSERT INTO parties (name, mobile, gstin, address, branch_id, is_active) VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING *', [cleanName, cleanMobile, cleanGstin, cleanAddress, branchIdNum]);
        return res.json({
            status: true,
            message: 'Party added successfully',
            party: dbRes.rows[0],
        });
    }
    catch (err) {
        // Unique violation on mobile column (PostgreSQL Error Code 23505)
        if (err && (err.code === '23505' || (err.message && err.message.includes('unique')))) {
            return res.status(400).json({
                status: false,
                message: 'Party with this mobile number already exists.',
            });
        }
        // Fallback mode logic
        const existing = memoryParties.find(p => p.mobile === cleanMobile);
        if (existing) {
            return res.status(400).json({
                status: false,
                message: 'Party with this mobile number already exists.',
            });
        }
        const newParty = {
            id: memoryParties.length + 1,
            name: cleanName,
            mobile: cleanMobile,
            gstin: cleanGstin,
            address: cleanAddress,
            branch_id: branchIdNum,
            is_active: true,
            created_at: new Date().toISOString(),
        };
        memoryParties.push(newParty);
        return res.json({
            status: true,
            message: 'Party added successfully',
            party: newParty,
        });
    }
};
exports.createParty = createParty;
const updateParty = async (req, res) => {
    const { id } = req.params;
    const { name, mobile, gstin, address, branch_id, is_active } = req.body;
    if (!id) {
        return res.status(400).json({ status: false, message: 'Party ID is required' });
    }
    if (!name || !name.trim()) {
        return res.status(400).json({ status: false, message: 'Party name is required' });
    }
    if (!mobile || !mobile.trim()) {
        return res.status(400).json({ status: false, message: 'Mobile number is required' });
    }
    const cleanMobile = mobile.toString().replace(/\D/g, '');
    if (cleanMobile.length !== 10) {
        return res.status(400).json({ status: false, message: 'Invalid mobile number format. Party mobile number must be exactly 10 digits.' });
    }
    const cleanName = name.trim();
    const cleanGstin = gstin ? gstin.trim() : '';
    const cleanAddress = address ? address.trim() : '';
    const branchIdNum = branch_id ? parseInt(branch_id.toString(), 10) : null;
    const activeBool = is_active !== undefined ? Boolean(is_active) : true;
    try {
        // Check duplicate party name in same branch for other parties
        if (branchIdNum) {
            const dupCheck = await (0, pool_1.query)('SELECT id FROM parties WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND branch_id = $2 AND id != $3 AND is_active = TRUE', [cleanName, branchIdNum, id]);
            if (dupCheck.rows.length > 0) {
                return res.status(400).json({
                    status: false,
                    message: 'Another party with this name already exists in the selected branch.',
                });
            }
        }
        const dbRes = await (0, pool_1.query)(`UPDATE parties 
       SET name = $1, mobile = $2, gstin = $3, address = $4, branch_id = $5, is_active = $6 
       WHERE id = $7 
       RETURNING *`, [cleanName, cleanMobile, cleanGstin, cleanAddress, branchIdNum, activeBool, id]);
        if (dbRes.rows.length === 0) {
            return res.status(404).json({ status: false, message: 'Party not found' });
        }
        return res.json({
            status: true,
            message: 'Party updated successfully',
            party: dbRes.rows[0],
        });
    }
    catch (err) {
        if (err && (err.code === '23505' || (err.message && err.message.includes('unique')))) {
            return res.status(400).json({
                status: false,
                message: 'Another party with this mobile number already exists.',
            });
        }
        const memIndex = memoryParties.findIndex(p => p.id === Number(id));
        if (memIndex !== -1) {
            memoryParties[memIndex] = {
                ...memoryParties[memIndex],
                name: cleanName,
                mobile: cleanMobile,
                gstin: cleanGstin,
                address: cleanAddress,
                branch_id: branchIdNum,
                is_active: activeBool,
            };
            return res.json({
                status: true,
                message: 'Party updated successfully',
                party: memoryParties[memIndex],
            });
        }
        return res.status(500).json({ status: false, message: err.message || 'Failed to update party' });
    }
};
exports.updateParty = updateParty;
const togglePartyStatus = async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    try {
        let dbRes;
        if (is_active !== undefined) {
            dbRes = await (0, pool_1.query)('UPDATE parties SET is_active = $1 WHERE id = $2 RETURNING *', [Boolean(is_active), id]);
        }
        else {
            dbRes = await (0, pool_1.query)('UPDATE parties SET is_active = NOT COALESCE(is_active, TRUE) WHERE id = $1 RETURNING *', [id]);
        }
        if (dbRes.rows.length === 0) {
            return res.status(404).json({ status: false, message: 'Party not found' });
        }
        const updated = dbRes.rows[0];
        return res.json({
            status: true,
            message: `Party ${updated.is_active ? 'activated' : 'deactivated'} successfully`,
            party: updated,
        });
    }
    catch (err) {
        const mem = memoryParties.find(p => p.id === Number(id));
        if (mem) {
            mem.is_active = is_active !== undefined ? Boolean(is_active) : !mem.is_active;
            return res.json({
                status: true,
                message: `Party ${mem.is_active ? 'activated' : 'deactivated'} successfully`,
                party: mem,
            });
        }
        return res.status(500).json({ status: false, message: 'Failed to update party status' });
    }
};
exports.togglePartyStatus = togglePartyStatus;
const getParties = async (req, res) => {
    const { branch_id, search, active_only } = req.query;
    try {
        let sql = `
      SELECT p.*, b.branch_name, b.city AS branch_city 
      FROM parties p 
      LEFT JOIN branches b ON p.branch_id = b.id 
      WHERE 1=1
    `;
        const params = [];
        if (branch_id && branch_id !== 'ALL' && branch_id !== 'all') {
            params.push(parseInt(String(branch_id), 10));
            sql += ` AND (p.branch_id = $${params.length} OR p.branch_id IS NULL)`;
        }
        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (p.name ILIKE $${params.length} OR p.mobile ILIKE $${params.length})`;
        }
        // Universal Pagination (Default 100, Max 500)
        const pageNum = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limitNum = Math.min(500, Math.max(1, parseInt(String(req.query.limit || '100'), 10) || 100));
        const offset = (pageNum - 1) * limitNum;
        const whereIndex = sql.indexOf('WHERE 1=1');
        const whereClause = whereIndex !== -1 ? sql.slice(whereIndex) : 'WHERE 1=1';
        const countSql = `SELECT COUNT(*) AS total FROM parties p LEFT JOIN branches b ON p.branch_id = b.id ${whereClause}`;
        const pagedSql = `${sql} ORDER BY p.name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
            parties: dbRes.rows,
        });
    }
    catch (err) {
        const sorted = [...memoryParties].sort((a, b) => a.name.localeCompare(b.name));
        return res.json({
            status: true,
            total: sorted.length,
            page: 1,
            limit: sorted.length,
            total_pages: 1,
            parties: sorted,
        });
    }
};
exports.getParties = getParties;
