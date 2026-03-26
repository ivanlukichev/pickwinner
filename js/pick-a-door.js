(function () {
  const page = document.querySelector(".door-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.pickADoor.v1";
  const MIN_DOORS = 2;
  const MAX_DOORS = 12;
  const ITEM_MAX_LENGTH = 80;
  const HISTORY_LIMIT = 30;
  const SHUFFLE_FEEDBACK_DURATION = 460;
  const DEFAULT_ITEMS = ["Grand Prize", "Bonus Prize", "Free Ticket"];

  const sharedConfig = loadConfigFromUrl();
  let lastFocusedElement = null;

  const elements = {
    grid: document.querySelector("[data-door-grid]"),
    shuffleButton: document.querySelector("[data-shuffle-button]"),
    resetButton: document.querySelector("[data-reset-button]"),
    openSettingsButton: document.querySelector("[data-open-settings]"),
    shareButton: document.querySelector("[data-share-button]"),
    clearHistoryButton: document.querySelector("[data-clear-history-button]"),
    doorCountStat: document.querySelector("[data-door-count-stat]"),
    revealCountStat: document.querySelector("[data-reveal-count-stat]"),
    resultDoor: document.querySelector("[data-result-door]"),
    resultContent: document.querySelector("[data-result-content]"),
    historyList: document.querySelector("[data-history-list]"),
    historyEmpty: document.querySelector("[data-history-empty]"),
    historyHint: document.querySelector("[data-history-hint]"),
    message: document.querySelector("[data-message]"),
    settingsModal: document.querySelector("[data-settings-modal]"),
    settingsPanel: document.querySelector(".spin-settings-modal__panel"),
    settingsBackdrop: document.querySelector("[data-settings-backdrop]"),
    closeSettingsButtons: document.querySelectorAll("[data-close-settings]"),
    saveSettingsButton: document.querySelector("[data-save-settings]"),
    doorCountInput: document.querySelector("[data-door-count-input]"),
    doorCountHint: document.querySelector("[data-door-count-hint]"),
    itemList: document.querySelector("[data-item-list]"),
    modalShuffleButton: document.querySelector("[data-modal-shuffle-button]"),
    animationToggle: document.querySelector("[data-animation-toggle]"),
    revealOneToggle: document.querySelector("[data-reveal-one-toggle]")
  };

  const state = {
    config: sharedConfig ? normalizeConfig(sharedConfig) : loadInitialConfig(),
    session: {
      shuffledItems: [],
      openDoors: [],
      history: [],
      lastReveal: null,
      isModalOpen: false,
      draftConfig: null,
      message: {
        tone: "info",
        text: "Pick a closed door to reveal the hidden result."
      }
    }
  };

  restoreSession();
  populateDoorCountOptions();
  initializeIfNeeded();
  bindEvents();
  renderAll();
  saveState();

  function bindEvents() {
    elements.grid.addEventListener("click", handleDoorGridClick);
    elements.shuffleButton.addEventListener("click", () => shuffleDoors({ clearHistory: false }));
    elements.resetButton.addEventListener("click", () => resetDoors({ clearHistory: true }));
    elements.openSettingsButton.addEventListener("click", openSettings);
    elements.shareButton.addEventListener("click", copyShareLink);
    elements.clearHistoryButton.addEventListener("click", clearHistory);
    elements.settingsBackdrop.addEventListener("click", closeSettings);
    elements.closeSettingsButtons.forEach((button) => button.addEventListener("click", closeSettings));
    elements.saveSettingsButton.addEventListener("click", saveSettings);
    elements.modalShuffleButton.addEventListener("click", shuffleDraftItems);
    elements.doorCountInput.addEventListener("input", handleDraftDoorCountInput);
    elements.animationToggle.addEventListener("change", handleDraftToggleChange);
    elements.revealOneToggle.addEventListener("change", handleDraftToggleChange);
    document.addEventListener("keydown", handleDocumentKeydown);
  }

  function getDefaultConfig() {
    return {
      doorCount: 3,
      items: DEFAULT_ITEMS.slice(),
      allowRevealAnimation: true,
      revealOneOnly: false
    };
  }

  function populateDoorCountOptions() {
    elements.doorCountInput.textContent = "";

    for (let value = MIN_DOORS; value <= MAX_DOORS; value += 1) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = `${value} doors`;
      elements.doorCountInput.append(option);
    }
  }

  function loadInitialConfig() {
    const fromUrl = loadConfigFromUrl();
    if (fromUrl) return normalizeConfig(fromUrl);

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.config) {
          return normalizeConfig(parsed.config);
        }
      }
    } catch (error) {
      console.warn("Unable to read local pick-a-door config.", error);
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
        ? parsed.history
          .map(normalizeHistoryEntry)
          .filter((entry) => entry.value)
          .slice(-HISTORY_LIMIT)
        : [];

      state.session.lastReveal = parsed.lastReveal ? normalizeHistoryEntry(parsed.lastReveal) : null;

      if (Array.isArray(parsed.shuffledItems) && Array.isArray(parsed.openDoors)) {
        state.session.shuffledItems = ensureItemCount(
          parsed.shuffledItems.map((item) => normalizeItem(item)),
          state.config.doorCount
        );
        state.session.openDoors = normalizeOpenDoors(parsed.openDoors, state.config.doorCount);
      }
    } catch (error) {
      console.warn("Unable to restore pick-a-door session.", error);
    }
  }

  function initializeIfNeeded() {
    if (
      state.session.shuffledItems.length !== state.config.doorCount ||
      state.session.openDoors.length !== state.config.doorCount
    ) {
      resetDoors({ clearHistory: !state.session.history.length, silent: true });
    }
  }

  function normalizeConfig(input) {
    const base = getDefaultConfig();
    const source = input && typeof input === "object" ? input : {};
    const doorCount = clampNumber(source.doorCount ?? source.doors, MIN_DOORS, MAX_DOORS, base.doorCount);
    const rawItems = Array.isArray(source.items)
      ? source.items
      : typeof source.items === "string"
        ? source.items.split(",").map((item) => decodeURIComponent(item))
        : base.items;

    return {
      doorCount,
      items: ensureItemCount(rawItems.map((item) => normalizeItem(item)), doorCount),
      allowRevealAnimation: toBoolean(source.allowRevealAnimation ?? source.anim, base.allowRevealAnimation),
      revealOneOnly: toBoolean(source.revealOneOnly ?? source.one, base.revealOneOnly)
    };
  }

  function normalizeHistoryEntry(entry) {
    return {
      order: clampNumber(entry.order, 1, 9999, 1),
      doorNumber: clampNumber(entry.doorNumber, 1, MAX_DOORS, 1),
      value: normalizeItem(entry.value)
    };
  }

  function normalizeItem(value) {
    return String(value || "").trim().slice(0, ITEM_MAX_LENGTH);
  }

  function ensureItemCount(items, count) {
    const next = items.slice(0, count);
    while (next.length < count) {
      next.push(getDefaultDoorItem(next.length));
    }
    return next.map((item, index) => item || getDefaultDoorItem(index));
  }

  function getDefaultDoorItem(index) {
    return DEFAULT_ITEMS[index] || `Prize ${index + 1}`;
  }

  function normalizeOpenDoors(values, count) {
    return Array.from({ length: count }, (_, index) => Boolean(values[index]));
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function toBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
    return fallback;
  }

  function loadConfigFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("doors") || !params.has("items")) return null;

    return {
      doors: params.get("doors"),
      items: params.get("items"),
      anim: params.get("anim"),
      one: params.get("one")
    };
  }

  function buildShareUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("doors", String(state.config.doorCount));
    url.searchParams.set("items", state.config.items.map((item) => encodeURIComponent(item)).join(","));
    url.searchParams.set("anim", state.config.allowRevealAnimation ? "1" : "0");
    url.searchParams.set("one", state.config.revealOneOnly ? "1" : "0");
    return url.toString();
  }

  async function copyShareLink() {
    const shareUrl = buildShareUrl();

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
        openDoors: state.session.openDoors,
        history: state.session.history,
        lastReveal: state.session.lastReveal
      }));
    } catch (error) {
      console.warn("Unable to save pick-a-door state.", error);
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

  function shuffleDoors({ clearHistory = false, silent = false } = {}) {
    state.session.shuffledItems = shuffleArray(state.config.items);
    state.session.openDoors = Array.from({ length: state.config.doorCount }, () => false);
    state.session.lastReveal = null;

    if (clearHistory) {
      state.session.history = [];
    }

    renderAll();
    triggerShuffleFeedback(elements.grid, { panel: false });
    saveState();

    if (!silent) {
      setMessage(clearHistory ? "Doors reset and shuffled." : "Doors shuffled for a new reveal order.", "success");
    }
  }

  function resetDoors({ clearHistory = true, silent = false } = {}) {
    shuffleDoors({ clearHistory, silent: true });
    if (!silent) {
      setMessage(clearHistory ? "Doors reset for a fresh round." : "Doors reset.", "info");
    }
  }

  function clearHistory() {
    state.session.history = [];
    renderHistory();
    renderStats();
    saveState();
    setMessage("History cleared.", "info");
  }

  function handleDoorGridClick(event) {
    const button = event.target.closest("[data-door-index]");
    if (!button) return;

    const doorIndex = Number.parseInt(button.dataset.doorIndex, 10);
    if (Number.isNaN(doorIndex)) return;

    if (state.session.openDoors[doorIndex]) return;

    if (state.config.revealOneOnly && state.session.openDoors.some(Boolean)) {
      setMessage("Only one door can be revealed in this round. Reset or shuffle to continue.", "info");
      return;
    }

    revealDoor(doorIndex);
  }

  function revealDoor(doorIndex) {
    state.session.openDoors[doorIndex] = true;
    const value = state.session.shuffledItems[doorIndex];
    const entry = {
      order: state.session.history.length + 1,
      doorNumber: doorIndex + 1,
      value
    };

    state.session.lastReveal = entry;
    state.session.history.push(entry);
    state.session.history = state.session.history.slice(-HISTORY_LIMIT);

    renderAll();
    flashResultPanel();
    saveState();
    setMessage(`Door ${doorIndex + 1} revealed: ${value}.`, "success");
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

  function cloneConfig(config) {
    return {
      doorCount: config.doorCount,
      items: config.items.slice(),
      allowRevealAnimation: config.allowRevealAnimation,
      revealOneOnly: config.revealOneOnly
    };
  }

  function renderSettingsModal() {
    const draft = state.session.draftConfig;
    if (!draft) return;

    elements.doorCountInput.value = String(draft.doorCount);
    elements.animationToggle.checked = draft.allowRevealAnimation;
    elements.revealOneToggle.checked = draft.revealOneOnly;
    elements.doorCountHint.textContent = `Use between ${MIN_DOORS} and ${MAX_DOORS} doors.`;

    const fragment = document.createDocumentFragment();
    draft.items.forEach((item, index) => {
      const row = document.createElement("div");
      const badge = document.createElement("span");
      const body = document.createElement("div");
      const input = document.createElement("input");
      const meta = document.createElement("span");

      row.className = "spin-item-row";
      badge.className = "spin-item-row__index";
      badge.textContent = String(index + 1);
      body.className = "spin-item-row__body";
      input.type = "text";
      input.value = item;
      input.maxLength = ITEM_MAX_LENGTH;
      input.placeholder = getDefaultDoorItem(index);
      input.setAttribute("aria-label", `Door ${index + 1} content`);
      input.dataset.draftItemIndex = String(index);
      meta.className = "spin-item-row__meta";
      meta.textContent = `Hidden result for Door ${index + 1}`;

      input.addEventListener("input", handleDraftItemInput);

      body.append(input, meta);
      row.append(badge, body);
      fragment.append(row);
    });

    elements.itemList.replaceChildren(fragment);
  }

  function handleDraftDoorCountInput() {
    if (!state.session.draftConfig) return;
    const nextCount = clampNumber(elements.doorCountInput.value, MIN_DOORS, MAX_DOORS, state.session.draftConfig.doorCount);
    state.session.draftConfig.doorCount = nextCount;
    state.session.draftConfig.items = ensureItemCount(state.session.draftConfig.items, nextCount);
    renderSettingsModal();
  }

  function handleDraftItemInput(event) {
    if (!state.session.draftConfig) return;
    const index = Number.parseInt(event.target.dataset.draftItemIndex, 10);
    if (Number.isNaN(index)) return;
    state.session.draftConfig.items[index] = normalizeItem(event.target.value) || getDefaultDoorItem(index);
  }

  function handleDraftToggleChange() {
    if (!state.session.draftConfig) return;
    state.session.draftConfig.allowRevealAnimation = elements.animationToggle.checked;
    state.session.draftConfig.revealOneOnly = elements.revealOneToggle.checked;
  }

  function shuffleDraftItems() {
    if (!state.session.draftConfig) return;
    state.session.draftConfig.items = shuffleArray(state.session.draftConfig.items);
    renderSettingsModal();
    triggerShuffleFeedback(elements.itemList, { panel: false });
  }

  function saveSettings() {
    if (!state.session.draftConfig) return;

    state.config = normalizeConfig({
      doorCount: state.session.draftConfig.doorCount,
      items: state.session.draftConfig.items,
      allowRevealAnimation: state.session.draftConfig.allowRevealAnimation,
      revealOneOnly: state.session.draftConfig.revealOneOnly
    });

    resetDoors({ clearHistory: true, silent: true });
    saveState();
    closeSettings();
    setMessage("Door setup updated.", "success");
  }

  function renderDoors() {
    const hasOpenDoor = state.session.openDoors.some(Boolean);
    const fragment = document.createDocumentFragment();

    state.session.shuffledItems.forEach((item, index) => {
      const isOpen = state.session.openDoors[index];
      const isLocked = !isOpen && state.config.revealOneOnly && hasOpenDoor;
      const button = document.createElement("button");
      const prize = document.createElement("span");
      const prizeEmoji = document.createElement("span");
      const prizeValue = document.createElement("strong");
      const panel = document.createElement("span");
      const front = document.createElement("span");
      const frontEmoji = document.createElement("span");
      const frontTitle = document.createElement("strong");
      const frontHint = document.createElement("span");

      button.type = "button";
      button.className = "door-card";
      button.style.setProperty("--shuffle-index", String(index));
      button.dataset.doorIndex = String(index);
      button.dataset.state = isOpen ? "open" : isLocked ? "locked" : "closed";
      button.disabled = isLocked;
      button.setAttribute("role", "listitem");
      button.setAttribute("aria-label", isOpen ? `Door ${index + 1} opened` : `Open Door ${index + 1}`);

      if (isOpen) button.classList.add("is-open");
      if (!state.config.allowRevealAnimation) button.classList.add("is-no-animation");

      prize.className = "door-card__prize";
      prizeEmoji.className = "door-card__back-emoji";
      prizeEmoji.textContent = "🎁";
      prizeValue.className = "door-card__back-value";
      prizeValue.textContent = item;

      panel.className = "door-card__panel";
      front.className = "door-card__face door-card__face--front";
      frontEmoji.className = "door-card__emoji";
      frontEmoji.textContent = "🚪";
      frontTitle.className = "door-card__title";
      frontTitle.textContent = `Door ${index + 1}`;
      frontHint.className = "door-card__hint";
      frontHint.textContent = isLocked ? "Round locked" : "Tap to reveal";

      front.append(frontEmoji, frontTitle, frontHint);
      prize.append(prizeEmoji, prizeValue);
      panel.append(front);
      button.append(prize, panel);
      fragment.append(button);
    });

    elements.grid.replaceChildren(fragment);
  }

  function renderLastReveal() {
    if (!state.session.lastReveal) {
      elements.resultDoor.textContent = "Ready to reveal";
      elements.resultContent.textContent = "Pick a door to uncover the hidden result.";
      return;
    }

    elements.resultDoor.textContent = `Door ${state.session.lastReveal.doorNumber}`;
    elements.resultContent.textContent = state.session.lastReveal.value;
  }

  function renderHistory() {
    const hasHistory = state.session.history.length > 0;
    elements.historyEmpty.hidden = hasHistory;
    elements.historyHint.hidden = hasHistory;
    elements.historyList.hidden = !hasHistory;

    if (!hasHistory) {
      elements.historyList.replaceChildren();
      return;
    }

    const fragment = document.createDocumentFragment();
    state.session.history.forEach((entry) => {
      const item = document.createElement("li");
      const wrapper = document.createElement("div");
      const title = document.createElement("strong");
      const meta = document.createElement("span");

      wrapper.className = "spin-history__entry";
      title.textContent = `Door ${entry.doorNumber} -> ${entry.value}`;
      meta.textContent = `Reveal #${entry.order}`;
      wrapper.append(title, meta);
      item.append(wrapper);
      fragment.append(item);
    });

    elements.historyList.replaceChildren(fragment);
  }

  function renderStats() {
    elements.doorCountStat.textContent = String(state.config.doorCount);
    elements.revealCountStat.textContent = String(state.session.history.length);
  }

  function renderMessage() {
    elements.message.textContent = state.session.message.text;
    elements.message.dataset.tone = state.session.message.tone;
  }

  function setMessage(text, tone) {
    state.session.message = { text, tone };
    renderMessage();
  }

  function flashResultPanel() {
    const panel = document.querySelector("[data-result-panel]");
    panel.classList.remove("is-highlight");
    void panel.offsetWidth;
    panel.classList.add("is-highlight");
  }

  function renderAll() {
    renderDoors();
    renderLastReveal();
    renderHistory();
    renderStats();
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

  function getRandomInt(maxExclusive) {
    if (maxExclusive <= 0) return 0;

    if (window.crypto && window.crypto.getRandomValues) {
      const maxUint = 0xffffffff;
      const limit = maxUint - (maxUint % maxExclusive);
      const buffer = new Uint32Array(1);
      let value = 0;
      do {
        window.crypto.getRandomValues(buffer);
        value = buffer[0];
      } while (value >= limit);
      return value % maxExclusive;
    }

    return Math.floor(Math.random() * maxExclusive);
  }
})();
