"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const branch_controller_1 = require("../controllers/branch.controller");
const party_controller_1 = require("../controllers/party.controller");
const builty_controller_1 = require("../controllers/builty.controller");
const ledger_controller_1 = require("../controllers/ledger.controller");
const expense_controller_1 = require("../controllers/expense.controller");
const report_controller_1 = require("../controllers/report.controller");
const admin_controller_1 = require("../controllers/admin.controller");
const employee_controller_1 = require("../controllers/employee.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public / Auth Routes
router.post('/auth/send-otp', auth_controller_1.sendOtp);
router.post('/auth/verify-otp', auth_controller_1.verifyOtpAndLogin);
router.post('/auth/login', auth_controller_1.verifyOtpAndLogin);
router.post('/auth/register', auth_controller_1.registerUser);
router.get('/auth/profile', auth_1.authenticate, auth_controller_1.getProfile);
router.post('/auth/update-profile', auth_1.authenticate, auth_controller_1.updateProfile);
router.post('/auth/delete-profile', auth_1.authenticate, auth_controller_1.deleteProfile);
// Sonu Bhai OTP Approval Gate Routes
router.post('/auth/sonu-otp/send', auth_controller_1.sendSonuOtp);
router.post('/auth/sonu-otp/verify', auth_controller_1.verifySonuOtp);
// Party Management (Unified Consignor & Consignee DB)
router.post('/parties', auth_1.authenticate, party_controller_1.createParty);
router.get('/parties', auth_1.authenticate, party_controller_1.getParties);
// Branch Management (Main Admin for mutation, Public for listing)
router.post('/branches', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), branch_controller_1.createBranch);
router.get('/branches', branch_controller_1.getBranches);
router.delete('/branches/:id', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), branch_controller_1.deleteBranch);
// Builty Bookings
router.post('/builty/create', auth_1.authenticate, builty_controller_1.createBuilty);
router.get('/builty/list', auth_1.authenticate, builty_controller_1.getBuiltyList);
router.put('/builty/:id/weight', auth_1.authenticate, (0, auth_1.authorize)(['SUB_ADMIN', 'MAIN_ADMIN']), builty_controller_1.updateWeight);
router.put('/builty/:id/driver-status', auth_1.authenticate, (0, auth_1.authorize)(['DRIVER', 'SUB_ADMIN', 'MAIN_ADMIN', 'USER']), builty_controller_1.updateDriverStatus);
router.put('/builty/:id/admin-update', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), builty_controller_1.updateAdminBooking);
router.put('/builty/:id/split-delivery', auth_1.authenticate, (0, auth_1.authorize)(['DRIVER', 'SUB_ADMIN', 'MAIN_ADMIN', 'USER']), builty_controller_1.processSplitDelivery);
router.get('/builty/:id/delivery-logs', auth_1.authenticate, builty_controller_1.getDeliveryLogs);
// Ledgers & Outstanding Amounts
router.get('/ledger/party', auth_1.authenticate, ledger_controller_1.getPartyLedger);
router.get('/ledger/outstanding', auth_1.authenticate, ledger_controller_1.getOutstandingSummary);
router.post('/ledger/entry', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'SUB_ADMIN', 'USER']), ledger_controller_1.addPaymentEntry);
// Branch Expense Management
router.post('/expenses', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'SUB_ADMIN']), expense_controller_1.addExpense);
router.get('/expenses', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'SUB_ADMIN']), expense_controller_1.getExpenses);
// Branch Employee Debt & Salary Management
router.post('/employees', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'SUB_ADMIN']), employee_controller_1.createEmployee);
router.get('/employees', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'SUB_ADMIN']), employee_controller_1.getEmployees);
router.put('/employees/:id', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'SUB_ADMIN']), employee_controller_1.updateEmployeeDebtAndSalary);
// Reports & Dashboard Stats
router.get('/reports/profit-loss', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), report_controller_1.getProfitAndLossReport);
router.get('/reports/dashboard-stats', auth_1.authenticate, report_controller_1.getDashboardStats);
// Sub Admin & User Management
router.post('/admin/sub-admin', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN']), admin_controller_1.createSubAdmin);
router.get('/admin/users', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'SUB_ADMIN']), admin_controller_1.getUsersList);
router.post('/admin/user-status', auth_1.authenticate, (0, auth_1.authorize)(['MAIN_ADMIN', 'SUB_ADMIN']), auth_controller_1.toggleUserActiveStatus);
exports.default = router;
