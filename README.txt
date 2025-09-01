TG Web Media Downloader (personal) - Quick install

1) Download and unzip this folder.
2) Open Chrome and go to chrome://extensions
3) Enable Developer mode (top-right)
4) Click "Load unpacked" and choose the folder that contains manifest.json (the root of this unzipped folder).
5) Open https://web.telegram.org and try the extension. Click the extension icon to open popup, then "Open Download Panel".
6) Click video "Download" overlay or click images to add to the panel, then "Download All" or individual 'DL' buttons.

Notes:
- Some media URLs may be blob: URLs or protected by CORS. The extension tries multiple fallbacks:
  - Service worker fetch -> download
  - If that fails, content script fetch -> anchor download
  - If that fails, direct opening of the URL in a new tab
- This extension is intended for PERSONAL use only. Do not distribute without reviewing Chrome Web Store policies and legal considerations.