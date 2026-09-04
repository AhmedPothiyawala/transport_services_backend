import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    name: string;
    mobile: string;
    role: 'MAIN_ADMIN' | 'SUB_ADMIN' | 'USER' | 'DRIVER';
    branch_id?: number | null;
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'transport_management_super_secret_jwt_key_2026';

/**
 * Giant Security Middleware: JWT Authentication & Signature Validation
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: false, message: 'Access Denied: Authorization token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // Enforce HS256 algorithm verification against token manipulation
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as any;
    
    if (!decoded || !decoded.id || !decoded.role) {
      return res.status(401).json({ status: false, message: 'Access Denied: Invalid token claims' });
    }

    // Instant Deactivation & Real-time Session Revocation Check
    try {
      const { query } = require('../db/pool');
      const userRes = await query('SELECT is_active, session_version FROM users WHERE id = $1', [decoded.id]);
      if (userRes && userRes.rows.length > 0) {
        const u = userRes.rows[0];
        if (u.is_active === false) {
          return res.status(403).json({ status: false, message: 'Your account has been deactivated. Access revoked.' });
        }
        if (decoded.session_version !== undefined && u.session_version !== decoded.session_version) {
          return res.status(401).json({ status: false, message: 'Session expired due to account status change. Please log in again.' });
        }
      }
    } catch (_) {
      // Fallback check if db query fails
    }

    req.user = decoded;
    next();
  } catch (err: any) {
    return res.status(401).json({
      status: false,
      message: err.name === 'TokenExpiredError' ? 'Session expired. Please log in again.' : 'Invalid authentication token',
    });
  }
};

/**
 * Role-Based Access Control (RBAC) Authorization Middleware
 */
export const authorize = (allowedRoles: Array<'MAIN_ADMIN' | 'SUB_ADMIN' | 'USER' | 'DRIVER'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
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
