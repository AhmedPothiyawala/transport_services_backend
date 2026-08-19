"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteBranch = exports.getBranches = exports.createBranch = void 0;
const pool_1 = require("../db/pool");
const memoryBranches = [
    { id: 1, branch_name: 'Ahmedabad Central', city: 'Ahmedabad', code: 'AMD01' },
    { id: 2, branch_name: 'Delhi Hub', city: 'Delhi', code: 'DEL01' },
    { id: 3, branch_name: 'Mumbai Terminal', city: 'Mumbai', code: 'MUM01' }
];
const createBranch = async (req, res) => {
    const { branch_name, city, code } = req.body;
    if (!branch_name || !city || !code) {
        return res.status(400).json({ status: false, message: 'Branch Name, City, and Code are required' });
    }
    try {
        const dbRes = await (0, pool_1.query)('INSERT INTO branches (branch_name, city, code) VALUES ($1, $2, $3) RETURNING *', [branch_name, city, code]);
        return res.json({ status: true, message: 'Branch created successfully', branch: dbRes.rows[0] });
    }
    catch (err) {
        const newBranch = { id: memoryBranches.length + 1, branch_name, city, code };
        memoryBranches.push(newBranch);
        return res.json({ status: true, message: 'Branch created successfully (fallback)', branch: newBranch });
    }
};
exports.createBranch = createBranch;
const getBranches = async (req, res) => {
    try {
        const dbRes = await (0, pool_1.query)('SELECT * FROM branches ORDER BY id ASC');
        return res.json({ status: true, branches: dbRes.rows });
    }
    catch (err) {
        return res.json({ status: true, branches: memoryBranches });
    }
};
exports.getBranches = getBranches;
const deleteBranch = async (req, res) => {
    const { id } = req.params;
    try {
        await (0, pool_1.query)('DELETE FROM branches WHERE id = $1', [id]);
        return res.json({ status: true, message: 'Branch deleted successfully' });
    }
    catch (err) {
        const idx = memoryBranches.findIndex(b => b.id === Number(id));
        if (idx !== -1)
            memoryBranches.splice(idx, 1);
        return res.json({ status: true, message: 'Branch deleted successfully' });
    }
};
exports.deleteBranch = deleteBranch;
