import express from 'express';
import * as WebSocket from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { app } from './controller';  // Import Express app from controller.ts

// Load environment variables from .env file
dotenv.config();
const PORT = process.env.PORT || 5050;

// Create HTTP server and integrate with Express
const server = createServer(app);

// WebSocket Server for Soul Machines
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {
    console.log('A new client connected.');

    ws.on('message', (message) => {
        console.log('Received WebSocket message:', message.toString());
        // WebSocket connections will be handled separately if needed
    });
});

// Start Express + WebSocket server
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}.`);
});
