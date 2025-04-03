import User from '../models/User.js';
import Address from '../models/Address.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import validator from 'validator';

// Helper function to create token
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (req, res) => {
  const { name, mobileNumber, email, password, confirmPassword } = req.body;

  try {
    // Validation
    if (!name || !mobileNumber || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'Please fill in all fields' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email' });
    }

    if (!validator.isMobilePhone(mobileNumber, 'en-IN')) {
      return res.status(400).json({ message: 'Please enter a valid Indian mobile number' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ $or: [{ email }, { mobileNumber }] });
    if (userExists) {
      return res.status(400).json({ 
        message: userExists.email === email 
          ? 'Email already exists' 
          : 'Mobile number already exists' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      mobileNumber,
      email,
      password: hashedPassword,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        token: createToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/users/login
// @access  Public
export const loginUser = async (req, res) => {
  const { emailOrMobile, password } = req.body;

  try {
    if (!emailOrMobile || !password) {
      return res.status(400).json({ message: 'Please provide email/mobile and password' });
    }

    // Find user by email or mobile number
    const user = await User.findOne({
      $or: [
        { email: emailOrMobile },
        { mobileNumber: emailOrMobile }
      ]
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      token: createToken(user._id),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Change user password
// @route   PUT /api/users/change-password
// @access  Private
export const changePassword = async (req, res) => {
  const { currentPassword, newPassword, confirmNewPassword } = req.body;
  const userId = req.user._id;

  try {
    // Validation
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return res.status(400).json({ message: 'Please fill in all fields' });
    }

    if (newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'New passwords do not match' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('addresses')
      .populate('ordersHistory');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
export const updateUserProfile = async (req, res) => {
  const { name, email, mobileNumber } = req.body;

  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validation
    if (email && !validator.isEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email' });
    }

    if (mobileNumber && !validator.isMobilePhone(mobileNumber, 'en-IN')) {
      return res.status(400).json({ message: 'Please enter a valid Indian mobile number' });
    }

    // Check if email or mobile already exists (excluding current user)
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ message: 'Email already exists' });
      }
    }

    if (mobileNumber && mobileNumber !== user.mobileNumber) {
      const mobileExists = await User.findOne({ mobileNumber });
      if (mobileExists) {
        return res.status(400).json({ message: 'Mobile number already exists' });
      }
    }

    // Update fields
    user.name = name || user.name;
    user.email = email || user.email;
    user.mobileNumber = mobileNumber || user.mobileNumber;

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      mobileNumber: updatedUser.mobileNumber,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add new address
// @route   POST /api/users/address
// @access  Private
export const addAddress = async (req, res) => {
  const { name, mobileNumber, pinCode, city, state, country, isDefault } = req.body;
  
  try {
    // Validation
    if (!name || !mobileNumber || !pinCode || !city || !state) {
      return res.status(400).json({ message: 'Please fill all required fields' });
    }

    // Create address
    const address = await Address.create({
      user: req.user._id,
      name,
      mobileNumber,
      pinCode,
      city,
      state,
      country: country || 'India',
      isDefault: isDefault || false
    });

    // If set as default, update other addresses
    if (isDefault) {
      await Address.updateMany(
        { user: req.user._id, _id: { $ne: address._id } },
        { $set: { isDefault: false } }
      );
    }

    // Add address to user's addresses array
    await User.findByIdAndUpdate(req.user._id, {
      $push: { addresses: address._id }
    });

    res.status(201).json(address);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get user addresses
// @route   GET /api/users/address
// @access  Private
export const getAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ user: req.user._id });
    res.json(addresses);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update address
// @route   PUT /api/users/address/:id
// @access  Private
export const updateAddress = async (req, res) => {
  const { name, mobileNumber, pinCode, city, state, country, isDefault } = req.body;
  
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Update fields
    address.name = name || address.name;
    address.mobileNumber = mobileNumber || address.mobileNumber;
    address.pinCode = pinCode || address.pinCode;
    address.city = city || address.city;
    address.state = state || address.state;
    address.country = country || address.country;
    
    // Handle default address change
    if (isDefault !== undefined) {
      address.isDefault = isDefault;
      if (isDefault) {
        await Address.updateMany(
          { user: req.user._id, _id: { $ne: address._id } },
          { $set: { isDefault: false } }
        );
      }
    }

    const updatedAddress = await address.save();
    res.json(updatedAddress);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete address
// @route   DELETE /api/users/address/:id
// @access  Private
export const deleteAddress = async (req, res) => {
  try {
    const address = await Address.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!address) {
      return res.status(404).json({ message: 'Address not found' });
    }

    // Remove address from user's addresses array
    await User.findByIdAndUpdate(req.user._id, {
      $pull: { addresses: address._id }
    });

    res.json({ message: 'Address removed successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};