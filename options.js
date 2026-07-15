import { DATE_FORMATS, browserApi, formatDateFolder, loadSettings, normaliseServerUrl } from "./shared.js";

const api = browserApi();
const form = document.querySelector("#settings-form");
const serverUrl = document.querySelector("#server-url");
const token = document.querySelector("#token");
const destinationPath = document.querySelector("#destination-path");
const destinationCustom = document.querySelector("#destination-custom");
const destinationInbox = document.querySelector("#destination-inbox");
const customDestinationSettings = document.querySelector("#custom-destination-settings");
const organizeByDate = document.querySelector("#organize-by-date");
const dateFormat = document.querySelector("#date-format");
const dateFormatField = document.querySelector("#date-format-field");
const destinationExample = document.querySelector("#destination-example");
const status = document.querySelector("#status");
const statusMessage = document.querySelector("#status-message");
const statusIcon = document.querySelector(".connection-status-icon");

const saved = await loadSettings(api.storage.local);
serverUrl.value = saved.serverUrl;
token.value = saved.token;
destinationPath.value = saved.destinationPath;
destinationCustom.checked = saved.destinationMode !== "inbox";
destinationInbox.checked = saved.destinationMode === "inbox";
organizeByDate.checked = saved.organizeByDate !== false;
dateFormat.value = DATE_FORMATS.includes(saved.dateFormat) ? saved.dateFormat : DATE_FORMATS[0];
updateDestinationControls();

form.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await persistForm();
    setStatus("Settings saved.", "success");
  } catch (error) {
    setStatus(error.message || String(error), "error");
  }
});

document.querySelector("#test").addEventListener("click", async () => {
  try {
    await persistForm();
    setStatus("Connecting to Trilium…", "loading");
    const response = await api.runtime.sendMessage({ type: "test-connection" });
    if (!response?.ok) throw new Error(response?.error || "Connection failed.");
    setStatus(`Connected to Trilium · Clipper protocol ${response.protocolVersion}`, "success");
  } catch (error) {
    setStatus(error.message || String(error), "error");
  }
});

destinationCustom.addEventListener("change", updateDestinationControls);
destinationInbox.addEventListener("change", updateDestinationControls);
organizeByDate.addEventListener("change", updateDestinationControls);
destinationPath.addEventListener("input", updateDestinationExample);
dateFormat.addEventListener("change", updateDestinationExample);

async function persistForm() {
  const destinationMode = destinationInbox.checked ? "inbox" : "custom";
  const path = destinationMode === "custom" ? normaliseDestination(destinationPath.value) : (destinationPath.value.trim() || "Clippings");
  await api.storage.local.set({
    serverUrl: normaliseServerUrl(serverUrl.value),
    token: token.value.trim(),
    destinationMode,
    destinationPath: path,
    organizeByDate: organizeByDate.checked,
    dateFormat: DATE_FORMATS.includes(dateFormat.value) ? dateFormat.value : DATE_FORMATS[0]
  });
}

function updateDestinationControls() {
  const isCustom = destinationCustom.checked;
  customDestinationSettings.hidden = !isCustom;
  destinationPath.required = isCustom;
  dateFormat.disabled = !organizeByDate.checked;
  dateFormatField.classList.toggle("is-disabled", !organizeByDate.checked);
  updateDestinationExample();
}

function updateDestinationExample() {
  const path = destinationPath.value.trim() || "Clippings";
  const destination = organizeByDate.checked ? `${path}/${formatDateFolder(new Date(), dateFormat.value)}` : path;
  destinationExample.textContent = `Example: ${destination}`;
}

function setStatus(message, type = "") {
  statusMessage.textContent = message;
  statusIcon.textContent = type === "success" ? "✓" : type === "error" ? "!" : "•";
  status.className = `connection-status ${type}`;
  status.hidden = false;
}

function normaliseDestination(value) {
  const segments = String(value).trim().replaceAll("\\", "/").split("/").map(segment => segment.trim()).filter(Boolean);
  if (!segments.length || segments.some(segment => segment === "." || segment === "..")) throw new Error("Enter a valid note path, such as Clippings.");
  return segments.join("/");
}
