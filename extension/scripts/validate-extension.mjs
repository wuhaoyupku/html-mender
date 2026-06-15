import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_SCRIPT_FILES } from "../src/content/content-script-files.js";

const root = new URL("..", import.meta.url);
const manifestPath = new URL("manifest.json", root);
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const requiredFiles = [
  "manifest.json",
  "src/background/service-worker.js",
  "src/popup/popup.html",
  "src/popup/popup.css",
  "src/popup/popup.js",
  "src/content/content-script-files.js",
  ...CONTENT_SCRIPT_FILES
];

const errors = [];

if (manifest.manifest_version !== 3) {
  errors.push("manifest_version must be 3.");
}

for (const permission of ["activeTab", "scripting", "downloads", "storage"]) {
  if (!manifest.permissions?.includes(permission)) {
    errors.push(`Missing permission: ${permission}`);
  }
}

if (manifest.host_permissions?.length) {
  errors.push("MVP should not declare broad host_permissions.");
}

for (const file of requiredFiles) {
  if (!existsSync(join(root.pathname, file))) {
    errors.push(`Missing file: ${file}`);
  }
}

const popupHtml = await readFile(new URL("src/popup/popup.html", root), "utf8");
if (/\son\w+=/i.test(popupHtml)) {
  errors.push("Popup HTML should not contain inline event handlers.");
}

if (/<script(?![^>]+src=)/i.test(popupHtml)) {
  errors.push("Popup HTML should not contain inline scripts.");
}

const exporterJs = await readFile(new URL("src/content/modules/exporter.js", root), "utf8");
if (/credentials\s*:\s*["']include["']/.test(exporterJs)) {
  errors.push("Full HTML export must not fetch external resources with browser credentials.");
}

const skillRoot = new URL("../skills/html-slide-mender/", root);
const skillSafetyFiles = [
  "SKILL.md",
  "scripts/inject-html-editor.mjs",
  "scripts/rebuild-runtime-from-extension.mjs",
  "assets/html-slide-mender-runtime.js"
];

for (const file of skillSafetyFiles) {
  const source = await readFile(new URL(file, skillRoot), "utf8");
  if (/__HTML_SLIDE_MENDER_SKILL_(?:SOURCE_HTML|OPTIONS|SAVE_DRAFT__|CLEAR_DRAFT__)/.test(source)) {
    errors.push(`Skill file must not expose source HTML, options, or draft helpers through window globals: ${file}`);
  }
  if (/\bremoveMetaCsp\b|\bstripCsp\b|--strip-csp|--preserve-csp/.test(source)) {
    errors.push(`Skill file must not include CSP-stripping behavior: ${file}`);
  }
  if (/credentials\s*:\s*["']include["']/.test(source)) {
    errors.push(`Skill file must not fetch network resources with browser credentials: ${file}`);
  }
  if (/\bcollectExportStyleEntries\b|\bbundleExportResources\b|\bfetchStylesheetText\b|\bresourceAsDataUrl\b/.test(source)) {
    errors.push(`Skill file must not include full-export network resource bundling helpers: ${file}`);
  }
}

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log("Extension manifest and file structure look good.");
