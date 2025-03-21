document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveApiKeyButton = document.getElementById('saveApiKey');
    const settingsView = document.getElementById('settingsView');
    const compactView = document.getElementById('compactView');
    const openSettingsButton = document.getElementById('openSettings');
    const closeSettingsButton = document.getElementById('closeSettings');
    const resultSection = document.querySelector('.result-section');
    const explanationDiv = document.getElementById('explanation');
    const loadingDiv = document.querySelector('.loading');
    const copyButton = document.getElementById('copyButton');
    const instructionsDiv = document.querySelector('.instructions.compact');
    const explanationControls = document.querySelector('.explanation-controls');
    const resubmitButton = document.getElementById('resubmitButton');

    let lastProcessedText = '';
    let isProcessing = false;

    // Check if API key exists and show appropriate view
    chrome.storage.local.get(['apiKey'], function(result) {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
            // Verify the API key is loaded in the background script
            chrome.runtime.sendMessage({ action: 'checkApiKey' }, function(response) {
                if (response && response.hasApiKey) {
                    settingsView.style.display = 'none';
                    compactView.style.display = 'block';
                    checkForSelectedText();
                } else {
                    // If background script doesn't have the key, save it again
                    chrome.runtime.sendMessage({
                        action: 'saveApiKey',
                        apiKey: result.apiKey
                    }, function(response) {
                        if (response && response.success) {
                            settingsView.style.display = 'none';
                            compactView.style.display = 'block';
                            checkForSelectedText();
                        }
                    });
                }
            });
        } else {
            settingsView.style.display = 'block';
            compactView.style.display = 'none';
        }
    });

    // Settings button handlers
    openSettingsButton.addEventListener('click', function() {
        settingsView.style.display = 'block';
        compactView.style.display = 'none';
    });

    closeSettingsButton.addEventListener('click', function() {
        if (apiKeyInput.value.trim()) {
            settingsView.style.display = 'none';
            compactView.style.display = 'block';
            checkForSelectedText();
        }
    });

    // Copy button handler
    copyButton.addEventListener('click', function() {
        const textToCopy = explanationDiv.textContent;
        console.log('Copying text:', textToCopy);
        navigator.clipboard.writeText(textToCopy).then(() => {
            // Visual feedback
            copyButton.classList.add('copied');
            copyButton.querySelector('.material-icons').textContent = 'check';
            
            // Reset after 2 seconds
            setTimeout(() => {
                copyButton.classList.remove('copied');
                copyButton.querySelector('.material-icons').textContent = 'content_copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text:', err);
        });
    });

    // Resubmit button handler
    resubmitButton.addEventListener('click', function() {
        const selectedType = document.querySelector('input[name="explanationType"]:checked').value;
        getExplanation(lastProcessedText, selectedType);
    });

    // Save API key
    saveApiKeyButton.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            alert('Please enter an API key');
            return;
        }

        chrome.runtime.sendMessage({
            action: 'saveApiKey',
            apiKey: apiKey
        }, function(response) {
            if (response && response.success) {
                settingsView.style.display = 'none';
                compactView.style.display = 'block';
                checkForSelectedText();
            }
        });
    });

    function getExplanation(text, explanationType = 'simple') {
        if (isProcessing) return;
        
        isProcessing = true;
        instructionsDiv.style.display = 'none';
        loadingDiv.style.display = 'block';
        resultSection.style.display = 'none';
        explanationControls.style.display = 'none';

        chrome.runtime.sendMessage({
            action: 'getExplanation',
            explanationType: explanationType
        }, function(response) {
            isProcessing = false;
            console.log('Received explanation response:', response);
            loadingDiv.style.display = 'none';
            
            if (response && response.error) {
                console.error('Error from API:', response.error);
                resultSection.style.display = 'block';
                explanationDiv.innerHTML = `<p class="error">${response.error}</p>`;
                explanationControls.style.display = 'none';
            } else if (response && response.explanation) {
                console.log('Setting explanation HTML:', response.explanation);
                resultSection.style.display = 'block';
                explanationDiv.innerHTML = `<p>${response.explanation}</p>`;
                explanationControls.style.display = 'block';
                console.log('Explanation div height:', explanationDiv.scrollHeight);
                console.log('Visible height:', explanationDiv.clientHeight);
            } else {
                console.log('No explanation received');
                instructionsDiv.style.display = 'block';
                resultSection.style.display = 'none';
                explanationControls.style.display = 'none';
            }
        });
    }

    function checkForSelectedText() {
        if (isProcessing) {
            return; // Don't check if we're still processing the last request
        }

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) {
                console.error('No active tab found');
                return;
            }

            chrome.tabs.sendMessage(tabs[0].id, {action: 'getSelectedText'}, function(response) {
                if (chrome.runtime.lastError) {
                    console.error('Error getting selected text:', chrome.runtime.lastError);
                    return;
                }

                console.log('Selected text response:', response);

                if (response && response.text) {
                    // Only process if the text is different from the last processed text
                    if (response.text !== lastProcessedText) {
                        lastProcessedText = response.text;
                        const selectedType = document.querySelector('input[name="explanationType"]:checked').value;
                        getExplanation(lastProcessedText, selectedType);
                    }
                } else {
                    lastProcessedText = '';
                    instructionsDiv.style.display = 'block';
                    resultSection.style.display = 'none';
                    loadingDiv.style.display = 'none';
                    explanationControls.style.display = 'none';
                }
            });
        });
    }
}); 