const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');

const { initializeAuthRoutes, verifyToken } = require('./routes/auth');
const initializeSuccessStoryRoutes = require('./routes/successStory');
const initializePaymentRoutes = require('./routes/payment');
const initializeUserRoutes = require('./routes/user');
const initializeBiodataRoutes = require('./routes/biodata');
const initializeBiodataByIdRoutes = require('./routes/biodataById');
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
const database = client.db("SoulTie");
const usersCollection = database.collection('users')
const biodatasCollection = database.collection('biodatas')
const favouritesCollection = database.collection('favourites')
const paymentCollection = database.collection('payment')
const successCollection = database.collection('success')


    // Initialize auth routes with database
    const authRoutes = initializeAuthRoutes(database);
    const successStoryRoutes = initializeSuccessStoryRoutes(database);
    const paymentRoutes = initializePaymentRoutes(database);
    const userRoutes = initializeUserRoutes(database);         
    const biodataRoutes = initializeBiodataRoutes(database);
    const biodataByIdRoutes = initializeBiodataByIdRoutes(database);
    // Mount routes
    app.use('/', authRoutes);
    app.use('/success', successStoryRoutes);
    app.use('/', paymentRoutes); //  payment routes api 
    app.use('/', userRoutes);  // user routes api 
    app.use('/', biodataRoutes); //  biodata routes api 
    app.use('/', biodataByIdRoutes); // ID-based biodata routes api 

    // Get premium biodatas in home 
    app.get('/premium-biodatas', async (req, res) => {
      try {
        const { sortBy, order } = req.query;
        let sortStage = {};
        if (sortBy && order) {
          const sortField = sortBy === 'age' ? 'Age' : sortBy;
          sortStage[sortField] = order === 'desc' ? -1 : 1;
        }
        
        // Use aggregation to join collections 
        const pipeline = [
          {
            $lookup: {
              from: 'users', 
              localField: 'ContactEmail',
              foreignField: 'email',
              as: 'userInfo'
            }
          },
          {
            $match: {
              'userInfo.type': 'premium'
            }
          },
          {
            $unset: 'userInfo' 
          }
        ];
        if (Object.keys(sortStage).length > 0) {
          pipeline.push({ $sort: sortStage });
        }
        
        const result = await biodatasCollection.aggregate(pipeline).toArray();
        
        res.status(200).json(result);
      } catch (error) {
        console.error('Error fetching premium biodatas:', error);
        res.status(500).json({ 
          error: 'Failed to fetch premium biodatas',
          message: error.message 
        });
      }
    });

    
        // add to favourites

    app.post('/favourites',async(req,res)=>{

      const favouriteData= req.body;
      const query ={"BiodataId":favouriteData.BiodataId}
      const res1 = await favouritesCollection.findOne(query);
      if(res1)return res.status(403).send({message:"forbidean accsss"})
      const result = await favouritesCollection.insertOne(favouriteData)
      res.send(result)
    })
      // get favourites data
    app.get('/favourites/:email',async(req,res)=>{

      const email = req.params.email;
      const query = {"useremail":email}
      const result = await favouritesCollection.find(query).toArray();
      res.send(result)
    })

    app.delete("/favourites/:id",async(req,res)=>{
      const  biodataId = parseInt(req.params.id);
      const query = {"BiodataId":biodataId}
    
      const result = await favouritesCollection.deleteOne(query)
      
      res.send(result)

    })


    //progrees-info in home 
    app.get('/progress-info', async (req, res) => {
      try {
        const [
          totalBiodata,
          maleData,
          femaleData,
          premiumData,
          userData,
          success
        ] = await Promise.all([
          biodatasCollection.estimatedDocumentCount(),
          biodatasCollection.countDocuments({ "biodataType": "male" }),
          biodatasCollection.countDocuments({ "biodataType": "female" }),
          usersCollection.countDocuments({ "type": "premium" }),
          usersCollection.countDocuments(),
          successCollection.countDocuments()
        ]);
        res.json({
          success: true,
          data: {

            biodata: totalBiodata,
            maleData,
            femaleData,
            premiumData,
            userData,
            success,
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
          usersCollection.countDocuments({ "type": "premium" }),
          paymentCollection.aggregate([
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: "$amount" }
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

app.get( '/' ,(req,res)=>{
    res.send('soultie running');
})

app.listen(port,()=>{
    console.log(`soultie is running on:${port}`);
})