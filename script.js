document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const typingIndicator = document.getElementById('typing-indicator');
    const footprintDisplay = document.getElementById('footprint-display');
    const ecoTipDisplay = document.getElementById('eco-tip');

    // --- IMPORTANT: Replace with your actual API Key ---
    // In a real app, this key MUST be kept secure on a backend server.
    const GEMINI_API_KEY = "AIzaSyAsXmK26msdHdNlLQe8QOpTe4AqqBpSFjU"; // USE THE KEY YOU PROVIDED
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${GEMINI_API_KEY}`; // Updated Model

    // Store conversation history
    let conversationHistory = [
        // Initial system prompt (or first AI message as context)
        {
            role: "user", // We frame the initial setup as instructions from the "user" side to the model
            parts: [{ text: `You are EcoBot, a friendly and engaging AI assistant designed to calculate a user's carbon footprint through conversation. Your goal is to estimate their *annual* footprint in tonnes of CO2 equivalent (CO2e).

            Follow these steps:
            1.  **Greet the user warmly** and explain your purpose.
            2.  **Ask questions one category at a time:** Start with **Transportation**, then move to **Home Energy**, then **Diet**, and finally **Consumption/Waste**. Be clear about which category you're asking about.
            3.  **Ask specific but simple questions.** For example:
                *   Transport: "How do you primarily commute (e.g., car, bike, public transport)? Roughly how many miles/km do you travel per week for commuting and leisure?" (Specify units if needed). Ask about flights: "How many hours of flying did you do in the last year (short-haul and long-haul separately)?"
                *   Home Energy: "What's your primary heating source (e.g., natural gas, electricity, oil)? Do you know your approximate monthly electricity usage (in kWh) or bill amount? How many people live in your household?"
                *   Diet: "How would you describe your diet (e.g., vegan, vegetarian, pescatarian, meat-eater, heavy meat-eater)?"
                *   Consumption: "How often do you buy new electronics or clothing? Do you focus on recycling?" (Keep this simpler).
            4.  **Acknowledge user answers** briefly and transition smoothly to the next question or category.
            5.  **Estimate the footprint:** Once you have enough information (aim for at least transport, energy, and diet), provide an *estimated* annual carbon footprint in tonnes of CO2e. State clearly that it's an estimate. Format the final result clearly, perhaps like this: "Based on our conversation, your estimated annual carbon footprint is approximately: **X.X tonnes of CO2e**."
            6.  **Offer 1-2 relevant, actionable tips** based on their highest impact areas after giving the estimate. For example, if transport is high, suggest alternatives. If diet is high, suggest reducing meat consumption.
            7.  **Maintain a friendly, encouraging, and non-judgmental tone.** Make it feel like a helpful chat, not an interrogation.
            8.  **If the user gives unclear answers,** ask clarifying questions politely.
            9.  **Start the conversation now** by asking about transportation.` }]
        },
        {
            // The initial message displayed in HTML, also sent as the first 'model' turn
             role: "model",
             parts: [{ text: "Hello! I'm EcoBot. I can help you estimate your annual carbon footprint. Let's start with your transportation habits. How do you primarily commute (car, bike, public transport, walk)? And roughly how far is your daily round trip?" }]
        }
    ];

    // Function to add a message to the chat display
    function displayMessage(sender, message) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('message', `${sender}-message`);

        const icon = document.createElement('i');
        icon.classList.add('fas', sender === 'ai' ? 'fa-robot' : 'fa-user'); // Simple user icon for now
        if (sender === 'ai') icon.classList.add('bot-icon');


        const textElement = document.createElement('p');
        textElement.textContent = message; // Use textContent to prevent XSS

        if(sender === 'ai') messageElement.appendChild(icon); // Icon first for AI
        messageElement.appendChild(textElement);
        if(sender === 'user') {
             // messageElement.appendChild(icon); // Icon last for User (optional)
             // Hide user icon for cleaner look for now
        }


        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to bottom
    }

    // Function to show/hide typing indicator
    function showTyping(show) {
        if (show) {
            typingIndicator.classList.remove('hidden');
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } else {
            typingIndicator.classList.add('hidden');
        }
    }

     // Function to update the summary section (basic text update)
    function updateSummary(summaryText, tipText = "") {
        // Look for a pattern like "**X.X tonnes of CO2e**"
        const footprintRegex = /\*\*(.*? tonnes of CO2e)\*\*/;
        const match = summaryText.match(footprintRegex);

        if (match && match[1]) {
            footprintDisplay.innerHTML = `<p>Estimated Footprint:</p><strong>${match[1]}</strong>`;
        } else if (summaryText.includes("tonnes of CO2e")) {
             // Fallback if specific formatting isn't found but units are mentioned
             footprintDisplay.innerHTML = `<p>${summaryText}</p>`;
        }
        // Don't overwrite summary if no footprint found yet

        if (tipText) {
            ecoTipDisplay.textContent = tipText;
        } else {
            // Maybe extract tips from the main response if possible later
            const potentialTip = extractTip(summaryText);
             if(potentialTip) ecoTipDisplay.textContent = potentialTip;
        }
    }

     // Simple function to try and extract tips (can be improved)
    function extractTip(text) {
        const tipKeywords = ["tip:", "suggestion:", "consider", "try to", "reduce", "increase", "switch to"];
        const sentences = text.split('. ');
        for (let sentence of sentences) {
            const lowerSentence = sentence.toLowerCase();
            if (tipKeywords.some(keyword => lowerSentence.includes(keyword))) {
                // Avoid extracting the main footprint result as a tip
                 if (!lowerSentence.includes("tonnes of co2e")) {
                    return sentence.trim() + ".";
                 }
            }
        }
        return null; // No obvious tip found
    }

    // Function to send message to the AI and get response
    async function getAiResponse(message) {
        showTyping(true);
        userInput.disabled = true;
        sendButton.disabled = true;

        // Add user message to history
        conversationHistory.push({ role: "user", parts: [{ text: message }] });

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ contents: conversationHistory }), // Send the whole history
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error Response:", errorData);
                throw new Error(`API Error: ${response.status} ${response.statusText}. ${errorData.error?.message || 'Check console for details.'}`);
            }

            const data = await response.json();

             // Handle potential safety ratings or empty responses
            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
                 console.warn("API Warning:", data);
                 throw new Error("AI response format unexpected or content blocked.");
            }

            const aiText = data.candidates[0].content.parts[0].text;

            // Add AI response to history
            conversationHistory.push({ role: "model", parts: [{ text: aiText }] });

            displayMessage('ai', aiText);
            updateSummary(aiText); // Try to update summary/tips based on AI response


        } catch (error) {
            console.error("Error fetching AI response:", error);
            displayMessage('ai', `Sorry, I encountered an error. ${error.message}. Please try again later or check the API key/endpoint.`);
             // Add error message to history so model knows there was an issue
             conversationHistory.push({ role: "model", parts: [{ text: `System Error: ${error.message}` }] });
        } finally {
            showTyping(false);
            userInput.disabled = false;
            sendButton.disabled = false;
            userInput.focus();
        }
    }

    // Event listener for the send button
    sendButton.addEventListener('click', () => {
        const message = userInput.value.trim();
        if (message) {
            displayMessage('user', message);
            getAiResponse(message);
            userInput.value = '';
        }
    });

    // Event listener for pressing Enter in the input field
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission/newline
            sendButton.click();
        }
    });

     // Optional: Add initial welcome message from history (already done in HTML)
     // const initialAiMessage = conversationHistory.find(msg => msg.role === 'model');
     // if (initialAiMessage) {
     //    displayMessage('ai', initialAiMessage.parts[0].text);
     // }

});