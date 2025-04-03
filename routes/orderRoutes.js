import express from 'express';
import {
  createOrder,
  verifyPayment,
  getOrderById,
  getMyOrders,
  getOrders,
  updateOrderStatus,
  cancelOrder
} from '../controllers/OrderController.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .post(protect, createOrder)
  .get(protect, admin, getOrders);

router.post('/verify-payment', protect, verifyPayment);
router.get('/myorders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/status', protect, admin, updateOrderStatus);
router.put('/:id/cancel', protect, cancelOrder);

export default router;