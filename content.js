let selectedText = '';

// Check if the extension context is valid
function isExtensionContextValid() {
    try {
        return chrome.runtime && chrome.runtime.id;
    } catch (e) {
        return false;
    }
}

// Safely send message to background script
function safelySendMessage(message) {
    if (!isExtensionContextValid()) return;
    try {
        chrome.runtime.sendMessage(message, response => {
            if (chrome.runtime.lastError) {
                // Keep this error handling silent
            }
        });
    } catch (e) {
        // Silent error handling
    }
}

// Get currently selected text
function getCurrentSelection() {
    try {
        // Try standard window selection first
        const selection = window.getSelection();
        const text = selection ? selection.toString().trim() : '';
        
        // If we got text through normal means, return it
        if (text) {
            return text;
        }

        // Fallback for input elements
        const activeElement = document.activeElement;
        if (activeElement && 
            (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') && 
            activeElement.selectionStart !== activeElement.selectionEnd) {
            return activeElement.value.substring(
                activeElement.selectionStart,
                activeElement.selectionEnd
            ).trim();
        }

        return '';
    } catch (e) {
        console.error('Error getting selection:', e);
        return '';
    }
}

// Update selected text and notify background
function updateSelectedText() {
    try {
        const text = getCurrentSelection();
        if (text !== selectedText) {
            selectedText = text;
            safelySendMessage({
                action: 'textSelected',
                text: selectedText
            });
        }
    } catch (e) {
        console.error('Error updating selection:', e);
    }
}

// Listen for selection events
['mouseup', 'selectionchange'].forEach(event => {
    document.addEventListener(event, () => {
        if (!isExtensionContextValid()) return;
        setTimeout(updateSelectedText, 100);
    });
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!isExtensionContextValid()) return;
    if (request.action === 'getSelectedText') {
        const text = getCurrentSelection();
        selectedText = text || selectedText; // Update cache if we have new text
        sendResponse({ text: selectedText });
    }
}); 