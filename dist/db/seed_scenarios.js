"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./pool");
async function seedScenarios() {
    console.log('--- Step 1: Clearing existing bookings and ledgers ---');
    await (0, pool_1.query)('DELETE FROM delivery_logs');
    await (0, pool_1.query)('DELETE FROM expenses');
    await (0, pool_1.query)('DELETE FROM ledgers');
    await (0, pool_1.query)('DELETE FROM builtys');
    await (0, pool_1.query)('DELETE FROM parties');
    console.log('--- Step 2: Creating exactly 9 Transport Client Parties ---');
    const partiesData = [
        // 3 Ahmedabad Parties
        { name: 'Raj Logistics & Traders', mobile: '9825100001', gstin: '24ABCDE1234F1Z5', address: 'Gita Mandir, Ahmedabad' },
        { name: 'Patel Textiles PVT LTD', mobile: '9825100002', gstin: '24BCDEF2345G1Z6', address: 'Narol Textile Market, Ahmedabad' },
        { name: 'Gujarat Garments Corp', mobile: '9825100003', gstin: '24CDEFG3456H1Z7', address: 'Relief Road, Ahmedabad' },
        // 3 Delhi Parties
        { name: 'Delhi Darbar Fashions', mobile: '9811100001', gstin: '07DEFGH4567J1Z8', address: 'Chandni Chowk, Delhi' },
        { name: 'North India Express Hub', mobile: '9811100002', gstin: '07EFGHI5678K1Z9', address: 'Kashmere Gate, Delhi' },
        { name: 'Capital Goods Suppliers', mobile: '9811100003', gstin: '07FGHIJ6789L1Z0', address: 'Karol Bagh, Delhi' },
        // 3 Pune Parties
        { name: 'Pune Mega Distributors', mobile: '9822100001', gstin: '27GHIJK7890M1Z1', address: 'Swargate, Pune' },
        { name: 'Maharashtra Retailers', mobile: '9822100002', gstin: '27HIJKL8901N1Z2', address: 'Market Yard, Pune' },
        { name: 'Deccan Freight Corporation', mobile: '9822100003', gstin: '27IJKLM9012P1Z3', address: 'Shivaji Nagar, Pune' }
    ];
    for (const p of partiesData) {
        await (0, pool_1.query)('INSERT INTO parties (name, mobile, gstin, address) VALUES ($1, $2, $3, $4)', [p.name, p.mobile, p.gstin, p.address]);
    }
    console.log('✓ Exactly 9 parties created successfully!');
    // Fetch registered customer user IDs
    const uRes = await (0, pool_1.query)("SELECT id, name, mobile, branch_id FROM users WHERE role = 'USER' ORDER BY id ASC");
    console.log('Found registered customers:', uRes.rows);
    const ahmedUser = uRes.rows.find((u) => u.mobile === '9408379268') || uRes.rows[0]; // Pune
    const himanshuUser = uRes.rows.find((u) => u.mobile === '8000478617') || uRes.rows[1]; // Ahmedabad
    const dixitUser = uRes.rows.find((u) => u.mobile === '1234567892') || uRes.rows[2]; // Delhi
    console.log('--- Step 3: Adding 9 Bookings (3 per customer, 3 State / Sub-Admin Wise) ---');
    const bookingsData = [
        // 3 Bookings for Ahmed Pothiyawala (User ID: ahmedUser.id, Pune Hub)
        {
            user_id: ahmedUser.id,
            branch_id: 3, // Pune Hub
            destination_branch_id: 1, // Ahmedabad Hub
            source_city: 'PUNE (Swargate)',
            destination_city: 'AHMEDABAD (Gita Mandir)',
            party_name: 'Pune Mega Distributors',
            sender_mobile: '9822100001',
            sender_gstin: '27GHIJK7890M1Z1',
            receiver_name: 'Raj Logistics & Traders',
            receiver_mobile: '9825100001',
            receiver_gstin: '24ABCDE1234F1Z5',
            builty_amount: 2500,
            paid_amount: 0,
            pending_amount: 2500,
            no_of_pkt: 20,
            weight_kg: 50,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'BOOKED'
        },
        {
            user_id: ahmedUser.id,
            branch_id: 3, // Pune Hub
            destination_branch_id: 2, // Delhi Hub
            source_city: 'PUNE (Market Yard)',
            destination_city: 'DELHI (Chandni Chowk)',
            party_name: 'Maharashtra Retailers',
            sender_mobile: '9822100002',
            sender_gstin: '27HIJKL8901N1Z2',
            receiver_name: 'Delhi Darbar Fashions',
            receiver_mobile: '9811100001',
            receiver_gstin: '07DEFGH4567J1Z8',
            builty_amount: 2000,
            paid_amount: 0,
            pending_amount: 2000,
            no_of_pkt: 15,
            weight_kg: 40,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'IN_TRANSIT'
        },
        {
            user_id: ahmedUser.id,
            branch_id: 3, // Pune Hub
            destination_branch_id: 4, // Mumbai Hub
            source_city: 'PUNE (Shivaji Nagar)',
            destination_city: 'MUMBAI (Central)',
            party_name: 'Deccan Freight Corporation',
            sender_mobile: '9822100003',
            sender_gstin: '27IJKLM9012P1Z3',
            receiver_name: 'Patel Textiles PVT LTD',
            receiver_mobile: '9825100002',
            receiver_gstin: '24BCDEF2345G1Z6',
            builty_amount: 3000,
            paid_amount: 0,
            pending_amount: 3000,
            no_of_pkt: 25,
            weight_kg: 60,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'DELIVERED'
        },
        // 3 Bookings for Himanshu (User ID: himanshuUser.id, Ahmedabad Hub)
        {
            user_id: himanshuUser.id,
            branch_id: 1, // Ahmedabad Hub
            destination_branch_id: 2, // Delhi Hub
            source_city: 'AHMEDABAD (Narol)',
            destination_city: 'DELHI (Kashmere Gate)',
            party_name: 'Raj Logistics & Traders',
            sender_mobile: '9825100001',
            sender_gstin: '24ABCDE1234F1Z5',
            receiver_name: 'North India Express Hub',
            receiver_mobile: '9811100002',
            receiver_gstin: '07EFGHI5678K1Z9',
            builty_amount: 1500,
            paid_amount: 0,
            pending_amount: 1500,
            no_of_pkt: 10,
            weight_kg: 30,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'BOOKED'
        },
        {
            user_id: himanshuUser.id,
            branch_id: 1, // Ahmedabad Hub
            destination_branch_id: 3, // Pune Hub
            source_city: 'AHMEDABAD (Relief Road)',
            destination_city: 'PUNE (Swargate)',
            party_name: 'Patel Textiles PVT LTD',
            sender_mobile: '9825100002',
            sender_gstin: '24BCDEF2345G1Z6',
            receiver_name: 'Pune Mega Distributors',
            receiver_mobile: '9822100001',
            receiver_gstin: '27GHIJK7890M1Z1',
            builty_amount: 2250,
            paid_amount: 0,
            pending_amount: 2250,
            no_of_pkt: 18,
            weight_kg: 45,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'IN_TRANSIT'
        },
        {
            user_id: himanshuUser.id,
            branch_id: 1, // Ahmedabad Hub
            destination_branch_id: 4, // Mumbai Hub
            source_city: 'AHMEDABAD (Gita Mandir)',
            destination_city: 'MUMBAI (Bhiwandi)',
            party_name: 'Gujarat Garments Corp',
            sender_mobile: '9825100003',
            sender_gstin: '24CDEFG3456H1Z7',
            receiver_name: 'Maharashtra Retailers',
            receiver_mobile: '9822100002',
            receiver_gstin: '27HIJKL8901N1Z2',
            builty_amount: 1750,
            paid_amount: 0,
            pending_amount: 1750,
            no_of_pkt: 12,
            weight_kg: 35,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'DELIVERED'
        },
        // 3 Bookings for Dixit Zain (User ID: dixitUser.id, Delhi Hub)
        {
            user_id: dixitUser.id,
            branch_id: 2, // Delhi Hub
            destination_branch_id: 1, // Ahmedabad Hub
            source_city: 'DELHI (Chandni Chowk)',
            destination_city: 'AHMEDABAD (Narol)',
            party_name: 'Delhi Darbar Fashions',
            sender_mobile: '9811100001',
            sender_gstin: '07DEFGH4567J1Z8',
            receiver_name: 'Gujarat Garments Corp',
            receiver_mobile: '9825100003',
            receiver_gstin: '24CDEFG3456H1Z7',
            builty_amount: 1900,
            paid_amount: 0,
            pending_amount: 1900,
            no_of_pkt: 14,
            weight_kg: 38,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'BOOKED'
        },
        {
            user_id: dixitUser.id,
            branch_id: 2, // Delhi Hub
            destination_branch_id: 3, // Pune Hub
            source_city: 'DELHI (Kashmere Gate)',
            destination_city: 'PUNE (Market Yard)',
            party_name: 'North India Express Hub',
            sender_mobile: '9811100002',
            sender_gstin: '07EFGHI5678K1Z9',
            receiver_name: 'Deccan Freight Corporation',
            receiver_mobile: '9822100003',
            receiver_gstin: '27IJKLM9012P1Z3',
            builty_amount: 2750,
            paid_amount: 0,
            pending_amount: 2750,
            no_of_pkt: 22,
            weight_kg: 55,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'IN_TRANSIT'
        },
        {
            user_id: dixitUser.id,
            branch_id: 2, // Delhi Hub
            destination_branch_id: 4, // Mumbai Hub
            source_city: 'DELHI (Karol Bagh)',
            destination_city: 'MUMBAI (Kalamboli)',
            party_name: 'Capital Goods Suppliers',
            sender_mobile: '9811100003',
            sender_gstin: '07FGHIJ6789L1Z0',
            receiver_name: 'Raj Logistics & Traders',
            receiver_mobile: '9825100001',
            receiver_gstin: '24ABCDE1234F1Z5',
            builty_amount: 3500,
            paid_amount: 0,
            pending_amount: 3500,
            no_of_pkt: 30,
            weight_kg: 70,
            rate_per_kg: 50,
            bill_type: 'PAKKE',
            status: 'BOOKED'
        }
    ];
    let serial = 1;
    for (const b of bookingsData) {
        const cityCode = b.source_city.substring(0, 3).toUpperCase();
        const builtyNumber = `BTY-${cityCode}-${String(serial).padStart(4, '0')}`;
        const secCode = `SEC${Math.floor(100 + Math.random() * 900)}`;
        const insertRes = await (0, pool_1.query)(`INSERT INTO builtys (
        builty_number, serial_number, branch_id, destination_branch_id, user_id, source_city, destination_city,
        party_name, sender_mobile, sender_gstin, receiver_name, receiver_mobile, receiver_gstin,
        payment_status, builty_amount, paid_amount, pending_amount, bill_type,
        no_of_pkt, delivered_parcels, pending_parcels, weight_kg, rate_per_kg, cgst_percent, sgst_percent, cgst_amount, sgst_amount, sonu_gstin,
        terms_conditions, description, delivery_security_code, is_security_code_verified, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, 0, $19, $20, $21, 0, 0, 0, 0, '24AEMFS6216C1Z6', 'Standard Transport Terms', 'Parcel Consignment', $22, FALSE, $23) RETURNING id`, [
            builtyNumber, serial, b.branch_id, b.destination_branch_id, b.user_id, b.source_city, b.destination_city,
            b.party_name, b.sender_mobile, b.sender_gstin, b.receiver_name, b.receiver_mobile, b.receiver_gstin,
            'PENDING', b.builty_amount, b.paid_amount, b.pending_amount, b.bill_type,
            b.no_of_pkt, b.weight_kg, b.rate_per_kg, secCode, b.status
        ]);
        const builtyId = insertRes.rows[0].id;
        // Record Freight Debit Ledger strictly for the Receiver Party
        await (0, pool_1.query)(`INSERT INTO ledgers (party_name, receiver_mobile, builty_id, account_type, amount, balance, remarks)
       VALUES ($1, $2, $3, 'DEBIT', $4, $5, $6)`, [b.receiver_name, b.receiver_mobile, builtyId, b.builty_amount, b.pending_amount, `Freight Billed (Receiver: ${b.receiver_name}) - Builty #${builtyNumber}`]);
        serial++;
    }
    console.log('✓ Successfully created all 9 bookings and receiver freight ledgers!');
    await pool_1.pool.end();
}
seedScenarios().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
