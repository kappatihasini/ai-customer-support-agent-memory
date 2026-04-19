const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const memoryService = require('./memory-service');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));


app.post('/chat', async (req, res) => {
    const { user_id, message } = req.body;
    if (!user_id || !message) return res.status(400).json({ error: 'user_id and message are required' });

    try {
        // 0. Retrieve recent conversation context
        const history = await db.getUserInteractions(user_id);
        const contextBuffer = history.slice(0, 10);

        // 1. Memory Extraction (AUTO LEARN)
        // Store any facts mention in the current message
        const factConfirmation = await memoryService.extractFacts(user_id, message);

        // 2. Direct Answer Attempt (MEMORY PRIORITY)
        // Check if the user is asking for something we already know
        let reply = await memoryService.tryAnsweringFromMemory(user_id, message, contextBuffer);
        
        // 3. Contextual Continuity Logic (Response Selection)
        // If we learned something, acknowledge it. If we also answered a question, combine them.
        if (factConfirmation) {
            if (reply) {
                reply = `${factConfirmation} ${reply}`;
            } else {
                reply = factConfirmation;
            }
        }

        let memory_used = !!reply;

        // 4. Similarity Matching (Fallback for past issues)
        if (!reply) {
            const similarIssue = await memoryService.findSimilarIssue(user_id, message);
            if (similarIssue) {
                reply = similarIssue.response;
                memory_used = true;
            }
        }

        // 5. Natural Language Fallback (Final Step)
        if (!reply) {
            reply = memoryService.generateDynamicResponse(message);
        }

        const smartSuggestion = memoryService.getSmartSuggestion(message);
        
        const response = {
            reply: reply,
            memory_used: memory_used,
            suggestion: smartSuggestion,
            urgency: memoryService.detectUrgency(message),
            debug: {
                intent: memoryService.detectIntent(message),
                extracted: factConfirmation || "None",
                memory: Object.fromEntries((await db.getAllUserFacts(user_id)).map(f => [f.fact_key, f.fact_value]))
            }
        };

        // 6. Persistence
        await db.saveInteraction(user_id, message, response.reply);
        res.json(response);

    } catch (err) {
        console.error("Agent Core Error:", err);
        res.json({ 
            reply: "I'm having a bit of trouble accessing my memory right now. Could you repeat that?",
            memory_used: false,
            urgency: 'high'
        });
    }
});







/**
 * GET /facts/:user_id
 * Returns structured personal data (name, interests, etc.)
 */
app.get('/facts/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
        const facts = await db.getAllUserFacts(user_id);
        res.json(facts);
    } catch (err) {
        console.error("Fact Retrieval Error:", err);
        res.status(500).json({ error: 'Failed to retrieve user facts' });
    }
});

/**
 * GET /memory/:user_id
 * Returns all past issues for the user
 */
app.get('/memory/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
        const history = await db.getUserInteractions(user_id);
        const issues = history.map(item => ({
            id: item.id,
            issue: item.issue,
            response: item.response,
            timestamp: item.timestamp
        }));
        res.json(issues);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /insights
 * Returns global analytics
 */
app.get('/insights', async (req, res) => {
    try {
        const insights = await memoryService.getInsights();
        res.json(insights);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get insights' });
    }
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

