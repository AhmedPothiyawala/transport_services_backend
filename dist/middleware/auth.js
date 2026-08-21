"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'transport_management_super_secret_jwt_key_2026';
/**
 * Giant Security Middleware: JWT Authentication & Signature Validation
 */
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ status: false, message: 'Access Denied: Authorization token missing or malformed' });
    }
    const token = authHeader.split(' ')[1];
    try {
        // Enforce HS256 algorithm verification against token manipulation
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        if (!decoded || !decoded.id || !decoded.role) {
            return res.status(401).json({ status: false, message: 'Access Denied: Invalid token claims' });
        }
        req.user = decoded;
        next();
    }
    catch (err) {
        return res.status(401).json({
            status: false,
            message: err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid authentication token',
        });
    }
};
exports.authenticate = authenticate;
/**
 * Role-Based Access Control (RBAC) Authorization Middleware
 */
const authorize = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ status: false, message: 'Authentication required' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                status: false,
                message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource. Required role(s): ${allowedRoles.join(', ')}`,
            });
        }
        next();
    };
};
exports.authorize = authorize;
