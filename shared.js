export const DEFAULT_SETTINGS = {
  serverUrl: "",
  token: "",
  destinationMode: "custom",
  organizeByDate: true,
  destinationPath: "Clippings",
  dateFormat: "YYYYMMDD"
};

export const DATE_FORMATS = ["YYYYMMDD", "YYYY-MM-DD", "DD-MM-YYYY", "DD.MM.YYYY", "MM-DD-YYYY"];

export async function loadSettings(storageArea) {
  const stored = await storageArea.get(null);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    // Before destinationMode existed, organizeByDate=false meant clipper inbox.
    destinationMode: stored.destinationMode ?? (stored.organizeByDate === false ? "inbox" : "custom")
  };
}

export function formatDateFolder(date = new Date(), format = DEFAULT_SETTINGS.dateFormat) {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const values = {
    YYYYMMDD: `${year}${month}${day}`,
    "YYYY-MM-DD": `${year}-${month}-${day}`,
    "DD-MM-YYYY": `${day}-${month}-${year}`,
    "DD.MM.YYYY": `${day}.${month}.${year}`,
    "MM-DD-YYYY": `${month}-${day}-${year}`
  };
  return values[format] || values[DEFAULT_SETTINGS.dateFormat];
}

export function browserApi() {
  return globalThis.browser ?? globalThis.chrome;
}

export function normaliseServerUrl(value) {
  const url = new URL(value.trim());
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Use an http:// or https:// Trilium address.");
  }
  return url.href.replace(/\/$/, "");
}

export function localNowDateTime() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 23)
    .replace("T", " ");
  const sign = offset > 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  return `${local}${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}
