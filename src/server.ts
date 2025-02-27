import express from 'express';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { app } from './controller'; // Import the Express app from controller.ts

// Load environment variables from .env file
dotenv.config();

// Create HTTP Server
const server = createServer(app);

// Start Express Server
const port = process.env.PORT || process.env.PORT || 5050;
server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});