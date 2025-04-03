import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Address from '../models/Address.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import mongoose from 'mongoose';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_B7eKx4MFFl75B7",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "6KFivXMV0oroiqKfpjcgztqu"
});

const generateOrderId = () => `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

export const createOrder = async (req, res) => {
  const { items, shippingAddress, paymentMethod } = req.body;
  const userId = req.user._id;

  try {
    // Validate input
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'No items in order' });
    }
    if (!shippingAddress) {
      return res.status(400).json({ message: 'Shipping address required' });
    }
    if (!['COD', 'Razorpay'].includes(paymentMethod)) {
      return res.status(400).json({ message: 'Invalid payment method' });
    }

    // Verify shipping address
    const address = await Address.findOne({
      _id: shippingAddress,
      user: userId
    });
    if (!address) {
      return res.status(400).json({ message: 'Invalid shipping address' });
    }

    // Process order items
    let totalAmount = 0;
    const orderItems = [];
    const productUpdates = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      
      if (!product) {
        return res.status(400).json({ message: `Product ${item.product} not found` });
      }
      if (!product.isActive) {
        return res.status(400).json({ message: `Product ${product.name} is not available` });
      }
      if (product.quantityInStock < item.quantity) {
        return res.status(400).json({ 
          message: `Only ${product.quantityInStock} units available for ${product.name}`
        });
      }

      const discountedPrice = product.price * (1 - (product.discount / 100));
      const itemTotal = discountedPrice * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        product: product._id,
        name: product.name,
        quantity: item.quantity,
        price: discountedPrice,
        presentation: product.presentation
      });

      productUpdates.push({
        updateOne: {
          filter: { _id: product._id },
          update: { $inc: { quantityInStock: -item.quantity } }
        }
      });
    }

    // Handle Razorpay payment
    let razorpayOrder = null;
    if (paymentMethod === 'Razorpay') {
      try {
        razorpayOrder = await razorpay.orders.create({
          amount: Math.round(totalAmount * 100),
          currency: 'INR',
          receipt: generateOrderId(),
          payment_capture: 1
        });
      } catch (error) {
        console.error('Razorpay error:', error);
        return res.status(500).json({
          message: 'Payment gateway error',
          error: error.error?.description || 'Failed to create Razorpay order'
        });
      }
    }

    // Create order
    const order = new Order({
      user: userId,
      items: orderItems,
      totalAmount,
      shippingAddress,
      paymentMethod,
      orderId: generateOrderId(),
      razorpayOrderId: razorpayOrder?.id,
      expectedDelivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      paymentStatus: paymentMethod === 'COD' ? 'Pending' : 'Processing'
    });

    // Transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const createdOrder = await order.save({ session });

      await User.findByIdAndUpdate(
        userId,
        { $push: { ordersHistory: createdOrder._id } },
        { session }
      );

      if (productUpdates.length > 0) {
        await Product.bulkWrite(productUpdates, { session });
      }

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        _id: createdOrder._id,
        orderId: createdOrder.orderId,
        totalAmount: createdOrder.totalAmount,
        paymentMethod: createdOrder.paymentMethod,
        orderStatus: createdOrder.orderStatus, // Changed from status
        paymentStatus: createdOrder.paymentStatus,
        razorpayOrder
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Transaction error:', error);
      throw error;
    }

  } catch (error) {
    console.error('Order creation failed:', error);
    return res.status(500).json({
      message: 'Failed to create order',
      error: error.message
    });
  }
};

export const verifyPayment = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId } = req.body;

  try {
    // Validate input
    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !orderId) {
      return res.status(400).json({ message: 'Missing payment verification data' });
    }

    // Find the order
    const order = await Order.findOne({ orderId });
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Verify payment signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || "6KFivXMV0oroiqKfpjcgztqu")
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      return res.status(400).json({ message: 'Invalid payment signature' });
    }

    // Update order status
    order.paymentStatus = 'Success';
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;
    order.orderStatus = 'Processing';
    
    await order.save();

    return res.json({ 
      message: 'Payment verified successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus, // Changed from status
        paymentStatus: order.paymentStatus
      }
    });

  } catch (error) {
    console.error('Payment verification failed:', error);
    return res.status(500).json({ 
      message: 'Payment verification failed',
      error: error.message 
    });
  }
};

export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('user', 'name email mobileNumber')
      .populate('shippingAddress')
      .populate('items.product', 'name images price presentation category');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Check authorization
    if (order.user._id.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Unauthorized access' });
    }

    // Prepare response
    const response = {
      _id: order._id,
      orderId: order.orderId,
      createdAt: order.createdAt,
      orderStatus: order.orderStatus, // Changed from status
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      items: order.items.map(item => ({
        product: item.product,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        presentation: item.presentation
      })),
      shippingAddress: order.shippingAddress,
      expectedDelivery: order.expectedDelivery
    };

    return res.json(response);

  } catch (error) {
    console.error('Error fetching order:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch order details',
      error: error.message 
    });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .populate({
        path: 'items.product',
        select: 'name images price presentation category quantityInStock',
        model: 'Product'
      })
      .populate('shippingAddress')
      .lean();

    const formattedOrders = orders.map(order => ({
      ...order,
      items: order.items.map(item => ({
        ...item,
        name: item.name || item.product?.name,
        price: item.price || item.product?.price,
        presentation: item.presentation || item.product?.presentation,
        category: item.product?.category,
        image: item.product?.images?.[0] || '/images/placeholder-product.png'
      }))
    }));

    return res.json(formattedOrders);

  } catch (error) {
    console.error('Error fetching user orders:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch orders',
      error: error.message 
    });
  }
};

export const getOrders = async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const orders = await Order.find({})
      .sort({ createdAt: -1 })
      .populate('user', 'name email')
      .populate('shippingAddress')
      .populate({
        path: 'items.product',
        select: 'name images price presentation category',
        model: 'Product'
      })
      .lean();

    const formattedOrders = orders.map(order => ({
      ...order,
      items: order.items.map(item => ({
        ...item,
        name: item.name || item.product?.name,
        price: item.price || item.product?.price,
        presentation: item.presentation || item.product?.presentation,
        category: item.product?.category,
        image: item.product?.images?.[0] || '/images/placeholder-product.png'
      }))
    }));

    return res.json(formattedOrders);

  } catch (error) {
    console.error('Error fetching all orders:', error);
    return res.status(500).json({ 
      message: 'Failed to fetch orders',
      error: error.message 
    });
  }
};
export const updateOrderStatus = async (req, res) => {
  const { status, reason } = req.body;

  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Validate status transition
    const validStatusTransitions = {
      Processing: ['Shipped', 'Rejected'],
      Shipped: ['Delivered', 'Cancelled'],
      Delivered: [],
      Rejected: [],
      Cancelled: []
    };

    if (!validStatusTransitions[order.orderStatus]?.includes(status)) {
      return res.status(400).json({ 
        message: `Cannot change status from ${order.orderStatus} to ${status}`
      });
    }

    // Update order
    order.orderStatus = status;

    // Set timestamps and additional info
    if (status === 'Shipped') {
      order.shippedAt = new Date();
    } else if (status === 'Delivered') {
      order.deliveredAt = new Date();
      // Update payment status to Success if it's COD and not already Success
      if (order.paymentMethod === 'COD' && order.paymentStatus !== 'Success') {
        order.paymentStatus = 'Success';
      }
    } else if (status === 'Rejected' || status === 'Cancelled') {
      order[`${status.toLowerCase()}Reason`] = reason || 'No reason provided';
      
      // Handle refund if payment was successful
      if (order.paymentStatus === 'Success') {
        order.paymentStatus = 'Refunded';
      }

      // Restore inventory if cancelled/rejected
      if (status === 'Cancelled') {
        const inventoryUpdates = order.items.map(item => ({
          updateOne: {
            filter: { _id: item.product },
            update: { $inc: { quantityInStock: item.quantity } }
          }
        }));
        
        await Product.bulkWrite(inventoryUpdates);
      }
    }

    await order.save();

    return res.json({ 
      message: 'Order status updated',
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus
      }
    });

  } catch (error) {
    console.error('Error updating order status:', error);
    return res.status(500).json({ 
      message: 'Failed to update order status',
      error: error.message 
    });
  }
};

export const cancelOrder = async (req, res) => {
  const { reason } = req.body;

  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Validate cancellation
    if (!['Processing', 'Shipped'].includes(order.orderStatus)) {
      return res.status(400).json({ 
        message: `Order cannot be cancelled in ${order.orderStatus} state`
      });
    }

    // Update order
    order.orderStatus = 'Cancelled';
    order.cancellationReason = reason || 'No reason provided';
    order.cancelledAt = new Date();

    // Handle refund
    if (order.paymentStatus === 'Success') {
      order.paymentStatus = 'Refunded';
    }

    // Restore inventory
    const inventoryUpdates = order.items.map(item => ({
      updateOne: {
        filter: { _id: item.product },
        update: { $inc: { quantityInStock: item.quantity } }
      }
    }));

    await Product.bulkWrite(inventoryUpdates);
    await order.save();

    return res.json({ 
      message: 'Order cancelled successfully',
      order: {
        _id: order._id,
        orderId: order.orderId,
        orderStatus: order.orderStatus, // Changed from status
        paymentStatus: order.paymentStatus
      }
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    return res.status(500).json({ 
      message: 'Failed to cancel order',
      error: error.message 
    });
  }
};