const express = require('express');
const { ObjectId } = require('mongodb');
const router = express.Router();
let biodatasCollection;

const initializeBiodataByIdRoutes = (db) => {
  biodatasCollection = db.collection('biodatas');
  return router;
};

// Update biodata role by ID
router.patch('/biodataupdatepremium/:id',async (req,res)=>{
      const updateroll =req.body.updaterole;
      const id = req.params.id;
      const query ={_id: new ObjectId(id)}
     const  updateDoc ={
      $set:{
        role:updateroll
      }
     }
     const result = await biodatasCollection.updateOne(query,updateDoc);
     res.send(result)
    })

// Get biodata detail by ID
router.get('/biodatas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await biodatasCollection.findOne(query);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Biodata not found'
      });
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching biodata by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch biodata',
      error: error.message
    });
  }
});

// Get similar biodatas by ID
router.get('/biodatas/:id/similar', async (req, res) => {
  try {
    const id = req.params.id;
    const limit = parseInt(req.query.limit) || 3;
    
    // First, get the current biodata
    const currentBiodata = await biodatasCollection.findOne({
      _id: new ObjectId(id)
    });
    
    if (!currentBiodata) {
      return res.status(404).json({
        success: false,
        message: 'Biodata not found'
      });
    }
    
    // Helper function to safely parse numeric strings
    const parseNumber = (value) => {
      if (!value) return null;
      const parsed = parseFloat(value.toString().replace(/[^\d.-]/g, ''));
      return isNaN(parsed) ? null : parsed;
    };
    
    // Parse current biodata values from strings
    const currentAge = parseNumber(currentBiodata.Age);
    const currentHeight = parseNumber(currentBiodata.Height);
    const currentWeight = parseNumber(currentBiodata.Weight);
    
    // Validate that we have valid numbers
    if (!currentAge || !currentHeight || !currentWeight) {
      return res.status(400).json({
        success: false,
        message: 'Invalid biodata values for comparison'
      });
    }
    
    // Define similarity ranges
    const ageRange = 5;        // ±5 years
    const heightRange = 0.15;  // ±15cm (0.15m) or ±6 inches
    const weightRange = 10;    // ±10kg
    
    // Build base similarity query
    const similarityQuery = {
      biodataType: currentBiodata.biodataType,
      _id: { $ne: new ObjectId(id) } // Exclude current biodata
    };
    
    // Find all potential matches
    const allBiodatas = await biodatasCollection
      .find(similarityQuery)
      .toArray();
    
    // Calculate similarity scores and filter
    const scoredBiodatas = allBiodatas
      .map(biodata => {
        // Parse string values to numbers
        const age = parseNumber(biodata.Age);
        const height = parseNumber(biodata.Height);
        const weight = parseNumber(biodata.Weight);
        
        // Skip if any value is invalid
        if (!age || !height || !weight) {
          return null;
        }
        
        // Check if within ranges
        const ageDiff = Math.abs(age - currentAge);
        const heightDiff = Math.abs(height - currentHeight);
        const weightDiff = Math.abs(weight - currentWeight);
        
        const ageMatch = ageDiff <= ageRange;
        const heightMatch = heightDiff <= heightRange;
        const weightMatch = weightDiff <= weightRange;
        
        // Calculate similarity score (0-4 points)
        let score = 1; // Base point for same biodataType
        if (ageMatch) score += 1;
        if (heightMatch) score += 1;
        if (weightMatch) score += 1;
        
        return {
          ...biodata,
          similarityScore: score,
          differences: {
            age: ageDiff,
            height: heightDiff,
            weight: weightDiff
          },
          ageMatch,
          heightMatch,
          weightMatch
        };
      })
      // Remove null entries (invalid data)
      .filter(biodata => biodata !== null)
      // Filter: at least 2 matches (biodataType + one other criteria)
      .filter(biodata => biodata.similarityScore >= 2)
      // Sort by similarity score (highest first), then by age difference
      .sort((a, b) => {
        if (b.similarityScore !== a.similarityScore) {
          return b.similarityScore - a.similarityScore;
        }
        // If same score, prefer closer age match
        return a.differences.age - b.differences.age;
      })
      // Limit results
      .slice(0, limit)
      // Remove similarity metadata before sending
      .map(({ similarityScore, differences, ageMatch, heightMatch, weightMatch, ...biodata }) => biodata);
    
    res.status(200).json({
      success: true,
      data: scoredBiodatas,
      count: scoredBiodatas.length,
      criteria: {
        biodataType: currentBiodata.biodataType,
        ageRange: `${currentAge - ageRange} - ${currentAge + ageRange} years`,
        heightRange: `${(currentHeight - heightRange).toFixed(2)} - ${(currentHeight + heightRange).toFixed(2)} m`,
        weightRange: `${currentWeight - weightRange} - ${currentWeight + weightRange} kg`
      }
    });
    
  } catch (error) {
    console.error('Error fetching similar biodatas:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch similar biodatas',
      message: error.message
    });
  }
});

module.exports = initializeBiodataByIdRoutes;