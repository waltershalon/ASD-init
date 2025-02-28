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

// Create WebSocket server, but don't intercept all WebSocket messages
const wss = new WebSocket.Server({ 
    server,
    // This handler will only upgrade connections that don't match Soul Machines paths
    verifyClient: (info) => {
        // Accept connections to the root path, which is what Soul Machines uses
        return true;
    }
});

wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    
    ws.on('message', (message: string) => {
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
                
                // Forward this to your controller logic
                // You may need to modify your controller to handle this request format
                fetch(`http://localhost:${PORT}/conversation`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        input: { text: userMessage },
                        personaId: personaId,
                        optionalArgs: msgData.body.optionalArgs || {}
                    })
                })
                .then(response => response.json())
                .then(data => {
                    console.log('Response from conversation endpoint:', data);
                    
                    // Convert the response to the format expected by Soul Machines
                    const wsResponse = {
                        category: 'scene',
                        kind: 'event',
                        name: 'conversationResponse',
                        body: {
                            personaId: personaId,
                            response: {
                                answer: data.answer,
                                answerAvailable: data.answerAvailable
                            }
                        }
                    };
                    
                    ws.send(JSON.stringify(wsResponse));
                })
                .catch(error => {
                    console.error('Error forwarding conversation request:', error);
                });
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