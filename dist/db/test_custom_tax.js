"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'transport_management_super_secret_jwt_key_2026';
async function testCustomCgstSgstScenario() {
    console.log('====================================================');
    console.log('🧮 DYNAMIC EDITABLE CGST & SGST TAX ENGINE TEST');
    console.log('====================================================\n');
    let passed = 0;
    let failed = 0;
    function assert(condition, testName) {
        if (condition) {
            console.log(`✅ [PASS] ${testName}`);
            passed++;
        }
        else {
            console.error(`❌ [FAIL] ${testName}`);
            failed++;
        }
    }
    const token = jsonwebtoken_1.default.sign({ id: 1, name: 'Sonu Sir', mobile: '9999999999', role: 'MAIN_ADMIN', branch_id: 1 }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
    // Test Scenario from User Screenshot:
    // Weight: 100 kg, Rate: ₹100/kg -> Subtotal = ₹10,000
    // Custom CGST: 10% -> CGST Amount = ₹1,000
    // Custom SGST: 20% -> SGST Amount = ₹2,000
    // Expected Total Invoice Billed Amount = ₹13,000
    const subtotal = 10000.00;
    const customCgstPercent = 10.0;
    const customSgstPercent = 20.0;
    const expectedCgstAmount = (subtotal * customCgstPercent) / 100.0; // 1000.00
    const expectedSgstAmount = (subtotal * customSgstPercent) / 100.0; // 2000.00
    const expectedTotalAmount = subtotal + expectedCgstAmount + expectedSgstAmount; // 13000.00
    const payload = {
        branch_id: 1,
        destination_branch_id: 2,
        source_city: 'Ahmedabad',
        destination_city: 'Delhi',
        party_name: 'Custom Tax Consignor',
        sender_mobile: '9898989898',
        sender_gstin: '24AAAC1234A1Z1',
        receiver_name: 'Custom Tax Consignee',
        receiver_mobile: '9797979797',
        receiver_gstin: '07AAAC5678B1Z2',
        payment_status: 'PENDING',
        builty_amount: expectedTotalAmount.toFixed(2),
        paid_amount: '0.00',
        bill_type: 'PAKKE',
        no_of_pkt: 5,
        weight_kg: 100,
        rate_per_kg: 100,
        cgst_percent: customCgstPercent,
        sgst_percent: customSgstPercent,
        cgst_amount: expectedCgstAmount.toFixed(2),
        sgst_amount: expectedSgstAmount.toFixed(2),
        sonu_gstin: '24AEMFS6216C1Z6',
        terms_conditions: 'Standard terms',
        description: 'Custom CGST 10% & SGST 20% Test Goods',
    };
    const res = await fetch('http://localhost:3000/api/v1/builty/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    }).then(r => r.json());
    assert(res.status === true, 'API accepted builty creation with custom CGST (10%) and SGST (20%)');
    const createdBuilty = res.builty;
    console.log('Created Builty ID:', createdBuilty ? createdBuilty.id : 'null', 'builty_number:', createdBuilty ? createdBuilty.builty_number : 'null');
    assert(parseFloat(createdBuilty.cgst_percent) === 10.0, 'DB stores exact CGST % = 10.0');
    assert(parseFloat(createdBuilty.sgst_percent) === 20.0, 'DB stores exact SGST % = 20.0');
    assert(parseFloat(createdBuilty.cgst_amount) === 1000.0, 'DB stores exact CGST Amount = ₹1,000.00');
    assert(parseFloat(createdBuilty.sgst_amount) === 2000.0, 'DB stores exact SGST Amount = ₹2,000.00');
    assert(parseFloat(createdBuilty.builty_amount) === 13000.0, 'DB stores exact Total Billed Amount = ₹13,000.00');
    // Verify Ledger Entry via API
    const ledgerApiRes = await fetch('http://localhost:3000/api/v1/ledger/party', {
        headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json());
    assert(Boolean(ledgerApiRes.status && ledgerApiRes.ledgers && ledgerApiRes.ledgers.length > 0), 'DEBIT ledger entry generated');
    if (ledgerApiRes.ledgers && ledgerApiRes.ledgers.length > 0) {
        const customTaxLedger = ledgerApiRes.ledgers.find((l) => l.party_name === payload.party_name);
        assert(Boolean(customTaxLedger), 'Ledger record found for Custom Tax Consignor');
        if (customTaxLedger) {
            assert(parseFloat(customTaxLedger.amount) === 13000.0, 'Ledger DEBIT entry reflects total ₹13,000.00');
        }
    }
    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    if (failed > 0)
        process.exit(1);
    else
        process.exit(0);
}
testCustomCgstSgstScenario().catch(err => {
    console.error('Test execution failed:', err);
    process.exit(1);
});
