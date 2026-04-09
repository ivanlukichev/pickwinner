(function () {
  const page = document.querySelector(".mystery-box-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.mysteryBoxPicker.v1";
  const MIN_BOXES = 2;
  const MAX_BOXES = 16;
  const ITEM_MAX_LENGTH = 72;
  const HISTORY_LIMIT = 30;
  const SHUFFLE_FEEDBACK_DURATION = 460;
  const DEFAULT_ITEMS = ["Gift Card", "Bonus Prize", "Free Turn"];
  const sharedConfig = loadConfigFromUrl();
  let lastFocusedElement = null;

  const elements = {
    grid: document.querySelector("[data-box-grid]"),
    gridNote: document.querySelector("[data-grid-note]"),
    shuffleButton: document.querySelector("[data-shuffle-button]"),
    resetButton: document.querySelector("[data-reset-button]"),
    openSettingsButton: document.querySelector("[data-open-settings]"),
    shareButton: document.querySelector("[data-share-button]"),
    clearHistoryButton: document.querySelector("[data-clear-history-button]"),
    boxCountStat: document.querySelector("[data-box-count-stat]"),
    revealCountStat: document.querySelector("[data-reveal-count-stat]"),
    hiddenCountStat: document.querySelector("[data-hidden-count-stat]"),
    resultBox: document.querySelector("[data-result-box]"),
    resultContent: document.querySelector("[data-result-content]"),
    resultMeta: document.querySelector("[data-result-meta]"),
    historyList: document.querySelector("[data-history-list]"),
    historyEmpty: document.querySelector("[data-history-empty]"),
    historyHint: document.querySelector("[data-history-hint]"),
    message: document.querySelector("[data-message]"),
    settingsModal: document.querySelector("[data-settings-modal]"),
    settingsPanel: document.querySelector(".spin-settings-modal__panel"),
    settingsBackdrop: document.querySelector("[data-settings-backdrop]"),
    closeSettingsButtons: document.querySelectorAll("[data-close-settings]"),
    saveSettingsButton: document.querySelector("[data-save-settings]"),
    boxCountInput: document.querySelector("[data-box-count-input]"),
    boxCountHint: document.querySelector("[data-box-count-hint]"),
    itemList: document.querySelector("[data-item-list]"),
    modalShuffleButton: document.querySelector("[data-modal-shuffle-button]"),
    modalShareButton: document.querySelector("[data-modal-share-button]"),
    modalResetButton: document.querySelector("[data-modal-reset-button]"),
    revealOneToggle: document.querySelector("[data-reveal-one-toggle]"),
    animationToggle: document.querySelector("[data-animation-toggle]"),
    showLabelsToggle: document.querySelector("[data-show-labels-toggle]")
  };

  const state = {
    config: sharedConfig ? normalizeConfig(sharedConfig) : loadInitialConfig(),
    session: {
      shuffledItems: [],
      openBoxes: [],
      history: [],
      lastReveal: null,
      historyCounter: 0,
      isModalOpen: false,
      draftConfig: null,
      message: {
        tone: "info",
        text: "Open a closed mystery box to reveal the hidden result."
      }
    }
  };

  restoreSession();
  populateBoxCountOptions();
  initializeIfNeeded();
  bindEvents();
  renderAll();
  saveState();

  function bindEvents() {
    elements.grid.addEventListener("click", handleBoxGridClick);
    elements.shuffleButton.addEventListener("click", () => shuffleBoxes({ clearHistory: false }));
    elements.resetButton.addEventListener("click", () => resetBoxes({ clearHistory: true }));
    elements.openSettingsButton.addEventListener("click", openSettings);
    elements.shareButton.addEventListener("click", copyShareLink);
    elements.clearHistoryButton.addEventListener("click", clearHistory);
    elements.settingsBackdrop.addEventListener("click", closeSettings);
    elements.closeSettingsButtons.forEach((button) => button.addEventListener("click", closeSettings));
    elements.saveSettingsButton.addEventListener("click", saveSettings);
    elements.modalShuffleButton.addEventListener("click", shuffleDraftItems);
    elements.modalShareButton.addEventListener("click", copyShareLink);
    elements.modalResetButton.addEventListener("click", resetToolFromModal);
    elements.boxCountInput.addEventListener("input", handleDraftBoxCountInput);
    elements.revealOneToggle.addEventListener("change", handleDraftToggleChange);
    elements.animationToggle.addEventListener("change", handleDraftToggleChange);
    elements.showLabelsToggle.addEventListener("change", handleDraftToggleChange);
    document.addEventListener("keydown", handleDocumentKeydown);
  }

  function getDefaultConfig() {
    return {
      boxCount: 3,
      items: DEFAULT_ITEMS.slice(),
      revealOneOnly: false,
      showLabels: true,
      revealAnimation: true
    };
  }

  function populateBoxCountOptions() {
    elements.boxCountInput.textContent = "";

    for (let value = MIN_BOXES; value <= MAX_BOXES; value += 1) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = `${value} boxes`;
      elements.boxCountInput.append(option);
    }
  }

  function loadInitialConfig() {
    if (sharedConfig) return normalizeConfig(sharedConfig);

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.config) {
          return normalizeConfig(parsed.config);
        }
      }
    } catch (error) {
      console.warn("Unable to read local mystery-box config.", error);
    }

    return getDefaultConfig();
  }

  function restoreSession() {
    if (sharedConfig) return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;

      state.session.history = Array.isArray(parsed.history)
        ? parsed.history.map(normalizeHistoryEntry).filter((entry) => entry.value)
        : [];

      state.session.lastReveal = parsed.lastReveal ? normalizeHistoryEntry(parsed.lastReveal) : null;
      state.session.historyCounter = clampNumber(parsed.historyCounter, 0, 9999, state.session.history.length);

      if (Array.isArray(parsed.shuffledItems) && Array.isArray(parsed.openBoxes)) {
        state.session.shuffledItems = ensureItemCount(
          parsed.shuffledItems.map(normalizeItem),
          state.config.boxCount
        );
        state.session.openBoxes = normalizeOpenBoxes(parsed.openBoxes, state.config.boxCount);
      }
    } catch (error) {
      console.warn("Unable to restore mystery-box session.", error);
    }
  }

  function initializeIfNeeded() {
    if (
      state.session.shuffledItems.length !== state.config.boxCount ||
      state.session.openBoxes.length !== state.config.boxCount
    ) {
      resetBoxes({ clearHistory: !state.session.history.length, silent: true });
    }
  }

  function normalizeConfig(input) {
    const base = getDefaultConfig();
    const source = input && typeof input === "object" ? input : {};
    const boxCount = clampNumber(source.boxCount ?? source.boxes, MIN_BOXES, MAX_BOXES, base.boxCount);
    const rawItems = Array.isArray(source.items)
      ? source.items
      : typeof source.items === "string"
        ? source.items.split("|").map((item) => decodeURIComponent(item))
        : base.items;

    return {
      boxCount,
      items: ensureItemCount(rawItems.map(normalizeItem), boxCount),
      revealOneOnly: toBoolean(source.revealOneOnly ?? source.mode, base.revealOneOnly),
      showLabels: toBoolean(source.showLabels ?? source.labels ?? source.numbers, base.showLabels),
      revealAnimation: toBoolean(source.revealAnimation ?? source.anim, base.revealAnimation)
    };
  }

  function normalizeHistoryEntry(entry) {
    return {
      order: clampNumber(entry.order, 1, 9999, 1),
      boxNumber: clampNumber(entry.boxNumber, 1, MAX_BOXES, 1),
      value: normalizeItem(entry.value)
    };
  }

  function normalizeItem(value) {
    return String(value || "").trim().slice(0, ITEM_MAX_LENGTH);
  }

  function ensureItemCount(items, count) {
    const next = items.slice(0, count);
    while (next.length < count) {
      next.push(getDefaultBoxItem(next.length));
    }
    return next.map((item, index) => item || getDefaultBoxItem(index));
  }

  function getDefaultBoxItem(index) {
    return DEFAULT_ITEMS[index] || `Mystery Reward ${index + 1}`;
  }

  function normalizeOpenBoxes(values, count) {
    return Array.from({ length: count }, (_, index) => Boolean(values[index]));
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function toBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true" || value === "single") return true;
    if (value === 0 || value === "0" || value === "false" || value === "multiple") return false;
    return fallback;
  }

  function loadConfigFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("boxes") || !params.has("items")) return null;

    return {
      boxes: params.get("boxes"),
      items: params.get("items"),
      mode: params.get("mode"),
      labels: params.get("labels"),
      anim: params.get("anim")
    };
  }

  function buildShareUrl(sourceConfig = state.config) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("boxes", String(sourceConfig.boxCount));
    url.searchParams.set("mode", sourceConfig.revealOneOnly ? "single" : "multiple");
    url.searchParams.set("labels", sourceConfig.showLabels ? "1" : "0");
    url.searchParams.set("anim", sourceConfig.revealAnimation ? "1" : "0");
    url.searchParams.set("items", sourceConfig.items.map((item) => encodeURIComponent(item)).join("|"));
    return url.toString();
  }

  async function copyShareLink() {
    const shareConfig = state.session.isModalOpen && state.session.draftConfig
      ? normalizeConfig(state.session.draftConfig)
      : state.config;
    const shareUrl = buildShareUrl(shareConfig);

    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Shareable link copied.", "success");
    } catch (error) {
      window.prompt("Copy this shareable link:", shareUrl);
      setMessage("Shareable link ready to copy.", "info");
    }
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        config: state.config,
        shuffledItems: state.session.shuffledItems,
        openBoxes: state.session.openBoxes,
        history: state.session.history,
        lastReveal: state.session.lastReveal,
        historyCounter: state.session.historyCounter
      }));
    } catch (error) {
      console.warn("Unable to save mystery-box state.", error);
    }
  }

  function shuffleArray(values) {
    const next = values.slice();
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = getRandomInt(index + 1);
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  function shuffleBoxes({ clearHistory = false, silent = false } = {}) {
    state.session.shuffledItems = shuffleArray(state.config.items);
    state.session.openBoxes = Array.from({ length: state.config.boxCount }, () => false);
    state.session.lastReveal = null;

    if (clearHistory) {
      state.session.history = [];
      state.session.historyCounter = 0;
    }

    renderAll();
    triggerShuffleFeedback(elements.grid, { panel: false });
    saveState();

    if (!silent) {
      setMessage(clearHistory ? "Boxes reset and shuffled." : "Boxes shuffled for a new reveal order.", "success");
    }
  }

  function resetBoxes({ clearHistory = true, silent = false } = {}) {
    shuffleBoxes({ clearHistory, silent: true });
    if (!silent) {
      setMessage(clearHistory ? "Boxes reset for a fresh round." : "Boxes reset.", "info");
    }
  }

  function clearHistory() {
    state.session.history = [];
    state.session.historyCounter = 0;
    renderHistory();
    renderStats();
    renderButtons();
    saveState();
    setMessage("History cleared.", "info");
  }

  function handleBoxGridClick(event) {
    const button = event.target.closest("[data-box-index]");
    if (!button) return;

    const boxIndex = Number.parseInt(button.dataset.boxIndex, 10);
    if (Number.isNaN(boxIndex)) return;

    if (state.session.openBoxes[boxIndex]) return;

    if (state.config.revealOneOnly && state.session.openBoxes.some(Boolean)) {
      setMessage("One box has been opened. Reset or reshuffle to play again.", "info");
      return;
    }

    revealBox(boxIndex);
  }

  function revealBox(boxIndex) {
    state.session.openBoxes[boxIndex] = true;
    const value = state.session.shuffledItems[boxIndex];
    state.session.historyCounter += 1;

    const entry = {
      order: state.session.historyCounter,
      boxNumber: boxIndex + 1,
      value
    };

    state.session.lastReveal = entry;
    state.session.history.push(entry);
    state.session.history = state.session.history.slice(-HISTORY_LIMIT);

    renderAll();
    flashResultPanel();
    saveState();
    setMessage(
      state.config.revealOneOnly
        ? `Box ${boxIndex + 1} opened: ${value}. One box has already been revealed.`
        : `Box ${boxIndex + 1} opened: ${value}.`,
      "success"
    );
  }

  function openSettings() {
    state.session.draftConfig = cloneConfig(state.config);
    lastFocusedElement = document.activeElement;
    renderSettingsModal();
    state.session.isModalOpen = true;
    elements.settingsBackdrop.hidden = false;
    elements.settingsModal.hidden = false;
    elements.settingsModal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("has-modal-open");
    document.body.classList.add("has-modal-open");
    window.requestAnimationFrame(() => {
      elements.settingsPanel.focus();
    });
  }

  function closeSettings() {
    state.session.isModalOpen = false;
    state.session.draftConfig = null;
    elements.settingsBackdrop.hidden = true;
    elements.settingsModal.hidden = true;
    elements.settingsModal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("has-modal-open");
    document.body.classList.remove("has-modal-open");
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      lastFocusedElement.focus();
    }
  }

  function handleDocumentKeydown(event) {
    if (event.key === "Escape" && state.session.isModalOpen) {
      closeSettings();
    }
  }

  function renderSettingsModal() {
    const draft = state.session.draftConfig || cloneConfig(state.config);
    elements.boxCountInput.value = String(draft.boxCount);
    elements.boxCountHint.textContent = `${draft.boxCount} boxes ready to configure. Maximum: 16.`;
    elements.revealOneToggle.checked = draft.revealOneOnly;
    elements.animationToggle.checked = draft.revealAnimation;
    elements.showLabelsToggle.checked = draft.showLabels;
    renderDraftItemList();
  }

  function renderDraftItemList() {
    const draft = state.session.draftConfig;
    elements.itemList.textContent = "";

    draft.items.forEach((item, index) => {
      const row = document.createElement("label");
      row.className = "spin-item-row";

      const badge = document.createElement("span");
      badge.className = "spin-item-row__index";
      badge.textContent = String(index + 1);

      const field = document.createElement("span");
      field.className = "spin-item-row__field";

      const input = document.createElement("input");
      input.type = "text";
      input.value = item;
      input.maxLength = ITEM_MAX_LENGTH;
      input.placeholder = `Box ${index + 1} result`;
      input.addEventListener("input", () => {
        draft.items[index] = normalizeItem(input.value);
      });

      const meta = document.createElement("small");
      meta.textContent = "Revealed when this mystery box is opened";

      field.append(input, meta);
      row.append(badge, field);
      elements.itemList.append(row);
    });
  }

  function handleDraftBoxCountInput() {
    const nextCount = clampNumber(elements.boxCountInput.value, MIN_BOXES, MAX_BOXES, state.session.draftConfig.boxCount);
    state.session.draftConfig.boxCount = nextCount;
    state.session.draftConfig.items = ensureItemCount(state.session.draftConfig.items, nextCount);
    elements.boxCountInput.value = String(nextCount);
    elements.boxCountHint.textContent = `${nextCount} boxes ready to configure. Maximum: 16.`;
    renderDraftItemList();
  }

  function handleDraftToggleChange() {
    state.session.draftConfig.revealOneOnly = elements.revealOneToggle.checked;
    state.session.draftConfig.revealAnimation = elements.animationToggle.checked;
    state.session.draftConfig.showLabels = elements.showLabelsToggle.checked;
  }

  function shuffleDraftItems() {
    state.session.draftConfig.items = shuffleArray(state.session.draftConfig.items);
    renderDraftItemList();
    triggerShuffleFeedback(elements.itemList, { panel: false });
  }

  function resetToolFromModal() {
    state.config = getDefaultConfig();
    state.session.history = [];
    state.session.lastReveal = null;
    state.session.historyCounter = 0;
    state.session.draftConfig = cloneConfig(state.config);
    shuffleBoxes({ clearHistory: true, silent: true });
    renderSettingsModal();
    saveState();
    setMessage("Tool reset to default mystery boxes.", "info");
  }

  function saveSettings() {
    const draft = cloneConfig(state.session.draftConfig || state.config);
    draft.items = draft.items.map(normalizeItem);

    if (draft.items.some((item) => !item)) {
      setMessage("Please fill in every box result before saving.", "error");
      return;
    }

    state.config = normalizeConfig(draft);
    state.session.history = [];
    state.session.lastReveal = null;
    state.session.historyCounter = 0;
    closeSettings();
    shuffleBoxes({ clearHistory: true, silent: true });
    renderAll();
    saveState();
    setMessage("Mystery box setup updated.", "success");
  }

  function renderAll() {
    renderBoxes();
    renderResultPanel();
    renderHistory();
    renderStats();
    renderGridNote();
    renderButtons();
    renderMessage();
  }

  function triggerShuffleFeedback(target, { panel = true } = {}) {
    if (!target) return;
    target.classList.remove("shuffle-feedback-panel", "shuffle-feedback-grid", "is-shuffling");
    void target.offsetWidth;
    target.classList.add(panel ? "shuffle-feedback-panel" : "shuffle-feedback-grid", "is-shuffling");
    window.setTimeout(() => {
      target.classList.remove("is-shuffling");
    }, SHUFFLE_FEEDBACK_DURATION);
  }

  function renderBoxes() {
    elements.grid.textContent = "";

    const anyOpen = state.session.openBoxes.some(Boolean);

    state.session.shuffledItems.forEach((value, index) => {
      const isOpen = Boolean(state.session.openBoxes[index]);
      const isLocked = !isOpen && state.config.revealOneOnly && anyOpen;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "mystery-box-card";
      button.style.setProperty("--shuffle-index", String(index));
      button.dataset.boxIndex = String(index);
      button.dataset.state = isOpen ? "open" : (isLocked ? "locked" : "closed");
      button.dataset.animate = state.config.revealAnimation ? "on" : "off";
      button.setAttribute("aria-label", isOpen ? `Box ${index + 1} revealed ${value}` : `Open mystery box ${index + 1}`);
      button.disabled = isLocked;

      if (isOpen) {
        button.classList.add("is-open");
      }

      const surface = document.createElement("span");
      surface.className = "mystery-box-card__surface";

      const reveal = document.createElement("span");
      reveal.className = "mystery-box-card__reveal";

      const revealIcon = document.createElement("span");
      revealIcon.className = "mystery-box-card__reveal-icon";
      revealIcon.textContent = "🎁";

      const revealTitle = document.createElement("span");
      revealTitle.className = "mystery-box-card__reveal-title";
      revealTitle.textContent = `Box ${index + 1}`;

      const revealValue = document.createElement("strong");
      revealValue.className = "mystery-box-card__reveal-value";
      revealValue.textContent = value;

      const revealMeta = document.createElement("span");
      revealMeta.className = "mystery-box-card__reveal-meta";
      revealMeta.textContent = "Surprise revealed";

      reveal.append(revealIcon, revealTitle, revealValue, revealMeta);

      const present = document.createElement("span");
      present.className = "mystery-box-card__present";

      const lid = document.createElement("span");
      lid.className = "mystery-box-card__lid";

      const base = document.createElement("span");
      base.className = "mystery-box-card__base";

      const verticalRibbon = document.createElement("span");
      verticalRibbon.className = "mystery-box-card__ribbon mystery-box-card__ribbon--vertical";

      const horizontalRibbon = document.createElement("span");
      horizontalRibbon.className = "mystery-box-card__ribbon mystery-box-card__ribbon--horizontal";

      const bow = document.createElement("span");
      bow.className = "mystery-box-card__bow";

      const title = document.createElement("strong");
      title.className = "mystery-box-card__title";
      title.textContent = state.config.showLabels ? `Box ${index + 1}` : "Mystery Box";

      const hint = document.createElement("span");
      hint.className = "mystery-box-card__hint";
      hint.textContent = isLocked ? "Locked this round" : "Tap to open";

      present.append(lid, base, verticalRibbon, horizontalRibbon, bow, title, hint);
      surface.append(reveal, present);
      button.append(surface);
      elements.grid.append(button);
    });
  }

  function renderResultPanel() {
    const lastReveal = state.session.lastReveal;

    if (!lastReveal) {
      elements.resultBox.textContent = "Ready to reveal";
      elements.resultContent.textContent = "Pick a mystery box to uncover the hidden result.";
      elements.resultMeta.textContent = "Selected from a hidden box";
      return;
    }

    elements.resultBox.textContent = `Box ${lastReveal.boxNumber}`;
    elements.resultContent.textContent = lastReveal.value;
    elements.resultMeta.textContent = "Selected from a hidden box";
  }

  function renderHistory() {
    if (!state.session.history.length) {
      elements.historyList.replaceChildren();
      elements.historyList.hidden = true;
      elements.historyEmpty.hidden = false;
      elements.historyHint.hidden = false;
      return;
    }

    const fragment = document.createDocumentFragment();

    state.session.history.forEach((entry) => {
      const item = document.createElement("li");
      const wrapper = document.createElement("div");
      const label = document.createElement("strong");
      const value = document.createElement("span");

      wrapper.className = "spin-history__entry";
      label.textContent = `Box ${entry.boxNumber}`;
      value.textContent = entry.value;

      wrapper.append(label, value);
      item.append(wrapper);
      fragment.append(item);
    });

    elements.historyList.replaceChildren(fragment);
    elements.historyList.hidden = false;
    elements.historyEmpty.hidden = true;
    elements.historyHint.hidden = true;
  }

  function renderStats() {
    const hiddenCount = state.session.openBoxes.filter((value) => !value).length;
    const revealCount = state.session.openBoxes.filter(Boolean).length;

    elements.boxCountStat.textContent = String(state.config.boxCount);
    elements.revealCountStat.textContent = String(revealCount);
    elements.hiddenCountStat.textContent = String(hiddenCount);
  }

  function renderGridNote() {
    if (state.config.revealOneOnly && state.session.openBoxes.some(Boolean)) {
      elements.gridNote.textContent = "One box has been opened. Reset or reshuffle to play again.";
      return;
    }

    const hiddenCount = state.session.openBoxes.filter((value) => !value).length;
    elements.gridNote.textContent = hiddenCount === state.config.boxCount
      ? "Open a box to reveal the hidden result."
      : `${hiddenCount} hidden ${hiddenCount === 1 ? "box" : "boxes"} remaining.`;
  }

  function renderButtons() {
    elements.clearHistoryButton.disabled = state.session.history.length === 0;
  }

  function renderMessage() {
    elements.message.textContent = state.session.message.text;
    elements.message.dataset.tone = state.session.message.tone;
  }

  function setMessage(text, tone = "info") {
    state.session.message = { text, tone };
    renderMessage();
  }

  function flashResultPanel() {
    const panel = document.querySelector("[data-result-panel]");
    panel.classList.remove("is-flashing");
    void panel.offsetWidth;
    panel.classList.add("is-flashing");
    window.setTimeout(() => panel.classList.remove("is-flashing"), 800);
  }

  function cloneConfig(config) {
    return {
      boxCount: config.boxCount,
      items: config.items.slice(),
      revealOneOnly: config.revealOneOnly,
      showLabels: config.showLabels,
      revealAnimation: config.revealAnimation
    };
  }

  function getRandomInt(max) {
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      const array = new Uint32Array(1);
      window.crypto.getRandomValues(array);
      return array[0] % max;
    }

    return Math.floor(Math.random() * max);
  }
})();
