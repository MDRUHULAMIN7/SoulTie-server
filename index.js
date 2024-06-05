const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
// midleware

app.use(cors());
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
const
favouritesCollection = datbase.collection('favourites')
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
    // payment intent 

   
    // post user data 
    app.post('/users',async(req,res)=>{
      const user =req.body;
      const query = {email:user.email}
      const isExist = await usersCollection.findOne(query)
      if(isExist) return res.send({message:'user already exist !'})
      const result = await usersCollection.insertOne(user)

      res.send(result)
    })

    // get all users
    app.get('/manageusers',async(req,res)=>{
      const result = await usersCollection.find().toArray();
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
    // update user roll ;

    app.patch('/userupdate/:id',async (req,res)=>{
      const updateroll =req.body.updaterole;
      const id = req.params.id;
      const query ={_id: new ObjectId(id)}
     const  updateDoc ={
      $set:{
        roll:updateroll
      }
     }
     const result = await usersCollection.updateOne(query,updateDoc);
     res.send(result)
      console.log(updateroll,id);
    })

    // user update to premium
    app.patch('/userupdatepremium/:id',async (req,res)=>{
      const updateroll =req.body.updaterole;
      const id = req.params.id;
      const query ={_id: new ObjectId(id)}
     const  updateDoc ={
      $set:{
        role:updateroll
      }
     }
     const result = await usersCollection.updateOne(query,updateDoc);
     res.send(result)
      console.log(updateroll,id);
    })

    // add biodata 

    app.put('/biodatas',async(req,res)=>{
      const biodata=req.body;
        //  console.log(biodata.ContactEmail);
        const options={upsert:true}
        const data ={
          $set:{
            role:biodata.role,
            name:biodata.name,
            photo:biodata.photo, 
            biodataType:biodata.biodataType,
            birthDate:biodata.birthDate,
        Height:biodata.Height,
        Weight:biodata.Weight,
        Age:biodata.Age,
        Occupation:biodata.Occupation,
        Race:biodata.Race,
        FatherName:biodata.FatherName,
        MotherName:biodata.MotherName,
        ParmanentDivison:biodata.ParmanentDivison,
        PresentDivison:biodata.PresentDivison,
        PartnerAge:biodata.PartnerAge,
        ParnerHeight:biodata.ParnerHeight,
        PartnerWeight:biodata.PartnerWeight,
        ContactEmail:biodata.ContactEmail,
        MobileNumber:biodata.MobileNumber,
        biodataId:biodata.biodataId
          }
        }
      const query ={"ContactEmail" :biodata?.ContactEmail}
      console.log(query);
    
      const result = await biodatasCollection.updateOne(query,data,options);

      res.send(result)
    })

    // get my biodata
    app.get('/view-biodatas/:email',async(req,res)=>{
      const email = req.params.email;
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
    app.get('/biodatas',async (req,res)=>{
      const result = await biodatasCollection.find().toArray();
      

      res.send([result])
    })
    // get premium biodatas
    app.get('/premium-biodatas',async (req,res)=>{
     const roles="premium"
      const query={"role":roles}
      const result = await biodatasCollection.find(query).toArray();
      

      res.send([result])
    })
    // filter oremium acending

    app.get('/getbyage-premium',async(req,res)=>{
      const role="premium"
      const query = {"role":role };

      const result = await biodatasCollection.find(query).sort({"Age" : 1}).toArray();
      // console.log(result);
      res.send(result)
    })
    // filter oremium deacending

    app.get('/getbyage-premium-des',async(req,res)=>{
      const role="premium"
      const query = {"role":role };

      const result = await biodatasCollection.find(query).sort({"Age" : -1}).toArray();
      // console.log(result);
      res.send(result)
    })


    // update biodata roll ;

    app.patch('/biodataupdate/:id',async (req,res)=>{
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


    // add to favourites

    app.post('/favourites',async(req,res)=>{

      const favouriteData= req.body;
      const query ={"BiodataId":favouriteData.BiodataId}
      const res1 = await favouritesCollection.findOne(query);
   
      if(res1)return res.status(403).send({message:"forbidean accsss"})
      console.log(favouriteData);
      const result = await favouritesCollection.insertOne(favouriteData)
      res.send(result)
    })

    // get favourites dataa

    app.get('/favourites/:email',async(req,res)=>{

      const email = req.params.email;
      console.log(email);
      const query = {"useremail":email}
      console.log(query);
      const result = await favouritesCollection.find(query).toArray();
      console.log(result);
      res.send(result)
    })
    app.delete("/favourites/:id",async(req,res)=>{
      const  biodataId = parseInt(req.params.id);
      const query = {"BiodataId":biodataId}
      console.log(query);
      const result = await favouritesCollection.deleteOne(query)
      console.log(result);
      res.send(result)

    })
  
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
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
    console.log(`soultie is running von:${port}`);
})