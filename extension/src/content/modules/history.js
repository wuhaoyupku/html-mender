(() => {
  const ns = window.HtmlSlideMenderExtension = window.HtmlSlideMenderExtension || {};
  ns.mixins = ns.mixins || {};
  const {
    MESSAGE_NAMESPACE,
    ROOT_ID,
    TEXT_SELECTOR,
    BLOCK_TEXT_SELECTOR,
    EXCLUDED_SELECTOR,
    FONTS,
    LANG_STORAGE_KEY,
    DEFAULT_LANG,
    I18N
  } = ns.constants;
  const {
    normalizeText,
    isRendered,
    isVisibleRect,
    intersectsViewport,
    hasTextOverflow,
    round,
    clamp,
    sameState,
    restoreAttr,
    escapeHtml,
    escapeAttr,
    readFileAsDataUrl,
    toHexColor,
    filenameFromTitle,
    normalizeLanguage
  } = ns.utils;
  const {
    placeCaretAtEnd,
    placeCaretFromPoint,
    selectElementContents,
    rangeBelongsTo
  } = ns.selection;
  const { EDITOR_CSS } = ns.ui;

  ns.mixins.history = {
withMutation(item, mutate, label) {
      this.ensureOriginalState(item);
      const before = this.captureState(item);
      mutate();
      const after = this.captureState(item);
      if (!sameState(before, after)) {
        this.pushHistory(item, before, after, label);
        this.markModified(item);
        this.renderBoxes();
        this.refreshToolbar();
      }
    },

ensureOriginalState(item) {
      if (!this.originalStates.has(item.id)) {
        this.originalStates.set(item.id, this.captureState(item));
      }
    },

captureState(item) {
      const element = item.element;
      if (item.type === "text") {
        return {
          kind: "text",
          html: element.innerHTML,
          style: element.getAttribute("style") || ""
        };
      }

      if (item.imageMode === "background") {
        return {
          kind: "background",
          style: element.getAttribute("style") || ""
        };
      }

      return {
        kind: "img",
        src: element.getAttribute("src") || "",
        srcset: element.getAttribute("srcset") || "",
        pictureSources: this.capturePictureSourceStates?.(element) || [],
        style: element.getAttribute("style") || "",
        parentStyle: element.parentElement?.getAttribute("style") || null
      };
    },

restoreState(item, state) {
      const element = item.element;
      if (state.kind === "text") {
        element.innerHTML = state.html;
        restoreAttr(element, "style", state.style);
        return;
      }

      if (state.kind === "background") {
        restoreAttr(element, "style", state.style);
        this.imageAdjustments?.delete(item.id);
        return;
      }

      restoreAttr(element, "src", state.src);
      restoreAttr(element, "srcset", state.srcset);
      this.restorePictureSourceStates?.(element, state.pictureSources);
      restoreAttr(element, "style", state.style);
      if (element.parentElement && state.parentStyle !== null) {
        restoreAttr(element.parentElement, "style", state.parentStyle);
      }
      this.imageAdjustments?.delete(item.id);
    },

pushHistory(item, before, after, label) {
      this.undoStack.push({
        id: item.id,
        type: item.type,
        imageMode: item.imageMode,
        element: item.element,
        frameElement: item.frameElement,
        before,
        after,
        label
      });
      this.redoStack = [];
      this.trimHistory();
    },

trimHistory() {
      if (this.undoStack.length > 80) {
        this.undoStack.splice(0, this.undoStack.length - 80);
      }
    },

undo() {
      const entry = this.undoStack.pop();
      if (!entry) {
        this.toast(this.t("nothingUndo"));
        return;
      }
      const item = this.itemFromHistory(entry);
      this.restoreState(item, entry.before);
      this.updateModifiedFromCurrent(item);
      this.redoStack.push(entry);
      this.scheduleScan(0);
      this.toast(this.t("undone"));
    },

redo() {
      const entry = this.redoStack.pop();
      if (!entry) {
        this.toast(this.t("nothingRedo"));
        return;
      }
      const item = this.itemFromHistory(entry);
      this.restoreState(item, entry.after);
      this.updateModifiedFromCurrent(item);
      this.undoStack.push(entry);
      this.scheduleScan(0);
      this.toast(this.t("redone"));
    },

itemFromHistory(entry) {
      return {
        id: entry.id,
        type: entry.type,
        imageMode: entry.imageMode,
        element: entry.element,
        frameElement: entry.frameElement
      };
    },

itemFromHistoryId(id) {
      const entry = [...this.undoStack, ...this.redoStack].find((item) => item.id === id);
      return entry ? this.itemFromHistory(entry) : null;
    },

markModified(item) {
      this.modified.set(item.id, {
        type: item.type,
        imageMode: item.imageMode
      });
      this.updateModifiedFromCurrent(item);
    },

updateModifiedFromCurrent(item) {
      const original = this.originalStates.get(item.id);
      if (!original) {
        return;
      }
      const current = this.captureState(item);
      if (sameState(original, current)) {
        this.modified.delete(item.id);
      } else {
        this.modified.set(item.id, {
          type: item.type,
          imageMode: item.imageMode
        });
      }
      this.refreshToolbar();
    },

modifiedStats() {
      let text = 0;
      let images = 0;
      for (const item of this.modified.values()) {
        if (item.type === "text") {
          text += 1;
        } else {
          images += 1;
        }
      }
      return { text, images, total: text + images };
    }
  };
})();
