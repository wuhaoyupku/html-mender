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
    isElementRendered,
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

  ns.mixins.scanner = {
findTextItems() {
      const raw = Array.from(document.querySelectorAll(TEXT_SELECTOR))
        .filter((element) => this.isTextCandidate(element));
      const explicit = raw.filter((element) => this.isExplicitTextCandidate(element));
      const source = this.shouldPreferExplicitTextCandidates(raw, explicit)
        ? this.mergeTextCandidates(explicit, raw.filter((element) => this.isRevealedTextCandidate(element)))
        : raw;
      const candidates = this.filterNestedText(source);

      return candidates.map((element) => ({
        id: this.idFor(element, "text"),
        type: "text",
        element
      }));
    },

mergeTextCandidates(primary, extra) {
      return Array.from(new Set([...(primary || []), ...(extra || [])]));
    },

findImageItems() {
      const items = [];
      const seen = new Set();

      for (const image of document.querySelectorAll("img, picture img")) {
        if (!this.isImageCandidate(image)) {
          continue;
        }
        const id = this.idFor(image, "image");
        const frameElement = this.frameElementForImage(image);
        seen.add(image);
        items.push({
          id,
          type: "image",
          imageMode: "img",
          element: image,
          frameElement,
          positioned: this.isPositionedImage(image, frameElement)
        });
      }

      const all = Array.from(document.body?.querySelectorAll("*") || []);
      for (const element of all) {
        if (seen.has(element) || !this.isBackgroundImageCandidate(element)) {
          continue;
        }
        items.push({
          id: this.idFor(element, "background"),
          type: "image",
          imageMode: "background",
          element,
          frameElement: element,
          positioned: this.isPositionedImage(element, element)
        });
      }

      return items;
    },

frameElementForImage(image) {
      const parent = image.parentElement;
      if (!parent || parent === document.body || parent === document.documentElement) {
        return image;
      }

      const parentRect = parent.getBoundingClientRect();
      const imageRect = image.getBoundingClientRect();
      const parentUsable = isVisibleRect(parentRect, 24, 24) &&
        parentRect.width >= imageRect.width * 0.45 &&
        parentRect.height >= imageRect.height * 0.45;
      return parentUsable ? parent : image;
    },

isPositionedImage(element, frameElement) {
      return [element, frameElement].filter(Boolean).some((node) => {
        const style = getComputedStyle(node);
        return ["absolute", "fixed", "sticky"].includes(style.position) || style.float !== "none";
      });
    },

isTextCandidate(element) {
      if (!this.isPageElement(element) || element.matches(EXCLUDED_SELECTOR)) {
        return false;
      }

      const isAddedText = element.dataset.hsmAdded === "text";
      const isExplicitText = this.isExplicitTextCandidate(element);
      const text = normalizeText(element.innerText || element.textContent || "");
      if (!isExplicitText && text.length < 2) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      if (!isVisibleRect(rect, 8, 8) || !intersectsViewport(rect)) {
        return false;
      }

      if (!isElementRendered(element)) {
        return false;
      }

      const tag = element.tagName.toLowerCase();
      if (tag === "div" && !element.hasAttribute("data-editable") && !isAddedText) {
        if (element.querySelector(BLOCK_TEXT_SELECTOR)) {
          return false;
        }
        if (rect.width * rect.height > window.innerWidth * window.innerHeight * 0.42) {
          return false;
        }
      }

      return true;
    },

isExplicitTextCandidate(element) {
      return element?.hasAttribute?.("data-editable") ||
        element?.dataset?.hsmAdded === "text" ||
        element?.isContentEditable;
    },

isRevealedTextCandidate(element) {
      if (!element || this.isExplicitTextCandidate(element)) {
        return false;
      }
      const text = normalizeText(element.innerText || element.textContent || "");
      if (text.length < 4) {
        return false;
      }
      const expandableAncestor = element.closest?.(
        ".expanded,[open],[aria-expanded='true'],[data-expanded='true'],[data-open='true'],.is-expanded,.is-open"
      );
      if (!expandableAncestor) {
        return false;
      }
      if (element.querySelector(BLOCK_TEXT_SELECTOR)) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      return isVisibleRect(rect, 8, 8) && intersectsViewport(rect);
    },

shouldPreferExplicitTextCandidates(raw, explicit) {
      if (!explicit.length || explicit.length < 3) {
        return false;
      }

      const explicitTextLength = explicit.reduce((total, element) => (
        total + normalizeText(element.innerText || element.textContent || "").length
      ), 0);
      const rawTextLength = raw.reduce((total, element) => (
        total + normalizeText(element.innerText || element.textContent || "").length
      ), 0);

      return explicit.length >= raw.length * 0.35 ||
        explicitTextLength >= rawTextLength * 0.45;
    },

filterNestedText(elements) {
      const set = new Set(elements);
      return elements.filter((element) => {
        let parent = element.parentElement;
        while (parent && parent !== document.body && parent !== document.documentElement) {
          if (set.has(parent) && parent.matches(BLOCK_TEXT_SELECTOR)) {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      });
    },

isImageCandidate(element) {
      if (!this.isPageElement(element)) {
        return false;
      }

      const isAddedImage = element.dataset.hsmAdded === "image";
      const rect = element.getBoundingClientRect();
      if (!isVisibleRect(rect, isAddedImage ? 12 : 24, isAddedImage ? 12 : 24) || !intersectsViewport(rect)) {
        return false;
      }

      return isElementRendered(element);
    },

isBackgroundImageCandidate(element) {
      if (!this.isPageElement(element) || element.matches(EXCLUDED_SELECTOR)) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      if (!isVisibleRect(rect, 36, 36) || !intersectsViewport(rect)) {
        return false;
      }

      const style = getComputedStyle(element);
      if (!isElementRendered(element) || style.backgroundImage === "none") {
        return false;
      }

      return /url\(/i.test(style.backgroundImage) || element.hasAttribute("data-image-slot");
    },

isPageElement(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return false;
      }
      if (element.id === ROOT_ID || element.closest(`#${ROOT_ID}`)) {
        return false;
      }
      return element.ownerDocument === document;
    },

idFor(element, kind) {
      let baseId = this.elementIds.get(element);
      if (!baseId) {
        baseId = `hsm-${this.nextId++}`;
        this.elementIds.set(element, baseId);
      }
      return `${baseId}-${kind}`;
    }
  };
})();
