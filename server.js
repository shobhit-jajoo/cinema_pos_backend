import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './config/database_1535.js';

// Route Imports
import movieRoutes from './routes/movieRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js'; 
import reportRoutes from './routes/reportRoutes.js';

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// --- 🛡️ SECURITY & PARSING MIDDLEWARE 🛡️ ---
// Enable CORS so external apps (like Flutter Web) can communicate with this API
app.use(cors());
// Parse incoming JSON payloads
app.use(express.json());

// --- 🚀 MOUNT SUB-ROUTES ---
app.use('/api/movies', movieRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes); 
app.use('/api/reports', reportRoutes);

// --- 🩺 HEALTH CHECK ROUTE ---
// A simple endpoint to verify the server and database are awake
app.get('/api/health_1535', async (req, res) => {
  try {
    const dbTest = await pool.query('SELECT NOW()');
    res.status(200).json({
      status: 'UP',
      message: 'Surya Cinema backend server is running smoothly.',
      databaseTime: dbTest.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'DOWN',
      message: 'Server is up, but database connection failed.',
      error: error.message
    });
  }
});

// --- 🏁 START SERVER ---
app.listen(PORT, () => {
  console.log(`Server is operating on port ${PORT}`);
});