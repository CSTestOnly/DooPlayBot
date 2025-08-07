// Wait for the page to load
document.addEventListener('DOMContentLoaded', function() {
    initializeExtension();
});

// Also initialize if DOM is already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

function initializeExtension() {
    // Add keyboard event listener
    document.addEventListener('keydown', function(event) {
        // Check for CMD+J on Mac or Ctrl+J on other systems
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        const modifierKey = isMac ? event.metaKey : event.ctrlKey;
        
        if (modifierKey && event.key.toLowerCase() === 'j') {
            event.preventDefault(); // Prevent default browser behavior
            // Open extension popup instead of just clicking
            chrome.runtime.sendMessage({action: 'openPopup'});
        }
    });
    
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === 'processLinks') {
            processAndAddLinks(request.links, request.size, sendResponse, request.player2Scripts);
            return true; // Keep the message channel open for async response
        }
        if (request.action === 'replaceAndProcessLinks') {
            replaceEpisodeAndProcessLinks(request.links, request.size, sendResponse, request.player2Scripts);
            return true; // Keep the message channel open for async response
        }
        if (request.action === 'testClick') {
            clickAddLinksButton();
            sendResponse({message: 'Test click executed', type: 'success'});
        }
    });
    
    console.log('Auto Add Links extension loaded');
}

function replaceEpisodeAndProcessLinks(linksText, fileSize, sendResponse, player2Scripts) {
    try {
        console.log('🔄 Starting episode replacement and processing...');
        
        // Get episode number from page
        const episodeElement = document.getElementById('episodio');
        if (!episodeElement) {
            sendResponse({message: 'Episode element not found on page', type: 'error'});
            return;
        }
        
        const episodeNumber = episodeElement.value;
        if (!episodeNumber) {
            sendResponse({message: 'Episode number not found', type: 'error'});
            return;
        }
        
        console.log(`📺 Found episode number: ${episodeNumber}`);
        
        // Format episode number (ensure it's 2 digits)
        const formattedEpisodeNumber = episodeNumber.toString().padStart(2, '0');
        const newEpisodeCode = `E${formattedEpisodeNumber}`;
        
        console.log(`📝 New episode code: ${newEpisodeCode}`);
        
        // Replace episode numbers in links
        const originalLinks = linksText.split('\n').filter(link => link.trim() !== '');
        const replacedLinks = originalLinks.map(link => {
            // Replace any E01, E02, E03, etc. with the new episode number
            const updatedLink = link.replace(/E\d{2}/g, newEpisodeCode);
            
            console.log(`🔄 Original: ${link}`);
            console.log(`✅ Updated:  ${updatedLink}`);
            
            return updatedLink;
        });
        
        const replacedLinksText = replacedLinks.join('\n');
        
        // Show success message with replaced links
        showNotification(`Episode numbers replaced with ${newEpisodeCode}!`, 'success');
        
        // Now process the replaced links
        setTimeout(() => {
            processAndAddLinks(replacedLinksText, fileSize, (response) => {
                // Send back response with replaced links
                sendResponse({
                    message: response.message + ` (Episode ${formattedEpisodeNumber})`,
                    type: response.type,
                    replacedLinks: replacedLinksText
                });
            }, player2Scripts);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error in episode replacement:', error);
        sendResponse({message: 'Error replacing episode numbers: ' + error.message, type: 'error'});
    }
}

function processAndAddLinks(linksText, fileSize, sendResponse, player2Scripts) {
    try {
        const links = linksText.split('\n').filter(link => link.trim() !== '');
        
        if (links.length === 0) {
            sendResponse({message: 'No valid links found', type: 'error'});
            return;
        }
        
        // Find links by quality
        const link1080p = links.find(link => link.includes('1080p'));
        const link720p = links.find(link => link.includes('720p'));
        const link480p = links.find(link => link.includes('480p'));
        
        if (!link1080p) {
            sendResponse({message: 'No 1080p link found', type: 'error'});
            return;
        }
        
        // Store the 720p link globally for player URL use - ENSURE IT'S STORED
        if (link720p) {
            current720pLink = link720p;
            console.log(`🔗 Stored 720p link for player URL: ${current720pLink}`);
        } else {
            console.log(`⚠️ No 720p link found to store`);
        }
        
        // Debug: Log all detected links and their qualities
        console.log('🔍 All detected links:');
        if (link1080p) {
            const info1080p = extractLinkInfo(link1080p);
            console.log(`   1080p: ${link1080p} → Quality: ${info1080p.quality}`);
        }
        if (link720p) {
            const info720p = extractLinkInfo(link720p);
            console.log(`   720p: ${link720p} → Quality: ${info720p.quality}`);
        }
        if (link480p) {
            const info480p = extractLinkInfo(link480p);
            console.log(`   480p: ${link480p} → Quality: ${info480p.quality}`);
        }
        
        // Extract base information from 1080p link (for language only)
        const baseInfo = extractLinkInfo(link1080p);
        
        // Parse file size to calculate smaller sizes
        const sizeInfo = parseFileSize(fileSize);
        
        // Set flag to track completion
        let allLinksProcessed = false;
        
        // Process in 3 rounds
        processRound1(link1080p, baseInfo, sizeInfo.original, () => {
            if (link720p) {
                setTimeout(() => {
                    processRound2(link720p, baseInfo, sizeInfo.half, () => {
                        if (link480p) {
                            setTimeout(() => {
                                processRound3(link480p, baseInfo, sizeInfo.quarter, () => {
                                    allLinksProcessed = true;
                                    sendResponse({message: 'All links added successfully in 3 rounds!', type: 'success'});
                                    // Add player sources only once, after all rounds are complete
                                    setTimeout(() => {
                                        addPlayerSources(player2Scripts);
                                    }, 2000);
                                });
                            }, 1500);
                        } else {
                            allLinksProcessed = true;
                            sendResponse({message: '1080p and 720p links added successfully!', type: 'success'});
                            // Add player sources after 2 rounds
                            setTimeout(() => {
                                addPlayerSources(player2Scripts);
                            }, 2000);
                        }
                    });
                }, 1500);
            } else {
                allLinksProcessed = true;
                sendResponse({message: '1080p link added successfully!', type: 'success'});
                // Add player sources after 1 round
                setTimeout(() => {
                    addPlayerSources(player2Scripts);
                }, 2000);
            }
        });
        
    } catch (error) {
        console.error('Error processing links:', error);
        sendResponse({message: 'Error processing links: ' + error.message, type: 'error'});
    }
}

function parseFileSize(sizeStr) {
    // Extract number and unit from size string (e.g., "3 GB" -> 3, "GB")
    const match = sizeStr.match(/(\d+(?:\.\d+)?)\s*(GB|MB|KB)/i);
    if (!match) {
        return {
            original: sizeStr,
            half: sizeStr,
            quarter: sizeStr
        };
    }
    
    const number = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    // Calculate half size
    const half = (number / 2).toFixed(1);
    
    // Calculate quarter size
    const quarterValue = number / 4;
    let quarter;
    
    if (unit === 'GB' && quarterValue < 1) {
        // Convert to MB if less than 1 GB
        const quarterInMB = Math.round(quarterValue * 1000);
        quarter = `${quarterInMB} MB`;
    } else {
        quarter = `${quarterValue.toFixed(1)} ${unit}`;
    }
    
    return {
        original: `${number} ${unit}`,
        half: `${half} ${unit}`,
        quarter: quarter
    };
}

function processRound1(link, baseInfo, size, callback) {
    console.log('======= ROUND 1: 1080P PROCESSING =======');
    console.log('Link:', link);
    
    // Test the format detection first
    const detectedFormat = testLinkFormat(link);
    console.log(`Detected format: ${detectedFormat}`);
    
    showNotification('Round 1: Adding 1080p link...', 'info');
    
    if (!clickAddLinksButton()) {
        showNotification('Could not find Add Links button', 'error');
        return;
    }
    
    setTimeout(() => {
        // Create link info with detected format
        const linkInfo = {
            language: baseInfo.language,
            quality: `${detectedFormat} 1080p`,
            type: baseInfo.type
        };
        
        console.log(`Final 1080p quality: ${linkInfo.quality}`);
        
        if (fillAndSubmitForm(link, size, linkInfo)) {
            showNotification('1080p link added successfully!', 'success');
            callback();
        } else {
            showNotification('Failed to add 1080p link', 'error');
        }
    }, 800);
}

function processRound2(link, baseInfo, size, callback) {
    console.log('Starting Round 2: Adding 720p link');
    console.log('720p Link:', link);
    showNotification('Round 2: Adding 720p link...', 'info');
    
    if (!clickAddLinksButton()) {
        showNotification('Could not find Add Links button', 'error');
        return;
    }
    
    setTimeout(() => {
        // Re-extract quality info specifically from the 720p link
        const linkInfo = extractLinkInfo(link);
        // Force 720p resolution
        linkInfo.quality = getQualityWith720p(linkInfo.quality);
        
        console.log('Round 2 - Final link info:', linkInfo);
        
        if (fillAndSubmitForm(link, size, linkInfo)) {
            showNotification('720p link added successfully!', 'success');
            callback();
        } else {
            showNotification('Failed to add 720p link', 'error');
        }
    }, 800);
}

function processRound3(link, baseInfo, size, callback) {
    console.log('Starting Round 3: Adding 480p link');
    console.log('480p Link:', link);
    showNotification('Round 3: Adding 480p link...', 'info');
    
    if (!clickAddLinksButton()) {
        showNotification('Could not find Add Links button', 'error');
        return;
    }
    
    setTimeout(() => {
        // Re-extract quality info specifically from the 480p link
        const linkInfo = extractLinkInfo(link);
        // Force 480p resolution
        linkInfo.quality = getQualityWith480p(linkInfo.quality);
        
        console.log('Round 3 - Final link info:', linkInfo);
        
        if (fillAndSubmitForm(link, size, linkInfo)) {
            showNotification('480p link added successfully!', 'success');
            setTimeout(() => {
                showNotification('All download links processed!', 'success');
            }, 1000);
            callback();
        } else {
            showNotification('Failed to add 480p link', 'error');
        }
    }, 800);
}

function getQualityWith1080p(originalQuality) {
    // Extract format and replace resolution with 1080p
    const format = extractQualityFormat(originalQuality);
    return `${format} 1080p`;
}

function getQualityWith720p(originalQuality) {
    // Extract format and replace resolution with 720p
    const format = extractQualityFormat(originalQuality);
    return `${format} 720p`;
}

function getQualityWith480p(originalQuality) {
    // Extract format and replace resolution with 480p
    const format = extractQualityFormat(originalQuality);
    return `${format} 480p`;
}

function extractQualityFormat(qualityString) {
    // Extract the format part from quality string
    const format = qualityString.split(' ')[0];
    
    // Map common format variations to match dropdown exactly
    const formatMap = {
        'WEB-DL': 'WEB-DL',
        'WEBRip': 'WEBRip',
        'BluRay': 'BluRay',
        'WEBDL': 'WEBDL',
        'HDRip': 'HDRip',
        'HDTV': 'HDTV',
        'DVDRip': 'DVDRip',
        'HMAX': 'HMAX WEB-DL',
        'HD': 'HD CAM',
        'HC-HDRip': 'HC-HDRip',
        'HC-WEBRip': 'HC-WEBRip',
        'Leak': 'Leak HDRip',
        'PRE-WEBRip': 'PRE-WEBRip'
    };
    
    // Return mapped format or original if not found
    return formatMap[format] || format;
}

function extractLinkInfo(link) {
    const info = {
        language: null, // Changed to null - will only set if detected
        quality: 'WEB-DL 1080p',
        type: 'Direct & Telegram Download Links'
    };
    
    // Extract language - only if found in link
    const languages = ['Korean', 'Hindi', 'English', 'Tamil', 'Telugu', 'Kannada', 'Thai', 'Indonesian', 'Gujarati', 'Japanese', 'Malayalam', 'Chinese', 'Bengali', 'Spanish', 'Italian', 'French', 'Russian', 'Marathi', 'German', 'Ukrainian', 'Turkish'];
    
    for (let lang of languages) {
        if (link.toLowerCase().includes(lang.toLowerCase())) {
            info.language = lang;
            break;
        }
    }
    
    // Extract resolution first
    const resolutionMatch = link.match(/(1080p|720p|480p)/i);
    const resolution = resolutionMatch ? resolutionMatch[1] : '1080p';
    
    // Detect format from link with improved detection
    const detectedFormat = detectFormatFromLink(link);
    info.quality = `${detectedFormat} ${resolution}`;
    
    console.log(`🔍 Link analysis:`);
    console.log(`   Link: ${link}`);
    console.log(`   Detected format: ${detectedFormat}`);
    console.log(`   Detected resolution: ${resolution}`);
    console.log(`   Final quality: ${info.quality}`);
    
    return info;
}

function detectFormatFromLink(link) {
    console.log(`🔍 Analyzing link: ${link}`);
    
    // Convert to uppercase for easier matching
    const linkUpper = link.toUpperCase();
    
    // Check for formats in order of specificity
    if (linkUpper.includes('BLURAY') || linkUpper.includes('BLU-RAY')) {
        console.log(`✓ Found BluRay format`);
        return 'BluRay';
    }
    if (linkUpper.includes('WEBRIP')) {
        console.log(`✓ Found WEBRip format`);
        return 'WEBRip';
    }
    if (linkUpper.includes('WEB-DL')) {
        console.log(`✓ Found WEB-DL format`);
        return 'WEB-DL';
    }
    if (linkUpper.includes('WEBDL')) {
        console.log(`✓ Found WEBDL format`);
        return 'WEBDL';
    }
    if (linkUpper.includes('HDRIP')) {
        console.log(`✓ Found HDRip format`);
        return 'HDRip';
    }
    if (linkUpper.includes('HDTV')) {
        console.log(`✓ Found HDTV format`);
        return 'HDTV';
    }
    if (linkUpper.includes('DVDRIP')) {
        console.log(`✓ Found DVDRip format`);
        return 'DVDRip';
    }
    
    // Default to WEB-DL if nothing found
    console.log(`❌ No format detected, using WEB-DL as default`);
    return 'WEB-DL';
}

// Simple test function to check what format your link returns
function testLinkFormat(link) {
    console.log('=== TESTING LINK FORMAT ===');
    const format = detectFormatFromLink(link);
    console.log(`Result: ${format}`);
    return format;
}

function fillAndSubmitForm(singleLink, fileSize, linkInfo) {
    try {
        console.log(`🔄 Starting form fill process...`);
        console.log(`   Link: ${singleLink}`);
        console.log(`   Expected quality: ${linkInfo.quality}`);
        
        // Step 1: Check if form is visible
        const form = document.querySelector('.dform');
        if (!form || form.style.display === 'none') {
            console.log('❌ Form not visible, waiting...');
            return false;
        }

        // Step 2: Fill the type dropdown first
        const typeSelect = document.getElementById('dooplay_lfield_type');
        if (typeSelect) {
            typeSelect.value = linkInfo.type;
            console.log(`✅ Type set to: ${linkInfo.type}`);
        }

        // Step 3: Search and select language if detected
        const langSelect = document.getElementById('dooplay_lfield_lang');
        if (langSelect && linkInfo.language) {
            const options = langSelect.querySelectorAll('option');
            let languageFound = false;
            
            for (let option of options) {
                if (option.textContent.trim() === linkInfo.language) {
                    langSelect.value = option.value;
                    option.selected = true;
                    languageFound = true;
                    console.log(`✅ Language set to: ${linkInfo.language}`);
                    break;
                }
            }
            
            if (!languageFound) {
                console.log(`❌ Language "${linkInfo.language}" not found in dropdown`);
            }
        } else {
            console.log(`ℹ️ No language detected, keeping default`);
        }

        // Step 4: Find quality from link and select in dropdown 
        const qualSelect = document.getElementById('dooplay_lfield_qual');
        if (qualSelect) {
            console.log(`🔍 Looking for quality: "${linkInfo.quality}" in dropdown...`);
            
            const options = qualSelect.querySelectorAll('option');
            let qualityFound = false;
            
            // Log all available options for debugging
            console.log('📋 Available quality options:');
            options.forEach((option, index) => {
                const optionText = option.textContent.trim();
                console.log(`   ${index}: "${optionText}"`);
                
                if (optionText === linkInfo.quality) {
                    qualSelect.value = option.value;
                    option.selected = true;
                    qualityFound = true;
                    console.log(`✅ Quality matched and selected: "${linkInfo.quality}"`);
                }
            });
            
            if (!qualityFound) {
                console.log(`❌ Quality "${linkInfo.quality}" not found in dropdown`);
                // Try to find partial match
                const partialMatch = Array.from(options).find(option => {
                    const optionText = option.textContent.trim();
                    return optionText.includes(linkInfo.quality.split(' ')[0]) && 
                           optionText.includes(linkInfo.quality.split(' ')[1]);
                });
                
                if (partialMatch) {
                    qualSelect.value = partialMatch.value;
                    partialMatch.selected = true;
                    console.log(`✅ Partial match found and selected: "${partialMatch.textContent.trim()}"`);
                }
            }
        }

        // Step 5: Add file size
        const sizeInput = document.getElementById('dooplay_lfield_size');
        if (sizeInput) {
            sizeInput.value = fileSize;
            console.log(`✅ Size set to: ${fileSize}`);
        }

        // Step 6: Fill the links textarea
        const linksTextarea = document.getElementById('dooplay_lfield_urls');
        if (linksTextarea) {
            linksTextarea.value = singleLink;
            console.log(`✅ Link added to textarea`);
        }

        console.log(`📝 Form filled successfully!`);

        // Step 7: Wait then click submit (Add Links button)
        setTimeout(() => {
            const submitButton = document.getElementById('dooplay_anchor_postlinks');
            if (submitButton) {
                submitButton.click();
                console.log(`✅ Add Links button clicked!`);
            } else {
                console.log(`❌ Add Links submit button not found`);
            }
        }, 500);

        return true;
    } catch (error) {
        console.error('❌ Error filling form:', error);
        return false;
    }
}

function clickAddLinksButton() {
    // Look for the specific "Add Links" button
    const addLinksButton = document.getElementById('dooplay_anchor_showform');
    if (addLinksButton) {
        addLinksButton.click();
        console.log('Add Links button clicked');
        return true;
    }
    
    // Fallback: look for any button with "Add Links" text
    const allButtons = document.querySelectorAll('a, button');
    for (let button of allButtons) {
        if (button.textContent.trim() === 'Add Links') {
            button.click();
            console.log('Add Links button clicked via fallback');
            return true;
        }
    }
    
    console.log('Add Links button not found');
    return false;
}

function addPlayerSources(player2Scripts) {
    console.log('Starting to add player sources...');
    console.log('Player 2 scripts provided:', !!player2Scripts);
    showNotification('Adding player sources...', 'info');
    
    const titles = [
        'Player 01 [No Ads   -  CS Player]',
        'Player 02 [With Ads - Evo Player]'
    ];
    
    const dropdownValues = [
        'mp4',        // Player 01 - URL MP4
        'dtshcode'    // Player 02 - Shortcode or HTML
    ];
    
    // First, add required rows (we need 1 additional row since there's usually 1 by default)
    const requiredRows = 1;
    
    if (addPlayerRows(requiredRows)) {
        // Wait for rows to be added, then fill inputs
        setTimeout(() => {
            fillPlayerInputs(titles, dropdownValues, player2Scripts);
        }, 1000);
    } else {
        // If adding rows failed, try to fill existing inputs
        fillPlayerInputs(titles, dropdownValues, player2Scripts);
    }
}

function addPlayerRows(numberOfRows) {
    console.log(`Attempting to add ${numberOfRows} player rows`);
    
    // Look for the add row link
    const addRowLink = document.querySelector('p.repeater a#add-row.add_row');
    
    if (!addRowLink) {
        console.error('Add row link not found');
        return false;
    }
    
    // Get current number of input rows before adding
    const initialInputs = document.querySelectorAll('td.text_player input.widefat[name="name[]"]').length;
    console.log(`Initial player inputs: ${initialInputs}`);
    
    for (let i = 0; i < numberOfRows; i++) {
        addRowLink.click();
        console.log(`Clicked add row ${i + 1}`);
    }
    
    // Wait and verify the number of rows
    setTimeout(() => {
        const finalInputs = document.querySelectorAll('td.text_player input.widefat[name="name[]"]').length;
        console.log(`Final player inputs: ${finalInputs}`);
    }, 500);
    
    return true;
}

function fillPlayerInputs(titles, dropdownValues) {
    console.log('Filling player input boxes');
    
    // Fill title inputs
    const titleInputs = document.querySelectorAll('td.text_player input.widefat[name="name[]"]');
    console.log(`Found ${titleInputs.length} player title input fields`);
    
    // Fill available inputs up to the number of titles or available inputs
    const inputsToFill = Math.min(titleInputs.length, titles.length);
    
    for (let i = 0; i < inputsToFill; i++) {
        const input = titleInputs[i];
        input.value = titles[i];
        
        // Trigger events to ensure changes are registered
        const events = ['input', 'change', 'blur'];
        events.forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            input.dispatchEvent(event);
        });
        
        console.log(`Filled player title ${i + 1}: ${titles[i]}`);
    }
    
    // Fill dropdown selectors
    fillPlayerDropdowns(dropdownValues);
    
    // Fill player URLs (specifically for the first player) - INCREASED TIMEOUT
    setTimeout(() => {
        console.log('🎯 About to call fillPlayerUrls...');
        fillPlayerUrls();
    }, 1500); // Increased timeout to ensure DOM is ready
    
    showNotification(`Added ${inputsToFill} player sources successfully!`, 'success');
}

function fillPlayerDropdowns(dropdownValues) {
    // Find all select dropdowns with name="select[]"
    const selectDropdowns = document.querySelectorAll('select[name="select[]"]');
    
    console.log(`Found ${selectDropdowns.length} dropdown fields`);
    
    const dropdownsToFill = Math.min(selectDropdowns.length, dropdownValues.length);
    
    for (let i = 0; i < dropdownsToFill; i++) {
        const select = selectDropdowns[i];
        const value = dropdownValues[i];
        
        // Set the value
        select.value = value;
        
        // Trigger change event to ensure it's registered
        const changeEvent = new Event('change', { bubbles: true });
        select.dispatchEvent(changeEvent);
        
        console.log(`Set dropdown ${i + 1} to: ${value}`);
    }
    
    console.log(`Filled ${dropdownsToFill} dropdown fields`);
}

// FIXED: Function to fill player URLs with improved URL transformation
function fillPlayerUrls() {
    console.log('🎬 Starting to fill player URLs...');
    console.log(`🔍 Stored 720p link: ${current720pLink}`);
    
    // Get the 720p link from the processed links
    const link720p = getCurrentProcessed720pLink();
    
    if (!link720p) {
        console.log('❌ No 720p link available for player URL');
        console.log(`🔍 Current stored link: ${current720pLink}`);
        showNotification('No 720p link found for player URL', 'error');
        return;
    }
    
    console.log(`✅ Using 720p link: ${link720p}`);
    
    // Transform the 720p link as requested
    const transformedUrl = transform720pLink(link720p);
    
    if (!transformedUrl) {
        console.log('❌ Failed to transform 720p link');
        showNotification('Failed to transform 720p link', 'error');
        return;
    }
    
    console.log(`🎯 Transformed player URL: ${transformedUrl}`);
    
    // Try multiple selectors to find player URL input fields
    let urlInputs = document.querySelectorAll('td.url_player input.widefat[name="url[]"]');
    
    if (urlInputs.length === 0) {
        // Try alternative selectors
        urlInputs = document.querySelectorAll('input[name="url[]"]');
        console.log(`🔍 Found ${urlInputs.length} URL inputs with alternative selector`);
    }
    
    if (urlInputs.length === 0) {
        // Try even more generic selector
        urlInputs = document.querySelectorAll('input[placeholder*="URL"], input[placeholder*="url"], input[type="url"]');
        console.log(`🔍 Found ${urlInputs.length} URL inputs with generic selector`);
    }
    
    console.log(`🔍 Total URL input fields found: ${urlInputs.length}`);
    
    // Debug: Log all found input elements
    urlInputs.forEach((input, index) => {
        console.log(`   Input ${index}: ${input.name || 'no-name'} - ${input.placeholder || 'no-placeholder'} - ${input.className}`);
    });
    
    // Fill the first player URL (index 0)
    if (urlInputs.length > 0) {
        const firstUrlInput = urlInputs[0];
        firstUrlInput.value = transformedUrl;
        
        // Trigger events to ensure changes are registered
        const events = ['input', 'change', 'blur', 'keyup'];
        events.forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            firstUrlInput.dispatchEvent(event);
        });
        
        // Force focus and blur to ensure value sticks
        firstUrlInput.focus();
        setTimeout(() => {
            firstUrlInput.blur();
        }, 100);
        
        console.log(`✅ Successfully filled first player URL: ${transformedUrl}`);
        showNotification('Player URL added successfully!', 'success');
        
        // Verify the value was set
        setTimeout(() => {
            console.log(`🔍 Verification - Input value is now: "${firstUrlInput.value}"`);
        }, 200);
        
    } else {
        console.log('❌ No player URL input fields found with any selector');
        showNotification('No player URL fields found', 'error');
        
        // Debug: Show all input elements on the page
        const allInputs = document.querySelectorAll('input');
        console.log(`🔍 Debug: Total inputs on page: ${allInputs.length}`);
        allInputs.forEach((input, index) => {
            if (input.type === 'text' || input.type === 'url' || !input.type) {
                console.log(`   Input ${index}: name="${input.name}" placeholder="${input.placeholder}" class="${input.className}"`);
            }
        });
    }
}

// Store the current 720p link globally for access
let current720pLink = null;

// Function to get the current 720p link
function getCurrentProcessed720pLink() {
    return current720pLink;
}

// FIXED: Function to transform 720p link with improved URL decoding
function transform720pLink(originalLink) {
    try {
        console.log('🔄 Original 720p link:', originalLink);
        
        // Method 1: Try to extract filename using regex pattern
        // Look for pattern like /server5/1:/202508/ or similar path structures
        const pathMatch = originalLink.match(/\/[^\/]*\/[^\/]*:\/[^\/]*\/(.+)$/);
        
        let filename = null;
        
        if (pathMatch) {
            filename = pathMatch[1];
            console.log('✅ Filename extracted using regex pattern:', filename);
        } else {
            // Method 2: Fallback - get everything after the last /
            const lastSlashIndex = originalLink.lastIndexOf('/');
            if (lastSlashIndex !== -1) {
                filename = originalLink.substring(lastSlashIndex + 1);
                console.log('✅ Filename extracted using last slash method:', filename);
            } else {
                console.log('❌ Could not extract filename from link');
                return null;
            }
        }
        
        // Decode URL-encoded characters properly
        // First decode the URL encoding (%5B to [, %5D to ])
        filename = decodeURIComponent(filename);
        console.log('🔄 After URL decoding:', filename);
        
        // Additional decoding for common patterns
        filename = filename.replace(/%20/g, ' '); // Space
        filename = filename.replace(/%5B/g, '['); // Left bracket
        filename = filename.replace(/%5D/g, ']'); // Right bracket
        filename = filename.replace(/%2D/g, '-'); // Dash
        filename = filename.replace(/%2E/g, '.'); // Dot
        
        console.log('🔄 After additional decoding:', filename);
        
        // Create the new URL with cscloud12.online
        const transformedUrl = `https://cscloud12.online/${filename}`;
        
        console.log('✅ Final transformed URL:', transformedUrl);
        return transformedUrl;
        
    } catch (error) {
        console.error('❌ Error transforming 720p link:', error);
        return null;
    }
}

// NEW: Function to fill Player 2 URL with iframe script
function fillPlayer2Url(player2Scripts) {
    console.log('🎬 Starting to fill Player 2 URL...');
    
    if (!player2Scripts || player2Scripts.trim() === '') {
        console.log('❌ No Player 2 scripts provided');
        return;
    }
    
    // Get Player 1 URL to extract filename
    const urlInputs = document.querySelectorAll('input[name="url[]"]');
    if (urlInputs.length < 1) {
        console.log('❌ No Player 1 URL found to extract filename from');
        return;
    }
    
    const player1Url = urlInputs[0].value;
    if (!player1Url) {
        console.log('❌ Player 1 URL is empty');
        return;
    }
    
    console.log(`🔍 Player 1 URL: ${player1Url}`);
    
    // Extract filename from Player 1 URL
    let filename = '';
    try {
        // Remove domain and path, keep only filename
        const urlParts = player1Url.split('/');
        filename = urlParts[urlParts.length - 1];
        
        // Remove any query parameters or fragments
        filename = filename.split('?')[0].split('#')[0];
        
        console.log(`📄 Extracted filename: ${filename}`);
    } catch (error) {
        console.error('❌ Error extracting filename:', error);
        return;
    }
    
    // Parse Player 2 scripts to find matching iframe
    const scriptLines = player2Scripts.split('\n').filter(line => line.trim() !== '');
    let matchedIframe = '';
    
    for (let line of scriptLines) {
        // Check if line contains the filename
        if (line.includes(filename)) {
            console.log(`✅ Found matching line: ${line}`);
            
            // Extract iframe code (everything after the filename and " : ")
            const parts = line.split(' : ');
            if (parts.length >= 2) {
                matchedIframe = parts.slice(1).join(' : '); // In case there are multiple " : " in iframe
                console.log(`🎯 Extracted iframe: ${matchedIframe}`);
                break;
            }
        }
    }
    
    if (!matchedIframe) {
        console.log(`❌ No matching iframe found for filename: ${filename}`);
        showNotification(`No Player 2 script found for ${filename}`, 'error');
        return;
    }
    
    // Fill Player 2 URL field (second URL input)
    if (urlInputs.length >= 2) {
        const player2UrlInput = urlInputs[1];
        player2UrlInput.value = matchedIframe;
        
        // Trigger events to ensure changes are registered
        const events = ['input', 'change', 'blur', 'keyup'];
        events.forEach(eventType => {
            const event = new Event(eventType, { bubbles: true });
            player2UrlInput.dispatchEvent(event);
        });
        
        // Force focus and blur to ensure value sticks
        player2UrlInput.focus();
        setTimeout(() => {
            player2UrlInput.blur();
        }, 100);
        
        console.log(`✅ Successfully filled Player 2 URL with iframe`);
        showNotification('Player 2 iframe added successfully!', 'success');
        
        // Verify the value was set
        setTimeout(() => {
            console.log(`🔍 Player 2 Verification - Input value length: ${player2UrlInput.value.length}`);
        }, 200);
        
    } else {
        console.log('❌ Player 2 URL input field not found');
        showNotification('Player 2 URL field not found', 'error');
    }
}

function showNotification(message, type = 'success') {
    // Create notification element
    const notification = document.createElement('div');
    
    let backgroundColor;
    switch(type) {
        case 'error':
            backgroundColor = '#f44336';
            break;
        case 'info':
            backgroundColor = '#2196F3';
            break;
        case 'success':
        default:
            backgroundColor = '#4CAF50';
            break;
    }
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${backgroundColor};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        font-family: Arial, sans-serif;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        transition: opacity 0.3s ease;
        max-width: 300px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after different times based on type
    const duration = type === 'info' ? 2000 : 4000;
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}
