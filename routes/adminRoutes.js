// routes/adminRoutes.js
import express from 'express';
import {
  getAllUsers,
  getUserOrders,
  deleteUser,
  resetUserPassword
} from '../controllers/adminController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.get('/users', protect, admin, getAllUsers);
router.get('/users/:userId/orders', protect, admin, getUserOrders);
router.delete('/users/:userId', protect, admin, deleteUser);
router.put('/users/:userId/reset-password', protect, admin, resetUserPassword);

export default router;