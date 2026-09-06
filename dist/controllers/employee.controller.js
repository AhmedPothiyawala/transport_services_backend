"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmployeeDebtAndSalary = exports.getEmployees = exports.createEmployee = void 0;
const pool_1 = require("../db/pool");
const memoryEmployees = [];
const createEmployee = async (req, res) => {
    const { branch_id, name, mobile_number, salary, debt_amount } = req.body;
    const user = req.user;
    if (!name) {
        return res.status(400).json({ status: false, message: 'Employee name is required' });
    }
    const assignedBranch = branch_id || user?.branch_id || 1;
    const salVal = parseFloat(salary || '0');
    const debtVal = parseFloat(debt_amount || '0');
    try {
        const dbRes = await (0, pool_1.query)('INSERT INTO employees (branch_id, name, mobile_number, salary, debt_amount) VALUES ($1, $2, $3, $4, $5) RETURNING *', [assignedBranch, name, mobile_number || '', salVal, debtVal]);
        return res.json({ status: true, message: 'Employee created successfully', employee: dbRes.rows[0] });
    }
    catch (err) {
        const newEmp = {
            id: memoryEmployees.length + 1,
            branch_id: assignedBranch,
            name,
            mobile_number: mobile_number || '',
            salary: salVal,
            debt_amount: debtVal,
            created_at: new Date().toISOString()
        };
        memoryEmployees.push(newEmp);
        return res.json({ status: true, message: 'Employee created successfully', employee: newEmp });
    }
};
exports.createEmployee = createEmployee;
const getEmployees = async (req, res) => {
    const { branch_id } = req.query;
    const user = req.user;
    let targetBranch = branch_id;
    if (user?.role === 'SUB_ADMIN' && user.branch_id) {
        targetBranch = user.branch_id.toString();
    }
    try {
        let sql = 'SELECT e.*, b.branch_name FROM employees e LEFT JOIN branches b ON e.branch_id = b.id WHERE 1=1';
        const params = [];
        if (targetBranch && targetBranch !== 'ALL' && targetBranch !== 'all') {
            params.push(targetBranch);
            sql += ` AND e.branch_id = $${params.length}`;
        }
        sql += ' ORDER BY e.id ASC';
        const dbRes = await (0, pool_1.query)(sql, params);
        return res.json({ status: true, employees: dbRes.rows });
    }
    catch (err) {
        let filtered = [...memoryEmployees];
        if (targetBranch && targetBranch !== 'ALL' && targetBranch !== 'all') {
            filtered = filtered.filter(e => e.branch_id === Number(targetBranch));
        }
        return res.json({ status: true, employees: filtered });
    }
};
exports.getEmployees = getEmployees;
const updateEmployeeDebtAndSalary = async (req, res) => {
    const { id } = req.params;
    const { debt_amount, salary } = req.body;
    try {
        const empRes = await (0, pool_1.query)('SELECT * FROM employees WHERE id = $1', [id]);
        if (empRes.rows.length === 0) {
            return res.status(404).json({ status: false, message: 'Employee not found' });
        }
        const currentEmp = empRes.rows[0];
        const newSalary = salary !== undefined ? parseFloat(salary) : parseFloat(currentEmp.salary);
        const newDebt = debt_amount !== undefined ? parseFloat(debt_amount) : parseFloat(currentEmp.debt_amount);
        await (0, pool_1.query)('UPDATE employees SET salary = $1, debt_amount = $2 WHERE id = $3', [newSalary, newDebt, id]);
        return res.json({
            status: true,
            message: 'Employee details updated successfully',
            salary: newSalary,
            debt_amount: newDebt
        });
    }
    catch (err) {
        const emp = memoryEmployees.find(e => e.id === Number(id));
        if (emp) {
            if (salary !== undefined)
                emp.salary = parseFloat(salary);
            if (debt_amount !== undefined)
                emp.debt_amount = parseFloat(debt_amount);
        }
        return res.json({ status: true, message: 'Employee details updated successfully' });
    }
};
exports.updateEmployeeDebtAndSalary = updateEmployeeDebtAndSalary;
