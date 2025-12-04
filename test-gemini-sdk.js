import { GoogleGenerativeAI } from "@google/generative-ai";

// Test script to verify Gemini API integration
async function testGeminiAPI() {
    // Get API key from environment or use a test key
    const apiKey = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE";

    if (apiKey === "YOUR_API_KEY_HERE") {
        console.error("Please set GEMINI_API_KEY environment variable or update the script");
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: "gemini-2.0-flash-exp",
            systemInstruction: "You are a helpful assistant.",
        });

        console.log("Testing Gemini API...");
        const result = await model.generateContent("Explain how AI works in a few words");
        const response = result.response;
        const text = response.text();

        console.log("Success! Response:");
        console.log(text);
    } catch (error) {
        console.error("Error:", error.message);
    }
}

testGeminiAPI();
