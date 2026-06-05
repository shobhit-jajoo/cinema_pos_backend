import express from 'express';
import { searchCustomer, registerCustomer, upgradeToMembership } from '../controllers/customerController.js';

const router = express.Router();

// Route to check profile states by parameter -> GET /api/customers/search/:phoneNumber
router.get('/search/:phoneNumber', searchCustomer);

// Route to register standard profiles -> POST /api/customers/register
router.post('/register', registerCustomer);

// Route to sign up or renew an annual member -> POST /api/customers/membership
router.post('/membership', upgradeToMembership);

export default router;