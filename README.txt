TG Web Media Downloader (personal) - Quick install (updated v0.2)

1) Download and unzip this folder.
2) Open Chrome and go to chrome://extensions
3) Enable Developer mode (top-right)
4) Click "Load unpacked" and choose the folder that contains manifest.json (the root of this unzipped folder).
5) Open https://web.telegram.org and try the extension. Click the extension icon to open popup, then "Open Download Panel".
6) Click video "Download" overlay to start buffered recording; a progress bar will appear. After recording completes the video will be downloaded as .webm and the item will be removed from the panel.

Notes:
- This uses MediaRecorder + captureStream to record the buffered video playback into a webm file. It is not the original raw file but is playable.
- Some players / CORS settings / blob URLs might prevent captureStream from working; in that case the extension falls back to background fetch or anchor download when possible.
- Recording performance depends on video length and your machine; playback at 2x attempts to speed up buffering.
- This is intended for personal use only.
