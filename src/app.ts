import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes/api.routes';

const app: Application = express();

// Security Headers Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
});

// Simple In-Memory Rate Limiting for Auth Routes (Giant Security)
const authAttempts = new Map<string, { count: number; resetTime: number }>();

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes window
  const maxAttempts = 20;

  const current = authAttempts.get(ip);
  if (!current || now > current.resetTime) {
    authAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (current.count >= maxAttempts) {
    return res.status(429).json({
      status: false,
      message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.',
    });
  }

  current.count++;
  next();
};

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply Rate Limiter to Auth Endpoints
app.use('/api/v1/auth/login', rateLimiter);
app.use('/api/v1/auth/register', rateLimiter);

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: true, message: 'Transport Management Backend API is running securely.' });
});

// API v1 Routes
app.use('/api/v1', routes);

// Central Error Handler with Sanitized Output
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Backend Security Log - Error]:', err.stack);
  res.status(500).json({
    status: false,
    message: 'An internal server error occurred',
    error: process.env.NODE_ENV === 'production' ? undefined : err.message,
  });
});

export default app;
