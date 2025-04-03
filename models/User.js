import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  mobileNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  ordersHistory: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  }],
  addresses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address'
  }],
  isAdmin: {
    type: Boolean,
    required: true,
    default: false
  }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

export default User;