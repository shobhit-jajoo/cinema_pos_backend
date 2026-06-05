import express from 'express';
import { processCheckout } from '../controllers/transactionController.js';

const router = express.Router();

// Main checkout hub endpoint -> POST /api/transactions/checkout
router.post('/checkout', processCheckout);

export default router;