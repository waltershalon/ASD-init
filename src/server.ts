import express from 'express';
import * as WebSocket from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { app } from './controller';
import axios from 'axios';

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
                const speakResults = optionalArgs.speakResults === true;
                
                console.log(`User message: "${userMessage}", personaId: ${personaId}, turnId: ${turnId}, speakResults: ${speakResults}`);
                
                // Directly call the controller logic without using fetch
                try {
                    // Create a request to the same server but on the /conversation endpoint
                    const serverUrl = process.env.SERVER_URL;
                    const response = await axios.post(`${serverUrl}/conversation`, {
                        input: { text: userMessage },
                        personaId: personaId,
                        optionalArgs: optionalArgs
                    });
                    
                    console.log('Response from conversation endpoint:', response.data);
                    
                    // Send response back via WebSocket in the format Soul Machines expects
                    // Include all possible fields that Soul Machines might need
                    const wsResponse = {
                        category: 'scene',
                        kind: 'event',
                        name: 'conversationResponse',
                        body: {
                            personaId: personaId,
                            variables: {
                                Turn_Id: turnId
                            },
                            response: {
                                answer: response.data.answer,
                                text: response.data.answer, // Explicitly add text field
                                answerAvailable: true,
                                speakResults: true // Explicitly set to true
                            }
                        }
                    };
                    
                    console.log('Sending WebSocket response:', JSON.stringify(wsResponse));
                    ws.send(JSON.stringify(wsResponse));
                } catch (error) {
                    console.error('Error processing conversation request:', error);
                    
                    // Send an error response with all required fields
                    const errorResponse = {
                        category: 'scene',
                        kind: 'event',
                        name: 'conversationResponse',
                        body: {
                            personaId: personaId,
                            variables: {
                                Turn_Id: turnId
                            },
                            response: {
                                answer: "I'm sorry, I'm having trouble with my thoughts right now. Could we try again?",
                                text: "I'm sorry, I'm having trouble with my thoughts right now. Could we try again?",
                                answerAvailable: true,
                                speakResults: true
                            }
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