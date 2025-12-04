// Test OpenRouter API
async function testOpenRouter() {
    const API_KEY = 'YOUR_API_KEY_HERE';
    const MODEL = 'google/gemma-2-9b-it:free';
    const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

    console.log('Testing OpenRouter API...');
    console.log('Model:', MODEL);
    console.log('Key prefix:', API_KEY.substring(0, 15) + '...');

    const requestBody = {
        model: MODEL,
        messages: [
            { role: 'system', content: 'You are a helpful translator.' },
            { role: 'user', content: 'Translate "Hello" to Polish.' }
        ]
    };

    console.log('Request:', JSON.stringify(requestBody, null, 2));

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        console.log('Response status:', response.status, response.statusText);

        const text = await response.text();
        console.log('Response body:', text);

        if (!response.ok) {
            console.error('ERROR:', text);
            return;
        }

        const data = JSON.parse(text);
        console.log('Success!');
        console.log('Result:', data.choices[0].message.content);
    } catch (error) {
        console.error('Exception:', error);
    }
}

// Run test
testOpenRouter();
