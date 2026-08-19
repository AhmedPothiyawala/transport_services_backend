"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'transport_management_super_secret_jwt_key_2026';
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: false, message: 'Authorization token missing or invalid' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({ status: false, message: 'Invalid or expired token' });
    }
};
exports.authenticate = authenticate;
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ status: false, message: 'User not authenticated' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                status: false,
                message: `Access denied. Role ${req.user.role} does not have required permissions.`,
            });
        }
        next();
    };
};
exports.authorize = authorize;
