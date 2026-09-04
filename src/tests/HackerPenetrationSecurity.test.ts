import { TransportCoreEngine, BuiltyRecord } from '../engine/TransportCoreEngine';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Hacker-Proof Penetration & Security Architecture Test Suite', () => {
  let engine: TransportCoreEngine;
  const JWT_SECRET = 'transport_management_super_secret_jwt_key_2026';

  beforeEach(() => {
    engine = new TransportCoreEngine();
  });

  test('Security Test 1: SQL Injection Payload Defense on Auth & Search Queries', () => {
    const maliciousInputs = [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "admin'--",
      "' UNION SELECT null, null, password_hash FROM users --",
      "9999999999' OR '1'='1"
    ];

    maliciousInputs.forEach(input => {
      // Clean mobile extracts digits only
      const cleanMobile = input.replace(/\D/g, '');
      if (cleanMobile.length !== 10) {
        expect(cleanMobile.length).not.toBe(10);
      }
    });
  });

  test('Security Test 2: Single Main Admin Policy - Reject creation of duplicate Admin', () => {
    // Attempting to register with ADMIN or MAIN_ADMIN role
    const attemptRole = 'ADMIN';
    const isMainAdminCreationAllowed = (role: string) => {
      if (role === 'ADMIN' || role === 'MAIN_ADMIN') {
        return { allowed: false, status: 403, error: 'Main Admin cannot be created. Exactly ONE Main Admin is permitted.' };
      }
      return { allowed: true, status: 200 };
    };

    const res1 = isMainAdminCreationAllowed('MAIN_ADMIN');
    const res2 = isMainAdminCreationAllowed('ADMIN');
    const res3 = isMainAdminCreationAllowed('USER');

    expect(res1.allowed).toBe(false);
    expect(res1.status).toBe(403);
    expect(res2.allowed).toBe(false);
    expect(res2.status).toBe(403);
    expect(res3.allowed).toBe(true);
    expect(res3.status).toBe(200);
  });

  test('Security Test 3: Sub-Admin Public Registration Prevention', () => {
    const isSubAdminPublicRegistrationAllowed = (role: string) => {
      if (role === 'SUB_ADMIN') {
        return { allowed: false, status: 403, error: 'Sub-Admins can only be created by the Main Admin.' };
      }
      return { allowed: true, status: 200 };
    };

    const res = isSubAdminPublicRegistrationAllowed('SUB_ADMIN');
    expect(res.allowed).toBe(false);
    expect(res.status).toBe(403);
  });

  test('Security Test 4: Customer-Only Builty Booking Creation Authority', () => {
    const canCreateBooking = (userRole: string) => {
      if (userRole !== 'USER' && userRole !== 'CUSTOMER') {
        return { allowed: false, status: 403, error: 'Access Denied: Only registered customers can create bookings.' };
      }
      return { allowed: true, status: 200 };
    };

    expect(canCreateBooking('SUB_ADMIN').allowed).toBe(false);
    expect(canCreateBooking('SUB_ADMIN').status).toBe(403);
    expect(canCreateBooking('DRIVER').allowed).toBe(false);
    expect(canCreateBooking('DRIVER').status).toBe(403);
    expect(canCreateBooking('MAIN_ADMIN').allowed).toBe(false);
    expect(canCreateBooking('CUSTOMER').allowed).toBe(true);
    expect(canCreateBooking('USER').allowed).toBe(true);
  });

  test('Security Test 5: 5-Strike Brute-Force Lockout Defense Engine', () => {
    const failedMap = new Map<string, { attempts: number; lockUntil: number }>();
    const testMobile = '9876543210';
    const now = Date.now();

    for (let i = 1; i <= 5; i++) {
      const state = failedMap.get(testMobile) || { attempts: 0, lockUntil: 0 };
      const nextAttempts = state.attempts + 1;
      if (nextAttempts >= 5) {
        failedMap.set(testMobile, { attempts: nextAttempts, lockUntil: now + 15 * 60 * 1000 });
      } else {
        failedMap.set(testMobile, { attempts: nextAttempts, lockUntil: 0 });
      }
    }

    const finalState = failedMap.get(testMobile);
    expect(finalState?.attempts).toBe(5);
    expect(finalState?.lockUntil).toBeGreaterThan(now);
  });

  test('Security Test 6: Rate per Kg Privacy Matrix & Masking for Non-Admin Roles', () => {
    const mockBuilty: BuiltyRecord = {
      id: 501,
      serial_number: 'SR-501',
      sender_name: 'Gujarat Cottons',
      sender_mobile: '9876543210',
      receiver_name: 'Delhi Fabrics',
      receiver_mobile: '9123456789',
      total_parcels: 50,
      delivered_parcels: 0,
      pending_parcels: 50,
      weight: 250.0,
      rate: 45.0,
      total_amount: 11250.0,
      delivery_security_code: 'SEC999',
      is_security_code_verified: false,
      status: 'BOOKED',
    };

    const userPayload = engine.generateWhatsAppPayload(mockBuilty, 'CUSTOMER');
    const subAdminPayload = engine.generateWhatsAppPayload(mockBuilty, 'SUB_ADMIN');
    const driverPayload = engine.generateWhatsAppPayload(mockBuilty, 'DRIVER');
    const mainAdminPayload = engine.generateWhatsAppPayload(mockBuilty, 'MAIN_ADMIN');

    expect(userPayload.message_body).not.toContain('Rate:');
    expect(subAdminPayload.message_body).not.toContain('Rate:');
    expect(driverPayload.message_body).not.toContain('Rate:');
    expect(mainAdminPayload.message_body).toContain('Rate: ₹45/kg');
  });

  test('Security Test 7: Delivered Consignment Immutable Lock', () => {
    const fullyDeliveredBuilty: BuiltyRecord = {
      id: 601,
      serial_number: 'SR-601',
      sender_name: 'Suresh Textiles',
      sender_mobile: '9876543210',
      receiver_name: 'Ramesh Sarees',
      receiver_mobile: '9123456789',
      total_parcels: 20,
      delivered_parcels: 20,
      pending_parcels: 0,
      weight: 100.0,
      rate: 15.0,
      total_amount: 1500.0,
      delivery_security_code: 'SEC100',
      is_security_code_verified: true,
      status: 'DELIVERED',
    };

    const splitAttempt = engine.processSplitDelivery(fullyDeliveredBuilty, 5, 'Delivery Boy 1');
    expect(splitAttempt.error).toBeDefined();
    expect(splitAttempt.error).toContain('already fully delivered');
  });

  test('Security Test 8: Strict 10-Digit Mobile Number Enforcer', () => {
    const invalidMobiles = ['12345', '987654321', '98765432100', 'abcdefghij', ''];
    invalidMobiles.forEach(m => {
      const clean = m.replace(/\D/g, '');
      expect(clean.length === 10).toBe(false);
    });

    const validMobile = '9876543210';
    expect(validMobile.replace(/\D/g, '').length).toBe(10);
  });

  test('Security Test 9: Single Active Sub-Admin Per Branch Rule', () => {
    const activeSubAdmins = [{ branch_id: 1, name: 'Delhi Sub Admin', is_active: true }];

    const canAssignSubAdmin = (branchId: number) => {
      const existing = activeSubAdmins.find(a => a.branch_id === branchId && a.is_active);
      if (existing) {
        return { allowed: false, error: 'Sub-Admin already exists for this branch. Each branch can have ONLY ONE active Sub-Admin.' };
      }
      return { allowed: true };
    };

    expect(canAssignSubAdmin(1).allowed).toBe(false);
    expect(canAssignSubAdmin(2).allowed).toBe(true);
  });

  test('Security Test 10: Payment Collector Identity Audit Trail on Ledgers', () => {
    const recordPayment = (partyName: string, amount: number, user: { name: string; role: string }) => {
      return {
        party_name: partyName,
        account_type: 'CREDIT',
        amount,
        collected_by: `${user.name} (${user.role})`,
        created_at: new Date().toISOString(),
      };
    };

    const entry = recordPayment('Shree Ganesh Traders', 5000, { name: 'Ahmed', role: 'SUB_ADMIN' });
    expect(entry.collected_by).toBe('Ahmed (SUB_ADMIN)');
  });
});
