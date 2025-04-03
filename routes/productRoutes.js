import express from 'express';
import {
  getProducts,
  getProductById,
  getAllProductsForAdmin,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage
} from '../controllers/ProductController.js';
import { protect, admin } from '../middleware/auth.js';
import upload from '../utils/upload.js';

const router = express.Router();

// Public routes
router.get('/', getProducts);
router.get('/:id', getProductById);

// Admin routes
router.get('/admin/all', protect, admin, getAllProductsForAdmin);
router.post('/', protect, admin, createProduct);
router.put('/:id', protect, admin, updateProduct);
router.delete('/:id', protect, admin, deleteProduct);
router.post('/upload-image', protect, admin, upload.single('image'), uploadProductImage);


// Add this route
router.post('/upload-image', protect, admin, upload.single('image'), uploadProductImage);

export default router;