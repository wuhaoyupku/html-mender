const MESSAGE_NAMESPACE = "HTML_SLIDE_MENDER";
const LANG_STORAGE_KEY = "htmlSlideMenderLanguage";
const EXPORT_MODE_STORAGE_KEY = "htmlSlideMenderExportMode";
const DEFAULT_LANG = "zh-CN";

const I18N = {
  "zh-CN": {
    subtitle: "HTML 幻灯片本地可视化编辑。",
    language: "语言",
    saveMode: "保存方式",
    basicHtml: "基础 HTML",
    fullHtml: "完整 HTML",
    start: "开始编辑",
    toggleBoxes: "显示 / 隐藏编辑框",
    download: "下载 HTML",
    exit: "退出编辑",
    note: "插件只会在你点击后运行，并导出本地 HTML 副本。",
    ready: "已准备好。打开 HTML 幻灯片页面后开始编辑。",
    injecting: "正在注入编辑器...",
    sending: "正在发送命令...",
    done: "已完成。",
    failed: "命令执行失败。"
  },
  en: {
    subtitle: "Local visual edits for HTML slides.",
    language: "Language",
    saveMode: "Save as",
    basicHtml: "Basic HTML",
    fullHtml: "Full HTML",
    start: "Start editing",
    toggleBoxes: "Show / hide boxes",
    download: "Download HTML",
    exit: "Exit editor",
    note: "The editor only runs after you click it and exports a local HTML copy.",
    ready: "Ready. Open an HTML slide page and start editing.",
    injecting: "Injecting editor...",
    sending: "Sending command...",
    done: "Done.",
    failed: "Command failed."
  }
};

const statusEl = document.getElementById("status");
const languageEl = document.getElementById("language");
const exportModeEl = document.getElementById("export-mode");
const buttons = {
  start: document.getElementById("start"),
  toggleBoxes: document.getElementById("toggle-boxes"),
  download: document.getElementById("download"),
  exit: document.getElementById("exit")
};

let currentLang = DEFAULT_LANG;
let currentExportMode = "basic";

buttons.start.addEventListener("click", () => runCommand("start"));
buttons.toggleBoxes.addEventListener("click", () => runCommand("toggleBoxes"));
buttons.download.addEventListener("click", () => runCommand("download"));
buttons.exit.addEventListener("click", () => runCommand("exit"));
languageEl.addEventListener("change", () => setLanguage(languageEl.value));
exportModeEl.addEventListener("change", () => setExportMode(exportModeEl.value));

init();

async function init() {
  const stored = await chrome.storage.local.get([LANG_STORAGE_KEY, EXPORT_MODE_STORAGE_KEY]).catch(() => ({}));
  currentLang = normalizeLanguage(stored?.[LANG_STORAGE_KEY]);
  currentExportMode = normalizeExportMode(stored?.[EXPORT_MODE_STORAGE_KEY]);
  languageEl.value = currentLang;
  exportModeEl.value = currentExportMode;
  renderLanguage();
  setStatus(t("ready"));
}

async function setLanguage(language) {
  currentLang = normalizeLanguage(language);
  languageEl.value = currentLang;
  renderLanguage();
  setStatus(t("sending"));

  await chrome.storage.local.set({ [LANG_STORAGE_KEY]: currentLang }).catch(() => {});

  try {
    const response = await chrome.runtime.sendMessage({
      namespace: MESSAGE_NAMESPACE,
      type: "POPUP_COMMAND",
      command: "setLanguage",
      payload: { language: currentLang }
    });
    setStatus(response?.message || t("done"));
  } catch (_error) {
    setStatus(t("ready"));
  }
}

async function setExportMode(mode) {
  currentExportMode = normalizeExportMode(mode);
  exportModeEl.value = currentExportMode;
  await chrome.storage.local.set({ [EXPORT_MODE_STORAGE_KEY]: currentExportMode }).catch(() => {});
}

async function runCommand(command) {
  setBusy(true);
  setStatus(command === "start" ? t("injecting") : t("sending"));

  try {
    const response = await chrome.runtime.sendMessage({
      namespace: MESSAGE_NAMESPACE,
      type: "POPUP_COMMAND",
      command,
      payload: {
        language: currentLang,
        exportMode: currentExportMode,
        mode: currentExportMode
      }
    });

    if (!response?.ok) {
      throw new Error(response?.error || t("failed"));
    }

    const summary = response.summary ? ` ${response.summary}` : "";
    setStatus(`${response.message || t("done")}${summary}`);
  } catch (error) {
    setStatus(error.message || String(error));
  } finally {
    setBusy(false);
  }
}

function renderLanguage() {
  document.documentElement.lang = currentLang;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });
}

function setBusy(isBusy) {
  Object.values(buttons).forEach((button) => {
    button.disabled = isBusy;
  });
  languageEl.disabled = isBusy;
  exportModeEl.disabled = isBusy;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function t(key) {
  return I18N[currentLang]?.[key] || I18N.en[key] || key;
}

function normalizeLanguage(language) {
  return language === "en" ? "en" : DEFAULT_LANG;
}

function normalizeExportMode(mode) {
  return mode === "full" ? "full" : "basic";
}
