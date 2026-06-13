(() => {
  const ns = window.HtmlSlideMenderExtension = window.HtmlSlideMenderExtension || {};
  const GLOBAL_STYLE_ID = "html-slide-mender-ui-kit-global-style";

  function installGlobalStyles() {
    if (document.getElementById(GLOBAL_STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = GLOBAL_STYLE_ID;
    style.dataset.hsmEditor = "true";
    style.textContent = `
      vaadin-combo-box-overlay {
        z-index: 2147483647 !important;
      }

      vaadin-combo-box-overlay::part(overlay) {
        border: 1px solid #cfd8e6;
        border-radius: 7px;
        box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
      }

      vaadin-combo-box-item::part(content) {
        font-size: 12px;
      }
    `;
    document.head?.appendChild(style);
  }

  function removeGlobalStyles() {
    document.getElementById(GLOBAL_STYLE_ID)?.remove();
  }

  function createComboBox({
    className = "",
    control,
    items = [],
    mount,
    onChange,
    onOpen,
    placeholder = "",
    value = ""
  }) {
    if (!mount || !customElements.get("vaadin-combo-box")) {
      return null;
    }

    installGlobalStyles();

    const combo = document.createElement("vaadin-combo-box");
    combo.className = className;
    combo.dataset.control = control;
    combo.dataset.uiKit = "combo";
    combo.allowCustomValue = true;
    combo.autoOpenDisabled = false;
    combo.clearButtonVisible = false;
    combo.placeholder = placeholder;
    combo.items = items.map((item) => String(item));
    combo.value = String(value || "");

    let syncing = false;
    const commit = (nextValue, event) => {
      if (syncing) {
        return;
      }
      const normalized = String(nextValue || "").trim();
      if (!normalized) {
        return;
      }
      onChange?.(normalized, event);
    };

    combo.addEventListener("opened-changed", (event) => {
      if (event.detail?.value) {
        onOpen?.(event);
      }
    });

    combo.addEventListener("custom-value-set", (event) => {
      const nextValue = String(event.detail || "").trim();
      if (!nextValue) {
        return;
      }
      syncing = true;
      combo.value = nextValue;
      syncing = false;
      commit(nextValue, event);
    });

    combo.addEventListener("value-changed", (event) => {
      commit(event.detail?.value, event);
    });

    combo.addEventListener("focusin", () => {
      combo.opened = true;
      onOpen?.();
    });

    combo.addEventListener("pointerdown", () => {
      onOpen?.();
    });

    mount.replaceChildren(combo);

    return {
      close() {
        combo.opened = false;
      },
      destroy() {
        combo.remove();
      },
      element: combo,
      focus() {
        combo.focus();
      },
      open() {
        combo.opened = true;
      },
      setItems(nextItems) {
        combo.items = nextItems.map((item) => String(item));
      },
      setValue(nextValue) {
        syncing = true;
        combo.value = String(nextValue || "");
        syncing = false;
      },
      value() {
        return combo.value;
      }
    };
  }

  ns.uiKit = {
    createComboBox,
    removeGlobalStyles
  };
})();
