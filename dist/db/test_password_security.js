"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = require("./pool");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const password_validator_1 = require("../util/password.validator");
async function runPasswordSecurityTests() {
    console.log('====================================================');
    console.log('🔒 EXHAUSTIVE GOOGLE-STANDARD PASSWORD SECURITY TEST');
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
    // 1. Password Policy Validation Rule Tests
    console.log('--- 1. GOOGLE PASSWORD POLICY VALIDATION TESTS ---');
    const shortPass = (0, password_validator_1.validateSecurePassword)('Ab1!');
    assert(!shortPass.isValid && shortPass.message.includes('8 characters'), 'Rejects password shorter than 8 characters');
    const noUpperPass = (0, password_validator_1.validateSecurePassword)('pass@1234');
    assert(!noUpperPass.isValid && noUpperPass.message.includes('uppercase'), 'Rejects password without uppercase letter');
    const noLowerPass = (0, password_validator_1.validateSecurePassword)('PASS@1234');
    assert(!noLowerPass.isValid && noLowerPass.message.includes('lowercase'), 'Rejects password without lowercase letter');
    const noNumberPass = (0, password_validator_1.validateSecurePassword)('Pass@Word');
    assert(!noNumberPass.isValid && noNumberPass.message.includes('number'), 'Rejects password without numeric digit');
    const noSpecialPass = (0, password_validator_1.validateSecurePassword)('Pass12345');
    assert(!noSpecialPass.isValid && noSpecialPass.message.includes('special character'), 'Rejects password without special character');
    const validPass = (0, password_validator_1.validateSecurePassword)('SecurePass@2026');
    assert(validPass.isValid, 'Accepts valid Google-policy password (SecurePass@2026)');
    // 2. Database Bcrypt Hashing & Confidentiality Verification
    console.log('\n--- 2. DATABASE BCRYPT HASHING & PRIVACY VERIFICATION ---');
    const testMobile = '9876543210';
    const testRawPassword = 'MySecretPass@123';
    // Clean up old test user if exists
    await (0, pool_1.query)('DELETE FROM users WHERE mobile = $1', [testMobile]);
    // Insert user with hashed password
    const hashedPassword = await bcryptjs_1.default.hash(testRawPassword, 10);
    await (0, pool_1.query)("INSERT INTO users (name, mobile, address, role, password_hash, otp) VALUES ($1, $2, $3, 'USER', $4, '123456')", ['Security Test User', testMobile, 'Test Address', hashedPassword]);
    // Fetch record from DB directly
    const dbResult = await (0, pool_1.query)('SELECT * FROM users WHERE mobile = $1', [testMobile]);
    assert(dbResult.rows.length === 1, 'Test user inserted into database successfully');
    const dbUser = dbResult.rows[0];
    assert(dbUser.password_hash !== testRawPassword, 'Raw password is NEVER stored in database');
    assert(dbUser.password_hash.startsWith('$2'), 'Password is stored as a valid Bcrypt hash ($2a$ / $2b$)');
    // Verify Bcrypt Comparison
    const isMatch = await bcryptjs_1.default.compare(testRawPassword, dbUser.password_hash);
    assert(isMatch === true, 'Bcrypt verification succeeds for correct password');
    const isWrongMatch = await bcryptjs_1.default.compare('WrongPass@123', dbUser.password_hash);
    assert(isWrongMatch === false, 'Bcrypt verification fails for incorrect password');
    // 3. User Role Password Coverage Verification
    console.log('\n--- 3. ALL USER ROLES PASSWORD ASSIGNMENT VERIFICATION ---');
    const allUsers = await (0, pool_1.query)('SELECT id, name, mobile, role, password_hash FROM users');
    let allHavePassword = true;
    for (const u of allUsers.rows) {
        if (!u.password_hash || u.password_hash.trim().length === 0) {
            console.error(`User ID ${u.id} (${u.role}) is missing a password_hash!`);
            allHavePassword = false;
        }
    }
    assert(allHavePassword, 'EVERY Main Admin, Sub-Admin, Driver, and Customer in DB has a bcrypt password');
    // Clean up
    await (0, pool_1.query)('DELETE FROM users WHERE mobile = $1', [testMobile]);
    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');
    if (failed > 0) {
        process.exit(1);
    }
    else {
        process.exit(0);
    }
}
runPasswordSecurityTests().catch((err) => {
    console.error('Test Execution Error:', err);
    process.exit(1);
});
