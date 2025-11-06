const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET);
let usersCollection, biodatasCollection, paymentCollection;

const initializePaymentRoutes = (db) => {
  usersCollection = db.collection('users');
  biodatasCollection = db.collection('biodatas');
  paymentCollection = db.collection('payment');
  return router;
};

// 1. Create payment intent for Stripe
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.status(200).json({
      success: true,
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
});

// 2. Save payment - OPTIMIZED (Only essential data)
router.post('/payment', async (req, res) => {
  try {
    const { userEmail, biodataId, transactionId, amount } = req.body;
    
    // Get user to get their MongoDB ObjectId
    const user = await usersCollection.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get biodata to get its MongoDB ObjectId
    const biodata = await biodatasCollection.findOne({ 
      biodataId: parseInt(biodataId) 
    });
    if (!biodata) {
      return res.status(404).json({
        success: false,
        message: 'Biodata not found'
      });
    }

    const userId = user._id;
    const biodataObjectId = biodata._id;

    // Check if payment already exists
    const existingPayment = await paymentCollection.findOne({
      userId: userId,
      biodataId: biodataObjectId
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: 'Payment request already exists for this biodata'
      });
    }

    // Check if user already has access
    if (biodata.hasAccess && biodata.hasAccess.includes(userId.toString())) {
      return res.status(400).json({
        success: false,
        message: 'You already have access to this biodata'
      });
    }

    // Save OPTIMIZED payment record (only essential data)
    const paymentData = {
      userId: userId,                    
      biodataId: biodataObjectId,      
      transactionId: transactionId,     
      amount: amount,                  
      status: 'pending',               
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await paymentCollection.insertOne(paymentData);

    // Add user ObjectId to biodata's hasRequest array
    await biodatasCollection.updateOne(
      { _id: biodataObjectId },
      { 
        $addToSet: { hasRequest: userId.toString() },
        $set: { updatedAt: new Date() }
      }
    );

    res.status(200).json({
      success: true,
      insertedId: result.insertedId,
      message: 'Payment recorded successfully and access request submitted'
    });
  } catch (error) {
    console.error('Error saving payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save payment',
      error: error.message
    });
  }
});

// 3. Check biodata access - COMPREHENSIVE CHECK
router.get('/check-biodata-access', async (req, res) => {
  try {
    const { userEmail, biodataId } = req.query;

    if (!userEmail || !biodataId) {
      return res.status(400).json({
        success: false,
        message: 'User email and biodata ID are required'
      });
    }

    // Get user information
    const user = await usersCollection.findOne({ email: userEmail });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        hasAccess: false,
        accessType: 'none',
        isPremium: false,
        message: 'User not found'
      });
    }

    const isPremium = user.type === 'premium';
    const userId = user._id.toString();

    // Premium users get automatic access to all biodatas
    if (isPremium) {
      return res.status(200).json({
        success: true,
        hasAccess: true,
        accessType: 'premium',
        isPremium: true,
        hasPendingRequest: false,
        message: 'Premium user - Full access granted'
      });
    }

    // Get biodata to check access arrays
    const biodata = await biodatasCollection.findOne({ 
      biodataId: parseInt(biodataId) 
    });
    
    if (!biodata) {
      return res.status(404).json({
        success: false,
        hasAccess: false,
        message: 'Biodata not found'
      });
    }

    // Check if user has approved access
    const hasAccess = biodata.hasAccess && biodata.hasAccess.includes(userId);
    
    // Check if user has pending request
    const hasPendingRequest = biodata.hasRequest && biodata.hasRequest.includes(userId);

    // Determine access type
    let accessType = 'none';
    if (hasAccess) {
      accessType = 'paid';
    } else if (hasPendingRequest) {
      accessType = 'pending';
    }

    res.status(200).json({
      success: true,
      hasAccess: hasAccess,
      hasPendingRequest: hasPendingRequest,
      accessType: accessType,
      isPremium: false,
      userId: userId,
      message: hasAccess 
        ? 'Access granted' 
        : hasPendingRequest 
          ? 'Payment pending approval' 
          : 'No access'
    });

  } catch (error) {
    console.error('Error checking biodata access:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check biodata access',
      error: error.message
    });
  }
});

// 4. Get all payments with populated user and biodata info (for admin)
router.get('/payments', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status = 'all',
      populate = 'true' // New parameter to control population
    } = req.query;
    
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const skip = (pageNumber - 1) * limitNumber;

    // Build filter
    const filter = {};
    if (status !== 'all') {
      filter.status = status;
    }

    const payments = await paymentCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .toArray();

    const totalItems = await paymentCollection.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNumber);
    const shouldPopulate = populate !== 'false';

    let populatedPayments = payments;

    if (shouldPopulate) {
      populatedPayments = await Promise.all(
        payments.map(async (payment) => {
          let userData = null;
          let biodataData = null;

          // Populate user information
          if (payment.userId) {
            try {
              const user = await usersCollection.findOne({ 
                _id: new ObjectId(payment.userId) 
              });
              if (user) {
                userData = {
                  name: user.name,
                  email: user.email,
                };
              }
            } catch (userError) {
              console.error('Error fetching user:', userError);
            }
          }

          // Populate biodata information
          if (payment.biodataId) {
            try {
              const biodata = await biodatasCollection.findOne({ 
                _id: new ObjectId(payment.biodataId) 
              });
              if (biodata) {
                biodataData = {
                  name: biodata.name,
                  biodataId: biodata.biodataId,
                  ContactEmail: biodata.ContactEmail,
                };
              }
            } catch (biodataError) {
              console.error('Error fetching biodata:', biodataError);
            }
          }
          return {
            ...payment,
            user: userData, 
            biodata: biodataData 
          };
        })
      );
    }

    res.status(200).json({
      success: true,
      data: populatedPayments,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems,
        itemsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1
      },
      // Include metadata about population
      meta: {
        populated: shouldPopulate,
        totalPopulated: shouldPopulate ? populatedPayments.length : 0
      }
    });

  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment requests',
      error: error.message
    });
  }
});

router.put('/payment/update-status', async (req, res) => {
  try {
    const { paymentId, newStatus } = req.body;
    
    if (!paymentId || !newStatus) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID and new status are required'
      });
    }

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (!validStatuses.includes(newStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be: pending, approved, or rejected'
      });
    }

    // Get payment document
    const payment = await paymentCollection.findOne({ 
      _id: new ObjectId(paymentId) 
    });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const oldStatus = payment.status;
    const userId = payment.userId.toString(); 
    const biodataId = payment.biodataId.toString();
    if (oldStatus === newStatus) {
      return res.status(200).json({
        success: true,
        message: 'Status is already set to ' + newStatus,
        modifiedCount: 0
      });
    }

    // Get biodata document
    const biodata = await biodatasCollection.findOne({ _id: new ObjectId(biodataId) });
    
    if (!biodata) {
      return res.status(404).json({
        success: false,
        message: `Biodata not found for biodataId: ${biodataId}`
      });
    }
    const currentHasRequest = (biodata.hasRequest || []).map(id => id.toString());
    const currentHasAccess = (biodata.hasAccess || []).map(id => id.toString());
    let updatedHasRequest = [...currentHasRequest];
    let updatedHasAccess = [...currentHasAccess];

    if (newStatus === 'approved') {
      updatedHasRequest = currentHasRequest.filter(id => id !== userId);
      if (!updatedHasAccess.includes(userId)) {
        updatedHasAccess.push(userId);
      }
      
    } else if (newStatus === 'rejected') {
      updatedHasRequest = currentHasRequest.filter(id => id !== userId);
      
    } else if (newStatus === 'pending') {
      if (oldStatus === 'approved') {
        updatedHasAccess = currentHasAccess.filter(id => id !== userId);
        if (!updatedHasRequest.includes(userId)) {
          updatedHasRequest.push(userId);
        }
      } else {
        if (!updatedHasRequest.includes(userId)) {
          updatedHasRequest.push(userId);
        }
      }
    }
    const biodataUpdateResult = await biodatasCollection.updateOne(
      { _id: biodata._id },
      { 
        $set: { 
          hasRequest: updatedHasRequest,
          hasAccess: updatedHasAccess,
          updatedAt: new Date()
        }
      }
    );
    const paymentUpdate = {
      status: newStatus,
      updatedAt: new Date()
    };

    // Add timestamp fields based on new status
    if (newStatus === 'approved') {
      paymentUpdate.approvedAt = new Date();
    } else if (newStatus === 'rejected') {
      paymentUpdate.rejectedAt = new Date();
    }

    const paymentUpdateResult = await paymentCollection.updateOne(
      { _id: new ObjectId(paymentId) },
      { $set: paymentUpdate }
    );
    res.status(200).json({
      success: true,
      message: `Payment status updated from "${oldStatus}" to "${newStatus}"`,
      data: {
        paymentId: payment._id,
        oldStatus,
        newStatus,
        biodataId,
        userId,
        paymentModified: paymentUpdateResult.modifiedCount > 0,
        biodataModified: biodataUpdateResult.modifiedCount > 0,
        arraysUpdated: {
          hasRequest: updatedHasRequest,
          hasAccess: updatedHasAccess
        }
      }
    });

  } catch (error) {
    console.error('=== Payment Status Update Error ===');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      success: false,
      message: 'Failed to update payment status',
      error: error.message
    });
  }
});

// 6. Check payment status
router.get('/payments/status', async (req, res) => {
  try {
    const { userEmail, biodataId } = req.query;

    if (!userEmail || !biodataId) {
      return res.status(400).json({
        success: false,
        message: 'User email and biodata ID are required'
      });
    }

    // Get user
    const user = await usersCollection.findOne({ email: userEmail });
    if (!user) {
      return res.status(200).json({
        success: true,
        hasPendingPayment: false,
        payment: null
      });
    }

    // Get biodata
    const biodata = await biodatasCollection.findOne({ 
      biodataId: parseInt(biodataId) 
    });
    if (!biodata) {
      return res.status(200).json({
        success: true,
        hasPendingPayment: false,
        payment: null
      });
    }
    const payment = await paymentCollection.findOne({
      userId: user._id,
      biodataId: biodata._id
    });

    if (!payment) {
      return res.status(200).json({
        success: true,
        hasPendingPayment: false,
        payment: null,
        message: 'No payment found'
      });
    }

    const hasPendingPayment = payment.status === 'pending';
    const isApproved = payment.status === 'approved';

    res.status(200).json({
      success: true,
      hasPendingPayment: hasPendingPayment,
      isApproved: isApproved,
      payment: payment,
      message: hasPendingPayment 
        ? 'Payment pending approval' 
        : isApproved 
          ? 'Payment approved' 
          : 'Payment status: ' + payment.status
    });

  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status',
      error: error.message
    });
  }
});

// 7. Get biodata with full contact info (for payment page)
router.get('/reqbiodatas-payment/:biodataId', async (req, res) => {
  try {
    const biodataId = parseInt(req.params.biodataId);
    
    const biodata = await biodatasCollection.findOne({ 
      biodataId: biodataId 
    });
    
    if (!biodata) {
      return res.status(404).json({
        success: false,
        message: 'Biodata not found'
      });
    }

    res.status(200).json({
      success: true,
      ...biodata
    });
  } catch (error) {
    console.error('Error fetching biodata:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch biodata',
      error: error.message
    });
  }
});
//8 get my request 
router.get('/payment/:email', async (req, res) => {
  try {
    const email = req.params.email;
    // Get user by email
    const user = await usersCollection.findOne({ email: email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userId = user._id;

    // Find ALL payments for this user 
    const payments = await paymentCollection
      .find({ userId: userId })
      .toArray();

    // Populate biodata info for each payment
    const populatedPayments = await Promise.all(
      payments.map(async (payment) => {
        const biodata = await biodatasCollection.findOne({ 
          _id: payment.biodataId 
        });

        return {
          _id: payment._id,
          userId: payment.userId,
          biodataId: payment.biodataId,
          transactionId: payment.transactionId,
          amount: payment.amount,
          status: payment.status,
          createdAt: payment.createdAt,
          updatedAt: payment.updatedAt,
          approvedAt: payment.approvedAt,
          rejectedAt: payment.rejectedAt,
          biodata: biodata ? {
            _id: biodata._id,
            biodataId: biodata.biodataId,
            name: biodata.name,
            ContactEmail: biodata.ContactEmail,
            MobileNumber: biodata.MobileNumber,
            photo: biodata.photo
          } : null
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: populatedPayments
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact requests',
      error: error.message
    });
  }
});

module.exports = initializePaymentRoutes;