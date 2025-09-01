// content.js - detects media on web.telegram.org, injects per-item download UI and a batch panel.
// Personal-use extension.

const PROCESSED_ATTR = 'data-tg-downloader-processed';
const detectedItems = new Map();

function createButton(label) {
  const btn = document.createElement('button');
  btn.innerText = label;
  btn.style.position = 'absolute';
  btn.style.zIndex = '999999';
  btn.style.padding = '6px 8px';
  btn.style.fontSize = '12px';
  btn.style.borderRadius = '6px';
  btn.style.border = 'none';
  btn.style.background = 'rgba(0,0,0,0.6)';
  btn.style.color = 'white';
  btn.style.cursor = 'pointer';
  btn.style.backdropFilter = 'blur(4px)';
  return btn;
}

function getFilenameFromUrl(url, defaultName='media') {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || defaultName;
    return decodeURIComponent(last.split('?')[0]);
  } catch (e) {
    return defaultName;
  }
}

let batchPanel = null;

function ensureBatchPanel() {
  if (batchPanel) return batchPanel;
  batchPanel = document.createElement('div');
  batchPanel.id = 'tg-downloader-panel';
  batchPanel.style.position = 'fixed';
  batchPanel.style.right = '12px';
  batchPanel.style.bottom = '12px';
  batchPanel.style.width = '320px';
  batchPanel.style.maxHeight = '60vh';
  batchPanel.style.overflow = 'auto';
  batchPanel.style.zIndex = '999999';
  batchPanel.style.background = 'rgba(24,24,24,0.95)';
  batchPanel.style.color = 'white';
  batchPanel.style.borderRadius = '8px';
  batchPanel.style.padding = '8px';
  batchPanel.style.fontFamily = 'Arial, sans-serif';
  batchPanel.style.fontSize = '13px';
  batchPanel.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '6px';

  const title = document.createElement('strong');
  title.innerText = 'TG Downloader';
  header.appendChild(title);

  const btnAll = document.createElement('button');
  btnAll.innerText = 'Download All';
  btnAll.style.cursor = 'pointer';
  btnAll.onclick = () => downloadSelected(Array.from(detectedItems.keys()));
  header.appendChild(btnAll);

  batchPanel.appendChild(header);

  const list = document.createElement('div');
  list.id = 'tg-downloader-list';
  batchPanel.appendChild(list);

  document.body.appendChild(batchPanel);
  return batchPanel;
}

function refreshPanel() {
  const panel = ensureBatchPanel();
  const list = panel.querySelector('#tg-downloader-list');
  list.innerHTML = '';
  for (const [id, info] of detectedItems) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.marginBottom = '6px';

    const label = document.createElement('span');
    label.innerText = info.filename;
    label.style.flex = '1';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    label.style.marginRight = '8px';

    const dbtn = document.createElement('button');
    dbtn.innerText = 'DL';
    dbtn.style.cursor = 'pointer';
    dbtn.onclick = (e) => {
      e.stopPropagation();
      downloadSelected([id]);
    };

    row.appendChild(label);
    row.appendChild(dbtn);
    list.appendChild(row);
  }
}

function downloadSelected(ids) {
  const items = ids.map(id => ({ url: detectedItems.get(id).url, filename: detectedItems.get(id).filename }));
  // Send to background service worker to attempt fetch+download there. If it fails, background will postMessage back for fallback.
  chrome.runtime.sendMessage({ type: 'download', items }, resp => {});
}

// Attach overlay button to video
function attachOverlayToVideo(video) {
  try {
    if (video[PROCESSED_ATTR]) return;
    video[PROCESSED_ATTR] = '1';
    const btn = createButton('Download');
    document.body.appendChild(btn);

    function positionButton() {
      const rect = video.getBoundingClientRect();
      btn.style.left = (window.scrollX + rect.left + 8) + 'px';
      btn.style.top = (window.scrollY + rect.top + 8) + 'px';
    }

    btn.onclick = (e) => {
      e.stopPropagation();
      const src = video.currentSrc || video.src;
      if (!src) {
        alert('No source URL found for this video.');
        return;
      }
      const filename = getFilenameFromUrl(src, 'telegram-video.mp4');
      const id = Math.random().toString(36).slice(2,9);
      detectedItems.set(id, { url: src, filename: filename, el: video });
      refreshPanel();
    };

    positionButton();
    window.addEventListener('scroll', positionButton);
    window.addEventListener('resize', positionButton);
    // reposition periodically in case UI shifts
    setInterval(positionButton, 1500);
  } catch (e) {
    console.error('attachOverlayToVideo error', e);
  }
}

function attachOverlayToImage(img) {
  try {
    if (img[PROCESSED_ATTR]) return;
    img[PROCESSED_ATTR] = '1';
    img.addEventListener('click', (e) => {
      const src = img.src;
      const filename = getFilenameFromUrl(src, 'telegram-image.jpg');
      const id = Math.random().toString(36).slice(2,9);
      detectedItems.set(id, { url: src, filename: filename, el: img });
      refreshPanel();
    });
  } catch (e) {
    // ignore
  }
}

const observer = new MutationObserver(mutations => {
  for (const m of mutations) {
    if (m.type === 'childList') {
      m.addedNodes.forEach(node => {
        try {
          if (node instanceof Element) {
            const videos = node.querySelectorAll ? node.querySelectorAll('video') : [];
            for (const v of Array.from(videos)) attachOverlayToVideo(v);
            const imgs = node.querySelectorAll ? node.querySelectorAll('img') : [];
            for (const i of Array.from(imgs)) attachOverlayToImage(i);
            if (node.tagName === 'VIDEO') attachOverlayToVideo(node);
            if (node.tagName === 'IMG') attachOverlayToImage(node);
          }
        } catch (e) {}
      });
    }
  }
});

function scanInitial() {
  const videos = document.querySelectorAll('video');
  for (const v of Array.from(videos)) attachOverlayToVideo(v);
  const imgs = document.querySelectorAll('img');
  for (const i of Array.from(imgs)) attachOverlayToImage(i);
}

observer.observe(document.body, { childList: true, subtree: true });
scanInitial();
ensureBatchPanel();

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'download-fallback' && msg.item) {
    anchorDownload(msg.item.url, msg.item.filename || getFilenameFromUrl(msg.item.url));
  }
});

function anchorDownload(url, filename) {
  (async () => {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60 * 1000);
    } catch (err) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  })();
}