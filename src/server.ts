//Copyright 2024 Soul Machines Ltd

//Licensed under the Apache License, Version 2.0 (the "License");
//you may not use this file except in compliance with the License.
//You may obtain a copy of the License at

//http://www.apache.org/licenses/LICENSE-2.0

//Unless required by applicable law or agreed to in writing, software
//distributed under the License is distributed on an "AS IS" BASIS,
//WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//See the License for the specific language governing permissions and
//limitations under the License.

import express from 'express';
import * as WebSocket from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { handleMessage } from './controller';

// Load environment variables from .env file
dotenv.config();
const PORT = process.env.EXPRESS_PORT || 5050;

// Initialize application
const app = express();
const server = createServer(app);

// WebSocket Server
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws: WebSocket) => {
    console.log('A new client Connected');
    
    ws.on('message', (message) => {
        handleMessage(ws, message);
    });
});

// Express Server

server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}.`);
});
