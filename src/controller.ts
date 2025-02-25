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
    const userMessage = req.body.text;
    const sessionId = req.body.sessionId || "default"; 

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
            res.json({ output: { text: "I'm just trying to share what I've experienced with my child. Can you clarify what you'd like to know about raising a child with autism?" } });
            return;
        }

        sessionData.conversationHistory[sessionData.conversationHistory.length - 1].parent = responseText;
        sessionData.interactions++;
        if (sessionData.interactions >= 70) {
            sessions.delete(sessionId);
        }

        res.json({ output: { text: responseText } });

    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        res.json({ output: { text: "I'm sorry, I'm having trouble organizing my thoughts right now. Could you give me a moment?" } });
    }
});

// Export the Express app
export { app };
