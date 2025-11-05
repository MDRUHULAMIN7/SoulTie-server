const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// midleware

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5000",
      "https://soul-tie-server.vercel.app",
      "https://soultie.web.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE","PATCH"],
    credentials: true,
  })

);
app.use(express.json());


// mongodb




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.aymctjj.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {


    // datbase collections
const datbase = client.db("SoulTie");
const usersCollection = datbase.collection('users')
const biodatasCollection = datbase.collection('biodatas')
const favouritesCollection = datbase.collection('favourites')
const paymentCollection = datbase.collection('payment')
const successCollection = datbase.collection('success')
// 
   // create jwt token 
   app.post('/jwt',async(req,res)=>{
    const user = req.body;
    console.log(user);
    const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn : '1d'
    })
  

    res.send({token})
 
})

// 
// verify and create token

const verifyToken =(req,res,next)=>{

    if(req.headers.authorization){
        return res.status(401).send({Message:"forbidean access"})
    }
    const token =req.headers.authorization;

    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if(err){
            return res.status(401).send({Message:"forbiden access"})
        }

        req.decoded = decoded
        next()
    })
}
    //

    // 
    // success story post 
     app.post('/success',async(req,res)=>{
       const data = req.body;
        console.log(data);
       const result= await successCollection.insertOne(data)
       res.send(result)
     })
  // Backend API Route with Pagination
app.get('/success', async (req, res) => {
  try {
    // Get pagination parameters from query string
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const sortBy = req.query.sortBy || '_id';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search || '';

    console.log('API Params:', { page, limit, sortBy, sortOrder, search }); // Debug log

    // Build filter query
    const filter = {};
    if (search) {
      filter.$or = [
        { shortStory: { $regex: search, $options: 'i' } },
        { SelfBiodata: { $regex: search, $options: 'i' } },
        { PartnerBiodata: { $regex: search, $options: 'i' } }
      ];
    }

    // Get total count for pagination info
    const totalStories = await successCollection.countDocuments(filter);
    console.log('Total stories:', totalStories); // Debug log
    
    let stories;
    let totalPages;
    let showing;

    if (limit === -1) {
      // Get all data if limit is -1
      stories = await successCollection
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .toArray();
      
      totalPages = 1;
      showing = stories.length;
    } else {
      // Calculate skip value for pagination
      const skip = (page - 1) * limit;
      totalPages = Math.ceil(totalStories / limit);
      
      // Get paginated data
      stories = await successCollection
        .find(filter)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      showing = stories.length;
    }

    console.log('Returning stories:', stories.length); // Debug log
    console.log('Pagination data:', { 
      currentPage: page, 
      totalPages, 
      totalStories, 
      showing 
    }); // Debug log

    // Send response with proper structure
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
    // post user data 
    app.post('/users',async(req,res)=>{
      const user =req.body;
      const query = {email:user.email}
      const isExist = await usersCollection.findOne(query)
      if(isExist) return res.send({message:'user already exist !'})
      const result = await usersCollection.insertOne(user)

      res.send(result)
    })

    // get admin user data

    app.get('/users/admin/:email',verifyToken,async (req,res)=>{
      const email= req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message:"unauthorization access"})
      }
      const query = {email: email};

      const user = await usersCollection.findOne(query)
      let admin = false;
      if(user){
        admin =user?.role === "admin"
      }
      res.send({admin})
    })

    // get all user data

    app.get('/user/:email',async(req,res)=>{
      const email = req.params.email;
      const query={email : email}
      const result = await usersCollection.findOne(query)
      res.send(result)
    })


//**  admin -> manageuser api 

app.get('/manageusers', async (req, res) => {
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
app.patch('/userupdate/:id', async (req, res) => {
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
app.patch('/userupdatepremium/:id', async (req, res) => {
  try {
    const { updaterole } = req.body;
    const id = req.params.id;
    
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        type: updaterole
      }
    };
    console.log(query)
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
//** 


    // add biodata /edit biodata

app.put('/biodatas', async (req, res) => {
  try {
    const biodata = req.body;
    const query = { "ContactEmail": biodata?.ContactEmail };
    
    // Check if biodata already exists
    const existingBiodata = await biodatasCollection.findOne(query);
    
    const options = { upsert: true };
    
    // Prepare the update data
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
      
      console.log('Creating new biodata with ID:', nextBiodataId);
    } else {
      // If biodata exists, keep the existing biodataId and createdAt
      updateData.biodataId = existingBiodata.biodataId;
      updateData.createdAt = existingBiodata.createdAt;
      updateData.role = existingBiodata.role || 'normal';
      
      console.log('Updating existing biodata with ID:', existingBiodata.biodataId);
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
app.get('/biodatas/email/:email', async (req, res) => {
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
    // get my biodata
app.get('/view-biodatas/:email',async(req,res)=>{
      const  email = req.params.email;
      const query ={"ContactEmail":email};
      const result = await biodatasCollection.findOne(query)
      res.send(result)
    })

    // updata biodata roll

    app.patch('/biodataupdatepremium/:id',async (req,res)=>{
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
      console.log(updateroll,id);
    })

    // get biodatas

app.get('/biodatas', async (req, res) => {
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
// Bonus endpoint for filter options
app.get('/biodatas/filter-options', async (req, res) => {
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
// get similar biodata
app.get('/biodatas/:id/similar', async (req, res) => {
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







// COMPLETE BACKEND API FOR PAYMENT WORKFLOW


// 1. Create payment intent for Stripe
app.post('/create-payment-intent', async (req, res) => {
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
app.post('/payment', async (req, res) => {
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
app.get('/check-biodata-access', async (req, res) => {
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

app.get('/payments', async (req, res) => {
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

    // Get payments with pagination
    const payments = await paymentCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .toArray();

    const totalItems = await paymentCollection.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limitNumber);

    // Check if population is requested (default to true for backward compatibility)
    const shouldPopulate = populate !== 'false';

    let populatedPayments = payments;

    if (shouldPopulate) {
      // Populate user and biodata information
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

          // Return payment with populated data, keeping all original fields
          return {
            ...payment, // Keep all original payment fields
            user: userData, // Add populated user data
            biodata: biodataData // Add populated biodata data
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

app.put('/payment/update-status', async (req, res) => {
  try {
    const { paymentId, newStatus } = req.body;
    console.log('=== Payment Status Update Started ===');
    console.log('Request:', { paymentId, newStatus });
    
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
    const userId = payment.userId.toString(); // Keep as string for consistency
    const biodataId = payment.biodataId.toString();
    
    console.log('Payment Info:', { 
      paymentId,
      userId, 
      biodataId,
      oldStatus,
      newStatus
    });

    // If status is not changing, return early
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

    // console.log('Biodata Found:', {
    //   biodataId: biodata.biodataId,
    //   name: biodata.name,
    //   hasRequest: biodata.hasRequest || [],
    //   hasAccess: biodata.hasAccess || []
    // });

    // Convert all array values to strings for consistent comparison
    const currentHasRequest = (biodata.hasRequest || []).map(id => id.toString());
    const currentHasAccess = (biodata.hasAccess || []).map(id => id.toString());

    // console.log('Normalized Arrays:', {
    //   hasRequest: currentHasRequest,
    //   hasAccess: currentHasAccess
    // });

    // Manual array manipulation to ensure data type consistency
    let updatedHasRequest = [...currentHasRequest];
    let updatedHasAccess = [...currentHasAccess];

    if (newStatus === 'approved') {
      // APPROVED: Remove from hasRequest and add to hasAccess
      updatedHasRequest = currentHasRequest.filter(id => id !== userId);
      if (!updatedHasAccess.includes(userId)) {
        updatedHasAccess.push(userId);
      }
      
    } else if (newStatus === 'rejected') {
      // REJECTED: Remove from hasRequest only
      updatedHasRequest = currentHasRequest.filter(id => id !== userId);
      
    } else if (newStatus === 'pending') {
      if (oldStatus === 'approved') {
        // Was approved, now pending: Remove from hasAccess, Add to hasRequest
        updatedHasAccess = currentHasAccess.filter(id => id !== userId);
        if (!updatedHasRequest.includes(userId)) {
          updatedHasRequest.push(userId);
        }
      } else {
        // Was rejected or new, now pending: Add to hasRequest
        if (!updatedHasRequest.includes(userId)) {
          updatedHasRequest.push(userId);
        }
      }
    }

    // Update biodata with the new arrays
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

    // Verify the update by fetching the updated biodata
    const updatedBiodata = await biodatasCollection.findOne({ _id: biodata._id });

    // Update payment status
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
app.get('/payments/status', async (req, res) => {
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

    // Find payment by ObjectIds
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
app.get('/reqbiodatas-payment/:biodataId', async (req, res) => {
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













//premium biodata
app.get('/premium-biodatas', async (req, res) => {
  try {
    const { sortBy, order } = req.query;
    
    // Base query for premium members
    const query = { role: "premium" };
    
    // Build sort options
    let sortOptions = {};
    if (sortBy && order) {
      const sortField = sortBy === 'age' ? 'Age' : sortBy;
      sortOptions[sortField] = order === 'desc' ? -1 : 1;
    }
    
    // Execute query with optional sorting
    const result = await biodatasCollection
      .find(query)
      .sort(sortOptions)
      .toArray();
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching premium biodatas:', error);
    res.status(500).json({ 
      error: 'Failed to fetch premium biodatas',
      message: error.message 
    });
  }
});

    // update biodata roll ;

    app.patch('/biodataupdate/:email',async (req,res)=>{
      const updateroll =req.body.updaterole;
      const email = req.params.email;
      const query ={email}

     const  updateDoc ={
      $set:{
        type:updateroll
      }
     }
     const result = await usersCollection.updateOne(query,updateDoc);
     res.send(result)
      console.log(updateroll,email);
    })

    // app.get /getbyage

    app.get('/getbyage',async(req,res)=>{
      const Age1=req.query.age1;
      const Age2=req.query.age2;
      console.log(Age1,Age2);
      const query = {
        Age:{ $gte:Age1,$lte:Age2}
      };

      const result = await biodatasCollection.find(query).toArray();
      res.send(result)
    })

    // data divison

    app.get('/getdivison',async(req,res)=>{
      const divison = req.query.r;
      const query ={ "ParmanentDivison":divison}
        const result = await biodatasCollection.find(query).toArray();
        res.send(result)

   
    })
    // detail data by id 

    app.get('/biodatas/:id',async(req,res)=>{
      const id = req.params.id;
      const query={_id:new ObjectId(id)}
      const result = await biodatasCollection.findOne(query)
      res.send(result)
  
    })





    
    // /  ................ get my request 

  app.get('/payment/:email', async (req, res) => {
  try {
    const email = req.params.email;
    
    console.log('=== Fetching Contact Requests ===');
    console.log('User Email:', email);

    // Get user by email
    const user = await usersCollection.findOne({ email: email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userId = user._id;
    console.log('User ID:', userId.toString());

    // Find ALL payments for this user (approved, rejected, pending)
    const payments = await paymentCollection
      .find({ userId: userId })
      .toArray();

    console.log(`Found ${payments.length} payments for user`);

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

    console.log('=== Contact Requests Fetched Successfully ===');
    
    res.status(200).json({
      success: true,
      data: populatedPayments
    });
  } catch (error) {
    console.error('=== Error Fetching Contact Requests ===');
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contact requests',
      error: error.message
    });
  }
});

// DELETE: Remove payment and update biodata arrays
app.delete('/payment-delete/:id', async (req, res) => {
  try {
    const paymentId = req.params.id;
    
    console.log('=== Deleting Contact Request ===');
    console.log('Payment ID:', paymentId);

    // Get payment document to find userId, biodataId, and status
    const payment = await paymentCollection.findOne({ 
      _id: new ObjectId(paymentId) 
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    const userId = payment.userId;
    const biodataId = payment.biodataId;
    const paymentStatus = payment.status;

    console.log('Payment Info:', {
      userId: userId.toString(),
      biodataId: biodataId.toString(),
      status: paymentStatus
    });

    // Get biodata document
    const biodata = await biodatasCollection.findOne({ _id: biodataId });
    
    if (!biodata) {
      console.log('Warning: Biodata not found, but continuing with payment deletion');
    }

    // Determine which array to update based on payment status
    let biodataUpdate = {};
    let arrayName = '';

    if (paymentStatus === 'approved') {
      // Remove from hasAccess array
      biodataUpdate = {
        $pull: { hasAccess: userId },
        $set: { updatedAt: new Date() }
      };
      arrayName = 'hasAccess';
      console.log('Removing user from hasAccess array');
      
    } else if (paymentStatus === 'pending') {
      // Remove from hasRequest array
      biodataUpdate = {
        $pull: { hasRequest: userId },
        $set: { updatedAt: new Date() }
      };
      arrayName = 'hasRequest';
      console.log('Removing user from hasRequest array');
      
    } else if (paymentStatus === 'rejected') {
      // For rejected, user shouldn't be in any array, but check both just in case
      biodataUpdate = {
        $pull: { 
          hasRequest: userId,
          hasAccess: userId
        },
        $set: { updatedAt: new Date() }
      };
      arrayName = 'hasRequest and hasAccess';
      console.log('Removing user from both arrays (rejected status)');
    }

    // Update biodata arrays
    if (biodata) {
      const biodataUpdateResult = await biodatasCollection.updateOne(
        { _id: biodataId },
        biodataUpdate
      );

      console.log('Biodata Update Result:', {
        matchedCount: biodataUpdateResult.matchedCount,
        modifiedCount: biodataUpdateResult.modifiedCount
      });
    }

    // Delete payment document
    const deleteResult = await paymentCollection.deleteOne({ 
      _id: new ObjectId(paymentId) 
    });

    console.log('Payment Delete Result:', {
      deletedCount: deleteResult.deletedCount
    });

    if (deleteResult.deletedCount > 0) {
      console.log('=== Contact Request Deleted Successfully ===');
      
      res.status(200).json({
        success: true,
        message: `Payment deleted and user removed from biodata's ${arrayName} array`,
        deletedCount: deleteResult.deletedCount
      });
    } else {
      throw new Error('Failed to delete payment');
    }

  } catch (error) {
    console.error('=== Error Deleting Contact Request ===');
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete contact request',
      error: error.message
    });
  }
});


    // get favourites dataa
        // add to favourites

    app.post('/favourites',async(req,res)=>{

      const favouriteData= req.body;
      const query ={"BiodataId":favouriteData.BiodataId}
      const res1 = await favouritesCollection.findOne(query);
   
      if(res1)return res.status(403).send({message:"forbidean accsss"})
      // console.log(favouriteData);
      const result = await favouritesCollection.insertOne(favouriteData)
      res.send(result)
    })

    app.get('/favourites/:email',async(req,res)=>{

      const email = req.params.email;
      // console.log(email);
      const query = {"useremail":email}
      // console.log(query);
      const result = await favouritesCollection.find(query).toArray();
      res.send(result)
    })
    app.delete("/favourites/:id",async(req,res)=>{
      const  biodataId = parseInt(req.params.id);
      const query = {"BiodataId":biodataId}
    
      const result = await favouritesCollection.deleteOne(query)
      
      res.send(result)

    })

 // admin-info 
app.get('/admin-info', async (req, res) => {
  try {
    const [
      totalBiodata,
      maleData,
      femaleData,
      premiumData,
      revenueResult
    ] = await Promise.all([
      biodatasCollection.estimatedDocumentCount(),
      biodatasCollection.countDocuments({ "biodataType": "male" }),
      biodatasCollection.countDocuments({ "biodataType": "female" }),
      biodatasCollection.countDocuments({ "role": "premium" }),
      paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$price" }
          }
        }
      ]).toArray()
    ]);

    const revenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    res.json({
      success: true,
      data: {
        revenue,
        biodata: totalBiodata,
        maleData,
        femaleData,
        premiumData,
        lastUpdated: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching admin info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch admin statistics',
      message: error.message
    });
  }
});
  
    console.log("SoulTie is successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
   
  }
}
run().catch(console.dir);

// 


app.get( '/' ,(req,res)=>{
    res.send('soultie running');
})

app.listen(port,()=>{
    console.log(`soultie is running on:${port}`);
})