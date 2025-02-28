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

// Changed to match the Soul Machines template
export interface ConversationResponse {
    input?: { text: string };
    output: { text: string };
    variables?: { [key: string]: any };
    fallback?: boolean;
}

export interface SessionData {
    childName: string;
    parentName: string;
    interactions: number;
    conversationHistory: { officer: string; parent: string }[];
}