# HTML Slide Mender

HTML Slide Mender 让 **HTML PPT / AI 生成的网页演示稿** 可以像普通幻灯片一样被快速修稿。

你可以直接在浏览器里改文字、换图片、调整样式，然后下载一份干净的 HTML。它特别适合 AI 生成 HTML PPT 之后的最后一轮人工微调：改错别字、换标题、替换配图、统一字号颜色，而不用重新提示模型生成，也不用手写 HTML/CSS。

## 为什么需要它

- 大模型已经把 HTML PPT 做好了，只是一个标题、一个数字、一个错别字要改；但你不得不重新描述问题、等模型改、再检查一遍，还继续花 token 和钱。
- 你把做好的 HTML PPT 发给老板或客户，对方只想顺手改两句话；但他没有大模型工具，也不会改 HTML，只能把意见发回给你。
- 页面设计、动画和翻页都已经满意了，你只想改内容；但重新生成很容易把原来满意的地方也改坏。

## 用大模型安装技能

如果你已经在使用 Codex 或类似的大模型 coding agent，并且希望它帮你把某个本地 HTML PPT 准备成“可视化编辑页面”，最推荐的方式是安装本仓库里的 `html-slide-mender` 技能。

如果你只是自己临时修改演讲 PPT 里的几处文字或图片，不需要大模型参与，直接安装浏览器扩展会更顺手。

你可以直接对大模型说：

```text
请从 https://github.com/wuhaoyupku/html-slide-mender 安装 html-slide-mender 技能。
```

安装后，你可以继续说：

```text
帮我把这个 HTML PPT 变成可编辑页面：/path/to/deck.html
```

大模型会使用 `skills/html-slide-mender` 中的技能，把你的本地 HTML 复制成一个可编辑版本，并注入 HTML Slide Mender 编辑器。你打开生成的 `*.editable.html` 后，就可以在浏览器里可视化修改文字和图片，最后点击 `下载 HTML` 得到最终文件。

这个方式适合不想碰命令行的用户：你只需要给大模型一个 HTML 文件路径，然后在浏览器里完成编辑。

## 安装浏览器扩展

如果你想直接在浏览器里编辑 HTML 页面，可以在 Google 或浏览器插件商店搜索：

```text
html-slide-mender
```

建议优先在这些地方搜索：

- Google
- Chrome Web Store
- Microsoft Edge Add-ons
- 其他 Chromium 浏览器的扩展商店

安装后，打开你的 HTML PPT 页面，点击扩展图标即可开始编辑。对于 `file://` 打开的本地 HTML，可能需要在扩展详情页开启 `Allow access to file URLs`。

## 给开发者和高级用户

你也可以从源码运行技能注入器或本地加载浏览器扩展。

克隆仓库：

```bash
git clone https://github.com/wuhaoyupku/html-slide-mender.git
cd html-slide-mender
```

手动安装技能：

```bash
npx -y skills add ./skills/html-slide-mender
```

直接把编辑器注入到某个本地 HTML：

```bash
node skills/html-slide-mender/scripts/inject-html-editor.mjs /absolute/path/input.html \
  --out /absolute/path/input.editable.html \
  --lang zh-CN \
  --mode basic
```

本地加载浏览器扩展：

1. 打开 `chrome://extensions`。
2. 开启 Developer mode。
3. 点击 Load unpacked。
4. 选择本仓库的 `extension` 目录。
5. 打开 HTML PPT 页面，点击扩展图标开始编辑。

## 开发

```bash
cd extension
npm install
npm run check
```

如果要运行浏览器烟测，需要额外安装 Playwright：

```bash
cd extension
npm install --no-save playwright
npx playwright install chromium
npm run smoke
```

Playwright 不写入默认依赖，避免只使用技能或只做普通开发的用户被迫安装浏览器测试工具。

## 仓库结构

```text
docs/                         产品设计和项目文档
examples/                     示例 HTML PPT
extension/                    Chrome Manifest V3 扩展
skills/html-slide-mender/      Codex / LLM 技能包
prototypes/                   早期原型资产
```

## 路线图 Checklist

- [ ] 元素位置调整：允许轻量移动文字和图片位置。
- [ ] 元素尺寸调整：支持基础宽高调整，同时尽量不破坏原布局。
- [ ] 更好的文字溢出提示：改字后发现可能超出容器。
- [ ] 内容级草稿/恢复机制：只保存用户内容修改，不保存运行时 DOM 状态。
- [ ] 多文件导出：图片和资源可选择打包成 ZIP。
- [ ] 更多 HTML PPT 模板适配测试。
- [ ] AI 辅助修稿：改写、缩短、统一语气和翻译。

## License

MIT

---

# HTML Slide Mender

HTML Slide Mender helps you visually edit **HTML slide decks and AI-generated presentation pages**.

You can edit text, replace images, adjust simple styles, and download a clean HTML file from the browser. It is designed for the last editing pass after an AI has generated an HTML deck: fixing copy, changing titles, replacing visuals, and polishing typography without rewriting HTML/CSS or regenerating the whole deck.

## Why This Exists

- The AI already made the HTML deck, and all you need is to fix one title, one number, or one typo; instead you have to prompt again, wait again, review again, and spend more tokens.
- You send the finished HTML deck to your boss or client, and they only want to tweak two sentences; but they do not have your AI tool, and they definitely do not want to edit HTML.
- The layout, animation, and slide navigation are already right, and you only want content edits; regenerating the deck risks breaking the parts you already liked.

## Install The LLM Skill

If you already use Codex or another LLM coding agent, and you want it to prepare a local HTML deck as a visually editable page, the recommended workflow is to install the `html-slide-mender` skill from this repository.

If you only need to quickly edit a few words or images in a presentation yourself, the browser extension is the simpler path.

Tell the model:

```text
Please install the html-slide-mender skill from https://github.com/wuhaoyupku/html-slide-mender.
```

Then ask:

```text
Please make this HTML deck editable: /path/to/deck.html
```

The assistant will use `skills/html-slide-mender` to create an editable copy of your local HTML file and inject the HTML Slide Mender editor. Open the generated `*.editable.html`, edit text and images visually, then click `Download HTML` to save the final file.

This workflow is meant for users who do not want to run commands themselves: give the assistant a local HTML path, then do the visual editing in the browser.

## Install The Browser Extension

To edit HTML pages directly in your browser, search Google or your browser's extension store for:

```text
html-slide-mender
```

Recommended places to search:

- Google
- Chrome Web Store
- Microsoft Edge Add-ons
- Other Chromium browser extension stores

After installing, open an HTML deck and click the extension action. For local `file://` decks, you may need to enable `Allow access to file URLs` in the extension details page.

## For Developers And Advanced Users

You can also run the skill injector or load the browser extension from source.

Clone the repository:

```bash
git clone https://github.com/wuhaoyupku/html-slide-mender.git
cd html-slide-mender
```

Install the skill manually:

```bash
npx -y skills add ./skills/html-slide-mender
```

Inject the editor into a local HTML file:

```bash
node skills/html-slide-mender/scripts/inject-html-editor.mjs /absolute/path/input.html \
  --out /absolute/path/input.editable.html \
  --lang zh-CN \
  --mode basic
```

Load the browser extension locally:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Choose Load unpacked.
4. Select this repository's `extension` folder.
5. Open an HTML deck and click the extension action.

## Development

```bash
cd extension
npm install
npm run check
```

To run the browser smoke test, install Playwright separately:

```bash
cd extension
npm install --no-save playwright
npx playwright install chromium
npm run smoke
```

Playwright is intentionally not part of the default dependency set, so users who only use the skill or do ordinary development do not need to install browser test tooling.

## Repository Layout

```text
docs/                         Product notes and project documentation
examples/                     Example HTML decks
extension/                    Chrome Manifest V3 extension
skills/html-slide-mender/      Codex / LLM skill
prototypes/                   Early prototype assets
```

## Roadmap Checklist

- [ ] Element positioning: lightly move text and image elements.
- [ ] Element resizing: basic width/height adjustments while preserving layout.
- [ ] Better text overflow warnings after copy edits.
- [ ] Content-level draft/recovery that avoids saving runtime DOM state.
- [ ] Multi-file export with images/resources packaged as ZIP.
- [ ] More compatibility tests for HTML deck templates.
- [ ] AI-assisted copy editing, shortening, tone matching, and translation.

## License

MIT
