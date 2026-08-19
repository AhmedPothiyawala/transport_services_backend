"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProfile = exports.updateProfile = exports.verifyOtpAndLogin = exports.sendOtp = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const pool_1 = require("../db/pool");
const JWT_SECRET = process.env.JWT_SECRET || 'transport_management_super_secret_jwt_key_2026';
// In-memory fallback database for instant demo/testing when live postgres isn't running
const memoryUsers = [
    { id: 1, name: 'Sonu Sir (Main Admin)', mobile: '9999999999', address: 'Headquarters, Ahmedabad', role: 'MAIN_ADMIN', otp: '123456' },
    { id: 2, name: 'Sub Admin User', mobile: '8888888888', address: 'Branch Office, Delhi', role: 'SUB_ADMIN', otp: '123456' },
    { id: 3, name: 'Sample Driver', mobile: '7777777777', address: 'Logistics Center, Mumbai', role: 'DRIVER', otp: '123456' },
    { id: 4, name: 'Sample User / Party', mobile: '6666666666', address: 'Ahmedabad Market', role: 'USER', otp: '123456' }
];
const sendOtp = async (req, res) => {
    const { mobile } = req.body;
    if (!mobile) {
        return res.status(400).json({ status: false, message: 'Mobile number is required' });
    }
    const generatedOtp = '123456'; // Default test OTP as per SRS
    try {
        const dbRes = await (0, pool_1.query)('SELECT * FROM users WHERE mobile = $1', [mobile]);
        if (dbRes && dbRes.rows.length > 0) {
            await (0, pool_1.query)('UPDATE users SET otp = $1 WHERE mobile = $2', [generatedOtp, mobile]);
        }
    }
    catch (err) {
        const memUser = memoryUsers.find(u => u.mobile === mobile);
        if (memUser) {
            memUser.otp = generatedOtp;
        }
    }
    return res.json({
        status: true,
        message: `OTP sent successfully to ${mobile}. Use 123456 for testing.`,
        otp: generatedOtp,
    });
};
exports.sendOtp = sendOtp;
const verifyOtpAndLogin = async (req, res) => {
    const { mobile, otp, role, name, address } = req.body;
    if (!mobile || !otp) {
        return res.status(400).json({ status: false, message: 'Mobile and OTP are required' });
    }
    let user = null;
    try {
        const dbRes = await (0, pool_1.query)('SELECT * FROM users WHERE mobile = $1', [mobile]);
        if (dbRes && dbRes.rows.length > 0) {
            user = dbRes.rows[0];
        }
        else {
            // Create new user if registering
            const assignedRole = role || 'USER';
            const userName = name || `User ${mobile.substring(6)}`;
            const userAddr = address || 'India';
            const insertRes = await (0, pool_1.query)('INSERT INTO users (name, mobile, address, role, otp) VALUES ($1, $2, $3, $4, $5) RETURNING *', [userName, mobile, userAddr, assignedRole, otp]);
            user = insertRes.rows[0];
        }
    }
    catch (err) {
        user = memoryUsers.find(u => u.mobile === mobile);
        if (!user) {
            user = {
                id: memoryUsers.length + 1,
                name: name || `User ${mobile.substring(6)}`,
                mobile,
                address: address || 'India',
                role: role || 'USER',
                otp: '123456'
            };
            memoryUsers.push(user);
        }
    }
    // Verify OTP
    if (otp !== '123456' && user.otp !== otp) {
        return res.status(400).json({ status: false, message: 'Invalid OTP' });
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, name: user.name, mobile: user.mobile, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({
        status: true,
        message: 'Authentication successful',
        token,
        user: {
            id: user.id,
            name: user.name,
            mobile: user.mobile,
            address: user.address,
            role: user.role,
        },
    });
};
exports.verifyOtpAndLogin = verifyOtpAndLogin;
const updateProfile = async (req, res) => {
    const { userId, name, address } = req.body;
    try {
        await (0, pool_1.query)('UPDATE users SET name = $1, address = $2 WHERE id = $3', [name, address, userId]);
    }
    catch (err) {
        const user = memoryUsers.find(u => u.id === Number(userId));
        if (user) {
            if (name)
                user.name = name;
            if (address)
                user.address = address;
        }
    }
    return res.json({ status: true, message: 'Profile updated successfully' });
};
exports.updateProfile = updateProfile;
const deleteProfile = async (req, res) => {
    const { userId } = req.body;
    try {
        await (0, pool_1.query)('DELETE FROM users WHERE id = $1', [userId]);
    }
    catch (err) {
        const index = memoryUsers.findIndex(u => u.id === Number(userId));
        if (index !== -1)
            memoryUsers.splice(index, 1);
    }
    return res.json({ status: true, message: 'Profile deleted successfully' });
};
exports.deleteProfile = deleteProfile;
