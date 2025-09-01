// content.js - Updated: buffer-then-record approach using MediaRecorder + captureStream
// Shows per-item progress bar while buffering/recording, then downloads blob and removes item from panel.
// Note: This records the playing media into a webm; filename uses .webm extension by default.

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
  batchPanel.style.width = '360px';
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
    row.style.flexDirection = 'column';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'stretch';
    row.style.marginBottom = '8px';
    row.style.padding = '6px';
    row.style.background = 'rgba(255,255,255,0.04)';
    row.style.borderRadius = '6px';

    const top = document.createElement('div');
    top.style.display = 'flex';
    top.style.justifyContent = 'space-between';
    top.style.alignItems = 'center';

    const label = document.createElement('span');
    label.innerText = info.filename;
    label.style.flex = '1';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';
    label.style.marginRight = '8px';

    const status = document.createElement('span');
    status.innerText = info.status || '';
    status.style.marginLeft = '8px';
    status.style.fontSize = '12px';
    status.style.opacity = '0.9';

    top.appendChild(label);

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.gap = '6px';

    const dbtn = document.createElement('button');
    dbtn.innerText = info.status === 'recording' ? '...' : 'DL';
    dbtn.style.cursor = 'pointer';
    dbtn.onclick = (e) => {
      e.stopPropagation();
      if (info.status === 'recording') return; // already recording
      startRecordProcess(info.src, info.filename, id);
    };

    const rm = document.createElement('button');
    rm.innerText = '✕';
    rm.style.cursor = 'pointer';
    rm.onclick = (e) => {
      e.stopPropagation();
      detectedItems.delete(id);
      refreshPanel();
    };

    controls.appendChild(dbtn);
    controls.appendChild(rm);
    top.appendChild(controls);

    row.appendChild(top);

    // progress bar
    const progWrap = document.createElement('div');
    progWrap.style.height = '8px';
    progWrap.style.background = 'rgba(0,0,0,0.25)';
    progWrap.style.borderRadius = '4px';
    progWrap.style.marginTop = '8px';

    const prog = document.createElement('div');
    prog.style.height = '100%';
    prog.style.width = (info.progress || 0) + '%';
    prog.style.background = 'linear-gradient(90deg, rgba(100,200,255,0.9), rgba(60,140,200,0.9))';
    prog.style.borderRadius = '4px';
    progWrap.appendChild(prog);

    // textual percent
    const pct = document.createElement('div');
    pct.style.fontSize = '11px';
    pct.style.marginTop = '6px';
    pct.style.opacity = '0.9';
    pct.innerText = (info.progress || 0).toFixed(0) + '%';

    row.appendChild(progWrap);
    row.appendChild(pct);

    // attach to dom and store refs
    list.appendChild(row);
    // store refs for updates
    info._ui = { prog, pct, statusElem: status };
  }
}

function updateItemProgress(id, percent, statusText) {
  const info = detectedItems.get(id);
  if (!info) return;
  info.progress = percent;
  if (statusText) info.status = statusText;
  if (info._ui) {
    info._ui.prog.style.width = percent + '%';
    info._ui.pct.innerText = percent.toFixed(0) + '%';
    info._ui.statusElem.innerText = info.status || '';
  }
}

// remove item
function removeItem(id) {
  detectedItems.delete(id);
  refreshPanel();
}

function downloadSelected(ids) {
  for (const id of ids) {
    const info = detectedItems.get(id);
    if (!info) continue;
    if (info.status === 'recording') continue;
    startRecordProcess(info.src, info.filename, id);
  }
}

// Start recording process: create an offscreen video, play it muted, captureStream, record via MediaRecorder
async function startRecordProcess(src, filename, id) {
  const info = detectedItems.get(id);
  if (!info) return;
  info.status = 'recording';
  info.progress = 0;
  refreshPanel();

  // create offscreen/cloned video element
  const video = document.createElement('video');
  video.src = src;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  video.style.position = 'fixed';
  video.style.left = '-9999px';
  video.style.width = '1px';
  video.style.height = '1px';
  video.autoplay = false;
  // attempt to ensure it can play without attaching UI
  document.body.appendChild(video);

  // helper: wait for metadata to load (duration)
  await new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      // proceed even if metadata not loaded after 8s
      resolve();
    }, 8000);
    video.addEventListener('loadedmetadata', () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });

  // set playbackRate to speed up buffering if supported
  try { video.playbackRate = 2.0; } catch(e){}

  // try to play; browsers may block autoplay unless muted (we muted it)
  try {
    await video.play();
  } catch (e) {
    // If autoplay blocked, try to user-interaction fallback: inform user
    info.status = 'play-blocked';
    updateItemProgress(id, 0, 'play blocked - click DL to start');
    return;
  }

  // capture stream
  let stream = null;
  try {
    if (video.captureStream) stream = video.captureStream();
    else if (video.mozCaptureStream) stream = video.mozCaptureStream();
  } catch (e) {
    console.error('captureStream failed', e);
    stream = null;
  }

  if (!stream) {
    // fallback: tell background to fetch (existing behavior)
    chrome.runtime.sendMessage({ type: 'download', items: [{ url: src, filename }] }, (resp) => {});
    removeItem(id);
    video.remove();
    return;
  }

  // prepare MediaRecorder
  let options = { mimeType: 'video/webm;codecs=vp9' };
  let recorder;
  try {
    recorder = new MediaRecorder(stream, options);
  } catch (e) {
    try { options = { mimeType: 'video/webm;codecs=vp8' }; recorder = new MediaRecorder(stream, options); }
    catch (e2) { options = {}; recorder = new MediaRecorder(stream, options); }
  }

  const chunks = [];
  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) chunks.push(ev.data);
  };

  recorder.onerror = (ev) => {
    console.error('MediaRecorder error', ev);
  };

  recorder.start(1000); // collect data every 1s
  info.status = 'recording';
  updateItemProgress(id, 1, 'recording');

  // progress updater based on buffered ranges or currentTime/duration
  let lastPercent = 0;
  const startTime = Date.now();
  const progressTimer = setInterval(() => {
    try {
      let percent = 0;
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        // use played or buffered to estimate
        const buffered = video.buffered;
        if (buffered && buffered.length) {
          const end = buffered.end(buffered.length - 1);
          percent = Math.min(99, (end / video.duration) * 100);
        } else {
          percent = Math.min(99, (video.currentTime / Math.max(video.duration, 1)) * 100);
        }
      } else {
        // unknown duration - estimate by elapsed recording time (no good total)
        const elapsed = (Date.now() - startTime) / 1000;
        percent = Math.min(90, elapsed / 10 * 100); // arbitrary ramp
      }
      if (percent - lastPercent >= 1) {
        lastPercent = percent;
        updateItemProgress(id, percent, 'recording');
      }
    } catch (e) {}
  }, 800);

  // wait for end: either 'ended' event or we detect we've played near duration
  await new Promise((resolve) => {
    const onEnded = () => resolve();
    video.addEventListener('ended', onEnded, { once: true });
    // Also guard: if duration known, watch for currentTime close to duration
    const checkTimer = setInterval(() => {
      if (video.duration && isFinite(video.duration) && (video.currentTime >= video.duration - 0.5)) {
        clearInterval(checkTimer);
        resolve();
      }
    }, 500);
    // Safety timeout: stop after 5 minutes
    setTimeout(() => resolve(), 5 * 60 * 1000);
  });

  // stop recorder
  try { recorder.stop(); } catch (e) {}
  clearInterval(progressTimer);

  // wait a moment for final dataavailable
  await new Promise((r) => setTimeout(r, 800));

  // assemble blob
  const blob = new Blob(chunks, { type: recorder && recorder.mimeType ? recorder.mimeType : 'video/webm' });
  const ext = blob.type && blob.type.includes('webm') ? 'webm' : 'mp4';
  const finalName = filename.endsWith('.' + ext) ? filename : (filename.replace(/\.[^/.]+$/, '') + '.' + ext);

  // create anchor download in page context
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // update progress to 100% and remove
  updateItemProgress(id, 100, 'done');
  setTimeout(() => {
    try { URL.revokeObjectURL(blobUrl); } catch(e) {}
    removeItem(id);
  }, 1500);

  // cleanup
  try { video.pause(); video.remove(); } catch (e) {}
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
      const filename = getFilenameFromUrl(src, 'telegram-video');
      const id = Math.random().toString(36).slice(2,9);
      detectedItems.set(id, { src, filename, status: 'queued', progress: 0 });
      refreshPanel();
      // start immediately
      startRecordProcess(src, filename, id);
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
      detectedItems.set(id, { src, filename, status: 'queued', progress: 0 });
      refreshPanel();
      // simple download via anchor
      (async () => {
        try {
          const resp = await fetch(src);
          const blob = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(blobUrl), 60*1000);
          removeItem(id);
        } catch (e) {
          // fallback: send to background
          chrome.runtime.sendMessage({ type: 'download', items: [{ url: src, filename }] }, (resp) => {});
          removeItem(id);
        }
      })();
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
    // fallback: create anchor download
    const item = msg.item;
    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.filename || getFilenameFromUrl(item.url);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
});
