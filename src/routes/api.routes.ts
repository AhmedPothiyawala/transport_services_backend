import { Router } from 'express';
import { sendOtp, verifyOtpAndLogin, registerUser, updateProfile, deleteProfile, getProfile, sendSonuOtp, verifySonuOtp, toggleUserActiveStatus } from '../controllers/auth.controller';
import { createBranch, getBranches, deleteBranch } from '../controllers/branch.controller';
import { createParty, getParties, updateParty, togglePartyStatus } from '../controllers/party.controller';
import {
  createBuilty,
  getBuiltyList,
  updateWeight,
  updateDriverStatus,
  updateAdminBooking,
  processSplitDelivery,
  getDeliveryLogs,
  getAllDeliveryLogs,
  verifyCodeForStatusUpdate,
  updateStatusByCode,
} from '../controllers/builty.controller';
import { getPartyLedger, getOutstandingSummary, addPaymentEntry } from '../controllers/ledger.controller';
import { addExpense, getExpenses } from '../controllers/expense.controller';
import { getProfitAndLossReport, getDashboardStats } from '../controllers/report.controller';
import { createSubAdmin, createCustomer, getUsersList } from '../controllers/admin.controller';
import { createEmployee, getEmployees, updateEmployeeDebtAndSalary } from '../controllers/employee.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public / Auth Routes
router.post('/auth/send-otp', sendOtp);
router.post('/auth/verify-otp', verifyOtpAndLogin);
router.post('/auth/login', verifyOtpAndLogin);
router.post('/auth/register', registerUser);
router.get('/auth/profile', authenticate, getProfile);
router.post('/auth/update-profile', authenticate, updateProfile);
router.post('/auth/delete-profile', authenticate, deleteProfile);

// Sonu Bhai OTP Approval Gate Routes
router.post('/auth/sonu-otp/send', sendSonuOtp);
router.post('/auth/sonu-otp/verify', verifySonuOtp);

// Party Management (Unified Consignor & Consignee DB)
router.post('/parties', authenticate, createParty);
router.get('/parties', authenticate, getParties);
router.put('/parties/:id', authenticate, updateParty);
router.put('/parties/:id/status', authenticate, togglePartyStatus);

// Branch Management (Main Admin for mutation, Public for listing)
router.post('/branches', authenticate, authorize(['MAIN_ADMIN']), createBranch);
router.get('/branches', getBranches);
router.delete('/branches/:id', authenticate, authorize(['MAIN_ADMIN']), deleteBranch);

// Builty Bookings
router.post('/builty/create', authenticate, createBuilty);
router.get('/builty/list', authenticate, getBuiltyList);
router.put('/builty/:id/weight', authenticate, authorize(['SUB_ADMIN', 'MAIN_ADMIN']), updateWeight);
router.put('/builty/:id/driver-status', authenticate, authorize(['DRIVER', 'SUB_ADMIN', 'MAIN_ADMIN', 'USER']), updateDriverStatus);
router.put('/builty/:id/admin-update', authenticate, authorize(['MAIN_ADMIN']), updateAdminBooking);
router.put('/builty/:id/split-delivery', authenticate, authorize(['DRIVER', 'SUB_ADMIN', 'MAIN_ADMIN', 'USER']), processSplitDelivery);
router.get('/builty/:id/delivery-logs', authenticate, getDeliveryLogs);
router.get('/builty/delivery-logs/all', authenticate, getAllDeliveryLogs);

// Status Update via Verification Code
router.post('/builty/verify-code', authenticate, verifyCodeForStatusUpdate);
router.post('/builty/update-status-by-code', authenticate, updateStatusByCode);

// Ledgers & Outstanding Amounts
router.get('/ledger/party', authenticate, getPartyLedger);
router.get('/ledger/outstanding', authenticate, getOutstandingSummary);
router.post('/ledger/entry', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN', 'USER']), addPaymentEntry);

// Branch Expense Management
router.post('/expenses', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN']), addExpense);
router.get('/expenses', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN', 'USER']), getExpenses);

// Branch Employee Debt & Salary Management
router.post('/employees', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN']), createEmployee);
router.get('/employees', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN']), getEmployees);
router.put('/employees/:id', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN']), updateEmployeeDebtAndSalary);

// Reports & Dashboard Stats
router.get('/reports/profit-loss', authenticate, authorize(['MAIN_ADMIN']), getProfitAndLossReport);
router.get('/reports/dashboard-stats', authenticate, getDashboardStats);

// Sub Admin, Customer & User Management
router.post('/admin/sub-admin', authenticate, authorize(['MAIN_ADMIN']), createSubAdmin);
router.post('/admin/customer', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN']), createCustomer);
router.get('/admin/users', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN']), getUsersList);
router.post('/admin/user-status', authenticate, authorize(['MAIN_ADMIN', 'SUB_ADMIN']), toggleUserActiveStatus);

export default router;
