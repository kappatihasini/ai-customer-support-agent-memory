const stringSimilarity = require('string-similarity');
const db = require('./database');

const SIMILARITY_THRESHOLD = 0.5;

const Intents = {
  GET_NAME: 'get_name',
  GET_AGE: 'get_age',
  GET_INTERESTS: 'get_interests',
  GET_ALL: 'get_all',
  GET_RELATIONSHIP: 'get_relationship',
  GREETING: 'greeting',
  IDENTITY: 'identity',
  CAPABILITIES: 'capabilities',
  UNSURE: 'unsure'
};

/**
 * Normalizes user input for semantic analysis
 */
function normalizeMessage(message) {
  const msg = message.toLowerCase()
    .replace(/[?.,!]/g, ' ') // Remove punctuation
    .trim();
  
  const stopwords = ['a', 'an', 'the', 'is', 'do', 'i', 'me', 'my', 'tell', 'say', 'what', 'how', 'have', 'who', 'am'];
  const tokens = msg.split(/\s+/).filter(t => t.length > 0 && !stopwords.includes(t));
  
  return tokens;
}

/**
 * Maps user input to a specific intent using semantic normalization
 */
function detectIntent(message) {
  const tokens = normalizeMessage(message);
  const raw = message.toLowerCase();

  // 1. GREETING
  if (raw.match(/^(hi|hello|hey|good morning|good afternoon)/i)) return Intents.GREETING;

  // 2. IDENTITY & CAPABILITIES
  if (tokens.includes('you') || tokens.includes('your')) {
      if (tokens.includes('who') || tokens.includes('what') || tokens.includes('name')) return Intents.IDENTITY;
      if (tokens.includes('can') || tokens.includes('help') || tokens.includes('do')) return Intents.CAPABILITIES;
  }

  // 3. COMPOUND (ALL/BOTH)
  if (tokens.includes('both') || tokens.includes('all') || tokens.includes('everything')) return Intents.GET_ALL;

  // 4. RELATIONSHIP
  if (tokens.includes('brother') || tokens.includes('sister') || tokens.includes('sibling') || tokens.includes('family')) {
      if (raw.includes('do i') || raw.includes('have i') || raw.includes('who is') || raw.includes('?')) return Intents.GET_RELATIONSHIP;
  }

  // 5. PERSONAL FACTS
  if (tokens.includes('name')) return Intents.GET_NAME;
  if (tokens.includes('age') || tokens.includes('old')) return Intents.GET_AGE;
  if (tokens.includes('like') || tokens.includes('interest') || tokens.includes('hobby')) return Intents.GET_INTERESTS;

  return Intents.UNSURE;
}

/**
  * Finds the most similar past issue for a user
  */
async function findSimilarIssue(userId, currentMessage) {
  const pastInteractions = await db.getUserInteractions(userId);
  if (pastInteractions.length === 0) return null;

  const issues = pastInteractions.map(i => i.issue);
  const matches = stringSimilarity.findBestMatch(currentMessage, issues);

  if (matches.bestMatch.rating >= SIMILARITY_THRESHOLD) {
    return pastInteractions[matches.bestMatchIndex];
  }
  return null;
}

/**
 * Extracts structured facts from messages
 */
async function extractFacts(userId, message) {
  const tokens = normalizeMessage(message);
  const raw = message.toLowerCase();
  let results = [];

  // 🔹 Age Extraction
  const ageMatch = message.match(/(?:I am|I'm|My age is|i'm)\s*([0-9]+)/i);
  if (ageMatch) {
    await db.saveFact(userId, 'age', ageMatch[1]);
    results.push(`I've noted that you are ${ageMatch[1]} years old.`);
  }

  // 🔹 Name Extraction
  const nameMatch = message.match(/(?:my name is|i am|call me)\s+([\w]{2,20})/i);
  if (nameMatch && !ageMatch) { // Avoid "I am 19" being caught as name "19"
    const name = nameMatch[1].trim();
    const blacklist = ['feeling', 'hungry', 'busy', 'tired', 'working', 'ready', 'fine', 'good', 'great', 'happy', 'sad'];
    
    if (name.length > 0 && isNaN(Number(name)) && !blacklist.includes(name.toLowerCase()) && !name.toLowerCase().endsWith('ing')) {
        await db.saveFact(userId, 'name', name);
        results.push(`Nice to meet you, ${name}! I've saved that to my memory.`);
    }
  }

  // 🔹 Interests Extraction
  const interestMatch = message.match(/(?:i like|i love|my interest is|i'm into)\s+([\w\s]{2,40})/i);
  if (interestMatch) {
    const interest = interestMatch[1].trim();
    await db.saveFact(userId, 'interest', interest);
    results.push(`I've noted that you like ${interest}. I'll remember that!`);
  }

  // 🔹 relationship Extraction
  const relMatch = message.toLowerCase().match(/(?:i have|i've got)\s+(?:a|an)\s+(younger|elder|older|big|little|twin)?\s*(brother|sister)/i);
  const isQuestion = raw.includes('do i') || raw.includes('have i') || raw.includes('?') || raw.includes('who');
  
  if (relMatch && !isQuestion) {
    const type = relMatch[1] ? relMatch[1].toLowerCase().trim() : 'general';
    const member = relMatch[2].toLowerCase().trim();
    const factKey = `rel_${type}_${member}`;
    await db.saveFact(userId, factKey, 'true');
    const article = (type === 'elder' || type === 'older') ? 'an' : 'a';
    results.push(`I've noted that you have ${article} ${type !== 'general' ? type + ' ' : ''}${member}.`);
  }

  if (results.length > 0) {
    console.log(`[MemoryService] Extraction Successful: ${results.join(' ')}`);
  }

  return results.length > 0 ? results.join(' ') : null;
}

/**
 * Attempts to answer a direct query from memory or context
 */
async function tryAnsweringFromMemory(userId, message, contextBuffer = []) {
  const intent = detectIntent(message);
  const tokens = normalizeMessage(message);
  const facts = await db.getAllUserFacts(userId);
  const factMap = Object.fromEntries(facts.map(f => [f.fact_key, f.fact_value]));

  switch (intent) {
    case Intents.GET_ALL:
      const items = [];
      if (factMap.name) items.push(`your name is ${factMap.name}`);
      if (factMap.age) items.push(`you are ${factMap.age} years old`);
      if (factMap.interest) items.push(`you like ${factMap.interest}`);

      if (items.length > 1) {
        const last = items.pop();
        return `Yes, I remember: ${items.join(', ')} and ${last}.`;
      } else if (items.length === 1) {
        return `Right now, I only know that ${items[0]}. Is there anything else you'd like to tell me?`;
      }
      return "I don’t think I’ve learned enough about you yet to give a full summary! Could you tell me things like your name or age?";

    case Intents.GET_NAME:
      if (factMap.name) return `Yes, your name is ${factMap.name}.`;
      return "I don't think you've told me your name yet! What should I call you?";

    case Intents.GET_AGE:
      if (factMap.age) return `Yes, you told me you are ${factMap.age} years old.`;
      return "I don't have your age on file—how old are you?";

    case Intents.GET_INTERESTS:
      if (factMap.interest) return `Yes, you mentioned that you like ${factMap.interest}.`;
      return "I'm not sure what your interests are yet! What do you like to do?";

    case Intents.GET_RELATIONSHIP:
      const relMatch = message.match(/(younger|elder|older|big|little|twin)?\s*(brother|sister)/i);
      if (relMatch) {
        const type = relMatch[1] ? relMatch[1].toLowerCase().trim() : 'general';
        const member = relMatch[2].toLowerCase().trim();
        
        // Check specifically for the requested sibling
        const factKey = `rel_${type}_${member}`;
        if (factMap[factKey] === 'true') {
            const article = (type === 'elder' || type === 'older') ? 'an' : 'a';
            return `Yes, you told me you have ${article} ${type !== 'general' ? type + ' ' : ''}${member}.`;
        }

        // Generic check if user just asked "do i have a brother?"
        if (type === 'general') {
            const specificRel = Object.keys(factMap).find(k => k.startsWith('rel_') && k.endsWith(member));
            if (specificRel) {
                const foundType = specificRel.split('_')[1];
                const article = (foundType === 'elder' || foundType === 'older') ? 'an' : 'a';
                return `Yes, you mentioned you have ${article} ${foundType !== 'general' ? foundType + ' ' : ''}${member}.`;
            }
        }

        const article = (type === 'elder' || type === 'older') ? 'an' : 'a';
        return `I don’t think you’ve mentioned that yet. Do you have ${article} ${type !== 'general' ? type + ' ' : ''}${member}?`;
      }
      return "I'm a bit confused about which family member you mean—could you clarify that for me?";

    default:
      return null;
  }
}

/**
 * Generates natural responses for common intents or fallbacks
 */
function generateDynamicResponse(message) {
  const intent = detectIntent(message);
  const msg = message.toLowerCase();

  const responses = {
    [Intents.GREETING]: "Hello! I'm here and ready to help. How are you doing today?",
    [Intents.IDENTITY]: "I am your personal AI Support Assistant, equipped with a structured memory core and context awareness.",
    [Intents.CAPABILITIES]: "I can remember facts about you (like your name, age, and interests), keep track of our conversation history, and assist with technical support queries!",
  };

  if (responses[intent]) return responses[intent];

  // Specific domain-linked replies (Human-like)
  if (msg.includes('login') || msg.includes('password') || msg.includes('account')) {
    return "I notice you're asking about account access. Security is key—are you getting a specific error message, or do you need help resetting something?";
  }
  if (msg.includes('payment') || msg.includes('billing') || msg.includes('charge')) {
    return "It sounds like there's a billing question. I can definitely help look into specific charges if you share a bit more detail!";
  }

  return "I'm listening! Tell me more so I can help as much as possible.";
}

/**
 * Procedural logic to detect urgency
 */
function detectUrgency(message) {
  const msg = message.toLowerCase();
  const highKeywords = ['urgent', 'error', 'failed', 'not working', 'broken', 'emergency', 'asap'];
  if (highKeywords.some(key => msg.includes(key))) return "high";
  return "low";
}

function getSmartSuggestion(message) {
  const msg = message.toLowerCase();
  if (msg.includes('name') || msg.includes('who')) return "Tell me your age";
  if (msg.includes('age')) return "Tell me what you like";
  if (msg.includes('like')) return "What's my name?";
  return "Ask about my memory";
}

async function getInsights() {
  try {
    return await db.getGlobalInsights();
  } catch (error) {
    return { totalIssues: 0, repeatedIssues: 0, mostCommonIssue: "None" };
  }
}

module.exports = {
  detectIntent,
  findSimilarIssue,
  getInsights,
  detectUrgency,
  getSmartSuggestion,
  generateDynamicResponse,
  extractFacts,
  tryAnsweringFromMemory
};







