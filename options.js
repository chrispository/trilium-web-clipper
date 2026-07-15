import { DEFAULT_SETTINGS, browserApi, normaliseServerUrl } from "./shared.js";

const api = browserApi();
const form = document.querySelector("#settings-form");
const serverUrl = document.querySelector("#server-url");
const token = document.querySelector("#token");
const destinationPath = document.querySelector("#destination-path");
const organizeByDate = document.querySelector("#organize-by-date");
const status = document.querySelector("#status");
const saved = { ...DEFAULT_SETTINGS, ...(await api.storage.local.get(DEFAULT_SETTINGS)) };
serverUrl.value = saved.serverUrl;
token.value = saved.token;
destinationPath.value = saved.destinationPath;
organizeByDate.checked = saved.organizeByDate !== false;

form.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api.storage.local.set({ serverUrl: normaliseServerUrl(serverUrl.value), token: token.value.trim(), destinationPath: normaliseDestination(destinationPath.value), organizeByDate: organizeByDate.checked });
    setStatus("Settings saved.", "success");
  } catch (error) { setStatus(error.message || String(error), "error"); }
});
document.querySelector("#test").addEventListener("click", async () => {
  try {
    await api.storage.local.set({ serverUrl: normaliseServerUrl(serverUrl.value), token: token.value.trim(), destinationPath: normaliseDestination(destinationPath.value), organizeByDate: organizeByDate.checked });
    setStatus("Connecting…");
    const response = await api.runtime.sendMessage({ type: "test-connection" });
    if (!response?.ok) throw new Error(response?.error || "Connection failed.");
    setStatus(`Connected to Trilium (clipper protocol ${response.protocolVersion}).`, "success");
  } catch (error) { setStatus(error.message || String(error), "error"); }
});
function setStatus(message, type = "") { status.textContent = message; status.className = `status ${type}`; }
function normaliseDestination(value) {
  const segments = String(value).trim().replaceAll("\\", "/").split("/").map(segment => segment.trim()).filter(Boolean);
  if (!segments.length || segments.some(segment => segment === "." || segment === "..")) throw new Error("Enter a valid note path, such as Clippings.");
  return segments.join("/");
}
