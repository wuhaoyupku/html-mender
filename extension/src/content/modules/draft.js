(() => {
  const ns = window.HtmlSlideMenderExtension = window.HtmlSlideMenderExtension || {};
  ns.mixins = ns.mixins || {};
  const { ROOT_ID } = ns.constants;

  ns.mixins.draft = {
isDraftEnabled() {
      return Boolean(window.__HTML_SLIDE_MENDER_SKILL_OPTIONS?.enableDraft);
    },

async saveDraft() {
      if (!this.isDraftEnabled?.()) {
        return { ok: false, error: "Drafts are only available in skill-injected pages." };
      }

      if (!this.active) {
        await this.start();
      }

      this.commitActiveText();
      const draft = this.serializeEditableDraft();
      const save = window.__HTML_SLIDE_MENDER_SKILL_SAVE_DRAFT__;
      if (typeof save !== "function") {
        this.toast(this.t("draftSaveFailed"));
        return { ok: false, error: "Draft storage is unavailable." };
      }

      const response = await save({
        ...draft,
        title: document.title,
        url: location.href
      });
      if (!response?.ok) {
        this.toast(response?.error || this.t("draftSaveFailed"));
        return response || { ok: false, error: this.t("draftSaveFailed") };
      }

      this.toast(this.t("draftSaved"));
      return { ok: true, message: this.t("draftSaved"), savedAt: response.savedAt };
    },

serializeEditableDraft() {
      return {
        version: 2,
        patches: this.createDraftPatches()
      };
    },

createDraftPatches() {
      const patches = [];
      for (const id of this.modified.keys()) {
        const item = this.items.get(id) || this.itemFromHistoryId(id);
        if (!item?.element?.isConnected) {
          continue;
        }
        const selector = this.selectorForDraftElement(item.element);
        if (!selector) {
          continue;
        }
        patches.push({
          id,
          type: item.type,
          imageMode: item.imageMode,
          selector,
          state: this.serializableDraftState(item)
        });
      }
      return patches;
    },

serializableDraftState(item) {
      const state = this.captureState(item);
      if (Array.isArray(state.pictureSources)) {
        state.pictureSources = state.pictureSources.map((sourceState) => ({
          srcset: sourceState.srcset || "",
          sizes: sourceState.sizes || "",
          type: sourceState.type || "",
          media: sourceState.media || ""
        }));
      }
      return state;
    },

selectorForDraftElement(element) {
      if (!element || element.nodeType !== Node.ELEMENT_NODE || element.id === ROOT_ID || element.closest?.(`#${ROOT_ID}`)) {
        return "";
      }

      const escapedId = element.id ? this.escapeDraftCss(element.id) : "";
      if (escapedId) {
        const selector = `#${escapedId}`;
        if (document.querySelectorAll(selector).length === 1) {
          return selector;
        }
      }

      const segments = [];
      let current = element;
      while (current && current.nodeType === Node.ELEMENT_NODE && current !== document) {
        const tag = current.tagName.toLowerCase();
        if (current === document.documentElement) {
          segments.unshift(tag);
          break;
        }
        let index = 1;
        let sibling = current;
        while ((sibling = sibling.previousElementSibling)) {
          if (sibling.tagName === current.tagName) {
            index += 1;
          }
        }
        segments.unshift(`${tag}:nth-of-type(${index})`);
        current = current.parentElement;
      }
      return segments.join(" > ");
    },

escapeDraftCss(value) {
      if (window.CSS?.escape) {
        return window.CSS.escape(value);
      }
      return String(value).replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char.charCodeAt(0).toString(16)} `);
    }
  };
})();
