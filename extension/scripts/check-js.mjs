import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_SCRIPT_FILES } from "../src/content/content-script-files.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  "src/background/service-worker.js",
  "src/popup/popup.js",
  "scripts/validate-extension.mjs",
  "scripts/smoke-page.mjs",
  ...CONTENT_SCRIPT_FILES
];

let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", resolve(root, file)], {
    cwd: root,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    failed = true;
    console.error(`Syntax check failed: ${file}`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
  }
}

if (failed) {
  process.exit(1);
}

console.log(`JavaScript syntax checks passed for ${files.length} files.`);
