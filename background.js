// background.js - service worker for handling downloads.
// Attempts to fetch each URL and trigger chrome.downloads.download with blob URL.
// If fetch fails (CORS or other), asks content script to perform fallback anchor download.

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'download' && msg.items) {
    (async () => {
      for (const item of msg.items) {
        try {
          // Try fetch in service worker
          const resp = await fetch(item.url);
          if (!resp.ok) throw new Error('Network response not ok');
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          // start download
          chrome.downloads.download({ url: blobUrl, filename: item.filename, conflictAction: 'uniquify' }, (id) => {
            // revoke later
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60 * 1000);
          });
        } catch (err) {
          // If any error (CORS etc.), forward to the page to do an anchor download there
          try {
            if (sender && sender.tab && sender.tab.id) {
              chrome.tabs.sendMessage(sender.tab.id, { type: 'download-fallback', item: item });
            }
          } catch (e) {
            console.error('Failed to send fallback message', e);
          }
        }
      }
    })();
    sendResponse({ status: 'ok' });
    return true;
  }
});