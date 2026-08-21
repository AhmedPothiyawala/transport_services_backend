import { Router } from 'express';
import { sendOtp, verifyOtpAndLogin, registerUser, updateProfile, deleteProfile } from '../controllers/auth.controller';
import { createBranch, getBranches, deleteBranch } from '../controllers/branch.controller';
import {
  createBuilty,
  getBuiltyList,
  updateWeight,
  updateDriverStatus,
  updateAdminBooking,
} from '../controllers/builty.controller';
import { getPartyLedger, getOutstandingSummary, addPaymentEntry } from '../controllers/ledger.controller';
import { addExpense, getExpenses } from '../controllers/expense.controller';
import { getProfitAndLossReport, getDashboardStats } from '../controllers/report.controller';
import { createSubAdmin, getUsersList } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Public / Auth Routes
router.post('/auth/send-otp', sendOtp);
router.post('/auth/verify-otp', verifyOtpAndLogin);
router.post('/auth/login', verifyOtpAndLogin);
router.post('/auth/register', registerUser);
router.post('/auth/update-profile', authenticate, updateProfile);
router.post('/auth/delete-profile', authenticate, deleteProfile);

// Branch Management (Main Admin)
router.post('/branches', authenticate, authorize(['MAIN_ADMIN']), createBranch);
router.get('/branches', authenticate, getBranches);
router.delete('/branches/:id', authenticate, authorize(['MAIN_ADMIN']), deleteBranch);

// Builty Bookings
router.post('/builty/create', authenticate, createBuilty);
router.get('/builty/list', authenticate, getBuiltyList);
router.put('/builty/:id/weight', authenticate, authorize(['SUB_ADMIN', 'MAIN_ADMIN']), updateWeight); // Sub-Admin
router.put('/builty/:id/driver-status', authenticate, authorize(['DRIVER', 'MAIN_ADMIN']), updateDriverStatus); // Driver
router.put('/builty/:id/admin-update', authenticate, authorize(['MAIN_ADMIN']), updateAdminBooking); // Main Admin

// Ledgers & Outstanding Amounts (Section 3.10)
router.get('/ledger/party', authenticate, getPartyLedger);
router.get('/ledger/outstanding', authenticate, getOutstandingSummary);
router.post('/ledger/entry', authenticate, authorize(['MAIN_ADMIN', 'USER']), addPaymentEntry);

// Expense Management (Main Admin)
router.post('/expenses', authenticate, authorize(['MAIN_ADMIN']), addExpense);
router.get('/expenses', authenticate, authorize(['MAIN_ADMIN']), getExpenses);

// Reports & Dashboard Stats
router.get('/reports/profit-loss', authenticate, authorize(['MAIN_ADMIN']), getProfitAndLossReport); // Main Admin ONLY
router.get('/reports/dashboard-stats', authenticate, getDashboardStats);

// Sub Admin & User Management
router.post('/admin/sub-admin', authenticate, authorize(['MAIN_ADMIN']), createSubAdmin);
router.get('/admin/users', authenticate, authorize(['MAIN_ADMIN']), getUsersList);

export default router;
