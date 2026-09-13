import app from './app';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Zero-Crash Architecture: Prevent process termination on unexpected runtime exceptions
process.on('uncaughtException', (err: Error) => {
  console.error('[CRITICAL ZERO-CRASH GUARD] Uncaught Exception intercepted:', err.message, err.stack);
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[CRITICAL ZERO-CRASH GUARD] Unhandled Promise Rejection intercepted:', reason);
});

app.listen(PORT, () => {
  console.log(`🚀 Transport Management System Backend running on port ${PORT}`);
  console.log(`📡 Health Check URL: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
});

