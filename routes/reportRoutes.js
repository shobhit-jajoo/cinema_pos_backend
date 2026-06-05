import express from 'express';
import { getDashboardReport } from '../controllers/reportController.js';

const router = express.Router();

// GET /api/reports/dashboard
// Accepts optional query params: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
router.get('/dashboard', getDashboardReport);

export default router;