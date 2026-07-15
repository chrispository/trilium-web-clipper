import { DEFAULT_SETTINGS, browserApi } from "./shared.js";

const api = browserApi();
const status = document.querySelector("#status");
const statusMessage = document.querySelector("#status-message");
const statusIcon = document.querySelector(".status-icon");
const selectionPreview = document.querySelector("#selection-preview");
const selectionText = document.querySelector("#selection-text");
const selectionCount = document.querySelector("#selection-count");
const serverLabel = document.querySelector("#server-label");
const buttons = document.querySelectorAll("button");

const settings = { ...DEFAULT_SETTINGS, ...(await api.storage.local.get(DEFAULT_SETTINGS)) };
serverLabel.textContent = settings.serverUrl || "Set your Trilium address";
if (!settings.token) setStatus("Add an ETAPI token in settings before clipping.", "error");
else showSelectionState();

document.querySelector("#settings").addEventListener("click", () => api.runtime.openOptionsPage());
document.querySelector("#clip-selection").addEventListener("click", () => saveTab("selection"));
document.querySelector("#clip-page").addEventListener("click", () => saveTab("page"));
document.querySelector("#save-note").addEventListener("click", () => {
  const content = document.querySelector("#note-content").value.trim();
  if (!content) return setStatus("Write a quick note first.", "error");
  send({ type: "save-quick-note", clip: { title: document.querySelector("#note-title").value.trim(), content: `<p>${escapeHtml(content).replace(/\n/g, "</p><p>")}</p>`, pageUrl: "" } });
});

async function saveTab(mode) { await send({ type: "save-tab", mode }); }
async function send(message) {
  setBusy(true);
  try {
    const response = await api.runtime.sendMessage(message);
    if (!response?.ok) throw new Error(response?.error || "No response from the extension.");
    setStatus(response.location ? `Saved to ${response.location}.` : "Saved to Trilium.", "success");
  } catch (error) { setStatus(error.message || String(error), "error"); }
  finally { setBusy(false); }
}
function setBusy(value) { buttons.forEach(button => { button.disabled = value; }); }
function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusIcon.textContent = type === "success" ? "✓" : type === "error" ? "!" : "•";
  status.className = `status ${type}`;
  status.hidden = false;
}
async function showSelectionState() {
  try {
    const response = await api.runtime.sendMessage({ type: "get-selection" });
    if (!response?.selection) return;
    selectionText.textContent = response.selection;
    selectionCount.textContent = `${response.selection.length.toLocaleString()} characters`;
    selectionPreview.hidden = false;
  } catch { /* Some browser pages do not allow script access. */ }
}
function escapeHtml(value) { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }
