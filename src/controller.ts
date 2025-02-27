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

// Middleware to log all incoming requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
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

// API Endpoint for Chat Requests
app.post('/chat', async (req, res) => {
    console.log("Received chat request:", JSON.stringify(req.body));
    
    // Handle different input formats (Soul Machines uses different structure)
    let userMessage = "";
    let sessionId = "default";
    
    if (req.body.text) {
        // Standard format from your previous implementation
        userMessage = req.body.text;
        sessionId = req.body.sessionId || "default";
    } else if (req.body.input && req.body.input.text) {
        // Soul Machines format
        userMessage = req.body.input.text;
        sessionId = req.body.personaId || "default";
    } else {
        console.log("Warning: Unrecognized request format");
        res.json({ output: { text: "I'm sorry, I didn't catch what you said." } });
        return;
    }

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

    // List of autism signs and behaviors that the parent can describe
    const autismSigns = `
    - Difficulty with social interactions and making eye contact
    - Sensory sensitivities (to lights, sounds, textures, etc.)
    - Repetitive behaviors or movements (stimming)
    - Need for routine and difficulty with unexpected changes
    - Communication differences (delayed speech, echolalia, literal interpretation)
    - Meltdowns when overwhelmed (different from tantrums)
    - Special interests with intense focus
    - Difficulty understanding social cues and nonverbal communication
    - Challenges with transitions between activities
    - Different responses to pain or distress
    `;

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

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage }
            ],
            max_tokens: 300
        });

        const responseText = response.choices[0].message.content || "I'm not sure how to respond to that.";

        if (responseText.includes("Sorry") || responseText.trim() === "" || responseText.includes("AI") || responseText.includes("language model")) {
            res.json({ 
                output: { 
                    text: "I'm just trying to share what I've experienced with my child. Can you clarify what you'd like to know about raising a child with autism?" 
                } 
            });
            return;
        }

        sessionData.conversationHistory[sessionData.conversationHistory.length - 1].parent = responseText;

        sessionData.interactions++;
        if (sessionData.interactions >= 70) {
            sessions.delete(sessionId);
        }

        // Format response according to expected format
        let formattedResponse;
        
        // Check if this is a Soul Machines request by checking structure
        if (req.body.input && req.body.personaId) {
            // Soul Machines response format
            formattedResponse = {
                answer: responseText,
                answerAvailable: true
            };
        } else {
            // Standard format
            formattedResponse = { 
                output: { 
                    text: responseText 
                } 
            };
        }
        
        console.log("Sending response:", JSON.stringify(formattedResponse));
        res.json(formattedResponse);

    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        
        // Format error response based on request type
        if (req.body.input && req.body.personaId) {
            // Soul Machines error format
            res.json({ 
                answer: "I'm sorry, I'm having trouble organizing my thoughts right now. Could you give me a moment?",
                answerAvailable: true
            });
        } else {
            // Standard error format
            res.json({ 
                output: { 
                    text: "I'm sorry, I'm having trouble organizing my thoughts right now. Could you give me a moment?" 
                } 
            });
        }
    }
});

// Optional: Endpoint to reset conversation
app.post('/reset', (req, res) => {
    const sessionId = req.body.sessionId || "default";
    sessions.delete(sessionId);
    res.json({ success: true, message: "Conversation reset successfully" });
});

// Optional: Endpoint to get session info (for debugging)
app.get('/session/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    const sessionData = sessions.get(sessionId);
    
    if (!sessionData) {
        return res.status(404).json({ error: "Session not found" });
    }
    
    res.json({
        parentName: sessionData.parentName,
        childName: sessionData.childName,
        interactions: sessionData.interactions,
        conversationLength: sessionData.conversationHistory.length
    });
});

// Add a simple healthcheck endpoint
app.get('/', (req, res) => {
    res.send('Autism Awareness Training API is running');
});

// Add a ping endpoint for testing
app.get('/ping', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Export the Express app
export { app };