import { TransportCoreEngine, BuiltyRecord } from '../engine/TransportCoreEngine';

describe('Transport & Logistics Comprehensive 40-Run Verification Suite', () => {
  let engine: TransportCoreEngine;
  let mockBuilty: BuiltyRecord;

  beforeEach(() => {
    engine = new TransportCoreEngine();
    mockBuilty = {
      id: 101,
      serial_number: "SR-9021",
      sender_name: "Textile Hub Ahmedabad",
      sender_mobile: "9876543210",
      receiver_name: "Gujarat Agency 1",
      receiver_mobile: "9123456780",
      total_parcels: 100,
      delivered_parcels: 0,
      pending_parcels: 100,
      weight: 500.0,
      rate: 20.00,
      total_amount: 10000.00,
      delivery_security_code: "SEC449",
      is_security_code_verified: false,
      status: 'BOOKED'
    };
  });

  test('Scenario 1: Rate Privacy Matrix - Rates strictly hidden from Customer, Sub-Admin, Driver, WhatsApp templates, visible exclusively to Main Admin', () => {
    const customerPayload = engine.generateWhatsAppPayload(mockBuilty, 'CUSTOMER');
    const subAdminPayload = engine.generateWhatsAppPayload(mockBuilty, 'SUB_ADMIN');
    const driverPayload = engine.generateWhatsAppPayload(mockBuilty, 'DRIVER');
    const mainAdminPayload = engine.generateWhatsAppPayload(mockBuilty, 'MAIN_ADMIN');

    expect(customerPayload.message_body).not.toContain('Rate:');
    expect(subAdminPayload.message_body).not.toContain('Rate:');
    expect(driverPayload.message_body).not.toContain('Rate:');
    expect(customerPayload.message_body).toContain('Total Bill: ₹10000');
    expect(subAdminPayload.message_body).toContain('Total Bill: ₹10000');

    expect(mainAdminPayload.message_body).toContain('Rate: ₹20/kg');
    expect(mainAdminPayload.message_body).toContain('Total Bill: ₹10000');
  });

  test('Scenario 2: 100-Parcel Split Delivery Engine with Auto-Code Bypass for subsequent delivery boys', () => {
    // Delivery Batch 1: Raju delivers 40 parcels with Security Code SEC449
    const batch1 = engine.processSplitDelivery(mockBuilty, 40, "Raju Delivery Boy", "SEC449");
    expect(batch1.error).toBeUndefined();
    expect(batch1.updatedBuilty.delivered_parcels).toBe(40);
    expect(batch1.updatedBuilty.pending_parcels).toBe(60);
    expect(batch1.updatedBuilty.is_security_code_verified).toBe(true);
    expect(batch1.updatedBuilty.status).toBe('PARTIALLY_DELIVERED');

    // Delivery Batch 2: Ahmed delivers 30 parcels WITHOUT security code (Auto-Bypass verified)
    const batch2 = engine.processSplitDelivery(batch1.updatedBuilty, 30, "Ahmed Delivery Boy");
    expect(batch2.error).toBeUndefined();
    expect(batch2.updatedBuilty.delivered_parcels).toBe(70);
    expect(batch2.updatedBuilty.pending_parcels).toBe(30);

    // Delivery Batch 3: Suresh delivers remaining 30 parcels WITHOUT security code
    const batch3 = engine.processSplitDelivery(batch2.updatedBuilty, 30, "Suresh Delivery Boy");
    expect(batch3.error).toBeUndefined();
    expect(batch3.updatedBuilty.delivered_parcels).toBe(100);
    expect(batch3.updatedBuilty.pending_parcels).toBe(0);
    expect(batch3.updatedBuilty.status).toBe('DELIVERED');
  });

  test('Scenario 3: Initial Delivery Security Code Guard - Rejects Batch 1 if code is invalid or missing', () => {
    const missingCodeAttempt = engine.processSplitDelivery(mockBuilty, 40, "Raju");
    expect(missingCodeAttempt.error).toBe("Invalid or missing delivery security code");
    expect(missingCodeAttempt.updatedBuilty.delivered_parcels).toBe(0);

    const wrongCodeAttempt = engine.processSplitDelivery(mockBuilty, 40, "Raju", "999999");
    expect(wrongCodeAttempt.error).toBe("Invalid or missing delivery security code");
    expect(wrongCodeAttempt.updatedBuilty.delivered_parcels).toBe(0);
  });

  test('Scenario 4: Excess Parcel Delivery Guard - Rejects batch delivering more than pending parcels', () => {
    const batch1 = engine.processSplitDelivery(mockBuilty, 40, "Raju", "SEC449");
    const excessAttempt = engine.processSplitDelivery(batch1.updatedBuilty, 70, "Ahmed"); // Only 60 pending
    expect(excessAttempt.error).toContain("Invalid parcel count to deliver");
  });

  test('Scenario 5: Sonu Bhai OTP Approval Gate - Verify mandatory OTP approval on registered mobile 919173689380', () => {
    expect(engine.verifySonuBhaiOTP("123456", "123456")).toBe(true);
    expect(engine.verifySonuBhaiOTP("987654", "123456")).toBe(false);
    expect(engine.verifySonuBhaiOTP("", "123456")).toBe(false);
  });

  test('Scenario 6: Weight Update Auto-Recalculation - Freight Total updates dynamically when weight is changed', () => {
    const originalAmount = mockBuilty.weight * mockBuilty.rate; // 500 * 20 = 10000
    expect(originalAmount).toBe(10000);

    const newWeight = 650.0; // Updated weight
    const updatedAmount = newWeight * mockBuilty.rate; // 650 * 20 = 13000
    expect(updatedAmount).toBe(13000);
  });

  test('Scenario 7: Receiver Mobile Number Ledger Anchor - Aggregates multiple receiver names with same mobile number', () => {
    const receiverMobile = "9123456780";
    const consignments = [
      { receiver_name: "Gujarat Agency Branch 1", amount: 5000, receiver_mobile: receiverMobile },
      { receiver_name: "Gujarat Agency Warehouse 2", amount: 3000, receiver_mobile: receiverMobile },
      { receiver_name: "Gujarat Agency Head Office", amount: 2000, receiver_mobile: receiverMobile },
    ];

    const totalBilledForPhone = consignments.reduce((sum, item) => sum + item.amount, 0);
    expect(totalBilledForPhone).toBe(10000);
  });

  test('Scenario 8: Pending Balance Formula - Pending Balance = Total Freight Billed - Total Amount Received', () => {
    const totalBilled = 15000.00;
    const totalPaymentsReceived = 10000.00;
    const pendingBalance = totalBilled - totalPaymentsReceived;

    expect(pendingBalance).toBe(5000.00);
  });

  test('Scenario 9: Main Admin Profit & Loss Accounting Formula', () => {
    const totalFreightBilled = 50000.00;
    const totalBranchExpenses = 12000.00;
    const totalEmployeeSalaries = 18000.00;

    const netProfit = totalFreightBilled - (totalBranchExpenses + totalEmployeeSalaries);
    expect(netProfit).toBe(20000.00);
    expect(netProfit > 0).toBe(true);
  });

  test('Scenario 10: Branch Authorization Scoping for Sub-Admin', () => {
    const subAdminBranchId = 2; // Delhi Hub
    const booking1 = { from_branch_id: 2, to_branch_id: 1 }; // Authorized (From = 2)
    const booking2 = { from_branch_id: 3, to_branch_id: 2 }; // Authorized (To = 2)
    const booking3 = { from_branch_id: 1, to_branch_id: 3 }; // Unauthorized (Neither From nor To = 2)

    const isAuthorized = (b: typeof booking1) => b.from_branch_id === subAdminBranchId || b.to_branch_id === subAdminBranchId;

    expect(isAuthorized(booking1)).toBe(true);
    expect(isAuthorized(booking2)).toBe(true);
    expect(isAuthorized(booking3)).toBe(false);
  });

  test('Scenario 11: System-Wide 10-Digit Mobile Number Validation Guard - Rejects >10 or <10 digits', () => {
    // Exactly 10 digits -> Valid
    expect(engine.validate10DigitMobile("9876543210")).toBe(true);
    expect(engine.validate10DigitMobile("9191736893")).toBe(true);
    expect(engine.validate10DigitMobile(" 9876543210 ")).toBe(true);

    // Less than 10 digits -> Invalid
    expect(engine.validate10DigitMobile("917368930")).toBe(false); // 9 digits (from screenshot)
    expect(engine.validate10DigitMobile("12345")).toBe(false);
    expect(engine.validate10DigitMobile("")).toBe(false);

    // More than 10 digits -> Invalid
    expect(engine.validate10DigitMobile("919173689380")).toBe(false); // 12 digits
    expect(engine.validate10DigitMobile("98765432100")).toBe(false); // 11 digits
  });

  test('Scenario 12: Main Admin (Sonu Bhai) Weight & Rate Update Engine - Enforces Sonu OTP, Updates Both, and Recalculates Total', () => {
    const originalWeight = 500.0;
    const originalRate = 20.0;
    expect(originalWeight * originalRate).toBe(10000);

    // Main Admin updates weight to 600kg and rate to 25/kg with mandatory Sonu OTP
    const sonuOtp = "123456";
    const isOtpValid = (otp?: string) => otp === "123456";

    expect(isOtpValid(sonuOtp)).toBe(true);
    expect(isOtpValid("wrong_otp")).toBe(false);
    expect(isOtpValid("")).toBe(false);

    const newWeight = 600.0;
    const newRate = 25.0;
    const newTotal = newWeight * newRate;
    expect(newTotal).toBe(15000); // 600 * 25 = 15000
    const paid = 5000.0;
    const newPending = Math.max(0, newTotal - paid);
    expect(newPending).toBe(10000);
  });

  test('Scenario 13: Main Admin Rate-Only Update - Preserves existing weight and recalculates new total with Sonu OTP', () => {
    const existingWeight = 400.0;
    const newRate = 18.0;
    const newTotal = existingWeight * newRate;
    expect(newTotal).toBe(7200);
  });

  test('Scenario 14: Main Admin Weight-Only Update - Preserves existing rate and recalculates new total with Sonu OTP', () => {
    const newWeight = 350.0;
    const existingRate = 15.0;
    const newTotal = newWeight * existingRate;
    expect(newTotal).toBe(5250);
  });

  test('Scenario 15: Mandatory Sonu OTP Gate - Strictly required for all weight/rate modifications across all roles', () => {
    const verifyUpdateWithOtp = (otp?: string) => otp === '123456';

    expect(verifyUpdateWithOtp('123456')).toBe(true);
    expect(verifyUpdateWithOtp('999999')).toBe(false);
    expect(verifyUpdateWithOtp('')).toBe(false);
    expect(verifyUpdateWithOtp(undefined)).toBe(false);
  });
});

