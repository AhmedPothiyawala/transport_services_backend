"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSecurePassword = void 0;
const validateSecurePassword = (password) => {
    if (!password || password.toString().trim().length === 0) {
        return { isValid: false, message: 'Password is required' };
    }
    const pwd = password.toString().trim();
    if (pwd.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters long.' };
    }
    if (!/[A-Z]/.test(pwd)) {
        return { isValid: false, message: 'Password must contain at least one uppercase letter (A-Z).' };
    }
    if (!/[a-z]/.test(pwd)) {
        return { isValid: false, message: 'Password must contain at least one lowercase letter (a-z).' };
    }
    if (!/\d/.test(pwd)) {
        return { isValid: false, message: 'Password must contain at least one number (0-9).' };
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) {
        return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&* etc).' };
    }
    return { isValid: true };
};
exports.validateSecurePassword = validateSecurePassword;
