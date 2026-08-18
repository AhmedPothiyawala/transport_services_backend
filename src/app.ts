import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import routes from './routes/api.routes';

const app: Application = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: true, message: 'Transport Management Backend API is running smoothly.' });
});

// API v1 Routes
app.use('/api/v1', routes);

// Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[Server Error]:', err.stack);
  res.status(500).json({ status: false, message: 'Internal Server Error', error: err.message });
});

export default app;
