const express = require('express');
const jwt = require('jsonwebtoken');
const { MongoClient, ObjectId } = require('mongodb');
const router = express.Router();

// Initialize MongoDB collection (you'll need to pass this from main file)
let usersCollection;

// Initialize the auth routes with database connection
const initializeAuthRoutes = (db) => {
  usersCollection = db.collection('users');
  return router;
};

// Create jwt token 
router.post('/jwt', async (req, res) => {
  const user = req.body;
  console.log(user);
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: '1d'
  });
  res.send({ token });
});

// Verify token middleware
const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "forbidden access" });
  }
  
  const token = req.headers.authorization;

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
};

// Get admin user data
router.get('/users/admin/:email', verifyToken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) {
    return res.status(403).send({ message: "unauthorized access" });
  }
  
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  let admin = false;
  
  if (user) {
    admin = user?.role === "admin";
  }
  
  res.send({ admin });
});

// Get user data by email
router.get('/user/:email', async (req, res) => {
  const email = req.params.email;
  const query = { email: email };
  const result = await usersCollection.findOne(query);
  res.send(result);
});

// Post user data (registration)
router.post('/users', async (req, res) => {
  const user = req.body;
  const query = { email: user.email };
  const isExist = await usersCollection.findOne(query);
  
  if (isExist) return res.send({ message: 'user already exist!' });
  
  const result = await usersCollection.insertOne(user);
  res.send(result);
});

// Export both router and middleware
module.exports = {
  initializeAuthRoutes,
  verifyToken
};