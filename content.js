// --- Utility: Create progress bar inside DL button ---
function attachProgressBar(button) {
  let bar = document.createElement("div");
  bar.style.height = "4px";
  bar.style.width = "0%";
  bar.style.background = "#4caf50";
  bar.style.transition = "width 0.2s";
  bar.className = "tg-download-progress";
  button.appendChild(bar);
  return bar;
}

// --- Main downloader ---
async function downloadTelegramFile(fileLocation, fileName, fileSize, button) {
  const chunkSize = 1024 * 1024; // 1MB chunks
  const totalChunks = Math.ceil(fileSize / chunkSize);
  let chunks = [];

  const bar = attachProgressBar(button);

  for (let offset = 0, i = 0; offset < fileSize; offset += chunkSize, i++) {
    const response = await window.mtproto.invoke('upload.getFile', {
      location: fileLocation,
      offset,
      limit: chunkSize
    });

    if (response && response.bytes) {
      chunks.push(response.bytes.buffer);
    }

    // Update progress
    bar.style.width = `${Math.floor(((i + 1) / totalChunks) * 100)}%`;
  }

  // Merge chunks into Blob
  const blob = new Blob(chunks, { type: "video/mp4" });
  const url = URL.createObjectURL(blob);

  // Trigger download
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".mp4") ? fileName : fileName + ".mp4";
  a.click();

  // Cleanup
  button.removeChild(bar);
}

// --- Inject DL buttons on Telegram Web ---
function injectDownloadButtons() {
  document.querySelectorAll("video").forEach(video => {
    if (!video.parentElement.querySelector(".tg-dl-btn")) {
      const btn = document.createElement("button");
      btn.textContent = "DL";
      btn.className = "tg-dl-btn";
      btn.style.margin = "5px";
      btn.style.padding = "4px 8px";
      btn.style.cursor = "pointer";

      video.parentElement.appendChild(btn);

      btn.addEventListener("click", async () => {
        try {
          // Step 1: Grab Telegram file info from attached message
          const messageObj = video.closest("div[role=listitem]").__ngContext__; 
          // ^ may vary depending on Telegram’s Angular build, sometimes "__reactFiber$"

          // This is the tricky part: we need the actual inputDocumentFileLocation
          const fileLocation = messageObj?.[8]?.media?.document?.inputFileLocation; 
          const fileName = messageObj?.[8]?.media?.document?.attributes?.[0]?.file_name || "telegram_video";
          const fileSize = messageObj?.[8]?.media?.document?.size;

          if (!fileLocation || !fileSize) {
            alert("❌ Could not extract Telegram file info.");
            return;
          }

          await downloadTelegramFile(fileLocation, fileName, fileSize, btn);
        } catch (err) {
          console.error("Download failed:", err);
          alert("❌ Download failed. Check console.");
        }
      });
    }
  });
}

// Run continuously to patch new messages
setInterval(injectDownloadButtons, 2000);
