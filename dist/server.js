"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const PORT = process.env.PORT || 3000;
// Zero-Crash Architecture: Prevent process termination on unexpected runtime exceptions
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL ZERO-CRASH GUARD] Uncaught Exception intercepted:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
    console.error('[CRITICAL ZERO-CRASH GUARD] Unhandled Promise Rejection intercepted:', reason);
});
app_1.default.listen(PORT, () => {
    console.log(`🚀 Transport Management System Backend running on port ${PORT}`);
    console.log(`📡 Health Check URL: http://localhost:${PORT}/health`);
    console.log(`🔗 API Base URL: http://localhost:${PORT}/api/v1`);
});
