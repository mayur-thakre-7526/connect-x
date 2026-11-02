const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db.js");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to Connect-X API!",
    status: "Server is running",
  });
});

// Start server after connecting to MongoDB
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`Connect-X backend running on port ${PORT}`);
  });
};

startServer();
