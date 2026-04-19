const axios = require('axios');

const URL = 'http://localhost:5000/chat';
const USER_ID = 'test_user_' + Date.now();

async function test() {
    console.log("--- Starting Memory Overhaul Test ---");

    // 1. Store Name
    console.log("\n1. Testing Name Storage...");
    let res = await axios.post(URL, { user_id: USER_ID, message: "my name is hasini" });
    console.log("Input: my name is hasini");
    console.log("Output:", res.data.reply);

    // 2. Store Age
    console.log("\n2. Testing Age Storage...");
    res = await axios.post(URL, { user_id: USER_ID, message: "i am 19" });
    console.log("Input: i am 19");
    console.log("Output:", res.data.reply);

    // 3. Test "say both"
    console.log("\n3. Testing 'say both' Intent...");
    res = await axios.post(URL, { user_id: USER_ID, message: "say both" });
    console.log("Input: say both");
    console.log("Output:", res.data.reply);

    // 4. Test "what is my name?"
    console.log("\n4. Testing Name Recall...");
    res = await axios.post(URL, { user_id: USER_ID, message: "what is my name?" });
    console.log("Input: what is my name?");
    console.log("Output:", res.data.reply);

    // 5. Test Fallback for unknown interest
    console.log("\n5. Testing Unknown Fact Fallback...");
    res = await axios.post(URL, { user_id: USER_ID, message: "what do I like?" });
    console.log("Input: what do I like?");
    console.log("Output:", res.data.reply);

    // 6. Test relationship Storage
    console.log("\n6. Testing relationship Storage...");
    res = await axios.post(URL, { user_id: USER_ID, message: "I have a younger brother" });
    console.log("Input: I have a younger brother");
    console.log("Output:", res.data.reply);

    // 7. Test relationship Recall
    console.log("\n7. Testing relationship Recall...");
    res = await axios.post(URL, { user_id: USER_ID, message: "do i have a younger brother?" });
    console.log("Input: do i have a younger brother?");
    console.log("Output:", res.data.reply);

    // 8. Test relationship Fallback
    console.log("\n8. Testing relationship Fallback...");
    res = await axios.post(URL, { user_id: USER_ID, message: "do i have an elder sister?" });
    console.log("Input: do i have an elder sister?");
    console.log("Output:", res.data.reply);

    // 9. Semantic Variations
    console.log("\n9. Testing Semantic Variations...");
    res = await axios.post(URL, { user_id: USER_ID, message: "younger brother i have?" });
    console.log("Input: younger brother i have?");
    console.log("Output:", res.data.reply);

    res = await axios.post(URL, { user_id: USER_ID, message: "tell me my physical age" });
    console.log("Input: tell me my physical age");
    console.log("Output:", res.data.reply);

    // 10. Memory Update Logic & Combination
    console.log("\n10. Testing Memory Update & Combination...");
    res = await axios.post(URL, { user_id: USER_ID, message: "Actually, i have a younger brother" });
    console.log("Input: Actually, i have a younger brother");
    console.log("Output:", res.data.reply);

    res = await axios.post(URL, { user_id: USER_ID, message: "i'm 19, what is my name?" });
    console.log("Input: i'm 19, what is my name?");
    console.log("Output:", res.data.reply);

    console.log("\n--- Test Complete ---");
}

test().catch(err => {
    console.error("Test failed:", err.message);
    if (err.response) console.error("Response data:", err.response.data);
});
