export const DEFAULT_SETTINGS = {
  serverUrl: "",
  token: "",
  organizeByDate: true,
  destinationPath: "Clippings"
};

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
