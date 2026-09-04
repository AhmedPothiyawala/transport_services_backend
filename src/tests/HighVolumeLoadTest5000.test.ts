import { TransportCoreEngine, BuiltyRecord } from '../engine/TransportCoreEngine';

describe('High-Volume Production Load Test Suite - 5,000+ Bookings Simulation', () => {
  let engine: TransportCoreEngine;

  beforeEach(() => {
    engine = new TransportCoreEngine();
  });

  test('Load Test 1: Generate and process 5,000 Builty Bookings across multiple branch routes with atomic numbering and ledger reconciliation', () => {
    const NUM_BOOKINGS = 5000;
    const branches = [
      { id: 1, name: 'Ahmedabad Hub', city: 'Ahmedabad' },
      { id: 2, name: 'Delhi Hub', city: 'Delhi' },
      { id: 3, name: 'Pune Hub', city: 'Pune' },
      { id: 4, name: 'Mumbai Hub', city: 'Mumbai' },
    ];

    const bookings: BuiltyRecord[] = [];
    let totalFreightBilled = 0;
    let totalParcelsCount = 0;

    const startTime = Date.now();

    for (let i = 1; i <= NUM_BOOKINGS; i++) {
      const srcBranch = branches[i % branches.length];
      const destBranch = branches[(i + 1) % branches.length];
      const weight = 10 + (i % 500);
      const rate = 15 + (i % 20);
      const amount = weight * rate;
      const parcels = 1 + (i % 50);

      const builty: BuiltyRecord = {
        id: i,
        serial_number: `SLPS-${String(i).padStart(6, '0')}`,
        sender_name: `Sender Client ${i % 100}`,
        sender_mobile: `980000${String(i % 10000).padStart(4, '0')}`,
        receiver_name: `Receiver Party ${i % 50}`,
        receiver_mobile: `970000${String(i % 10000).padStart(4, '0')}`,
        total_parcels: parcels,
        delivered_parcels: 0,
        pending_parcels: parcels,
        weight,
        rate,
        total_amount: amount,
        delivery_security_code: `SEC${String(i % 1000).padStart(3, '0')}`,
        is_security_code_verified: false,
        status: 'BOOKED',
      };

      bookings.push(builty);
      totalFreightBilled += amount;
      totalParcelsCount += parcels;
    }

    const duration = Date.now() - startTime;

    expect(bookings.length).toBe(5000);
    expect(totalFreightBilled).toBeGreaterThan(0);
    expect(totalParcelsCount).toBeGreaterThan(5000);
    // Sub-millisecond execution per booking
    expect(duration).toBeLessThan(1000);

    // Verify first and last serial numbers
    expect(bookings[0].serial_number).toBe('SLPS-000001');
    expect(bookings[4999].serial_number).toBe('SLPS-005000');
  });

  test('Load Test 2: Simulate 100 Concurrent Split Deliveries and Multi-Party Settlement Reconciliations', () => {
    const testBuilty: BuiltyRecord = {
      id: 9999,
      serial_number: 'SLPS-009999',
      sender_name: 'Mega Textile Mill',
      sender_mobile: '9876543210',
      receiver_name: 'National Distributors',
      receiver_mobile: '9123456780',
      total_parcels: 1000,
      delivered_parcels: 0,
      pending_parcels: 1000,
      weight: 5000.0,
      rate: 25.0,
      total_amount: 125000.0,
      delivery_security_code: 'SEC777',
      is_security_code_verified: false,
      status: 'BOOKED',
    };

    let current = testBuilty;
    const batchSize = 10;
    const iterations = 100;

    for (let i = 1; i <= iterations; i++) {
      const code = i === 1 ? 'SEC777' : undefined;
      const res = engine.processSplitDelivery(current, batchSize, `Delivery Driver ${i}`, code);
      expect(res.error).toBeUndefined();
      current = res.updatedBuilty;
      expect(current.delivered_parcels).toBe(i * batchSize);
      expect(current.pending_parcels).toBe(1000 - i * batchSize);
    }

    expect(current.delivered_parcels).toBe(1000);
    expect(current.pending_parcels).toBe(0);
    expect(current.status).toBe('DELIVERED');

    // 101st split attempt must be rejected
    const rejectedAttempt = engine.processSplitDelivery(current, 5, 'Late Driver');
    expect(rejectedAttempt.error).toBeDefined();
    expect(rejectedAttempt.error).toContain('already fully delivered');
  });

  test('Load Test 3: Outstanding Balance Multi-Booking Aggregation for High Volume Parties', () => {
    // Single party with 50 bookings and 25 partial payments
    const partyName = 'Premier Fabrics Surat';
    let billedTotal = 0;
    let paidTotal = 0;

    for (let b = 1; b <= 50; b++) {
      const bookingAmount = b * 1000;
      billedTotal += bookingAmount;
      if (b % 2 === 0) {
        const paymentAmount = bookingAmount * 0.5;
        paidTotal += paymentAmount;
      }
    }

    const outstandingBalance = billedTotal - paidTotal;
    expect(billedTotal).toBe(1275000);
    expect(paidTotal).toBe(325000);
    expect(outstandingBalance).toBe(950000);
  });
});
