import { build } from "esbuild";
import { copyFile, mkdir, writeFile } from "node:fs/promises";

await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
const { outputFiles: [client] } = await build({
  entryPoints: ["src/main.tsx"], bundle: true, minify: true, write: false, jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
await mkdir("dist/assets", { recursive: true });
await writeFile("dist/assets/client.txt", client.text);
await build({
  entryPoints: ["worker/index.js"], platform: "browser", bundle: true, format: "esm", minify: true,
  loader: { ".css": "text", ".svg": "text", ".txt": "text" }, outfile: "dist/server/index.js",
});
await copyFile(".openai/hosting.json", "dist/.openai/hosting.json");
