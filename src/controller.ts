import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

// Initialize OpenAI client with API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Express
const app = express();
app.use(express.json());
app.use(cors());

// Add logging middleware for debugging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.url}`);
  if (req.method === 'POST' && (req.url === '/chat' || req.url === '/conversation')) {
    console.log('Request body:', JSON.stringify(req.body));
  }
  next();
});

// Map to store session details
const sessions = new Map<string, { 
    childName: string,
    parentName: string,
    interactions: number, 
    conversationHistory: { officer: string, parent: string }[] 
}>();

// Generate random names for the parent and child
async function generateNames(): Promise<{parentName: string, childName: string}> {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [{ role: "system", content: "Generate a random parent name and a child name in JSON format: {\"parentName\": \"[name]\", \"childName\": \"[name]\"}" }],
            max_tokens: 50
        });

        const content = response.choices[0].message.content.trim();
        try {
            const names = JSON.parse(content);
            return {
                parentName: names.parentName || "Alex",
                childName: names.childName || "Jordan"
            };
        } catch (error) {
            console.error("Error parsing names JSON:", error);
            return { parentName: "Alex", childName: "Jordan" };
        }
    } catch (error) {
        console.error("Error generating names:", error);
        return { parentName: "Alex", childName: "Jordan" };
    }
}

// Basic healthcheck endpoint
app.get('/', (req, res) => {
    res.send('Autism Awareness Training API is running');
});

// Ping endpoint for testing
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Soul Machines specific conversation endpoint
app.post('/conversation', async (req, res) => {
    console.log('Received Soul Machines conversation request:', JSON.stringify(req.body));
    
    const userMessage = req.body.input?.text || '';
    const sessionId = req.body.personaId?.toString() || 'default';
    
    if (!userMessage && req.body.optionalArgs?.kind === 'init') {
        // This is an initialization request, send a greeting
        console.log('Initialization request detected');
        res.json({
            answer: "Hi, I'm a parent of a child with autism. Feel free to ask me any questions about my experiences or how to better interact with individuals who have autism.",
            answerAvailable: true
        });
        return;
    }
    
    // Process the conversation normally
    try {
        let sessionData = sessions.get(sessionId);
        if (!sessionData) {
            const names = await generateNames();
            sessionData = { 
                parentName: names.parentName,
                childName: names.childName,
                interactions: 0, 
                conversationHistory: [] 
            };
            sessions.set(sessionId, sessionData);
            console.log(`New session created: ${sessionId}, parent: ${names.parentName}, child: ${names.childName}`);
        }

        sessionData.conversationHistory.push({ officer: userMessage, parent: "" });

        const conversationContext = sessionData.conversationHistory.map(entry => 
            `Officer: ${entry.officer}\nParent: ${entry.parent}`
        ).join('\n');

        const systemPrompt = `
            You are ${sessionData.parentName}, the parent of ${sessionData.childName} who has autism. 
            You are speaking with a police officer who is seeking to understand how to better interact with 
            individuals who have autism. Your role is to educate the officer based on your experiences with your child.

            About your child:
            - ${sessionData.childName} is 8 years old and was diagnosed with autism at age 4
            - ${sessionData.childName} has the following autism characteristics:
              - Struggles with verbal communication and sometimes uses alternative communication methods
              - Has sensory sensitivities, especially to loud noises and bright lights
              - Becomes overwhelmed in new environments or during unexpected changes to routine
              - May not respond to their name or make eye contact
              - Engages in self-stimulatory behaviors (stimming) like rocking or hand-flapping when stressed
              - Has meltdowns when overwhelmed that can look like tantrums but are actually due to sensory overload

            As a parent, you:
            - Are knowledgeable about autism but speak from personal experience, not as a clinical expert
            - Want to help the officer understand how to approach and communicate with people who have autism
            - Can share real-life examples of challenges and successes
            - Are willing to explain common misunderstandings about autism
            - Want to emphasize that people with autism are individuals with unique needs
            - Are concerned about how emergency responders might interact with your child or others with autism

            Guidelines for your responses:
            - Speak naturally as a concerned and knowledgeable parent, not as an AI
            - Use conversational language and a personal tone
            - Share practical examples from your experience with ${sessionData.childName}
            - Provide specific suggestions for how officers might better handle interactions
            - Be respectful but direct about what works and what doesn't
            - Never break character or reveal you are not a real parent
            - Wait for the officer to ask questions before providing information
            - Keep your answers consistent throughout the conversation
            - Respond with concise, practical insights rather than academic explanations
            - Keep responses relatively short (2-3 sentences) as this is for a virtual character

            Previous conversation:
            ${conversationContext}
            
            Officer: ${userMessage}
            Parent:
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            max_tokens: 200
        });

        const responseText = response.choices[0].message.content || "I'm not sure how to respond to that.";

        if (responseText.includes("Sorry") || responseText.trim() === "" || responseText.includes("AI") || responseText.includes("language model")) {
            console.log("Response contains filtered content, sending fallback");
            res.json({ 
                answer: "I'm just trying to share what I've experienced with my child. Can you clarify what you'd like to know about raising a child with autism?",
                answerAvailable: true
            });
            return;
        }

        sessionData.conversationHistory[sessionData.conversationHistory.length - 1].parent = responseText;
        sessionData.interactions++;
        if (sessionData.interactions >= 70) {
            sessions.delete(sessionId);
        }

        console.log("Sending Soul Machines response:", responseText);
        res.json({ 
            answer: responseText,
            answerAvailable: true
        });

    } catch (error) {
        console.error("Error in Soul Machines conversation:", error);
        res.json({ 
            answer: "I'm sorry, I'm having trouble organizing my thoughts right now. Could you give me a moment?",
            answerAvailable: true
        });
    }
});

// Legacy /chat endpoint - handles both Soul Machines and regular requests
app.post('/chat', async (req, res) => {
    console.log('Received chat request:', JSON.stringify(req.body));
    
    // Check if this is a Soul Machines request
    if (req.body.input && req.body.personaId) {
        console.log('Detected Soul Machines request format in /chat endpoint');
        
        const userMessage = req.body.input.text || '';
        const sessionId = req.body.personaId.toString() || 'default';
        
        // Handle Soul Machines initialization message
        if (!userMessage && req.body.optionalArgs?.kind === 'init') {
            console.log('Soul Machines initialization request detected in /chat endpoint');
            res.json({
                answer: "Hi, I'm a parent of a child with autism. Feel free to ask me any questions about my experiences or how to better interact with individuals who have autism.",
                answerAvailable: true
            });
            return;
        }

        try {
            let sessionData = sessions.get(sessionId);
            if (!sessionData) {
                const names = await generateNames();
                sessionData = { 
                    parentName: names.parentName,
                    childName: names.childName,
                    interactions: 0, 
                    conversationHistory: [] 
                };
                sessions.set(sessionId, sessionData);
            }

            sessionData.conversationHistory.push({ officer: userMessage, parent: "" });

            const conversationContext = sessionData.conversationHistory.map(entry => 
                `Officer: ${entry.officer}\nParent: ${entry.parent}`
            ).join('\n');

            const systemPrompt = `
                You are ${sessionData.parentName}, the parent of ${sessionData.childName} who has autism. 
                You are speaking with a police officer who is seeking to understand how to better interact with 
                individuals who have autism. Your role is to educate the officer based on your experiences with your child.

                About your child:
                - ${sessionData.childName} is 8 years old and was diagnosed with autism at age 4
                - ${sessionData.childName} has the following autism characteristics:
                  - Struggles with verbal communication and sometimes uses alternative communication methods
                  - Has sensory sensitivities, especially to loud noises and bright lights
                  - Becomes overwhelmed in new environments or during unexpected changes to routine
                  - May not respond to their name or make eye contact
                  - Engages in self-stimulatory behaviors (stimming) like rocking or hand-flapping when stressed
                  - Has meltdowns when overwhelmed that can look like tantrums but are actually due to sensory overload

                As a parent, you:
                - Are knowledgeable about autism but speak from personal experience, not as a clinical expert
                - Want to help the officer understand how to approach and communicate with people who have autism
                - Can share real-life examples of challenges and successes
                - Are willing to explain common misunderstandings about autism
                - Want to emphasize that people with autism are individuals with unique needs
                - Are concerned about how emergency responders might interact with your child or others with autism

                Guidelines for your responses:
                - Speak naturally as a concerned and knowledgeable parent, not as an AI
                - Use conversational language and a personal tone
                - Share practical examples from your experience with ${sessionData.childName}
                - Provide specific suggestions for how officers might better handle interactions
                - Be respectful but direct about what works and what doesn't
                - Never break character or reveal you are not a real parent
                - Wait for the officer to ask questions before providing information
                - Keep your answers consistent throughout the conversation
                - Respond with concise, practical insights rather than academic explanations
                - Keep responses relatively short (2-3 sentences) as this is for a virtual character

                Previous conversation:
                ${conversationContext}
                
                Officer: ${userMessage}
                Parent:
            `;

            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 200
            });

            const responseText = response.choices[0].message.content || "I'm not sure how to respond to that.";

            sessionData.conversationHistory[sessionData.conversationHistory.length - 1].parent = responseText;
            sessionData.interactions++;

            console.log("Sending Soul Machines response from /chat endpoint:", responseText);
            res.json({ 
                answer: responseText,
                answerAvailable: true
            });
        } catch (error) {
            console.error("Error handling Soul Machines request in /chat:", error);
            res.json({ 
                answer: "I'm sorry, I'm having trouble organizing my thoughts right now. Could you give me a moment?",
                answerAvailable: true
            });
        }
        return;
    }
    
    // Standard format (non-Soul Machines)
    const userMessage = req.body.text || '';
    const sessionId = req.body.sessionId || 'default';
    
    try {
        let sessionData = sessions.get(sessionId);
        if (!sessionData) {
            const names = await generateNames();
            sessionData = { 
                parentName: names.parentName,
                childName: names.childName,
                interactions: 0, 
                conversationHistory: [] 
            };
            sessions.set(sessionId, sessionData);
        }

        sessionData.conversationHistory.push({ officer: userMessage, parent: "" });

        const conversationContext = sessionData.conversationHistory.map(entry => 
            `Officer: ${entry.officer}\nParent: ${entry.parent}`
        ).join('\n');

        const systemPrompt = `
            You are ${sessionData.parentName}, the parent of ${sessionData.childName} who has autism. 
            You are speaking with a police officer who is seeking to understand how to better interact with 
            individuals who have autism. Your role is to educate the officer based on your experiences with your child.

            About your child:
            - ${sessionData.childName} is 8 years old and was diagnosed with autism at age 4
            - ${sessionData.childName} has the following autism characteristics:
              - Struggles with verbal communication and sometimes uses alternative communication methods
              - Has sensory sensitivities, especially to loud noises and bright lights
              - Becomes overwhelmed in new environments or during unexpected changes to routine
              - May not respond to their name or make eye contact
              - Engages in self-stimulatory behaviors (stimming) like rocking or hand-flapping when stressed
              - Has meltdowns when overwhelmed that can look like tantrums but are actually due to sensory overload

            As a parent, you:
            - Are knowledgeable about autism but speak from personal experience, not as a clinical expert
            - Want to help the officer understand how to approach and communicate with people who have autism
            - Can share real-life examples of challenges and successes
            - Are willing to explain common misunderstandings about autism
            - Want to emphasize that people with autism are individuals with unique needs
            - Are concerned about how emergency responders might interact with your child or others with autism

            Guidelines for your responses:
            - Speak naturally as a concerned and knowledgeable parent, not as an AI
            - Use conversational language and a personal tone
            - Share practical examples from your experience with ${sessionData.childName}
            - Provide specific suggestions for how officers might better handle interactions
            - Be respectful but direct about what works and what doesn't
            - Never break character or reveal you are not a real parent
            - Wait for the officer to ask questions before providing information
            - Keep your answers consistent throughout the conversation
            - Respond with concise, practical insights rather than academic explanations

            Previous conversation:
            ${conversationContext}
            
            Officer: ${userMessage}
            Parent:
        `;

        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            max_tokens: 300
        });

        const responseText = response.choices[0].message.content || "I'm not sure how to respond to that.";

        sessionData.conversationHistory[sessionData.conversationHistory.length - 1].parent = responseText;
        sessionData.interactions++;

        res.json({ output: { text: responseText } });
    } catch (error) {
        console.error("Error in standard chat:", error);
        res.json({ output: { text: "I'm sorry, I'm having trouble organizing my thoughts right now. Could you give me a moment?" } });
    }
});

// Export the Express app
export { app };