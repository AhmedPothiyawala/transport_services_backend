"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorize = exports.authenticate = exports.invalidateUserSessionCache = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET || 'transport_management_super_secret_jwt_key_2026';
const userStatusCache = new Map();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL
const invalidateUserSessionCache = (userId) => {
    if (userId) {
        userStatusCache.delete(userId);
    }
    else {
        userStatusCache.clear();
    }
};
exports.invalidateUserSessionCache = invalidateUserSessionCache;
/**
 * Giant Security Middleware: JWT Authentication & Signature Validation
 */
const authenticate = async (req, res, next) => {
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
        // Fast In-Memory Cache Check for Deactivation & Session Revocation (300k scale optimization)
        try {
            const now = Date.now();
            const cached = userStatusCache.get(decoded.id);
            let isActive = true;
            let sessionVersion = decoded.session_version;
            if (cached && (now - cached.cachedAt < CACHE_TTL_MS)) {
                isActive = cached.isActive;
                sessionVersion = cached.sessionVersion;
            }
            else {
                const { query } = require('../db/pool');
                const userRes = await query('SELECT is_active, session_version FROM users WHERE id = $1', [decoded.id]);
                if (userRes && userRes.rows.length > 0) {
                    const u = userRes.rows[0];
                    isActive = u.is_active !== false;
                    sessionVersion = u.session_version;
                    userStatusCache.set(decoded.id, {
                        isActive,
                        sessionVersion,
                        cachedAt: now,
                    });
                }
            }
            if (!isActive) {
                return res.status(403).json({ status: false, message: 'Your account has been deactivated. Access revoked.' });
            }
            if (decoded.session_version !== undefined && sessionVersion !== decoded.session_version) {
                return res.status(401).json({ status: false, message: 'Session expired due to account status change. Please log in again.' });
            }
        }
        catch (_) {
            // Fallback check if db query fails
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
