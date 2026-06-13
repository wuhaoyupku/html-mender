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
    FONT_SIZES,
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

  ns.mixins.text = {
enterTextEdit(item, event) {
      if (!item || item.type !== "text") {
        return;
      }

      const alreadyEditing = this.editingTextId === item.id;
      if (!alreadyEditing) {
        this.commitActiveText();
        this.ensureOriginalState(item);
        this.selectedId = item.id;
        this.editingTextId = item.id;
        this.savedTextRange = null;
        this.textEditBefore = this.captureState(item);
        this.textEditRestore = {
          contenteditable: item.element.getAttribute("contenteditable"),
          spellcheck: item.element.getAttribute("spellcheck"),
          userSelect: item.element.style.userSelect,
          webkitUserSelect: item.element.style.webkitUserSelect,
          cursor: item.element.style.cursor
        };

        item.element.setAttribute("contenteditable", "true");
        item.element.setAttribute("spellcheck", "true");
        item.element.style.userSelect = "text";
        item.element.style.webkitUserSelect = "text";
        item.element.style.cursor = "text";
        item.element.addEventListener("input", this.boundTextInput ||= (() => this.handleTextInput()));
      }

      this.renderBoxes();
      requestAnimationFrame(() => {
        item.element.focus({ preventScroll: true });
        if (event && typeof event.clientX === "number") {
          placeCaretFromPoint(item.element, event.clientX, event.clientY);
        } else if (!alreadyEditing) {
          placeCaretAtEnd(item.element);
        }
        this.saveCurrentSelection();
      });
    },

handleTextInput() {
      const item = this.items.get(this.editingTextId);
      if (!item) {
        return;
      }
      this.markModified(item);
      this.refreshToolbar();
      this.renderBoxes();
    },

commitActiveText() {
      if (!this.editingTextId) {
        return;
      }

      const item = this.items.get(this.editingTextId) || this.itemFromHistoryId(this.editingTextId);
      if (!item) {
        this.editingTextId = null;
        return;
      }

      item.element.removeEventListener("input", this.boundTextInput);
      this.restoreTextEditAttributes(item.element);
      const after = this.captureState(item);
      if (this.textEditBefore && !sameState(this.textEditBefore, after)) {
        this.pushHistory(item, this.textEditBefore, after, "Edit text");
        this.markModified(item);
      }

      this.editingTextId = null;
      this.textEditBefore = null;
      this.textEditRestore = null;
      this.savedTextRange = null;
      this.renderBoxes();
      this.refreshToolbar();
    },

restoreTextEditAttributes(element) {
      if (!this.textEditRestore) {
        element.removeAttribute("contenteditable");
        element.removeAttribute("spellcheck");
        return;
      }

      restoreAttr(element, "contenteditable", this.textEditRestore.contenteditable);
      restoreAttr(element, "spellcheck", this.textEditRestore.spellcheck);
      element.style.userSelect = this.textEditRestore.userSelect || "";
      element.style.webkitUserSelect = this.textEditRestore.webkitUserSelect || "";
      element.style.cursor = this.textEditRestore.cursor || "";
    },

applyTextStyle(property, value) {
      const item = this.selectedItem();
      if (!item || item.type !== "text") {
        return;
      }

      this.withMutation(item, () => {
        if (property === "textAlign" || property === "lineHeight") {
          item.element.style[property] = value;
          return;
        }

        if (this.applyInlineStyleToSelection(item, property, value)) {
          return;
        }

        item.element.style[property] = value;
      }, "Text style");
      this.refreshTextFormatButtons?.(item);
    },

parseNumericControl(value) {
      const numeric = Number.parseFloat(String(value).replace(/[^\d.+-]/g, ""));
      return Number.isFinite(numeric) ? numeric : null;
    },

applyFontSize(size) {
      const numeric = this.parseNumericControl(size);
      if (!Number.isFinite(numeric)) {
        return;
      }
      const next = clamp(Math.round(numeric), 6, 100);
      this.applyTextStyle("fontSize", `${next}px`);
      this.syncTextControl("fontSize", String(next));
    },

adjustFontSize(delta) {
      const item = this.selectedItem();
      if (!item || item.type !== "text") {
        return;
      }

      const current = this.currentTextStyle(item, "fontSize");
      const numeric = Number.parseFloat(current) || Number.parseFloat(getComputedStyle(item.element).fontSize) || 16;
      this.applyFontSize(this.nextFontSize(numeric, delta));
    },

applyLineHeight(value) {
      const numeric = this.parseNumericControl(value);
      if (!Number.isFinite(numeric)) {
        return;
      }
      const next = clamp(Math.round(numeric * 100) / 100, 0.7, 4);
      this.applyTextStyle("lineHeight", String(next));
      this.syncTextControl("lineHeight", this.formatLineHeight(next));
    },

displayLineHeight(item) {
      const style = getComputedStyle(item.element);
      const fontSize = Number.parseFloat(style.fontSize) || 16;
      const lineHeight = style.lineHeight === "normal"
        ? fontSize * 1.2
        : Number.parseFloat(style.lineHeight);
      const ratio = Number.isFinite(lineHeight) && fontSize
        ? lineHeight / fontSize
        : 1.2;
      return this.formatLineHeight(clamp(ratio, 0.7, 4));
    },

formatLineHeight(value) {
      return String(Math.round(value * 100) / 100).replace(/\.0$/, "");
    },

syncTextControl(control, value) {
      const input = this.shadow?.querySelector(`[data-control='${control}']`);
      if (input) {
        if (control === "fontSize" && this.setFontSizeControl) {
          this.setFontSizeControl(value);
          return;
        }
        input.value = value;
      }
    },

nextFontSize(current, delta) {
      const sizes = FONT_SIZES.slice().sort((a, b) => a - b);
      if (delta > 0) {
        return sizes.find((size) => size > current) || sizes[sizes.length - 1];
      }
      return [...sizes].reverse().find((size) => size < current) || sizes[0];
    },

applyInlineStyleToSelection(item, property, value) {
      const range = this.activeTextRange(item);
      if (!range || range.collapsed) {
        return false;
      }

      const styledAncestor = this.closestInlineStyledAncestor(item, range, property);
      if (styledAncestor) {
        styledAncestor.style[property] = value;
        this.clearDescendantInlineStyle(styledAncestor, property);
        selectElementContents(styledAncestor);
        this.savedTextRange = window.getSelection()?.rangeCount
          ? window.getSelection().getRangeAt(0).cloneRange()
          : null;
        return true;
      }

      const span = document.createElement("span");
      span.style[property] = value;

      const fragment = range.extractContents();
      span.appendChild(fragment);
      this.clearDescendantInlineStyle(span, property);
      range.insertNode(span);
      selectElementContents(span);
      this.savedTextRange = window.getSelection()?.rangeCount
        ? window.getSelection().getRangeAt(0).cloneRange()
        : null;
      return true;
    },

clearDescendantInlineStyle(root, property) {
      const keys = this.inlineStyleKeys(property);
      if (!keys.length || !root.querySelectorAll) {
        return;
      }

      for (const element of root.querySelectorAll("[style]")) {
        for (const key of keys) {
          element.style[key] = "";
        }
        if (!element.getAttribute("style")) {
          element.removeAttribute("style");
        }
      }
    },

inlineStyleKeys(property) {
      if (property === "textDecoration" || property === "textDecorationLine") {
        return ["textDecoration", "textDecorationLine"];
      }
      return [property];
    },

closestInlineStyledAncestor(item, range, property) {
      let node = this.styleNodeForRange(range, item.element);
      const styleProperty = property === "textDecoration" ? "textDecoration" : property;
      while (node && node !== item.element.parentElement) {
        if (node.nodeType === Node.ELEMENT_NODE && node.style?.[styleProperty]) {
          return node;
        }
        if (node === item.element) {
          break;
        }
        node = node.parentElement;
      }
      return null;
    },

activeTextRange(item) {
      const selection = window.getSelection();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (rangeBelongsTo(range, item.element)) {
          this.savedTextRange = range.cloneRange();
          return range;
        }
      }

      if (this.savedTextRange && rangeBelongsTo(this.savedTextRange, item.element)) {
        selection?.removeAllRanges();
        selection?.addRange(this.savedTextRange);
        return this.savedTextRange;
      }

      return null;
    },

saveCurrentSelection() {
      if (!this.editingTextId) {
        return;
      }

      const item = this.items.get(this.editingTextId) || this.itemFromHistoryId(this.editingTextId);
      const selection = window.getSelection();
      if (!item || !selection?.rangeCount) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (rangeBelongsTo(range, item.element)) {
        this.savedTextRange = range.cloneRange();
      }
    },

toggleTextStyle(property, activeValue, inactiveValue) {
      const item = this.selectedItem();
      if (!item || item.type !== "text") {
        return;
      }

      const current = this.currentTextStyle(item, property);
      const state = this.textStyleState(item, property, activeValue);
      const isActive = state === "active" || (state === "mixed" && this.isTextStyleActive(property, current, activeValue));
      this.applyTextStyle(property, isActive ? inactiveValue : activeValue);
    },

toggleUnderline() {
      const item = this.selectedItem();
      if (!item || item.type !== "text") {
        return;
      }

      const current = this.currentTextStyle(item, "textDecorationLine");
      const state = this.textStyleState(item, "textDecorationLine", "underline");
      const isActive = state === "active" || (state === "mixed" && current.includes("underline"));
      this.applyTextStyle("textDecoration", isActive ? "none" : "underline");
    },

currentTextStyle(item, property) {
      const range = this.activeTextRange(item);
      const node = range ? this.styleNodeForRange(range, item.element) : item.element;
      return getComputedStyle(node || item.element)[property];
    },

styleNodeForRange(range, fallback) {
      if (range.startContainer.nodeType === Node.ELEMENT_NODE) {
        const walker = document.createTreeWalker(range.startContainer, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode;
          if (!normalizeText(node.textContent || "")) {
            continue;
          }
          try {
            if (range.intersectsNode(node)) {
              return node.parentElement || fallback;
            }
          } catch (_error) {
            continue;
          }
        }
        return range.startContainer;
      }

      return range.startContainer.parentElement || fallback;
    },

textStyleState(item, property, activeValue) {
      if (!item || item.type !== "text") {
        return "inactive";
      }

      const range = this.styleStateRange(item);
      if (range?.collapsed) {
        const node = this.styleNodeForRange(range, item.element);
        return this.isNodeTextStyleActive(node, item.element, property, activeValue) ? "active" : "inactive";
      }

      const nodes = this.textNodesForStyleState(item.element, range);
      if (!nodes.length) {
        const node = range ? this.styleNodeForRange(range, item.element) : item.element;
        return this.isNodeTextStyleActive(node, item.element, property, activeValue) ? "active" : "inactive";
      }

      let active = 0;
      for (const node of nodes) {
        if (this.isNodeTextStyleActive(node, item.element, property, activeValue)) {
          active += 1;
        }
      }

      if (range && active === 0 && normalizeText(window.getSelection()?.toString() || "")) {
        const fallbackNodes = this.textNodesForStyleState(item.element, null);
        if (fallbackNodes.length && fallbackNodes.every((node) => this.isNodeTextStyleActive(node, item.element, property, activeValue))) {
          return "active";
        }
      }

      if (active === nodes.length) {
        return "active";
      }
      return active === 0 ? "inactive" : "mixed";
    },

styleStateRange(item) {
      const selection = window.getSelection();
      if (selection?.rangeCount) {
        const range = selection.getRangeAt(0);
        if (rangeBelongsTo(range, item.element)) {
          return range;
        }
      }

      if (this.savedTextRange && rangeBelongsTo(this.savedTextRange, item.element)) {
        return this.savedTextRange;
      }

      return null;
    },

textNodesForStyleState(element, range) {
      const nodes = [];
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!normalizeText(node.textContent || "")) {
          continue;
        }
        if (range) {
          try {
            if (!range.intersectsNode(node)) {
              continue;
            }
          } catch (_error) {
            continue;
          }
        }
        nodes.push(node);
      }
      return nodes;
    },

isNodeTextStyleActive(node, boundary, property, activeValue) {
      const element = node?.nodeType === Node.ELEMENT_NODE
        ? node
        : node?.parentElement;
      if (!element) {
        return false;
      }

      if (property === "textDecoration" || property === "textDecorationLine") {
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
          if (this.isTextStyleActive(property, getComputedStyle(current).textDecorationLine, activeValue)) {
            return true;
          }
          if (current === boundary) {
            break;
          }
          current = current.parentElement;
        }
        return false;
      }

      return this.isTextStyleActive(property, getComputedStyle(element)[property], activeValue);
    },

isTextStyleActive(property, current, activeValue) {
      if (property === "fontWeight") {
        return Number.parseInt(current, 10) >= 600;
      }
      if (property === "textDecoration" || property === "textDecorationLine") {
        return String(current).includes("underline");
      }
      return current === activeValue;
    }
  };
})();
