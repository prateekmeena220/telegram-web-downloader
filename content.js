(() => {
  console.log("[TG-DL] content script loaded (Method B)");

  // =========== UI helpers ===========
  function makeOverlay(video) {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, {
      position: "absolute",
      right: "10px",
      bottom: "10px",
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      alignItems: "flex-end",
      fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
    });

    const btn = document.createElement("button");
    btn.textContent = "⬇️ Download";
    Object.assign(btn.style, {
      padding: "6px 10px",
      background: "#0ea5e9",
      color: "#fff",
      border: "0",
      borderRadius: "10px",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,.2)",
      fontSize: "13px",
    });

    const barWrap = document.createElement("div");
    Object.assign(barWrap.style, {
      width: "220px",
      height: "8px",
      background: "rgba(255,255,255,.6)",
      borderRadius: "999px",
      overflow: "hidden",
      display: "none",
    });
    const bar = document.createElement("div");
    Object.assign(bar.style, {
      width: "0%",
      height: "100%",
      background: "#22c55e",
      transition: "width .2s ease",
    });
    barWrap.appendChild(bar);

    const status = document.createElement("div");
    Object.assign(status.style, {
      color: "#fff",
      textShadow: "0 1px 2px rgba(0,0,0,.5)",
      fontSize: "12px",
      display: "none",
      maxWidth: "320px",
      textAlign: "right",
      wordBreak: "break-word",
    });

    wrap.appendChild(btn);
    wrap.appendChild(barWrap);
    wrap.appendChild(status);

    // attach overlay
    const host = video.parentElement || video;
    const pos = getComputedStyle(host).position;
    if (!["relative", "absolute", "fixed"].includes(pos)) host.style.position = "relative";
    host.appendChild(wrap);

    return { wrap, btn, barWrap, bar, status };
  }

  function setBar(el, pct) {
    el.style.width = Math.max(0, Math.min(100, pct)) + "%";
  }

  function sanitizeFilename(name) {
    return (name || "video").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 140);
  }

  // Try to read a human filename from the message bubble (caption/text)
  function guessTitleFromDOM(videoEl) {
    try {
      let msg = videoEl.closest('[class*="message"]') || videoEl.closest(".Message");
      const sels = [
        ".text-content",
        ".message-text",
        '[class*="messageText"]',
        '[class*="text-content"]',
        "figcaption",
        '[class*="caption"]',
      ];
      if (msg) {
        for (const s of sels) {
          const n = msg.querySelector(s);
          if (n && n.innerText && n.innerText.trim().length > 2) {
            return sanitizeFilename(n.innerText.trim());
          }
        }
      }
      const near = videoEl.closest("div");
      if (near) {
        const label = near.getAttribute("aria-label") || near.getAttribute("title");
        if (label) return sanitizeFilename(label);
      }
    } catch (e) {
      // noop
    }
    return "video_" + new Date().toISOString().replace(/[:.]/g, "-");
  }

  // =========== Telegram internals hooks ===========
  // 1) Find React fiber and climb props to find the media.document descriptor
  function getReactFiber(node) {
    for (const k in node) {
      if (k.startsWith("__reactFiber$")) return node[k];
      if (k.startsWith("__reactFiber")) return node[k];
      if (k.startsWith("__reactProps$")) return node[k];
    }
    return null;
  }

  function findInFiber(fiber, predicate, depth = 0, maxDepth = 50) {
    if (!fiber || depth > maxDepth) return null;
    try {
      const props = fiber.pendingProps || fiber.memoizedProps || fiber._debugOwner?.memoizedProps;
      if (props && predicate(props)) return props;

      return (
        findInFiber(fiber.child, predicate, depth + 1, maxDepth) ||
        findInFiber(fiber.sibling, predicate, depth + 1, maxDepth) ||
        findInFiber(fiber.return, predicate, depth + 1, maxDepth)
      );
    } catch {
      return null;
    }
  }

  function extractTelegramDocumentFromReact(videoEl) {
    const fiber = getReactFiber(videoEl) || getReactFiber(videoEl.parentElement || {});
    if (!fiber) return null;

    // Look for props with media/document
    const props = findInFiber(
      fiber,
      (p) =>
        p &&
        (p.media?.document || p.document || p.msg?.media?.document || p.message?.media?.document)
    );
    if (!props) return null;

    const doc =
      props.media?.document ||
      props.document ||
      props.msg?.media?.document ||
      props.message?.media?.document;

    if (!doc) return null;

    // Normalize to the fields we need
    // Common shapes seen in Telegram Web builds:
    // {
    //   id, access_hash, file_reference (Uint8Array or Array), dc_id, size,
    //   attributes: [{ _: 'documentAttributeFilename', file_name: 'name.mp4' }, ...]
    // }
    const id = doc.id || doc.document?.id;
    const access_hash = doc.access_hash || doc.document?.access_hash;
    const dc_id = doc.dc_id || doc.document?.dc_id;
    const size = doc.size || doc.document?.size;
    const attributes = doc.attributes || doc.document?.attributes || [];
    const filenameAttr = attributes.find((a) => a.file_name) || {};
    const file_name = filenameAttr.file_name || null;

    // file_reference may be Uint8Array, Array<number>, or base64; keep original
    const file_reference =
      doc.file_reference ||
      doc.document?.file_reference ||
      doc.fileReference ||
      doc.document?.fileReference;

    if (!id || !access_hash || !file_reference || !dc_id || !size) {
      return null;
    }

    return {
      id,
      access_hash,
      file_reference,
      dc_id,
      size,
      file_name,
    };
  }

  // 2) Find Telegram's mtproto client on window (best-effort)
  async function getMtproto() {
    // Fast paths commonly found in builds:
    const candidates = [
      "mtproto",
      "MTProto",
      "$MTProto",
      "_mtproto",
      "api",
      "ApiClient",
      "tgApi",
      "_tgApi",
      "gramjs", // rarely
    ];

    for (const k of candidates) {
      const obj = window[k];
      if (obj && typeof obj.invoke === "function") {
        try {
          // probe
          await Promise.race([
            obj.invoke("help.getConfig"),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 500)),
          ]);
          return obj; // success
        } catch {
          // keep searching
        }
      }
    }

    // Slow scan: crawl window for an object with invoke(method, params)
    for (const k in window) {
      try {
        const obj = window[k];
        if (obj && typeof obj.invoke === "function") {
          // probe quickly
          await Promise.race([
            obj.invoke("help.getConfig"),
            new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 500)),
          ]);
          return obj;
        }
      } catch {
        /* ignore */
      }
    }

    return null;
  }

  // Convert file_reference to the form MTProto wrapper expects (Uint8Array)
  function toUint8Array(ref) {
    if (ref instanceof Uint8Array) return ref;
    if (Array.isArray(ref)) return new Uint8Array(ref);
    // if base64 string:
    if (typeof ref === "string") {
      try {
        const bin = atob(ref);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        return u8;
      } catch {
        // pass
      }
    }
    return null;
  }

  // =========== MTProto download ===========
  async function downloadViaMTProto(mtproto, docInfo, filename, ui) {
    const chunkSize = 1024 * 1024; // 1 MB
    const total = docInfo.size;
    const totalChunks = Math.ceil(total / chunkSize);
    const chunks = [];

    ui.barWrap.style.display = "block";
    ui.status.style.display = "block";
    ui.btn.disabled = true;
    ui.btn.textContent = "⏬ Downloading…";

    const file_reference = toUint8Array(docInfo.file_reference);
    if (!file_reference) throw new Error("Invalid file_reference format");

    // inputDocumentFileLocation TL object (Telegram expects this shape)
    const location = {
      _: "inputDocumentFileLocation",
      id: docInfo.id,
      access_hash: docInfo.access_hash,
      file_reference,
      thumb_size: "", // empty for full file
    };

    let downloaded = 0;

    for (let offset = 0, i = 0; offset < total; offset += chunkSize, i++) {
      const limit = Math.min(chunkSize, total - offset);
      const res = await mtproto.invoke("upload.getFile", {
        location,
        offset,
        limit,
      });

      // Most wrappers return { type: 'upload.file', bytes: Uint8Array }
      const bytes = res?.bytes;
      if (!bytes) throw new Error("Empty chunk received");

      chunks.push(bytes.buffer);
      downloaded += bytes.byteLength;

      // Progress
      const pct = Math.floor((downloaded / total) * 100);
      setBar(ui.bar, pct);
      ui.status.textContent = `Downloading… ${pct}% (${(downloaded / (1024 * 1024)).toFixed(
        1
      )}/${(total / (1024 * 1024)).toFixed(1)} MB)`;
    }

    const blob = new Blob(chunks, { type: "video/mp4" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".mp4") ? filename : filename + ".mp4";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    ui.btn.textContent = "✅ Saved";
    setBar(ui.bar, 100);
    setTimeout(() => ui.wrap.remove(), 1500);
  }

  // =========== Fallback recorder (Method A) ===========
  async function recordFallback(video, ui, filename) {
    try {
      ui.barWrap.style.display = "block";
      ui.status.style.display = "block";
      ui.btn.disabled = true;
      ui.btn.textContent = "⏳ Recording…";
      ui.status.textContent = "Playing at 2× muted to record";

      video.muted = true;
      video.playbackRate = 2.0;
      let stream;
      try {
        stream = video.captureStream();
      } catch {
        throw new Error("captureStream() not available");
      }
      const rec = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
      const chunks = [];
      rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
      rec.start(500);

      try {
        await video.play();
      } catch {}
      await new Promise((res) => (video.onended = () => res()));

      rec.stop();
      await new Promise((res) => (rec.onstop = res));
      const webmBlob = new Blob(chunks, { type: "video/webm" });

      const url = URL.createObjectURL(webmBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".webm") ? filename : filename + ".webm";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      ui.btn.textContent = "✅ Saved (WEBM)";
      setBar(ui.bar, 100);
      setTimeout(() => ui.wrap.remove(), 1500);
    } catch (err) {
      ui.btn.disabled = false;
      ui.btn.textContent = "❌ Failed — Retry";
      ui.status.textContent = err?.message || "Unknown error";
      setBar(ui.bar, 0);
    }
  }

  // =========== Inject UI & wire up ===========
  function inject() {
    document.querySelectorAll("video").forEach((video) => {
      if (video.dataset.tgdlInjected) return;
      video.dataset.tgdlInjected = "1";

      const ui = makeOverlay(video);
      ui.btn.addEventListener("click", async () => {
        try {
          ui.status.textContent = "Looking up Telegram file…";

          const docInfo = extractTelegramDocumentFromReact(video);
          const candidateName =
            sanitizeFilename(docInfo?.file_name) || guessTitleFromDOM(video);

          if (!docInfo) {
            ui.status.textContent = "Could not extract Telegram file; using fallback.";
            await recordFallback(video, ui, candidateName);
            return;
          }

          const mtproto = await getMtproto();
          if (!mtproto) {
            ui.status.textContent = "MTProto client not found; using fallback.";
            await recordFallback(video, ui, candidateName);
            return;
          }

          await downloadViaMTProto(mtproto, docInfo, candidateName, ui);
        } catch (err) {
          console.error("[TG-DL] error", err);
          ui.status.textContent = err?.message || "Unknown error";
          ui.btn.textContent = "❌ Failed — Retry";
          ui.btn.disabled = false;
          setBar(ui.bar, 0);
        }
      });
    });
  }

  const mo = new MutationObserver(inject);
  mo.observe(document.body, { childList: true, subtree: true });
  inject();
})();
