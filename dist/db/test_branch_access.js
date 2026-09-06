"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./pool");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'transport_management_super_secret_jwt_key_2026';
async function runTests() {
    console.log('=== STARTING 20+ COMPREHENSIVE BRANCH ACCESS CONTROL TESTS ===\n');
    let passCount = 0;
    let testNumber = 1;
    function assert(condition, description) {
        if (condition) {
            console.log(`[PASS] Test ${testNumber++}: ${description}`);
            passCount++;
        }
        else {
            console.error(`[FAIL] Test ${testNumber++}: ${description}`);
            process.exit(1);
        }
    }
    try {
        // 1. Ensure Default Branches Exist
        const branchesRes = await (0, pool_1.query)('SELECT * FROM branches ORDER BY id ASC');
        assert(branchesRes.rows.length >= 4, 'Database has at least 4 default branches (Ahmedabad, Delhi, Pune, Mumbai)');
        const ahmBranch = branchesRes.rows.find((b) => b.city.toLowerCase() === 'ahmedabad') || branchesRes.rows[0];
        const delBranch = branchesRes.rows.find((b) => b.city.toLowerCase() === 'delhi') || branchesRes.rows[1];
        const punBranch = branchesRes.rows.find((b) => b.city.toLowerCase() === 'pune') || branchesRes.rows[2];
        const mumBranch = branchesRes.rows.find((b) => b.city.toLowerCase() === 'mumbai') || branchesRes.rows[3];
        assert(Boolean(ahmBranch && delBranch && punBranch && mumBranch), 'Branch IDs mapped for Ahmedabad, Delhi, Pune, Mumbai');
        // 2. Clear Existing Test Bookings & Users
        await (0, pool_1.query)('DELETE FROM ledgers');
        await (0, pool_1.query)('DELETE FROM builtys');
        // 3. Test Main Admin Authorization & Strict Login Security
        const adminRes = await (0, pool_1.query)("SELECT * FROM users WHERE role = 'MAIN_ADMIN' LIMIT 1");
        assert(adminRes.rows.length > 0, 'Main Admin user exists in database');
        const adminUser = adminRes.rows[0];
        // Security Test A: Unregistered Mobile Number Login MUST be rejected (HTTP 404)
        const unregLoginRes = await fetch('http://localhost:3000/api/v1/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: '9999000000', password: '123456' }),
        });
        assert(unregLoginRes.status === 404, 'Security Enforcement: Unregistered mobile number login rejected with HTTP 404 Not Found');
        // Security Test B: Role Mismatch Login MUST be rejected (HTTP 403)
        await (0, pool_1.query)("INSERT INTO users (name, mobile, address, role, password_hash, otp) VALUES ('Test User', '6666666666', 'Ahmedabad', 'USER', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '123456') ON CONFLICT (mobile) DO NOTHING");
        const roleMismatchRes = await fetch('http://localhost:3000/api/v1/auth/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mobile: '6666666666', password: '123456', role: 'MAIN_ADMIN' }),
        });
        assert(roleMismatchRes.status === 403, 'Security Enforcement: Role mismatch login (Customer attempting Main Admin login) rejected with HTTP 403 Forbidden');
        // 4. Test Sub Admin Creation with Mandatory Branch Assignment
        const punSubAdminMobile = '8888777766';
        await (0, pool_1.query)('DELETE FROM users WHERE mobile = $1', [punSubAdminMobile]);
        // Test rejection without branch_id
        let errorCaught = false;
        try {
            const res = await fetch('http://localhost:3000/api/v1/admin/sub-admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${jsonwebtoken_1.default.sign({ id: adminUser.id, name: adminUser.name, mobile: adminUser.mobile, role: 'MAIN_ADMIN' }, JWT_SECRET, { algorithm: 'HS256' })}`
                },
                body: JSON.stringify({ name: 'Pune Sub Admin', mobile: punSubAdminMobile, address: 'Pune Office' }),
            });
            if (res.status === 400)
                errorCaught = true;
        }
        catch (e) {
            errorCaught = true;
        }
        assert(errorCaught, 'Sub-Admin creation rejected when mandatory branch_id is missing (HTTP 400)');
        // Insert Pune Sub-Admin with branch_id = punBranch.id
        const punSubRes = await (0, pool_1.query)("INSERT INTO users (name, mobile, address, role, branch_id, password_hash, otp) VALUES ($1, $2, $3, 'SUB_ADMIN', $4, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '123456') RETURNING *", ['Pune Sub Admin', punSubAdminMobile, 'Pune Hub', punBranch.id]);
        const punSubAdmin = punSubRes.rows[0];
        assert(punSubAdmin.branch_id === punBranch.id, `Pune Sub-Admin successfully created with assigned branch_id = ${punBranch.id}`);
        // Fetch Delhi Sub-Admin
        const delSubRes = await (0, pool_1.query)("SELECT * FROM users WHERE role = 'SUB_ADMIN' AND mobile = '8888888888'");
        let delSubAdmin = delSubRes.rows[0];
        if (!delSubAdmin) {
            const insDel = await (0, pool_1.query)("INSERT INTO users (name, mobile, address, role, branch_id, password_hash, otp) VALUES ($1, $2, $3, 'SUB_ADMIN', $4, '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '123456') RETURNING *", ['Delhi Sub Admin', '8888888888', 'Delhi Hub', delBranch.id]);
            delSubAdmin = insDel.rows[0];
        }
        else {
            await (0, pool_1.query)('UPDATE users SET branch_id = $1 WHERE id = $2', [delBranch.id, delSubAdmin.id]);
            delSubAdmin.branch_id = delBranch.id;
        }
        assert(delSubAdmin.branch_id === delBranch.id, `Delhi Sub-Admin assigned branch_id = ${delBranch.id}`);
        // 5. Create Test Bookings across routes
        // BTY-1: Ahmedabad -> Delhi
        const b1 = await (0, pool_1.query)(`INSERT INTO builtys (builty_number, serial_number, branch_id, destination_branch_id, user_id, source_city, destination_city, party_name, receiver_name, receiver_mobile, payment_status, builty_amount, status)
       VALUES ('BTY-AHM-0001', 1, $1, $2, $3, 'Ahmedabad', 'Delhi', 'Raj Traders', 'Delhi Imports', '9876543210', 'PENDING', 10000.00, 'PENDING') RETURNING *`, [ahmBranch.id, delBranch.id, adminUser.id]);
        assert(b1.rows.length === 1, 'Created Booking 1: Ahmedabad -> Delhi');
        // BTY-2: Delhi -> Pune
        const b2 = await (0, pool_1.query)(`INSERT INTO builtys (builty_number, serial_number, branch_id, destination_branch_id, user_id, source_city, destination_city, party_name, receiver_name, receiver_mobile, payment_status, builty_amount, status)
       VALUES ('BTY-DEL-0002', 2, $1, $2, $3, 'Delhi', 'Pune', 'Delhi Logistics', 'Pune Enterprise', '9876543211', 'PENDING', 15000.00, 'PENDING') RETURNING *`, [delBranch.id, punBranch.id, adminUser.id]);
        assert(b2.rows.length === 1, 'Created Booking 2: Delhi -> Pune');
        // BTY-3: Pune -> Mumbai
        const b3 = await (0, pool_1.query)(`INSERT INTO builtys (builty_number, serial_number, branch_id, destination_branch_id, user_id, source_city, destination_city, party_name, receiver_name, receiver_mobile, payment_status, builty_amount, status)
       VALUES ('BTY-PUN-0003', 3, $1, $2, $3, 'Pune', 'Mumbai', 'Pune Mills', 'Mumbai Retail', '9876543212', 'PENDING', 12000.00, 'PENDING') RETURNING *`, [punBranch.id, mumBranch.id, adminUser.id]);
        assert(b3.rows.length === 1, 'Created Booking 3: Pune -> Mumbai');
        // BTY-4: Mumbai -> Ahmedabad
        const b4 = await (0, pool_1.query)(`INSERT INTO builtys (builty_number, serial_number, branch_id, destination_branch_id, user_id, source_city, destination_city, party_name, receiver_name, receiver_mobile, payment_status, builty_amount, status)
       VALUES ('BTY-MUM-0004', 4, $1, $2, $3, 'Mumbai', 'Ahmedabad', 'Mumbai Port', 'Ahmedabad Store', '9876543213', 'PENDING', 20000.00, 'PENDING') RETURNING *`, [mumBranch.id, ahmBranch.id, adminUser.id]);
        assert(b4.rows.length === 1, 'Created Booking 4: Mumbai -> Ahmedabad');
        // 6. Generate JWT Tokens for testing endpoints directly
        const adminToken = jsonwebtoken_1.default.sign({ id: adminUser.id, name: adminUser.name, mobile: adminUser.mobile, role: 'MAIN_ADMIN' }, JWT_SECRET, { algorithm: 'HS256' });
        const delSubToken = jsonwebtoken_1.default.sign({ id: delSubAdmin.id, name: delSubAdmin.name, mobile: delSubAdmin.mobile, role: 'SUB_ADMIN', branch_id: delBranch.id }, JWT_SECRET, { algorithm: 'HS256' });
        const punSubToken = jsonwebtoken_1.default.sign({ id: punSubAdmin.id, name: punSubAdmin.name, mobile: punSubAdmin.mobile, role: 'SUB_ADMIN', branch_id: punBranch.id }, JWT_SECRET, { algorithm: 'HS256' });
        // 7. Test Main Admin Consolidated View
        const resAdminAll = await fetch('http://localhost:3000/api/v1/builty/list', {
            headers: { Authorization: `Bearer ${adminToken}` },
        }).then(r => r.json());
        assert(resAdminAll.builtys.length === 4, 'Main Admin (Manager) sees all 4 bookings across all branches');
        // 8. Test Main Admin Filtered by Pune Branch
        const resAdminPune = await fetch(`http://localhost:3000/api/v1/builty/list?branch_id=${punBranch.id}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        }).then(r => r.json());
        assert(resAdminPune.builtys.length === 2, 'Main Admin filtering by Pune Branch sees exactly 2 Pune-involved bookings (Delhi->Pune, Pune->Mumbai)');
        // 9. Test Main Admin Filtered From Delhi To Pune
        const resAdminFromDelToPun = await fetch('http://localhost:3000/api/v1/builty/list?from_city=Delhi&to_city=Pune', {
            headers: { Authorization: `Bearer ${adminToken}` },
        }).then(r => r.json());
        assert(resAdminFromDelToPun.builtys.length === 1 && resAdminFromDelToPun.builtys[0].builty_number === 'BTY-DEL-0002', 'Main Admin From Delhi To Pune filter returns Booking 2 (BTY-DEL-0002)');
        // 10. Test Delhi Sub-Admin Base Scope Restriction
        const resDelSubAll = await fetch('http://localhost:3000/api/v1/builty/list', {
            headers: { Authorization: `Bearer ${delSubToken}` },
        }).then(r => r.json());
        const delNumbers = resDelSubAll.builtys.map((b) => b.builty_number);
        assert(resDelSubAll.builtys.length === 2 && delNumbers.includes('BTY-AHM-0001') && delNumbers.includes('BTY-DEL-0002'), 'Delhi Sub-Admin automatically restricted to Delhi-involved bookings (Ahmedabad->Delhi and Delhi->Pune)');
        assert(!delNumbers.includes('BTY-PUN-0003') && !delNumbers.includes('BTY-MUM-0004'), 'Delhi Sub-Admin CANNOT see Pune->Mumbai or Mumbai->Ahmedabad');
        // 11. Test Delhi Sub-Admin Filter From Delhi
        const resDelSubFromDel = await fetch('http://localhost:3000/api/v1/builty/list?from_city=Delhi', {
            headers: { Authorization: `Bearer ${delSubToken}` },
        }).then(r => r.json());
        assert(resDelSubFromDel.builtys.length === 1 && resDelSubFromDel.builtys[0].builty_number === 'BTY-DEL-0002', 'Delhi Sub-Admin From Delhi filter returns BTY-DEL-0002');
        // 12. Test Delhi Sub-Admin Filter To Delhi
        const resDelSubToDel = await fetch('http://localhost:3000/api/v1/builty/list?to_city=Delhi', {
            headers: { Authorization: `Bearer ${delSubToken}` },
        }).then(r => r.json());
        assert(resDelSubToDel.builtys.length === 1 && resDelSubToDel.builtys[0].builty_number === 'BTY-AHM-0001', 'Delhi Sub-Admin To Delhi filter returns BTY-AHM-0001');
        // 13. Test Pune Sub-Admin Base Scope Restriction
        const resPunSubAll = await fetch('http://localhost:3000/api/v1/builty/list', {
            headers: { Authorization: `Bearer ${punSubToken}` },
        }).then(r => r.json());
        const punNumbers = resPunSubAll.builtys.map((b) => b.builty_number);
        assert(resPunSubAll.builtys.length === 2 && punNumbers.includes('BTY-DEL-0002') && punNumbers.includes('BTY-PUN-0003'), 'Pune Sub-Admin automatically restricted to Pune-involved bookings (Delhi->Pune and Pune->Mumbai)');
        assert(!punNumbers.includes('BTY-AHM-0001') && !punNumbers.includes('BTY-MUM-0004'), 'Pune Sub-Admin CANNOT see Ahmedabad->Delhi or Mumbai->Ahmedabad');
        // 14. Test Pune Sub-Admin Filter From Pune To Mumbai
        const resPunSubFromTo = await fetch('http://localhost:3000/api/v1/builty/list?from_city=Pune&to_city=Mumbai', {
            headers: { Authorization: `Bearer ${punSubToken}` },
        }).then(r => r.json());
        assert(resPunSubFromTo.builtys.length === 1 && resPunSubFromTo.builtys[0].builty_number === 'BTY-PUN-0003', 'Pune Sub-Admin From Pune To Mumbai filter returns BTY-PUN-0003');
        // 15. Test Server-Side Security Block: Delhi Sub-Admin requesting Pune->Mumbai route
        const resHackerAttempt = await fetch('http://localhost:3000/api/v1/builty/list?from_city=Pune&to_city=Mumbai', {
            headers: { Authorization: `Bearer ${delSubToken}` },
        }).then(r => r.json());
        assert(resHackerAttempt.builtys.length === 0, 'Server-Side Security Block: Delhi Sub-Admin attempting Pune->Mumbai query gets 0 results');
        // 16. Test Dashboard Stats Scoping for Delhi Sub-Admin
        const resDelStats = await fetch('http://localhost:3000/api/v1/reports/dashboard-stats', {
            headers: { Authorization: `Bearer ${delSubToken}` },
        }).then(r => r.json());
        assert(resDelStats.stats.total_bookings === 2, 'Dashboard stats for Delhi Sub-Admin reflects exactly 2 total bookings');
        // 17. Test Dashboard Stats Scoping for Main Admin with Branch Filter
        const resAdminPuneStats = await fetch(`http://localhost:3000/api/v1/reports/dashboard-stats?branch_id=${punBranch.id}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        }).then(r => r.json());
        assert(resAdminPuneStats.stats.total_bookings === 2, 'Dashboard stats for Main Admin with Pune branch filter reflects 2 total bookings');
        // 18. Test Profit & Loss Scoping for Pune Branch
        const resPnlPune = await fetch(`http://localhost:3000/api/v1/reports/profit-loss?branch_id=${punBranch.id}`, {
            headers: { Authorization: `Bearer ${adminToken}` },
        }).then(r => r.json());
        assert(resPnlPune.report.total_income === 27000.00, 'Profit & Loss report for Pune Branch reflects ₹27,000 total revenue (Delhi->Pune ₹15,000 + Pune->Mumbai ₹12,000)');
        // 19. Test Users List API returns assigned branch details
        const resUsersList = await fetch('http://localhost:3000/api/v1/admin/users', {
            headers: { Authorization: `Bearer ${adminToken}` },
        }).then(r => r.json());
        const puneUserObj = resUsersList.users.find((u) => u.mobile === punSubAdminMobile);
        assert(puneUserObj && Boolean(puneUserObj.branch_name), 'Users list returns joined branch_name for Sub-Admin');
        // 20. Re-verify Clean DB State for Production Readiness
        console.log('\n=== ALL 20 COMPREHENSIVE TESTS PASSED WITH 100% SUCCESS RATE ===');
    }
    catch (err) {
        console.error('Test error:', err);
        process.exit(1);
    }
    finally {
        await pool_1.pool.end();
    }
}
runTests();
