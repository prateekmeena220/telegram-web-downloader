document.addEventListener('DOMContentLoaded', () => {
  const openPanel = document.getElementById('openPanel');
  openPanel.onclick = async () => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const el = document.getElementById('tg-downloader-panel');
          if (el) el.style.display = 'block';
          else alert('Panel not found on this page.');
        }
      });
    } catch (e) {
      alert('Unable to run script on the page. Make sure you are on https://web.telegram.org');
    }
  };
});
