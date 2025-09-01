(async function () {
  console.log("TG Downloader content script loaded");

  // Load ffmpeg.wasm dynamically
  async function loadFFmpeg() {
    if (window.ffmpeg) return window.ffmpeg;
    const { createFFmpeg, fetchFile } = FFmpeg;
    const ffmpeg = createFFmpeg({
      log: true,
      corePath: chrome.runtime.getURL("libs/ffmpeg/ffmpeg-core.js")
    });
    await ffmpeg.load();
    return ffmpeg;
  }

  // Helper: get Telegram video title/caption
  function getTelegramVideoTitle(videoEl) {
    try {
      let msg = videoEl.closest(".Message");
      if (msg) {
        let caption = msg.querySelector(".text-content");
        if (caption) {
          let text = caption.innerText.trim();
          if (text.length > 3) return text.replace(/[^\w\d\s-_.]/g, "_");
        }
      }
    } catch (e) {
      console.warn("Title grab failed:", e);
    }
    // fallback name
    return "video_" + new Date().toISOString().replace(/[:.]/g, "-");
  }

  // Download helper
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Add buttons on Telegram video
  function injectButtons() {
    document.querySelectorAll("video").forEach((video) => {
      if (video.dataset.dlInjected) return;
      video.dataset.dlInjected = "1";

      let btn = document.createElement("button");
      btn.innerText = "⬇️ Download MP4";
      btn.style.position = "absolute";
      btn.style.zIndex = "9999";
      btn.style.bottom = "10px";
      btn.style.right = "10px";
      btn.style.padding = "5px 10px";
      btn.style.background = "red";
      btn.style.color = "white";
      btn.style.border = "none";
      btn.style.borderRadius = "5px";
      btn.style.cursor = "pointer";

      btn.onclick = async () => {
        btn.innerText = "⏳ Recording...";
        btn.disabled = true;

        // Record video into WebM
        const stream = video.captureStream();
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        let chunks = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.start();

        // Force playback
        video.playbackRate = 2.0;
        video.muted = true;
        await video.play();

        // Wait until fully buffered
        await new Promise((resolve) => {
          video.onended = resolve;
        });

        recorder.stop();

        const webmBlob = await new Promise((resolve) => {
          recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
        });

        btn.innerText = "⚙️ Converting to MP4...";

        // Load ffmpeg
        const ffmpeg = await loadFFmpeg();

        // Write webm file to ffmpeg FS
        const webmData = new Uint8Array(await webmBlob.arrayBuffer());
        ffmpeg.FS("writeFile", "input.webm", webmData);

        // Run ffmpeg
        await ffmpeg.run("-i", "input.webm", "-c", "copy", "output.mp4");
        const mp4Data = ffmpeg.FS("readFile", "output.mp4");

        // Create Blob
        const mp4Blob = new Blob([mp4Data.buffer], { type: "video/mp4" });

        // Extract title
        const filename = getTelegramVideoTitle(video) + ".mp4";

        // Trigger download
        downloadBlob(mp4Blob, filename);

        btn.innerText = "✅ Downloaded";
      };

      video.parentElement.style.position = "relative";
      video.parentElement.appendChild(btn);
    });
  }

  // Observe DOM for new videos
  const observer = new MutationObserver(() => injectButtons());
  observer.observe(document.body, { childList: true, subtree: true });
  injectButtons();
})();
