"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const api_routes_1 = __importDefault(require("./routes/api.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Health Check
app.get('/health', (req, res) => {
    res.json({ status: true, message: 'Transport Management Backend API is running smoothly.' });
});
// API v1 Routes
app.use('/api/v1', api_routes_1.default);
// Error Handler
app.use((err, req, res, next) => {
    console.error('[Server Error]:', err.stack);
    res.status(500).json({ status: false, message: 'Internal Server Error', error: err.message });
});
exports.default = app;
