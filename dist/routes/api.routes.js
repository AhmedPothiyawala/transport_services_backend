"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const branch_controller_1 = require("../controllers/branch.controller");
const builty_controller_1 = require("../controllers/builty.controller");
const ledger_controller_1 = require("../controllers/ledger.controller");
const expense_controller_1 = require("../controllers/expense.controller");
const report_controller_1 = require("../controllers/report.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public / Auth Routes
router.post('/auth/send-otp', auth_controller_1.sendOtp);
router.post('/auth/verify-otp', auth_controller_1.verifyOtpAndLogin);
router.post('/auth/update-profile', auth_1.authenticate, auth_controller_1.updateProfile);
router.post('/auth/delete-profile', auth_1.authenticate, auth_controller_1.deleteProfile);
// Branch Management (Main Admin)
router.post('/branches', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), branch_controller_1.createBranch);
router.get('/branches', auth_1.authenticate, branch_controller_1.getBranches);
router.delete('/branches/:id', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), branch_controller_1.deleteBranch);
// Builty Bookings
router.post('/builty/create', auth_1.authenticate, builty_controller_1.createBuilty);
router.get('/builty/list', auth_1.authenticate, builty_controller_1.getBuiltyList);
router.put('/builty/:id/weight', auth_1.authenticate, (0, auth_1.authorize)(['SUB_ADMIN', 'MAIN_ADMIN']), builty_controller_1.updateWeight); // Sub-Admin
router.put('/builty/:id/driver-status', auth_1.authenticate, (0, auth_1.authorize)(['DRIVER', 'MAIN_ADMIN']), builty_controller_1.updateDriverStatus); // Driver
router.put('/builty/:id/admin-update', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), builty_controller_1.updateAdminBooking); // Main Admin
// Ledgers & Outstanding Amounts (Section 3.10)
router.get('/ledger/party', auth_1.authenticate, ledger_controller_1.getPartyLedger);
router.get('/ledger/outstanding', auth_1.authenticate, ledger_controller_1.getOutstandingSummary);
router.post('/ledger/entry', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'USER']), ledger_controller_1.addPaymentEntry);
// Expense Management (Main Admin)
router.post('/expenses', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), expense_controller_1.addExpense);
router.get('/expenses', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), expense_controller_1.getExpenses);
// Reports & Dashboard Stats
router.get('/reports/profit-loss', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), report_controller_1.getProfitAndLossReport); // Main Admin ONLY
router.get('/reports/dashboard-stats', auth_1.authenticate, report_controller_1.getDashboardStats);
// Sub Admin & User Management
router.post('/admin/sub-admin', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), admin_controller_1.createSubAdmin);
router.get('/admin/users', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), admin_controller_1.getUsersList);
exports.default = router;
