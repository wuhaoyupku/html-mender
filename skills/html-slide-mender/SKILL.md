---
name: html-slide-mender
description: Use this skill whenever the user wants to visually edit a local HTML file, AI-generated HTML presentation, webpage saved as HTML, or "HTML PPT" without editing source code. It injects a self-contained editor into a local HTML copy so the user can edit text and images in the browser, then download a clean HTML file. Do not use it for live online websites; ask the user to provide or save a local HTML file first.
---

# HTML Slide Mender

This skill turns a local `.html` file into an editable browser page by injecting the HTML Slide Mender runtime. It is intended for AI-generated HTML decks, HTML PPT outputs, and other local HTML pages where the user wants a visual editor instead of source-code edits.

## Use This For

- "我想编辑这个 HTML"
- "帮我把这个 HTML PPT 变成可编辑"
- "这个 AI 生成的 HTML 页面我想改文字/图片"
- "注入编辑器让我自己改一下"
- Local `.html` files, including pages saved from a browser

Do not target live websites directly. If the user asks to edit an online page, ask them to provide a saved local HTML copy or use the browser extension workflow instead.

## Workflow

1. Locate the user's source HTML file. If multiple candidates are possible, ask which file to edit.
2. Run the injector script from this skill:

```bash
node /path/to/this-skill/scripts/inject-html-editor.mjs /absolute/path/input.html
```

3. Use the JSON output to find the generated editable file. By default it is created next to the source file as `name.editable.html`.
4. Open the editable HTML in a browser when the user wants to edit now. The editor should start automatically.
5. Tell the user to edit visually in the page.
6. When finished, tell the user to click the editor toolbar's "下载 HTML / Download HTML" button. This downloaded file is the durable saved result for the MVP.

The original HTML file is never modified by default.

## Script Options

```bash
node scripts/inject-html-editor.mjs <input.html> \
  --out <output.html> \
  --lang zh-CN \
  --mode basic
```

- `--out`: custom editable HTML output path.
- `--lang zh-CN|en`: editor language. Default: `zh-CN`.
- `--mode basic|full`: default export mode. `basic` keeps original external links; `full` tries to inline accessible CSS/images. Default: `basic`.
- `--no-autostart`: inject runtime but do not start the editor automatically.
- `--preserve-csp`: keep meta Content-Security-Policy tags. By default the editable copy removes CSP meta tags because they often block injected inline scripts.

## Important Behavior

- The generated editable HTML includes the editor runtime inline, marked with `data-hsm-editor`.
- The editor's clean export removes its own toolbar, boxes, and injected runtime scripts.
- The MVP does not enable local draft saving. Refreshing or closing the editable page can lose unsaved edits; use "下载 HTML / Download HTML" when the user wants to keep the result.
- For skill-injected pages in `basic` mode, the final download starts from the original source HTML and applies content-layer edits to text/images/backgrounds instead of serializing the live runtime DOM. This avoids freezing slide-deck runtime state such as generated navigation dots or the currently translated slide.
- For PPT-style HTML with separate CSS files, prefer `--mode basic` unless the user specifically wants a bundled single HTML.
- For standalone sharing or uncertain external assets, use `--mode full`, but warn that browser security may prevent bundling some cross-origin or inaccessible assets.
- If the editable page appears unstyled, generate the editable file next to the original HTML so relative CSS/image paths still resolve.

## Example

User: "我想编辑 `/Users/me/deck.html`。"

Run:

```bash
node /path/to/this-skill/scripts/inject-html-editor.mjs /Users/me/deck.html --lang zh-CN --mode basic
```

Then open `/Users/me/deck.editable.html` and let the user edit in the browser.
