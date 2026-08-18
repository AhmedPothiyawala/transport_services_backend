import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    name: string;
    mobile: string;
    role: 'MAIN_ADMIN' | 'SUB_ADMIN' | 'USER' | 'DRIVER';
  };
}

const JWT_SECRET = process.env.JWT_SECRET || 'transport_management_super_secret_jwt_key_2026';

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: false, message: 'Authorization token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ status: false, message: 'Invalid or expired token' });
  }
};

export const authorize = (allowedRoles: Array<'MAIN_ADMIN' | 'SUB_ADMIN' | 'USER' | 'DRIVER'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
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
