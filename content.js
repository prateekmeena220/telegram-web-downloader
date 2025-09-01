// content.js

console.log("[TG Downloader] content script loaded");

// Utility: wait for element
function waitForElm(selector) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

// Inject DL button into video messages
function injectDownloadButtons(node) {
  if (!node.querySelector) return;
  if (node.querySelector(".tgdl-btn")) return; // avoid duplicate

  const videoThumb = node.querySelector("video, .VideoMessage, .MessageVideo");
  if (videoThumb) {
    const btn = document.createElement("button");
    btn.innerText = "DL";
    btn.className = "tgdl-btn";
    btn.style.cssText = `
      margin-left: 8px;
      padding: 2px 6px;
      font-size: 12px;
      border: none;
      border-radius: 4px;
      background: #4cafef;
      color: white;
      cursor: pointer;
    `;

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerText = "0%";

      try {
        const meta = extractVideoMeta(node);
        if (!meta) {
          alert("Could not extract video metadata");
          btn.innerText = "Err";
          return;
        }
        console.log("[TG Downloader] Meta:", meta);

        const blob = await downloadVideoWithProgress(meta, percent => {
          btn.innerText = percent + "%";
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = (meta.title || "video") + ".mp4";
        document.body.appendChild(a);
        a.click();
        a.remove();

        URL.revokeObjectURL(url);
        btn.innerText = "DL";
      } catch (e) {
        console.error("[TG Downloader] Download failed", e);
        btn.innerText = "Err";
      } finally {
        btn.disabled = false;
      }
    });

    node.appendChild(btn);
  }
}

// MutationObserver to watch new messages
function observeMessages() {
  const chatContainer = document.querySelector(".MessageList, .chat-content, [class*='Message']");

  if (!chatContainer) {
    console.log("[TG Downloader] Chat container not found, retrying...");
    setTimeout(observeMessages, 2000);
    return;
  }

  const observer = new MutationObserver(mutations => {
    for (let mutation of mutations) {
      for (let added of mutation.addedNodes) {
        injectDownloadButtons(added);
      }
    }
  });

  observer.observe(chatContainer, { childList: true, subtree: true });

  // Initial inject
  chatContainer.querySelectorAll(".Message").forEach(injectDownloadButtons);
}

// Extract video metadata (using React props on DOM)
function extractVideoMeta(node) {
  // Try reading from dataset (Telegram Web stores metadata in DOM attributes sometimes)
  const reactPropsKey = Object.keys(node).find(k => k.startsWith("__reactProps"));
  if (reactPropsKey && node[reactPropsKey]) {
    const props = node[reactPropsKey];
    if (props && props.children && props.children.props && props.children.props.message) {
      const msg = props.children.props.message;
      const doc = msg.media?.document;
      if (doc) {
        return {
          id: doc.id,
          access_hash: doc.access_hash,
          file_reference: doc.file_reference,
          dcId: doc.dc_id,
          size: doc.size,
          mime_type: doc.mime_type,
          title: doc.attributes?.find(a => a.file_name)?.file_name || "video"
        };
      }
    }
  }
  return null;
}

// MTProto chunked downloader
async function downloadVideoWithProgress(meta, onProgress) {
  const chunkSize = 512 * 1024; // 512 KB
  let offset = 0;
  let received = 0;
  const chunks = [];

  while (received < meta.size) {
    const chunk = await window.mtproto.invoke("upload.getFile", {
      location: {
        _: "inputDocumentFileLocation",
        id: meta.id,
        access_hash: meta.access_hash,
        file_reference: meta.file_reference
      },
      offset,
      limit: chunkSize
    });

    const bytes = chunk.bytes;
    chunks.push(bytes);

    received += bytes.length;
    offset += bytes.length;

    const percent = Math.floor((received / meta.size) * 100);
    onProgress(percent);
  }

  return new Blob(chunks, { type: "video/mp4" });
}

// Start
waitForElm(".MessageList, .chat-content").then(observeMessages);
