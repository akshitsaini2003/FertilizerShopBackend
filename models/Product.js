import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['wheat', 'rice', 'sugarcane', 'bajra', 'vegetable', 'Mango'],
    default: 'wheat'
  },
  presentation: {
    type: String,
    required: [true, 'Presentation type is required'],
    enum: ['Powder Form', 'Liquid Form'],
    default: 'Powder Form'
  },
  presentationSize: {
    type: String,
    required: [true, 'Presentation size is required'],
    enum: {
      values: ['100gm', '250gm', '500gm', '1kg', '3kg', '5kg', '25kg', '50kg', '10ml', '80ml', '1l'],
      message: 'Please select a valid presentation size'
    },
    default: '100gm'
  },
  images: [{
    type: String,
    required: [true, 'At least one image is required'],
    validate: {
      validator: function(images) {
        return images.length > 0;
      },
      message: 'At least one image is required'
    }
  }],
  discount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  benefits: {
    type: [String], // Changed from String to Array of Strings
    required: [true, 'At least one benefit is required'],
    validate: {
      validator: function(benefits) {
        return benefits.length > 0 && benefits.every(b => b.trim().length > 0);
      },
      message: 'Please provide at least one valid benefit'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  dosage: {
    type: String,
    required: [true, 'Dosage information is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0.01, 'Price must be greater than 0']
  },
  suitableForCrops: [{
    type: String,
    required: [true, 'At least one suitable crop is required'],
    validate: {
      validator: function(crops) {
        return crops.length > 0;
      },
      message: 'At least one suitable crop is required'
    }
  }],
  quantityInStock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock cannot be negative'],
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for discounted price
productSchema.virtual('discountedPrice').get(function() {
  return this.price - (this.price * this.discount / 100);
});

// Virtual for stock status
productSchema.virtual('stockStatus').get(function() {
  if (!this.isActive) return 'Inactive';
  return this.quantityInStock > 0 ? 'In Stock' : 'Out of Stock';
});

const Product = mongoose.model('Product', productSchema);

export default Product; 