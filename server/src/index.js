import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import connectDB from './db/index.js';

// Routes
import authRoutes from './routes/auth.js';
import sitesRoutes from './routes/sites.js';
import expensesRoutes from './routes/expenses.js';
import usersRoutes from './routes/users.js';
import reportsRoutes from './routes/reports.js';
import categoriesRoutes from './routes/categories.js';
import organizationsRoutes from './routes/organizations.js';
import investmentsRoutes from './routes/investments.js';
import fundsRoutes from './routes/funds.js';
import billsRoutes from './routes/bills.js';
import attendanceRoutes from './routes/attendance.js';
import ledgerRoutes from './routes/ledger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/investments', investmentsRoutes);
app.use('/api/funds', fundsRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/ledger', ledgerRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
