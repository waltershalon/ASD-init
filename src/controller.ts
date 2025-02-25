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

import { ConversationRequest, ConversationResponse, SMmessage } from 'interfaces';
import * as WebSocket from 'ws';

export function handleMessage(ws: WebSocket, message: any) {
    try {
        const msg: SMmessage = JSON.parse(message);
        if (msg.name == 'conversationRequest') {
            let request: ConversationRequest = msg.body as ConversationRequest;
            handleRequest(ws, request);
        }
    } catch {
        console.log('Unrecognized message: ', message);
    }
}

export function handleRequest(ws: WebSocket, req: ConversationRequest) {
    console.log('Conv request: ', req);

    // Set a simple response
    let resp : ConversationResponse = {
        input: { text: req.input.text },
        output: { text: `Echo: ${req.input.text}` },
        variables: {}
    };

    // Handle welcome message
    if (req.optionalArgs?.kind == 'init') {
        resp.output.text = 'Hi there!';
    }

    // Set fallback response example (can be handled by skills in the project)
    if (req.input.text.toLowerCase().startsWith('why')) {
        resp.output.text = 'I do not know how to answer that';
        resp.fallback = true;
    }

    // SM content cards example
    if (req.input.text.toLowerCase() == 'show card') {
        resp.output.text = 'Here is a cat @showcards(cat)';
        resp.variables['public-cat'] = {
            'component': 'image',
            'data': {
                'alt': 'A cute kitten',
                'url': 'https://placekitten.com/300/300'
            }
        };
    }

    sendMessage(ws, resp);
}

function sendMessage(ws: WebSocket, resp: ConversationResponse) {
    let message: SMmessage = {
        category: 'scene',
        kind: 'request',
        name: 'conversationResponse',
        body: resp
    };

    ws.send(JSON.stringify(message));
}
