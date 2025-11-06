const express = require('express');
const router = express.Router();
let successCollection;

const initializeSuccessStoryRoutes = (db) => {
  successCollection = db.collection('success');
  return router;
};

// Success story post 
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    // Validation: Check if required fields are present
    if (!data.SelfBiodata || !data.PartnerBiodata) {
      return res.status(400).json({
        success: false,
        message: 'Both SelfBiodata and PartnerBiodata are required'
      });
    }

    // Check if this combination already exists (in any order)
    const existingEntry = await successCollection.findOne({
      $or: [
        // Check exact same combination
        {
          SelfBiodata: data.SelfBiodata,
          PartnerBiodata: data.PartnerBiodata
        },
        // Check reverse combination (A+B or B+A)
        {
          SelfBiodata: data.PartnerBiodata,
          PartnerBiodata: data.SelfBiodata
        }
      ]
    });

    if (existingEntry) {
      return res.status(409).json({
        success: false,
        message: 'This biodata combination already exists in success stories',
        existingEntry: {
          id: existingEntry._id,
          selfBiodata: existingEntry.SelfBiodata,
          partnerBiodata: existingEntry.PartnerBiodata,
          createdAt: existingEntry.createdAt
        }
      });
    }

    // Check if self biodata is already in any success story
    const selfExists = await successCollection.findOne({
      $or: [
        { SelfBiodata: data.SelfBiodata },
        { PartnerBiodata: data.SelfBiodata }
      ]
    });

    if (selfExists) {
      return res.status(409).json({
        success: false,
        message: 'Your biodata is already associated with another success story',
        existingStory: {
          id: selfExists._id,
          withBiodata: selfExists.SelfBiodata === data.SelfBiodata ? selfExists.PartnerBiodata : selfExists.SelfBiodata
        }
      });
    }

    // Check if partner biodata is already in any success story
    const partnerExists = await successCollection.findOne({
      $or: [
        { SelfBiodata: data.PartnerBiodata },
        { PartnerBiodata: data.PartnerBiodata }
      ]
    });

    if (partnerExists) {
      return res.status(409).json({
        success: false,
        message: 'Partner biodata is already associated with another success story',
        existingStory: {
          id: partnerExists._id,
          withBiodata: partnerExists.SelfBiodata === data.PartnerBiodata ? partnerExists.PartnerBiodata : partnerExists.SelfBiodata
        }
      });
    }

    // Add timestamp if not provided
    if (!data.createdAt) {
      data.createdAt = new Date();
    }

    // Insert the new success story
    const result = await successCollection.insertOne(data);
    
    res.status(201).json({
      success: true,
      message: 'Success story added successfully',
      insertedId: result.insertedId,
      data: {
        selfBiodata: data.SelfBiodata,
        partnerBiodata: data.PartnerBiodata,
        createdAt: data.createdAt
      }
    });

  } catch (error) {
    console.error('Error adding success story:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get success stories with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const sortBy = req.query.sortBy || '_id';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search || '';
    const filter = {};
    
    if (search) {
      filter.$or = [
        { shortStory: { $regex: search, $options: 'i' } },
        { SelfBiodata: { $regex: search, $options: 'i' } },
        { PartnerBiodata: { $regex: search, $options: 'i' } }
      ];
    }
    
    const totalStories = await successCollection.countDocuments(filter);
    
    let stories;
    let totalPages;
    let showing;

    if (limit === -1) {
      stories = await successCollection
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .toArray();
      
      totalPages = 1;
      showing = stories.length;
    } else {
      const skip = (page - 1) * limit;
      totalPages = Math.ceil(totalStories / limit);
      stories = await successCollection
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      showing = stories.length;
    }
    
    res.status(200).json({
      success: true,
      data: stories,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalStories: totalStories,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        limit: limit === -1 ? totalStories : limit,
        showing: showing
      }
    });

  } catch (error) {
    console.error('Error fetching success stories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch success stories',
      error: error.message
    });
  }
});



module.exports = initializeSuccessStoryRoutes;