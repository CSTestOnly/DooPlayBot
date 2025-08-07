// Background script to handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'extract-files') {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Send message to content script to extract and copy files
      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'extractFileNames',
        copyToClipboard: true,
        showNotification: true
      });
      
      if (response && response.success) {
        // Show notification with count
        const count = response.count;
        const message = count > 0 
          ? `✅ Copied ${count} file name${count !== 1 ? 's' : ''} to clipboard!`
          : '❌ No video files found on this page';
          
        // Show browser notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iIzY2N2VlYSIvPgo8cGF0aCBkPSJNMTYgMjBIMzJWMjJIMTZWMjBaTTE2IDI0SDMyVjI2SDE2VjI0Wk0xNiAyOEgyOFYzMEgxNlYyOFoiIGZpbGw9IndoaXRlIi8+CjxwYXRoIGQ9Ik0xMiAxNkgzNlYzMkgxMlYxNlpNMTQgMThWMzBIMzRWMThIMTRaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
          title: 'File Name Extractor',
          message: message
        });
      }
    } catch (error) {
      console.error('Error in keyboard shortcut:', error);
      
      // Show error notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iOCIgZmlsbD0iI2ZmNjI2MiIvPgo8cGF0aCBkPSJNMjQgMTZMMjYgMjZIMjJMMjQgMTZaTTI0IDMwQzIzLjQ1IDMwIDIzIDI5LjU1IDIzIDI5QzIzIDI4LjQ1IDIzLjQ1IDI4IDI0IDI4QzI0LjU1IDI4IDI1IDI4LjQ1IDI1IDI5QzI1IDI5LjU1IDI0LjU1IDMwIDI0IDMwWiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==',
        title: 'File Name Extractor',
        message: '❌ Error: Please refresh the page and try again'
      });
    }
  }
});
