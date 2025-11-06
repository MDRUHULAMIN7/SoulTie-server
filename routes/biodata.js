const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
let biodatasCollection, usersCollection;

const initializeBiodataRoutes = (db) => {
  biodatasCollection = db.collection('biodatas');
  usersCollection = db.collection('users');
  return router;
};


// Create or update biodata
router.put('/biodatas', async (req, res) => {
  try {
    const biodata = req.body;
    const query = { "ContactEmail": biodata?.ContactEmail };
    
    // Check if biodata already exists
    const existingBiodata = await biodatasCollection.findOne(query);
    
    const options = { upsert: true };
    const updateData = {
      name: biodata.name,
      photo: biodata.photo,
      biodataType: biodata.biodataType,
      birthDate: biodata.birthDate,
      Height: biodata.Height,
      Weight: biodata.Weight,
      Age: biodata.Age,
      Occupation: biodata.Occupation,
      Race: biodata.Race,
      FatherName: biodata.FatherName,
      MotherName: biodata.MotherName,
      ParmanentDivison: biodata.ParmanentDivison,
      PresentDivison: biodata.PresentDivison,
      PartnerAge: biodata.PartnerAge,
      ParnerHeight: biodata.ParnerHeight,
      PartnerWeight: biodata.PartnerWeight,
      ContactEmail: biodata.ContactEmail,
      MobileNumber: biodata.MobileNumber,
      hasAccess: biodata.hasAccess || [],
      hasRequest: biodata.hasRequest || [],
      updatedAt: new Date()
    };

    // If biodata doesn't exist, create new one with generated ID
    if (!existingBiodata) {
      const totalBiodatas = await biodatasCollection.countDocuments();
      const nextBiodataId = totalBiodatas + 1;
      
      updateData.biodataId = nextBiodataId;
      updateData.createdAt = new Date();
      updateData.role = 'normal';
    } else {
      updateData.biodataId = existingBiodata.biodataId;
      updateData.createdAt = existingBiodata.createdAt;
      updateData.role = existingBiodata.role || 'normal';
    }

    const data = {
      $set: updateData
    };

    const result = await biodatasCollection.updateOne(query, data, options);

    res.status(200).json({
      success: true,
      message: result.upsertedCount > 0 ? 'Biodata created successfully' : 'Biodata updated successfully',
      biodataId: updateData.biodataId,
      isNew: result.upsertedCount > 0,
      data: result
    });

  } catch (error) {
    console.error('Error in biodata creation/update:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process biodata',
      error: error.message
    });
  }
});
// Get biodata by email
router.get('/biodatas/email/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const biodata = await biodatasCollection.findOne({ ContactEmail: email });
    
    if (!biodata) {
      return res.status(404).json({
        success: false,
        message: 'Biodata not found for this email'
      });
    }

    res.status(200).json(biodata);
  } catch (error) {
    console.error('Error fetching biodata by email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch biodata',
      error: error.message
    });
  }
});
// Get my biodata by email
router.get('/view-biodatas/:email', async (req, res) => {
  try {
    const email = req.params.email;
    const query = { "ContactEmail": email };
    const result = await biodatasCollection.findOne(query);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Biodata not found'
      });
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching biodata:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch biodata',
      error: error.message
    });
  }
});

// Get all biodatas with filtering and pagination
router.get('/biodatas', async (req, res) => {
  try {
    const {
      biodataType,
      minAge,
      maxAge,
      division,
      race,
      occupation,
      role,
      page = 1,
      limit = 8,
      sortBy = 'biodataId',
      order = 'desc'
    } = req.query;

    // Build query object
    const query = {};

    // Add filters if provided
    if (biodataType) {
      query.biodataType = biodataType.toLowerCase();
    }

    // Age filter - FIXED: Handle string age values properly
    if (minAge || maxAge) {
      query.Age = {};
      
      if (minAge) {
        // Convert minAge to number and compare with Age field (which is string)
        query.Age.$gte = minAge.toString();
      }
      
      if (maxAge) {
        // Convert maxAge to number and compare with Age field (which is string)
        query.Age.$lte = maxAge.toString();
      }
    }

    if (division) {
      query.ParmanentDivison = division;
    }

    if (race) {
      query.Race = { $regex: new RegExp(race, 'i') };
    }

    if (occupation) {
      query.Occupation = { $regex: new RegExp(occupation, 'i') };
    }

    if (role) {
      query.role = role.toLowerCase();
    }

    // Build sort object
    const sortField = sortBy;
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortOptions = { [sortField]: sortOrder };

    // Calculate pagination
    const pageNumber = Math.max(1, parseInt(page));
    const limitNumber = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNumber - 1) * limitNumber;

    // Execute query with pagination
    const [data, totalItems] = await Promise.all([
      biodatasCollection
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNumber)
        .toArray(),
      biodatasCollection.countDocuments(query)
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / limitNumber);
    const hasNextPage = pageNumber < totalPages;
    const hasPrevPage = pageNumber > 1;

    // Send response
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
      },
      filters: {
        biodataType: biodataType || null,
        ageRange: minAge && maxAge ? `${minAge}-${maxAge}` : null,
        division: division || null,
        race: race || null,
        occupation: occupation || null,
        role: role || null
      }
    });

  } catch (error) {
    console.error('Error fetching biodatas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch biodatas',
      message: error.message
    });
  }
});

// Get filter options for biodatas
router.get('/biodatas/filter-options', async (req, res) => {
  try {
    const [divisions, races, occupations] = await Promise.all([
      biodatasCollection.distinct('ParmanentDivison'),
      biodatasCollection.distinct('Race'),
      biodatasCollection.distinct('Occupation')
    ]);

    res.status(200).json({
      success: true,
      filterOptions: {
        divisions: divisions.filter(Boolean).sort(),
        races: races.filter(Boolean).sort(),
        occupations: occupations.filter(Boolean).sort(),
        biodataTypes: ['male', 'female'],
        roles: ['premium', 'requested', 'standard'],
        ageRanges: [
          { label: '18-25', min: 18, max: 25 },
          { label: '26-30', min: 26, max: 30 },
          { label: '31-35', min: 31, max: 35 },
          { label: '36-40', min: 36, max: 40 },
          { label: '41-50', min: 41, max: 50 },
          { label: '50+', min: 50, max: 100 }
        ]
      }
    });

  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch filter options',
      message: error.message
    });
  }
});

// Update user type by email
router.patch('/biodataupdate/:email', async (req, res) => {
  try {
    const updateroll = req.body.updaterole;
    const email = req.params.email;
    const query = { email };
    const updateDoc = {
      $set: {
        type: updateroll
      }
    };
    const result = await usersCollection.updateOne(query, updateDoc);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating user type:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user type',
      error: error.message
    });
  }
});

module.exports = initializeBiodataRoutes;