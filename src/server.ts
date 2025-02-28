import express from 'express';
import * as WebSocket from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { app } from './controller';
import axios from 'axios';

// Load environment variables from .env file
dotenv.config();
const PORT = process.env.PORT || 5050;

// Create HTTP server and integrate with Express
const server = createServer(app);

// WebSocket Server for Soul Machines
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    
    ws.on('message', async (message) => {
        try {
            const msgStr = message.toString();
            console.log('Received WebSocket message:', msgStr);
            
            // Parse the message to see if it contains a conversation request
            const msgData = JSON.parse(msgStr);
            
            if (msgData.category === 'scene' && msgData.kind === 'event' && msgData.name === 'conversationRequest') {
                // This is a Soul Machines conversation request
                console.log('Soul Machines conversation request detected via WebSocket');
                
                // Extract the essential data from the request
                const userMessage = msgData.body.input?.text || '';
                const personaId = msgData.body.personaId || '1';
                const turnId = msgData.body.variables?.Turn_Id || '';
                const optionalArgs = msgData.body.optionalArgs || {};
                
                // Directly call the controller logic without using fetch
                try {
                    // Create a request to the same server but on the /conversation endpoint
                    const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
                    const response = await axios.post(`${serverUrl}/conversation`, {
                        input: { text: userMessage },
                        personaId: personaId,
                        optionalArgs: optionalArgs
                    });
                    
                    console.log('Response from conversation endpoint:', response.data);
                    
                    // Send response back via WebSocket in the format Soul Machines expects
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
                                answerAvailable: true
                            }
                        }
                    };
                    
                    console.log('Sending WebSocket response:', JSON.stringify(wsResponse));
                    ws.send(JSON.stringify(wsResponse));
                } catch (error) {
                    console.error('Error processing conversation request:', error);
                    
                    // Send an error response
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
                                answerAvailable: true
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