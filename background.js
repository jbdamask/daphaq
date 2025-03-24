// Store the API key
let apiKey = '';

// Initialize API key from storage when background script loads
async function initializeApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['apiKey'], function(result) {
            if (result.apiKey) {
                apiKey = result.apiKey;
                console.log('API key loaded from storage');
            }
            resolve();
        });
    });
}

// Initialize on load
initializeApiKey();

function getPromptForType(type, text) {
    switch (type) {
        case 'analogy':
            return `Please explain this using an analogy that a layperson would understand: ${text}`;
        case 'simple':
        default:
            return `This is confusing. Explain it in a simple way to a noob. Define terms as you go. Don't use analogies. Don't use jargon. Don't use big words. Be as short as you can be. Just answer, don't personalize it: ${text}`;
    }
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'textSelected') {
        console.log('Text selected:', request.text);
        // If text is empty, clear the storage
        if (!request.text) {
            chrome.storage.local.remove(['selectedText', 'selectedTextTabId']);
            return;
        }
        // Store the selected text with the tab ID
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) {
                chrome.storage.local.set({ 
                    selectedText: request.text,
                    selectedTextTabId: tabs[0].id 
                });
            }
        });
    }
    
    if (request.action === 'saveApiKey') {
        apiKey = request.apiKey;
        chrome.storage.local.set({ apiKey: request.apiKey });
        sendResponse({ success: true });
    }

    if (request.action === 'checkApiKey') {
        // If no API key in memory, try to load it
        if (!apiKey) {
            chrome.storage.local.get(['apiKey'], function(result) {
                apiKey = result.apiKey || '';
                sendResponse({ hasApiKey: Boolean(apiKey) });
            });
            return true; // Will respond asynchronously
        }
        sendResponse({ hasApiKey: Boolean(apiKey) });
    }
    
    if (request.action === 'getExplanation') {
        // If no API key in memory, try to load it first
        if (!apiKey) {
            chrome.storage.local.get(['apiKey'], function(result) {
                if (!result.apiKey) {
                    sendResponse({ error: 'API key not set' });
                    return;
                }
                apiKey = result.apiKey;
                handleExplanationRequest(request, sendResponse);
            });
            return true; // Will respond asynchronously
        }
        handleExplanationRequest(request, sendResponse);
        return true; // Required for async response
    }
});

async function handleExplanationRequest(request, sendResponse) {
    try {
        // Get the selected text from storage and verify it's from the current tab
        const result = await new Promise((resolve) => {
            chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
                if (!tabs[0]) {
                    resolve({});
                    return;
                }
                chrome.storage.local.get(['selectedText', 'selectedTextTabId'], function(data) {
                    if (data.selectedTextTabId === tabs[0].id) {
                        resolve(data);
                    } else {
                        // Clear stored text if it's from a different tab
                        chrome.storage.local.remove(['selectedText', 'selectedTextTabId']);
                        resolve({});
                    }
                });
            });
        });

        if (!result.selectedText) {
            sendResponse({ error: 'No text selected' });
            return;
        }

        const explanationType = request.explanationType || 'simple';
        const userPrompt = getPromptForType(explanationType, result.selectedText);
        console.log('Sending text to OpenAI:', result.selectedText);
        console.log('Explanation type:', explanationType);

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant that explains things in simple, layperson terms. Keep your explanations concise and easy to understand."
                    },
                    {
                        role: "user",
                        content: userPrompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            })
        });

        const data = await response.json();
        console.log('OpenAI API Response:', data);
        
        if (data.error) {
            console.error('OpenAI API Error:', data.error);
            // Check if it's an authentication error
            if (data.error.type === 'invalid_request_error' || data.error.code === 'invalid_api_key') {
                // Clear the invalid API key
                apiKey = '';
                chrome.storage.local.remove('apiKey');
                sendResponse({ error: 'Invalid API key. Please enter a valid API key in settings.' });
                return;
            }
            sendResponse({ error: data.error.message || 'Error from OpenAI API' });
            return;
        }

        const explanation = data.choices[0].message.content;
        console.log('Sending explanation to popup:', explanation);
        console.log('Explanation length:', explanation.length);
        console.log('Full explanation object:', {
            text: explanation,
            truncated: explanation.endsWith('...') || explanation.endsWith('…')
        });
        sendResponse({ explanation });
    } catch (error) {
        console.error('Error calling OpenAI:', error);
        // Check if it's a network error or other fetch error
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            sendResponse({ error: 'Network error. Please check your internet connection.' });
            return;
        }
        sendResponse({ error: error.message });
    }
} 