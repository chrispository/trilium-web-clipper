import { copyFile, mkdir } from "node:fs/promises";

await mkdir("vendor", { recursive: true });
await copyFile("node_modules/defuddle/dist/index.js", "vendor/defuddle.js");
await copyFile("node_modules/defuddle/LICENSE", "vendor/defuddle-LICENSE");
