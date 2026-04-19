const axios = require('axios');

async function runTest() {
    const baseUrl = 'http://localhost:3000';
    const userId = 'user_123';

    console.log('--- Step 1: First Chat (No Memory) ---');
    try {
        const res1 = await axios.post(`${baseUrl}/chat`, {
            user_id: userId,
            message: 'I am having trouble with my login password'
        });
        console.log('Response 1:', JSON.stringify(res1.data, null, 2));

        console.log('\n--- Step 2: Similar Chat (Memory Expected) ---');
        const res2 = await axios.post(`${baseUrl}/chat`, {
            user_id: userId,
            message: 'login password is not working'
        });
        console.log('Response 2:', JSON.stringify(res2.data, null, 2));

        console.log('\n--- Step 3: Different Chat (No Memory) ---');
        const res3 = await axios.post(`${baseUrl}/chat`, {
            user_id: userId,
            message: 'How do I cancel my subscription?'
        });
        console.log('Response 3:', JSON.stringify(res3.data, null, 2));

        console.log('\n--- Step 4: Retrieve Memory ---');
        const res4 = await axios.get(`${baseUrl}/memory/${userId}`);
        console.log('Memory History:', JSON.stringify(res4.data, null, 2));

    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) console.error('Error detail:', error.response.data);
    }
}

runTest();
