document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('linksForm');
    const linksInput = document.getElementById('linksInput');
    const sizeInput = document.getElementById('sizeInput');
    const player2ScriptInput = document.getElementById('player2ScriptInput');
    const submitButton = document.getElementById('submitButton');
    const replaceButton = document.getElementById('replaceButton');
    const status = document.getElementById('status');
    
    // Load saved data
    loadSavedData();
    
    // Regular submit button (original functionality)
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        processLinks(false); // false = no replacement
    });
    
    // Replace button (new functionality)
    replaceButton.addEventListener('click', function(e) {
        e.preventDefault();
        processLinks(true); // true = with replacement
    });
    
    function processLinks(withReplacement) {
        const links = linksInput.value.trim();
        const size = sizeInput.value.trim();
        
        if (!links) {
            showStatus('Please enter at least one download link', 'error');
            return;
        }
        
        if (!size) {
            showStatus('Please enter file size for 1080p', 'error');
            return;
        }
        
        // Save data
        saveData(links, size);
        
        // Disable buttons during processing
        const activeButton = withReplacement ? replaceButton : submitButton;
        activeButton.disabled = true;
        const originalText = activeButton.textContent;
        activeButton.textContent = withReplacement ? 'Replacing & Processing...' : 'Processing...';
        
        // Send to content script
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {
                action: withReplacement ? 'replaceAndProcessLinks' : 'processLinks',
                links: links,
                size: size,
                replaceEpisode: withReplacement
            }, function(response) {
                // Re-enable button
                activeButton.disabled = false;
                activeButton.textContent = originalText;
                
                if (chrome.runtime.lastError) {
                    showStatus('Error: Make sure you are on the correct page', 'error');
                    return;
                }
                
                if (response) {
                    showStatus(response.message, response.type);
                    
                    // If replacement was successful, update the textarea with replaced links
                    if (withReplacement && response.type === 'success' && response.replacedLinks) {
                        linksInput.value = response.replacedLinks;
                        // Also save the updated links
                        saveData(response.replacedLinks, size);
                    }
                } else {
                    showStatus('Links processed successfully', 'success');
                }
            });
        });
    }
    
    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }
    
    function saveData(links, size, player2Scripts) {
        chrome.storage.local.set({
            savedLinks: links,
            savedSize: size,
            savedPlayer2Scripts: player2Scripts || ''
        });
    }
    
    function loadSavedData() {
        chrome.storage.local.get(['savedLinks', 'savedSize', 'savedPlayer2Scripts'], function(result) {
            if (result.savedLinks) {
                linksInput.value = result.savedLinks;
            }
            if (result.savedSize) {
                sizeInput.value = result.savedSize;
            }
            if (result.savedPlayer2Scripts) {
                player2ScriptInput.value = result.savedPlayer2Scripts;
            }
        });
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'showStatus') {
        const status = document.getElementById('status');
        if (status) {
            const statusElement = document.getElementById('status');
            statusElement.textContent = request.message;
            statusElement.className = `status ${request.type}`;
            statusElement.style.display = 'block';
            
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 5000);
        }
    }
});
