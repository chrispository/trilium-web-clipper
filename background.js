import { browserApi, formatDateFolder, loadSettings, localNowDateTime, normaliseServerUrl } from "./shared.js";

const api = browserApi();

api.runtime.onInstalled.addListener(() => {
  api.contextMenus.create({ id: "clip-selection", title: "Clip selection to Trilium", contexts: ["selection"] });
  api.contextMenus.create({ id: "clip-page", title: "Clip page to Trilium", contexts: ["page"] });
  api.contextMenus.create({ id: "clip-link", title: "Clip link to Trilium", contexts: ["link"] });
});

api.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  try {
    if (info.menuItemId === "clip-link") {
      const result = await saveClip({
        clipType: "link",
        title: info.linkUrl ?? tab.title ?? "Clipped link",
        content: linkContent(info.linkUrl ?? tab.url),
        pageUrl: info.linkUrl ?? tab.url
      });
      await notify("Saved to Trilium", result.location);
    } else {
      const mode = info.menuItemId === "clip-selection" ? "selection" : "page";
      const clip = await collectFromTab(tab.id, mode);
      const result = await saveClip(clip);
      await notify("Saved to Trilium", result.location);
    }
  } catch (error) {
    await notify("Could not save to Trilium", error.message || String(error));
  }
});

api.commands.onCommand.addListener(async command => {
  if (command !== "clip-selection") return;
  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  try {
    const result = await saveClip(await collectFromTab(tab.id, "selection"));
    await notify("Saved to Trilium", result.location);
  } catch (error) {
    await notify("Could not save to Trilium", error.message || String(error));
  }
});

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "test-connection") {
        sendResponse(await testConnection());
      } else if (message.type === "get-selection") {
        const [tab] = await api.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error("No active browser tab is available.");
        const [{ result }] = await api.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.getSelection()?.toString().trim() || ""
        });
        sendResponse({ ok: true, selection: result || "" });
      } else if (message.type === "save-quick-note") {
        const [tab] = await api.tabs.query({ active: true, currentWindow: true });
        const clip = {
          clipType: "note",
          ...message.clip,
          title: message.clip?.title || tab?.title || "Quick note",
          pageUrl: message.clip?.pageUrl || tab?.url || ""
        };
        sendResponse(await saveClip(clip, { destinationPath: message.destinationPath }));
      } else if (message.type === "save-tab") {
        const [tab] = await api.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) throw new Error("No active browser tab is available.");
        sendResponse(await saveClip(await collectFromTab(tab.id, message.mode), { destinationPath: message.destinationPath }));
      } else {
        sendResponse({ ok: false, error: "Unknown request." });
      }
    } catch (error) {
      sendResponse({ ok: false, error: error.message || String(error) });
    }
  })();
  return true;
});

async function collectFromTab(tabId, mode) {
  const [{ result }] = await api.scripting.executeScript({ target: { tabId }, func: extractClip, args: [mode] });
  return result;
}

function extractClip(mode) {
  const escapeHtml = value => {
    const element = document.createElement("div");
    element.textContent = value;
    return element.innerHTML;
  };
  const absolutise = root => {
    root.querySelectorAll("a[href], img[src], source[src], video[src]").forEach(element => {
      const attribute = element.hasAttribute("href") ? "href" : "src";
      try { element.setAttribute(attribute, new URL(element.getAttribute(attribute), location.href).href); } catch { /* leave unusual URLs alone */ }
    });
    root.querySelectorAll("*").forEach(element => {
      for (const attribute of [...element.attributes]) {
        if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name);
      }
    });
  };
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();
  if (mode === "selection" && selectedText) {
    const container = document.createElement("div");
    for (let index = 0; index < selection.rangeCount; index += 1) container.appendChild(selection.getRangeAt(index).cloneContents());
    absolutise(container);
    return { clipType: "selection", title: document.title, content: container.innerHTML || `<p>${escapeHtml(selectedText)}</p>`, pageUrl: location.href };
  }
  if (mode === "selection") throw new Error("Select some text first, then clip it.");

  const copy = document.cloneNode(true);
  copy.querySelectorAll("script, style, noscript, iframe, svg, canvas").forEach(node => node.remove());
  const candidate = copy.querySelector("article, main, [role='main']") || copy.body;
  absolutise(candidate);
  return { clipType: "page", title: document.title, content: candidate.innerHTML, pageUrl: location.href };
}

async function saveClip(clip, overrides = {}) {
  const settings = await loadSettings(api.storage.local);
  if (settings.destinationMode !== "inbox" && overrides.destinationPath?.trim()) {
    settings.destinationPath = overrides.destinationPath;
  }
  const serverUrl = normaliseServerUrl(settings.serverUrl);
  if (!settings.token.trim()) throw new Error("Add an ETAPI token in the extension settings first.");
  if (!clip?.content?.trim() && !clip?.pageUrl) throw new Error("There is nothing to save.");
  if (settings.destinationMode !== "inbox") {
    return saveCustomClip(settings, clip);
  }
  return saveWithTriliumClipper(serverUrl, settings.token.trim(), clip);
}

async function saveWithTriliumClipper(serverUrl, token, clip) {
  const response = await fetch(`${serverUrl}/api/clipper/notes`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "trilium-local-now-datetime": localNowDateTime()
    },
    body: JSON.stringify({ title: clip.title || "Clipped note", content: clip.content || "", pageUrl: clip.pageUrl || "", clipType: clip.clipType || "note" })
  });
  if (!response.ok) throw new Error(await response.text() || `Trilium returned HTTP ${response.status}.`);
  const body = await response.json();
  return { ok: true, noteId: body.noteId, location: "the Trilium clipper inbox" };
}

async function saveCustomClip(settings, clip) {
  const serverUrl = normaliseServerUrl(settings.serverUrl);
  const token = settings.token.trim();
  const path = normaliseDestination(settings.destinationPath);
  let parentNoteId = "root";
  for (const segment of path) {
    const folder = await findOrCreateNote(serverUrl, token, segment, parentNoteId, "book");
    parentNoteId = folder.noteId;
  }
  const destination = [...path];
  if (settings.organizeByDate !== false) {
    const date = formatDateFolder(new Date(), settings.dateFormat);
    const dateNote = await findOrCreateNote(serverUrl, token, date, parentNoteId, "book");
    parentNoteId = dateNote.noteId;
    destination.push(date);
  }
  const source = clip.pageUrl ? `<p><a href="${escapeAttribute(clip.pageUrl)}">Source: ${escapeHtml(clip.pageUrl)}</a></p>` : "";
  const content = `${source}${clip.content || ""}`;
  const response = await etapiRequest(serverUrl, token, "create-note", {
    method: "POST",
    body: JSON.stringify({
      parentNoteId,
      title: clip.title || "Clipped note",
      type: "text",
      content
    })
  });
  return { ok: true, noteId: response.note?.noteId, parentNoteId, location: destination.join("/") };
}

function normaliseDestination(value) {
  const segments = String(value || "Clippings").trim().replaceAll("\\", "/").split("/").map(segment => segment.trim()).filter(Boolean);
  if (!segments.length || segments.some(segment => segment === "." || segment === "..")) throw new Error("Set a valid clip destination in extension settings.");
  return segments;
}

async function findOrCreateNote(serverUrl, token, title, parentNoteId, type) {
  const query = new URLSearchParams({
    search: `note.title = '${title.replace(/'/g, "''")}'`,
    ancestorNoteId: parentNoteId,
    ancestorDepth: "eq1",
    fastSearch: "true",
    limit: "20"
  });
  const found = await etapiRequest(serverUrl, token, `notes?${query}`);
  const existing = (found.results || []).find(note => note.title === title);
  if (existing) return existing;
  const created = await etapiRequest(serverUrl, token, "create-note", {
    method: "POST",
    body: JSON.stringify({ parentNoteId, title, type, content: "" })
  });
  if (!created.note?.noteId) throw new Error(`Trilium did not return the new ${title} folder ID.`);
  return created.note;
}

async function etapiRequest(serverUrl, token, path, options = {}) {
  const response = await fetch(`${serverUrl}/etapi/${path}`, {
    ...options,
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "trilium-local-now-datetime": localNowDateTime(),
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try { message = JSON.parse(text).message || text; } catch { /* plain-text error */ }
    throw new Error(message || `Trilium ETAPI returned HTTP ${response.status}.`);
  }
  return response.status === 204 ? {} : response.json();
}

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  const string = String(value);
  return /^https?:\/\//i.test(string) ? escapeHtml(string) : "#";
}

async function testConnection() {
  const settings = await loadSettings(api.storage.local);
  const serverUrl = normaliseServerUrl(settings.serverUrl);
  if (!settings.token.trim()) throw new Error("An ETAPI token is required for server installations.");
  const response = await fetch(`${serverUrl}/api/clipper/handshake`, { headers: { Authorization: settings.token.trim() } });
  if (!response.ok) throw new Error(await response.text() || `Trilium returned HTTP ${response.status}.`);
  const body = await response.json();
  if (body.appName !== "trilium") throw new Error("This server did not identify itself as Trilium.");
  return { ok: true, protocolVersion: body.protocolVersion };
}

function linkContent(url) {
  const safe = escapeAttribute(url || "");
  return `<p><a href="${safe}">${safe}</a></p>`;
}

async function notify(title, message) {
  // A popup cannot stay open for a background request; use the action badge for lightweight feedback.
  await api.action.setBadgeText({ text: title.startsWith("Saved") ? "✓" : "!" });
  await api.action.setBadgeBackgroundColor({ color: title.startsWith("Saved") ? "#176b43" : "#a92b2b" });
  setTimeout(() => api.action.setBadgeText({ text: "" }), 5000);
  console[title.startsWith("Saved") ? "info" : "error"](`${title}: ${message}`);
}
