#!/usr/bin/env node
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimePath = resolve(skillDir, "assets/html-slide-mender-runtime.js");
const START_MARKER = "<!-- html-slide-mender-skill:start -->";
const END_MARKER = "<!-- html-slide-mender-skill:end -->";

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error?.message || String(error)
  }, null, 2));
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    printUsage();
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = resolve(args.input);
  await access(inputPath, fsConstants.R_OK);

  const outputPath = resolve(args.out || defaultOutputPath(inputPath));
  await mkdir(dirname(outputPath), { recursive: true });

  const sourceHtml = await readFile(inputPath, "utf8");
  const runtime = await readFile(runtimePath, "utf8");
  const cleanedHtml = stripPreviousInjection(sourceHtml);
  const options = {
    lang: args.lang || "zh-CN",
    exportMode: args.mode || "basic",
    autoStart: args.autoStart,
    enableDraft: false
  };
  const editableHtml = injectBeforeBodyEnd(
    cleanedHtml,
    buildBodyInjection(runtime, options, cleanedHtml)
  );

  await writeFile(outputPath, editableHtml, "utf8");

  console.log(JSON.stringify({
    ok: true,
    input: inputPath,
    output: outputPath,
    lang: args.lang || "zh-CN",
    exportMode: args.mode || "basic",
    autoStart: args.autoStart,
    cspMetaPreserved: true,
    cspMetaModified: false,
    note: "Open the output HTML in a browser, edit visually, then use the editor toolbar to download a clean HTML copy."
  }, null, 2));
}

function parseArgs(argv) {
  const args = {
    input: "",
    out: "",
    lang: "zh-CN",
    mode: "basic",
    autoStart: true,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--out") {
      args.out = requireValue(argv, index, arg);
      index += 1;
    } else if (arg === "--lang") {
      args.lang = normalizeLanguage(requireValue(argv, index, arg));
      index += 1;
    } else if (arg === "--mode") {
      args.mode = normalizeMode(requireValue(argv, index, arg));
      index += 1;
    } else if (arg === "--no-autostart") {
      args.autoStart = false;
    } else if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!args.input) {
      args.input = arg;
    } else {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }
  }

  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

function normalizeLanguage(value) {
  return value === "en" ? "en" : "zh-CN";
}

function normalizeMode(value) {
  if (!value || value === "basic") {
    return "basic";
  }
  throw new Error(`Unsupported export mode for the skill runtime: ${value}. Use basic.`);
}

function defaultOutputPath(inputPath) {
  const dir = dirname(inputPath);
  const ext = extname(inputPath) || ".html";
  const stem = basename(inputPath, ext);
  return resolve(dir, `${stem}.editable${ext}`);
}

function stripPreviousInjection(html) {
  return String(html || "")
    .replace(/<!--\s*html-slide-mender-skill:(?:start|end)\s*-->/gi, "")
    .replace(/<script\b(?=[^>]*\bdata-hsm-editor\b)[\s\S]*?<\/script\s*>/gi, "");
}

function buildBodyInjection(runtime, options, sourceHtml) {
  const optionsJson = jsonForInlineScript(options);
  const sourceJson = jsonForInlineScript(String(sourceHtml || ""));
  return [
    START_MARKER,
    `<script data-hsm-editor="skill-runtime">\n(() => {\n  const skillSourceHtml = ${sourceJson};\n  const skillOptions = ${optionsJson};\n${indentRuntime(escapeScript(runtime))}\n})();\n</script>`,
    END_MARKER
  ].join("\n");
}

function escapeScript(source) {
  return String(source || "").replace(/<\/script/gi, "<\\/script");
}

function jsonForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function indentRuntime(source) {
  return String(source || "").split("\n").map((line) => `  ${line}`).join("\n");
}

function injectBeforeBodyEnd(html, injection) {
  const source = String(html || "");
  if (/<\/body\s*>/i.test(source)) {
    return source.replace(/<\/body\s*>/i, `${injection}\n</body>`);
  }
  if (/<\/html\s*>/i.test(source)) {
    return source.replace(/<\/html\s*>/i, `${injection}\n</html>`);
  }
  return `${source}\n${injection}\n`;
}

function printUsage() {
  console.log(`Usage:
  node scripts/inject-html-editor.mjs <input.html> [--out output.html] [--lang zh-CN|en] [--mode basic]

Options:
  --out <path>       Output editable HTML path. Defaults to <input>.editable.html in the same folder.
  --lang <value>     Editor language: zh-CN or en. Defaults to zh-CN.
  --mode <value>     Export mode. Only basic is supported by the skill runtime.
  --no-autostart     Inject the runtime but do not start editing automatically.
`);
}
