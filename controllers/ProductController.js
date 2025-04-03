import Product from '../models/Product.js';
import mongoose from 'mongoose';
import cloudinaryUtils from '../utils/cloudinary.js';

// Helper function to validate images
const validateImages = (images) => {
  if (!Array.isArray(images)) return false;
  if (images.length === 0) return false;
  return images.every(img => typeof img === 'string' && (img.startsWith('http') || img.startsWith('https')));
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      category,
      presentation,
      presentationSize,
      images,
      discount = 0,
      benefits,
      description,
      dosage,
      price,
      suitableForCrops,
      quantityInStock = 0,
      isActive = true
    } = req.body;

    // Validate required fields
    const requiredFields = {
      name, category, presentation, presentationSize,
      description, dosage, price, suitableForCrops
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value || (typeof value === 'string' && !value.trim())) {
        return res.status(400).json({ message: `${field} is required` });
      }
    }

    // Process benefits
    let processedBenefits = [];
    if (Array.isArray(benefits)) {
      processedBenefits = benefits.map(b => b.trim()).filter(b => b.length > 0);
    } else if (typeof benefits === 'string') {
      processedBenefits = [benefits.trim()];
    }

    if (processedBenefits.length === 0) {
      return res.status(400).json({ message: 'At least one benefit is required' });
    }

    // Validate images
    if (!validateImages(images)) {
      return res.status(400).json({ message: 'Please provide at least one valid image URL' });
    }

    // Validate numbers
    if (isNaN(price) || price <= 0) {
      return res.status(400).json({ message: 'Price must be a positive number' });
    }

    if (isNaN(discount) || discount < 0 || discount > 100) {
      return res.status(400).json({ message: 'Discount must be between 0-100' });
    }

    if (isNaN(quantityInStock) || quantityInStock < 0) {
      return res.status(400).json({ message: 'Quantity must be 0 or greater' });
    }

    // Process suitable crops
    const processedCrops = Array.isArray(suitableForCrops) 
      ? suitableForCrops.map(c => c.trim()).filter(c => c.length > 0)
      : [suitableForCrops.trim()];

    if (processedCrops.length === 0) {
      return res.status(400).json({ message: 'At least one suitable crop is required' });
    }

    // Create product
    const product = new Product({
      name: name.trim(),
      category,
      presentation,
      presentationSize,
      images,
      discount: Number(discount),
      benefits: processedBenefits,
      description: description.trim(),
      dosage: dosage.trim(),
      price: Number(price),
      suitableForCrops: processedCrops,
      quantityInStock: Number(quantityInStock),
      isActive
    });

    const createdProduct = await product.save();

    res.status(201).json({
      ...createdProduct.toObject(),
      discountedPrice: createdProduct.price - (createdProduct.price * (createdProduct.discount / 100)),
      stockStatus: createdProduct.quantityInStock > 0 ? 'In Stock' : 'Out of Stock'
    });

  } catch (error) {
    console.error('Error creating product:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages
      });
    }

    res.status(500).json({
      message: 'Failed to create product',
      error: error.message
    });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
export const updateProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Get all valid categories from the schema
    const validCategories = Product.schema.path('category').enumValues;

    // Validate category
    if (req.body.category && !validCategories.includes(req.body.category)) {
      return res.status(400).json({
        message: 'Invalid category',
        validCategories: validCategories
      });
    }

    // Process benefits if provided
    if (req.body.benefits !== undefined) {
      let processedBenefits = [];
      if (Array.isArray(req.body.benefits)) {
        processedBenefits = req.body.benefits.map(b => b.trim()).filter(b => b.length > 0);
      } else if (typeof req.body.benefits === 'string') {
        processedBenefits = [req.body.benefits.trim()];
      }

      if (processedBenefits.length === 0) {
        return res.status(400).json({ message: 'At least one benefit is required' });
      }
      product.benefits = processedBenefits;
    }

    // Update other fields
    const updatableFields = [
      'name', 'category', 'presentation', 'presentationSize',
      'images', 'discount', 'description',
      'dosage', 'price', 'suitableForCrops', 'quantityInStock', 'isActive'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (typeof req.body[field] === 'string') {
          product[field] = req.body[field].trim();
        } else {
          product[field] = req.body[field];
        }
      }
    });

    // Validate numbers
    if (req.body.price && (isNaN(req.body.price) || req.body.price <= 0)) {
      return res.status(400).json({ message: 'Price must be a positive number' });
    }

    if (req.body.discount && (isNaN(req.body.discount) || req.body.discount < 0 || req.body.discount > 100)) {
      return res.status(400).json({ message: 'Discount must be between 0-100' });
    }

    if (req.body.quantityInStock && (isNaN(req.body.quantityInStock) || req.body.quantityInStock < 0)) {
      return res.status(400).json({ message: 'Quantity must be 0 or greater' });
    }

    const updatedProduct = await product.save();

    res.json({
      ...updatedProduct.toObject(),
      discountedPrice: updatedProduct.price - (updatedProduct.price * (updatedProduct.discount / 100)),
      stockStatus: updatedProduct.quantityInStock > 0 ? 'In Stock' : 'Out of Stock'
    });

  } catch (error) {
    console.error('Error updating product:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages,
        validCategories: Product.schema.path('category').enumValues
      });
    }

    res.status(500).json({
      message: 'Failed to update product',
      error: error.message
    });
  }
};

// Other controller functions (getProducts, getProductById, getAllProductsForAdmin, deleteProduct, uploadProductImage)
// remain the same as in your original code

// Keep all other controller methods the same as in your original code

// @desc    Get all products for homepage
// @route   GET /api/products
// @access  Public
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true })
      .select('name images price discount category presentation quantityInStock')
      .lean();

    // Calculate discounted price for each product
    const productsWithDiscount = products.map(product => ({
      ...product,
      discountedPrice: product.price - (product.price * (product.discount / 100)),
      stockStatus: product.quantityInStock > 0 ? 'In Stock' : 'Out of Stock'
    }));

    res.json(productsWithDiscount);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

export const getProductById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(req.params.id).lean();

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Allow admin to see inactive products
    if (!product.isActive && !req.user?.isAdmin) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Add calculated fields
    const productDetails = {
      ...product,
      discountedPrice: product.price - (product.price * (product.discount / 100)),
      stockStatus: product.isActive 
        ? (product.quantityInStock > 0 ? 'In Stock' : 'Out of Stock')
        : 'Inactive'
    };

    res.json(productDetails);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({
      message: 'Failed to fetch product details',
      error: error.message
    });
  }
};

export const getAllProductsForAdmin = async (req, res) => {
  try {
    const products = await Product.find({})
      .select('-__v')
      .sort({ createdAt: -1 });

    res.json(products);
  } catch (error) {
    console.error('Error fetching all products:', error);
    res.status(500).json({
      message: 'Failed to fetch products',
      error: error.message
    });
  }
};

// @desc    Delete a product (PERMANENT delete)
// @route   DELETE /api/products/:id
// @access  Private/Admin
export const deleteProduct = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    // First find the product to get image URLs
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Delete images from Cloudinary if needed
    if (product.images && product.images.length > 0) {
      try {
        await Promise.all(
          product.images.map(img =>
            cloudinaryUtils.deleteFromCloudinary(img)
          )
        );
      } catch (cloudinaryErr) {
        console.error('Error deleting images from Cloudinary:', cloudinaryErr);
      }
    }

    // Perform actual deletion from database
    await Product.deleteOne({ _id: req.params.id });

    res.json({
      message: 'Product deleted successfully',
      productId: req.params.id
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      message: 'Failed to delete product',
      error: error.message
    });
  }
};

// @desc    Upload product image
// @route   POST /api/products/upload-image
// @access  Private/Admin
export const uploadProductImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided' });
    }

    const result = await cloudinaryUtils.uploadToCloudinary(req.file.path);

    if (!result) {
      return res.status(500).json({ message: 'Image upload failed' });
    }

    res.json({
      url: result.secure_url,
      public_id: result.public_id
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({
      message: 'Image upload failed',
      error: error.message
    });
  }
};