export interface SMmessage {
    category: string;
    kind: string;
    name: string;
    body: object;
}

export interface ConversationRequest {
    input: { text: string };
    variables?: { [key: string]: any };
    optionalArgs?: { [key: string]: any };
    personaId?: string;
}

// This is the key interface that needs to change
export interface ConversationResponse {
    answer: string;
    answerAvailable: boolean;
}

// This is the format for sending WebSocket responses back to Soul Machines
export interface SMConversationResponse {
    category: string;
    kind: string;
    name: string;
    body: {
        personaId: string;
        variables?: { [key: string]: any };
        response: {
            answer: string;
            answerAvailable: boolean;
        }
    }
}

export interface SessionData {
    childName: string;
    parentName: string;
    interactions: number;
    conversationHistory: { officer: string; parent: string }[];
}