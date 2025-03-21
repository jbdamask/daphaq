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

// Get any currently selected text using multiple methods
function getCurrentSelection() {
    try {
        // Method 1: Standard window selection
        const selection = window.getSelection();
        if (selection && selection.toString().trim()) {
            return selection.toString().trim();
        }

        // Method 2: Check active element selection
        if (document.activeElement) {
            if (document.activeElement.selectionStart !== undefined) {
                const start = document.activeElement.selectionStart;
                const end = document.activeElement.selectionEnd;
                if (start !== end) {
                    return document.activeElement.value.substring(start, end).trim();
                }
            }
            
            // Check if the active element has selected text
            const activeText = document.activeElement.textContent;
            if (activeText) {
                return activeText.trim();
            }
        }

        // Method 3: Try document.selection for older browsers
        if (document.selection && document.selection.type !== "Control") {
            return document.selection.createRange().text.trim();
        }

        return '';
    } catch (e) {
        return '';
    }
}

// Update selected text and notify background
function updateSelectedText() {
    try {
        const text = getCurrentSelection();
        if (text && text !== selectedText) {
            selectedText = text;
            safelySendMessage({
                action: 'textSelected',
                text: selectedText
            });
        }
    } catch (e) {
        // Silent error handling
    }
}

// Listen for text selection
document.addEventListener('mouseup', function(e) {
    if (!isExtensionContextValid()) return;
    // Small delay to ensure selection is complete
    setTimeout(updateSelectedText, 10);
});

// Listen for keyboard selection
document.addEventListener('keyup', function(e) {
    if (!isExtensionContextValid()) return;
    // Wait a brief moment for the selection to be updated
    setTimeout(updateSelectedText, 100);
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!isExtensionContextValid()) return;

    if (request.action === 'getSelectedText') {
        const text = getCurrentSelection() || selectedText;
        sendResponse({ text: text });
    }
}); 