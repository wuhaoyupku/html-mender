(() => {
  const ns = window.HtmlSlideMenderExtension = window.HtmlSlideMenderExtension || {};
  ns.mixins = ns.mixins || {};
  const {
    COLOR_HISTORY_STORAGE_KEY,
    OFFICE_COLORS
  } = ns.constants;
  const { escapeAttr, escapeHtml, round, clamp } = ns.utils;

  function normalizeHexColor(value) {
    const text = String(value || "").trim();
    const short = text.match(/^#?([0-9a-f]{3})$/i);
    if (short) {
      return `#${short[1].split("").map((part) => part + part).join("").toUpperCase()}`;
    }

    const full = text.match(/^#?([0-9a-f]{6})$/i);
    return full ? `#${full[1].toUpperCase()}` : "";
  }

  function hexFromPickrColor(color) {
    const rgba = color?.toRGBA?.();
    if (!rgba || rgba.length < 3) {
      return "";
    }

    const hex = Array.from(rgba).slice(0, 3).map((part) => {
      const value = Math.max(0, Math.min(255, Math.round(Number(part) || 0)));
      return value.toString(16).padStart(2, "0");
    }).join("").toUpperCase();
    return `#${hex}`;
  }

  ns.mixins.color = {
async loadColorHistory() {
      try {
        const stored = await chrome.storage.local.get(COLOR_HISTORY_STORAGE_KEY);
        this.colorHistory = Array.isArray(stored?.[COLOR_HISTORY_STORAGE_KEY])
          ? stored[COLOR_HISTORY_STORAGE_KEY].map(normalizeHexColor).filter(Boolean).slice(0, 12)
          : [];
      } catch (_error) {
        this.colorHistory = [];
      }
    },

installColorPickers() {
      if (!window.Pickr || !this.shadow) {
        return;
      }

      for (const entry of this.colorPickers?.values?.() || []) {
        entry?.picker?.destroyAndRemove?.();
      }
      this.colorPickers?.clear();
      this.destroyColorMenuPicker();
    },

toggleColorMenu(control, anchor) {
      const menu = this.shadow?.querySelector("[data-role='color-menu']");
      if (this.openColorControl === control && menu && !menu.hidden) {
        this.closeColorMenu();
        return;
      }

      this.openColorMenu(control, anchor);
    },

openColorMenu(control, anchor) {
      if (!this.shadow || !["color", "highlight"].includes(control)) {
        return;
      }

      this.closeComboMenu?.();
      this.destroyColorMenuPicker();

      const menu = this.shadow.querySelector("[data-role='color-menu']");
      if (!menu) {
        return;
      }

      this.openColorControl = control;
      this.colorTargetId = this.selectedId;
      this.colorMenuAnchor = anchor || this.shadow.querySelector(`[data-color-button='${control}']`);
      menu.dataset.control = control;
      menu.innerHTML = this.colorMenuTemplate(control);
      menu.hidden = false;
      this.positionColorMenu(menu, this.colorMenuAnchor);
    },

    closeColorMenu() {
      this.destroyColorMenuPicker();
      const menu = this.shadow?.querySelector("[data-role='color-menu']");
      if (menu) {
        menu.hidden = true;
        menu.innerHTML = "";
      }
      this.openColorControl = null;
      this.colorTargetId = null;
      this.colorMenuAnchor = null;
    },

    destroyColorMenuPicker() {
      try {
        this.colorMenuPicker?.destroyAndRemove?.();
      } catch (_error) {
        // The menu content can already be gone after a quick swatch pick.
      }
      this.colorMenuPicker = null;
      this.colorPickers?.clear();
    },

positionColorMenu(menu, anchor) {
      const rect = anchor?.getBoundingClientRect?.();
      if (!rect) {
        return;
      }

      menu.style.visibility = "hidden";
      menu.style.left = "0px";
      menu.style.top = "0px";
      const menuRect = menu.getBoundingClientRect();
      const gap = 8;
      const margin = 10;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const below = rect.bottom + gap;
      const above = rect.top - menuRect.height - gap;
      const top = below + menuRect.height <= viewportHeight - margin
        ? below
        : clamp(above, margin, Math.max(margin, viewportHeight - menuRect.height - margin));
      const left = clamp(rect.left, margin, Math.max(margin, viewportWidth - menuRect.width - margin));

      menu.style.left = `${round(left)}px`;
      menu.style.top = `${round(top)}px`;
      menu.style.visibility = "";
    },

    colorMenuTemplate(control) {
      const current = normalizeHexColor(this.shadow?.querySelector(`[data-live-control='${control}']`)?.value) || "#111827";
      const history = (this.colorHistory || []).filter(Boolean);
      return `
        <div class="color-section">
          <div class="color-heading">${escapeHtml(this.t("recentColors"))}</div>
          <div class="color-grid history-grid">
            ${this.colorHistoryTemplate(history, current)}
          </div>
        </div>
        <div class="color-section">
          <div class="color-heading">${escapeHtml(this.t("presetColors"))}</div>
          <div class="color-grid preset-grid">
            ${OFFICE_COLORS.map((color) => this.colorOptionTemplate(color, current, false)).join("")}
          </div>
        </div>
        <button class="color-more" type="button" data-color-more="${escapeAttr(control)}">${escapeHtml(this.t("moreColors"))}</button>
      `;
    },

    colorHistoryTemplate(history, current) {
      const colors = history.slice(0, 10);
      const placeholders = Array.from({ length: Math.max(0, 10 - colors.length) }, () => {
        return `<span class="color-placeholder" title="${escapeAttr(this.t("noRecentColors"))}"></span>`;
      });
      return [
        ...colors.map((color) => this.colorOptionTemplate(color, current, true)),
        ...placeholders
      ].join("");
    },

colorOptionTemplate(color, current, recent) {
      const normalized = normalizeHexColor(color);
      return `
        <button class="color-option${normalized === current ? " is-selected" : ""}" type="button"
          title="${escapeAttr(normalized)}"
          data-color-option="${escapeAttr(normalized)}"
          data-recent="${recent ? "true" : "false"}"
          style="--hsm-swatch:${escapeAttr(normalized)}"></button>
      `;
    },

applyColorMenuOption(option) {
      const color = normalizeHexColor(option.dataset.colorOption);
      const control = this.openColorControl || option.closest("[data-role='color-menu']")?.dataset.control;
      if (!color || !control) {
        return;
      }

      this.applyPickerColor(control, color, true);
      this.closeColorMenu();
    },

    installMenuPickr(control, trigger) {
      if (!window.Pickr || !trigger) {
        return null;
      }

      const editor = this;
      const current = normalizeHexColor(this.shadow?.querySelector(`[data-live-control='${control}']`)?.value) || "#111827";
      const picker = window.Pickr.create({
        el: trigger,
        container: this.shadow.querySelector("[data-role='color-menu']") || this.shadow.host,
        theme: "nano",
        useAsButton: true,
        lockOpacity: true,
        comparison: false,
        default: current,
        defaultRepresentation: "HEXA",
        position: "bottom-start",
        autoReposition: true,
        swatches: null,
        components: {
          preview: true,
          opacity: false,
          hue: true,
          palette: true,
          interaction: {
            hex: true,
            input: true,
            save: true,
            cancel: true
          }
        },
        i18n: {
          "btn:save": this.lang === "zh-CN" ? "确定" : "Save",
          "btn:cancel": this.lang === "zh-CN" ? "取消" : "Cancel",
          "aria:input": this.lang === "zh-CN" ? "颜色值" : "Color value"
        }
      });

      picker
        .on("change", (color) => {
          if (editor.isSyncingColorControls) {
            return;
          }
          editor.applyPickerColor(control, hexFromPickrColor(color), false);
        })
        .on("save", (color) => {
          if (editor.isSyncingColorControls) {
            return;
          }
          editor.applyPickerColor(control, hexFromPickrColor(color || picker.getColor?.()), true);
          picker.hide();
          editor.closeColorMenu();
        })
        .on("cancel", () => {
          picker.hide();
          editor.repositionColorMenu();
        });

      this.colorMenuPicker = picker;
      trigger._hsmPickr = picker;
      this.colorPickers.set(control, { picker });
      return picker;
    },

    toggleAdvancedColorPicker(control, trigger) {
      if (!control || !trigger) {
        return;
      }

      const existingPicker = this.colorMenuPicker;
      let picker = existingPicker;
      if (!picker) {
        picker = this.installMenuPickr(control, trigger);
      }
      if (!picker) {
        return;
      }

      if (!existingPicker) {
        picker.show();
      }
      requestAnimationFrame(() => this.repositionColorMenu());
    },

    repositionColorMenu() {
      const menu = this.shadow?.querySelector("[data-role='color-menu']");
      if (!menu || menu.hidden || !this.openColorControl) {
        return;
      }
      const anchor = this.colorMenuAnchor || this.shadow?.querySelector(`[data-color-button='${this.openColorControl}']`);
      this.positionColorMenu(menu, anchor);
    },

colorPalette() {
      const history = this.colorHistory || [];
      return [
        ...history,
        ...OFFICE_COLORS.filter((color) => !history.includes(color))
      ];
    },

applyPickerColor(control, value, remember) {
      const color = normalizeHexColor(value);
      if (!color) {
        return;
      }

      if (this.colorTargetId && this.selectedId !== this.colorTargetId) {
        return;
      }

      const input = this.shadow?.querySelector(`[data-live-control='${control}']`);
      if (input) {
        input.value = color;
      }
      this.handleControl(control, color);
      this.refreshColorButtons({ [control]: color });
      if (remember) {
        this.rememberColor(color);
      }
    },

refreshColorButtons(colors = {}) {
      for (const control of ["color", "highlight"]) {
        const color = normalizeHexColor(colors[control] || this.shadow?.querySelector(`[data-live-control='${control}']`)?.value);
        if (!color) {
          continue;
        }

        const button = this.shadow?.querySelector(`[data-color-button='${control}']`);
        const swatch = button?.querySelector("[data-role='color-swatch']");
        if (swatch) {
          swatch.style.background = color;
        }

        const entry = this.colorPickers?.get(control);
        if (entry?.picker) {
          this.isSyncingColorControls = true;
          try {
            entry.picker.setColor(color, true);
          } finally {
            this.isSyncingColorControls = false;
          }
        }
      }
    },

async rememberColor(value) {
      const color = normalizeHexColor(value);
      if (!color) {
        return;
      }

      this.colorHistory = [
        color,
        ...(this.colorHistory || []).filter((item) => item !== color)
      ].slice(0, 12);

      for (const entry of this.colorPickers?.values?.() || []) {
        if (!entry.palette) {
          continue;
        }
        if (!entry.palette?.includes(color)) {
          entry.picker?.addSwatch?.(color);
          entry.palette = [color, ...(entry.palette || [])];
        }
      }

      try {
        await chrome.storage.local.set({ [COLOR_HISTORY_STORAGE_KEY]: this.colorHistory });
      } catch (_error) {
        // Storage may be unavailable in smoke tests; in-memory history still works.
      }
    }
  };
})();
