# TG Web Media Downloader (Personal Use)

**Version:** 0.3.0  
A Chrome Manifest V3 extension that detects media on [web.telegram.org](https://web.telegram.org), lets you queue videos/images, buffers/records video playback with progress, and downloads them to your machine. Optionally attempts client-side WEBM → MP4 conversion using `ffmpeg.wasm`.

---

## ✨ Features
- Detects **videos, images, audio** in Telegram Web.
- Floating download panel with:
  - Queue of items
  - Progress bars
  - Single-download & batch-download
- **Video recording via MediaRecorder** (plays video in background at 2× muted).
- Automatic download to Chrome’s **Downloads** folder.
- Filename sanitization (avoids Telegram internal IDs).
- Optional client-side **WEBM → MP4 conversion** (best-effort).

---

## 🚀 Install (Load Unpacked)
1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the repo folder (with `manifest.json`).
5. Open [web.telegram.org](https://web.telegram.org), log in, and use the extension.

---

## 🛠 How it Works
- **Images** → fetched and saved directly.
- **Videos** → recorded by:
  1. Cloning the `<video>` element
  2. Muting & playing at 2× speed
  3. Capturing via `captureStream() + MediaRecorder`
  4. Saving as WEBM (with optional MP4 conversion via `ffmpeg.wasm`)
- **Fallbacks** → background fetch or anchor if captureStream fails.

---

## 📊 UI
- Panel shows filename, status, progress %.
- Buttons:  
  - `DL` → start download/record  
  - `✕` → remove item  
  - `Download All` → batch download

---

## ⚠️ Limitations
- **Conversion**: MP4 conversion is slow and may fail for large files. Falls back to WEBM.
- **File size**: Very large videos can be CPU/memory heavy.
- **Autoplay**: Some videos need user interaction to allow playback.
- **Browser support**: Built for Chrome/Chromium browsers. Other browsers may behave differently.
- **Remote code**: `ffmpeg.wasm` is loaded from CDN (OK for personal use, not allowed for Chrome Web Store).

---

## 🔧 Debugging
- Open **DevTools → Console** on Telegram tab for logs.
- Check `chrome://extensions` → Inspect service worker for background logs.
- If no downloads: check permissions and `chrome://downloads`.

---

## 📜 Legal
This extension is intended **for personal use only**.  
You are responsible for ensuring you have rights to download and store any media.  
Do not redistribute or publish in violation of Telegram’s ToS or copyright laws.

---

## 📂 Repo Contents
- `manifest.json` — Extension manifest  
- `content.js` — Main content script (UI + detection + recording)  
- `background.js` — Background service worker  
- `popup.html` / `popup.js` — Extension popup  
- `icon.png` — Placeholder icon  

---

## 📌 Next Steps
- Bundle ffmpeg into the extension (instead of CDN).
- Optional: add server-side MTProto fetch for exact filenames + original file format.
- Add cancel button and better error handling in UI.
- Add tests & CI workflows.

---

## 📄 License
For personal experimental use.  
If you need a formal license (MIT/Apache/GPL), add `LICENSE` to the repo.
