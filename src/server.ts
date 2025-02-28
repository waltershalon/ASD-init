import express from 'express';
import * as WebSocket from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { app } from './controller';
import axios from 'axios';
import { SMmessage, ConversationRequest, ConversationResponse } from './interfaces';

// Load environment variables from .env file
dotenv.config();
const PORT = process.env.PORT || 5050;

// Check critical environment variables
if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: Missing OPENAI_API_KEY in environment variables');
    process.exit(1);
}

if (!process.env.SERVER_URL) {
    console.warn('WARNING: Missing SERVER_URL in environment variables. Using localhost.');
    process.env.SERVER_URL = `http://localhost:${PORT}`;
}

console.log('Environment variables loaded successfully.');
console.log(`Server URL: ${process.env.SERVER_URL}`);

// Create HTTP server and integrate with Express
const server = createServer(app);

// WebSocket Server for Soul Machines
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    
    ws.on('message', async (message) => {
        try {
            const msgStr = message.toString();
            console.log('Raw WebSocket message received:', msgStr.substring(0, 200) + '...');
            
            const msgData = JSON.parse(msgStr);
            
            if (msgData.category === 'scene' && msgData.kind === 'event' && msgData.name === 'conversationRequest') {
                console.log('Soul Machines conversation request detected via WebSocket');
                
                // Extract the essential data from the request
                const userMessage = msgData.body.input?.text || '';
                const personaId = msgData.body.personaId || '1';
                const turnId = msgData.body.variables?.Turn_Id || '';
                const optionalArgs = msgData.body.optionalArgs || {};
                
                console.log(`User message: "${userMessage}", personaId: ${personaId}, turnId: ${turnId}`);
                
                // Create the request for the controller
                const request: ConversationRequest = {
                    input: { text: userMessage },
                    optionalArgs: optionalArgs
                };
                
                try {
                    // Call the conversation endpoint
                    const serverUrl = process.env.SERVER_URL;
                    const response = await axios.post(`${serverUrl}/conversation`, request);
                    
                    console.log('Response from conversation endpoint:', response.data);
                    
                    // Create response object exactly as in Soul Machines template
                    // Make sure to include Turn_Id from the original request
                    const resp: ConversationResponse = response.data;
                    
                    // Add Turn_Id to variables if it exists in the original request
                    if (turnId) {
                        if (!resp.variables) {
                            resp.variables = {};
                        }
                        resp.variables.Turn_Id = turnId;
                    }
                    
                    // Format exactly as in Soul Machines template
                    const wsResponse: SMmessage = {
                        category: 'scene',
                        kind: 'request',
                        name: 'conversationResponse',
                        body: resp  // Use the entire response as the body
                    };
                    
                    console.log('Sending WebSocket response:', JSON.stringify(wsResponse));
                    ws.send(JSON.stringify(wsResponse));
                } catch (error) {
                    console.error('Error processing conversation request:', error);
                    
                    // Send an error response in the correct format
                    const errorResponse: SMmessage = {
                        category: 'scene',
                        kind: 'request',
                        name: 'conversationResponse',
                        body: {
                            input: { text: userMessage },
                            output: { text: "I'm sorry, I'm having trouble with my thoughts right now. Could we try again?" },
                            variables: turnId ? { Turn_Id: turnId } : {}
                        }
                    };
                    
                    ws.send(JSON.stringify(errorResponse));
                }
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });
    
    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

// Start Express + WebSocket server
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}.`);
});