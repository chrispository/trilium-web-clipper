import { browserApi, loadSettings } from "./shared.js";

const api = browserApi();
const status = document.querySelector("#status");
const statusMessage = document.querySelector("#status-message");
const statusIcon = document.querySelector(".status-icon");
const contentPreview = document.querySelector("#content-preview");
const titleInput = document.querySelector("#note-title");
const propertyTitle = document.querySelector("#property-title");
const propertySource = document.querySelector("#property-source");
const properties = document.querySelector("#properties");
const propertiesToggle = document.querySelector("#properties-toggle");
const moreMenu = document.querySelector("#more-menu");
const saveMenu = document.querySelector("#save-menu");
const quickNotePanel = document.querySelector("#quick-note-panel");
const destinationInput = document.querySelector("#destination-label");
const tagsInput = document.querySelector("#property-tags");
const interactiveButtons = document.querySelectorAll("button");

let activeMode = "page";
let selection = "";
let pagePreview = "";

const settings = await loadSettings(api.storage.local);
const destination = settings.destinationMode === "inbox" ? "Trilium clipper inbox" : settings.destinationPath;
destinationInput.value = destination;
destinationInput.readOnly = settings.destinationMode === "inbox";
destinationInput.title = settings.destinationMode === "inbox"
  ? "Trilium chooses the note marked #clipperInbox, or today's Day Note."
  : "Override the configured destination for this clip.";
document.querySelector("#property-created").textContent = localDate();

bindEvents();
await loadPreview();

if (!settings.token) setStatus("Add an ETAPI token in settings before clipping.", "error");

function bindEvents() {
  document.querySelector("#settings").addEventListener("click", openSettings);
  document.querySelector("#open-settings-menu").addEventListener("click", openSettings);
  document.querySelector("#clip-primary").addEventListener("click", () => saveTab(activeMode));
  document.querySelector("#clip-selection").addEventListener("click", () => chooseAndSave("selection"));
  document.querySelector("#clip-page").addEventListener("click", () => chooseAndSave("page"));
  document.querySelector("#more").addEventListener("click", event => toggleMenu(event, moreMenu, "#more"));
  document.querySelector("#save-menu-toggle").addEventListener("click", event => toggleMenu(event, saveMenu, "#save-menu-toggle"));
  document.querySelector("#open-quick-note").addEventListener("click", () => {
    moreMenu.hidden = true;
    quickNotePanel.hidden = false;
    document.querySelector("#note-content").focus();
  });
  document.querySelector("#close-quick-note").addEventListener("click", () => { quickNotePanel.hidden = true; });
  document.querySelector("#save-note").addEventListener("click", saveQuickNote);
  propertiesToggle.addEventListener("click", () => {
    const expanded = propertiesToggle.getAttribute("aria-expanded") === "true";
    propertiesToggle.setAttribute("aria-expanded", String(!expanded));
    properties.hidden = expanded;
  });
  document.addEventListener("click", event => {
    if (!event.target.closest("#more") && !event.target.closest("#more-menu")) closeMenu(moreMenu, "#more");
    if (!event.target.closest("#save-menu-toggle") && !event.target.closest("#save-menu")) closeMenu(saveMenu, "#save-menu-toggle");
  });
}

async function loadPreview() {
  contentPreview.textContent = "Loading preview…";
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    const title = tab?.title || "Untitled";
    titleInput.value = title;
    propertyTitle.textContent = title;
    propertySource.textContent = tab?.url || "—";
    propertySource.title = tab?.url || "";

    if (!tab?.id) throw new Error("No active browser tab is available.");
    const response = await api.runtime.sendMessage({ type: "get-selection" });
    selection = response?.selection || "";
    pagePreview = await collectPagePreview(tab.id);
    setMode(selection ? "selection" : "page");
  } catch (error) {
    pagePreview = "Preview is unavailable on this page.";
    setMode("page");
    if (!/Cannot access|extensions gallery/i.test(error.message || "")) setStatus(error.message || String(error), "error");
  }
}

async function collectPagePreview(tabId) {
  const [{ result }] = await api.scripting.executeScript({
    target: { tabId },
    func: () => {
      const root = document.querySelector("article, main, [role='main']") || document.body;
      return (root?.innerText || "").replace(/\n{3,}/g, "\n\n").trim().slice(0, 12000);
    }
  });
  return result || "This page has no text preview.";
}

function setMode(mode) {
  if (mode === "selection" && !selection) {
    setStatus("Select some text on the page first.", "error");
    return;
  }
  activeMode = mode;
  contentPreview.textContent = mode === "selection" ? selection : pagePreview;
}

function chooseAndSave(mode) {
  closeMenu(saveMenu, "#save-menu-toggle");
  if (mode === "selection" && !selection) return setStatus("Select some text on the page first.", "error");
  setMode(mode);
  saveTab(mode);
}

async function saveTab(mode) {
  if (settings.destinationMode !== "inbox" && !destinationInput.value.trim()) {
    return setStatus("Enter a clip destination first.", "error");
  }
  await send({ type: "save-tab", mode, destinationPath: destinationOverride(), tags: tagsInput.value });
}

async function saveQuickNote() {
  const content = document.querySelector("#note-content").value.trim();
  if (!content) return setStatus("Write a quick note first.", "error");
  if (settings.destinationMode !== "inbox" && !destinationInput.value.trim()) {
    return setStatus("Enter a clip destination first.", "error");
  }
  await send({
    type: "save-quick-note",
    destinationPath: destinationOverride(),
    tags: tagsInput.value,
    clip: {
      title: document.querySelector("#quick-note-title").value.trim(),
      content: `<p>${escapeHtml(content).replace(/\n/g, "</p><p>")}</p>`,
      pageUrl: ""
    }
  });
  quickNotePanel.hidden = true;
}

function destinationOverride() {
  return settings.destinationMode === "inbox" ? "" : destinationInput.value.trim();
}

async function send(message) {
  setBusy(true);
  try {
    const response = await api.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || "No response from the extension.");
    setStatus(response.location ? `Saved to ${response.location}.` : "Saved to Trilium.", "success");
  } catch (error) {
    setStatus(error.message || String(error), "error");
  } finally {
    setBusy(false);
  }
}

function toggleMenu(event, menu, triggerSelector) {
  event.stopPropagation();
  const willOpen = menu.hidden;
  closeMenu(moreMenu, "#more");
  closeMenu(saveMenu, "#save-menu-toggle");
  menu.hidden = !willOpen;
  document.querySelector(triggerSelector).setAttribute("aria-expanded", String(willOpen));
}

function closeMenu(menu, triggerSelector) {
  menu.hidden = true;
  document.querySelector(triggerSelector).setAttribute("aria-expanded", "false");
}

function openSettings() {
  api.runtime.openOptionsPage();
}

function setBusy(value) {
  interactiveButtons.forEach(button => { button.disabled = value; });
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusIcon.textContent = type === "success" ? "✓" : type === "error" ? "!" : "•";
  status.className = `clip-status ${type}`;
  status.hidden = false;
  clearTimeout(setStatus.timeout);
  setStatus.timeout = setTimeout(() => { status.hidden = true; }, type === "error" ? 6000 : 3000);
}

function localDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}
