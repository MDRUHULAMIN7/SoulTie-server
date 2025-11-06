const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
let usersCollection;

const initializeUserRoutes = (db) => {
  usersCollection = db.collection('users');
  return router;
};

// Get all users with pagination and search for admin
router.get('/manageusers', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 8,
      search = ''
    } = req.query;

    // Build query object
    const query = {};

    // Search by name or email
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.max(1, parseInt(limit));
    const skip = (pageNumber - 1) * limitNumber;

    // Execute query with pagination
    const [data, totalItems] = await Promise.all([
      usersCollection
        .find(query)
        .sort({ _id: -1 }) 
        .skip(skip)
        .limit(limitNumber)
        .toArray(),
      usersCollection.countDocuments(query)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    // Send response with proper structure
    res.status(200).json({
      success: true,
      data,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalItems,
        itemsPerPage: limitNumber,
        hasNextPage,
        hasPrevPage
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
      message: error.message
    });
  }
});

// Toggle Admin Role 
router.patch('/userupdate/:id', async (req, res) => {
  try {
    const { updaterole } = req.body;
    const id = req.params.id;
    
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        roll: updaterole
      }
    };
    
    const result = await usersCollection.updateOne(query, updateDoc);
    
    if (result.modifiedCount > 0) {
      res.status(200).json({
        success: true,
        message: `User role updated to ${updaterole}`,
        modifiedCount: result.modifiedCount
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No changes made',
        modifiedCount: 0
      });
    }
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user role',
      message: error.message
    });
  }
});

// Toggle Premium Status
router.patch('/userupdatepremium/:id', async (req, res) => {
  try {
    const { updaterole } = req.body;
    const id = req.params.id;
    
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        type: updaterole
      }
    };
    const result = await usersCollection.updateOne(query, updateDoc);
    
    if (result.modifiedCount > 0) {
      res.status(200).json({
        success: true,
        message: `User membership updated to ${updaterole}`,
        modifiedCount: result.modifiedCount
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'No changes made',
        modifiedCount: 0
      });
    }
  } catch (error) {
    console.error('Error updating user membership:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update user membership',
      message: error.message
    });
  }
});

module.exports = initializeUserRoutes;