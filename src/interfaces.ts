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

export interface SMmessage {
    category: string;
    kind: string;
    name: string;
    body: object;
}

export interface ConversationRequest {
    input: { text: string };
    variables?: { [key: string]: any; };
    optionalArgs?: { [key: string]: any; };
}

export interface ConversationResponse {
    input?: { text: string };
    output: { text: string };
    variables?: { [key: string]: any; };
    fallback?: boolean;
}
