(function () {
  const page = document.querySelector(".card-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.pickACard.v1";
  const MIN_CARDS = 2;
  const MAX_CARDS = 16;
  const ITEM_MAX_LENGTH = 72;
  const HISTORY_LIMIT = 30;
  const SHUFFLE_FEEDBACK_DURATION = 460;
  const DEFAULT_ITEMS = ["Gift Card", "Bonus Prize", "Free Turn"];
  const sharedConfig = loadConfigFromUrl();
  let lastFocusedElement = null;

  const elements = {
    grid: document.querySelector("[data-card-grid]"),
    shuffleButton: document.querySelector("[data-shuffle-button]"),
    resetButton: document.querySelector("[data-reset-button]"),
    openSettingsButton: document.querySelector("[data-open-settings]"),
    shareButton: document.querySelector("[data-share-button]"),
    clearHistoryButton: document.querySelector("[data-clear-history-button]"),
    cardCountStat: document.querySelector("[data-card-count-stat]"),
    revealCountStat: document.querySelector("[data-reveal-count-stat]"),
    hiddenCountStat: document.querySelector("[data-hidden-count-stat]"),
    resultCard: document.querySelector("[data-result-card]"),
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
    cardCountInput: document.querySelector("[data-card-count-input]"),
    cardCountHint: document.querySelector("[data-card-count-hint]"),
    itemList: document.querySelector("[data-item-list]"),
    modalShuffleButton: document.querySelector("[data-modal-shuffle-button]"),
    modalShareButton: document.querySelector("[data-modal-share-button]"),
    modalResetButton: document.querySelector("[data-modal-reset-button]"),
    revealOneToggle: document.querySelector("[data-reveal-one-toggle]"),
    showLabelsToggle: document.querySelector("[data-show-labels-toggle]")
  };

  const state = {
    config: sharedConfig ? normalizeConfig(sharedConfig) : loadInitialConfig(),
    session: {
      shuffledItems: [],
      openCards: [],
      history: [],
      lastReveal: null,
      isModalOpen: false,
      draftConfig: null,
      message: {
        tone: "info",
        text: "Pick a closed card to reveal the hidden result."
      }
    }
  };

  restoreSession();
  populateCardCountOptions();
  initializeIfNeeded();
  bindEvents();
  renderAll();
  saveState();

  function bindEvents() {
    elements.grid.addEventListener("click", handleCardGridClick);
    elements.shuffleButton.addEventListener("click", () => shuffleCards({ clearHistory: false }));
    elements.resetButton.addEventListener("click", () => resetCards({ clearHistory: true }));
    elements.openSettingsButton.addEventListener("click", openSettings);
    elements.shareButton.addEventListener("click", copyShareLink);
    elements.clearHistoryButton.addEventListener("click", clearHistory);
    elements.settingsBackdrop.addEventListener("click", closeSettings);
    elements.closeSettingsButtons.forEach((button) => button.addEventListener("click", closeSettings));
    elements.saveSettingsButton.addEventListener("click", saveSettings);
    elements.modalShuffleButton.addEventListener("click", shuffleDraftItems);
    elements.modalShareButton.addEventListener("click", copyShareLink);
    elements.modalResetButton.addEventListener("click", resetToolFromModal);
    elements.cardCountInput.addEventListener("input", handleDraftCardCountInput);
    elements.revealOneToggle.addEventListener("change", handleDraftToggleChange);
    elements.showLabelsToggle.addEventListener("change", handleDraftToggleChange);
    document.addEventListener("keydown", handleDocumentKeydown);
  }

  function getDefaultConfig() {
    return {
      cardCount: 3,
      items: DEFAULT_ITEMS.slice(),
      revealOneOnly: false,
      showLabels: true
    };
  }

  function populateCardCountOptions() {
    elements.cardCountInput.textContent = "";

    for (let value = MIN_CARDS; value <= MAX_CARDS; value += 1) {
      const option = document.createElement("option");
      option.value = String(value);
      option.textContent = `${value} cards`;
      elements.cardCountInput.append(option);
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
      console.warn("Unable to read local pick-a-card config.", error);
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
        ? parsed.history.map(normalizeHistoryEntry).filter((entry) => entry.value).slice(-HISTORY_LIMIT)
        : [];

      state.session.lastReveal = parsed.lastReveal ? normalizeHistoryEntry(parsed.lastReveal) : null;

      if (Array.isArray(parsed.shuffledItems) && Array.isArray(parsed.openCards)) {
        state.session.shuffledItems = ensureItemCount(
          parsed.shuffledItems.map(normalizeItem),
          state.config.cardCount
        );
        state.session.openCards = normalizeOpenCards(parsed.openCards, state.config.cardCount);
      }
    } catch (error) {
      console.warn("Unable to restore pick-a-card session.", error);
    }
  }

  function initializeIfNeeded() {
    if (
      state.session.shuffledItems.length !== state.config.cardCount ||
      state.session.openCards.length !== state.config.cardCount
    ) {
      resetCards({ clearHistory: !state.session.history.length, silent: true });
    }
  }

  function normalizeConfig(input) {
    const base = getDefaultConfig();
    const source = input && typeof input === "object" ? input : {};
    const cardCount = clampNumber(source.cardCount ?? source.cards, MIN_CARDS, MAX_CARDS, base.cardCount);
    const rawItems = Array.isArray(source.items)
      ? source.items
      : typeof source.items === "string"
        ? source.items.split("|").map((item) => decodeURIComponent(item))
        : base.items;

    return {
      cardCount,
      items: ensureItemCount(rawItems.map(normalizeItem), cardCount),
      revealOneOnly: toBoolean(source.revealOneOnly ?? source.mode, base.revealOneOnly),
      showLabels: toBoolean(source.showLabels ?? source.labels, base.showLabels)
    };
  }

  function normalizeHistoryEntry(entry) {
    return {
      order: clampNumber(entry.order, 1, 9999, 1),
      cardNumber: clampNumber(entry.cardNumber, 1, MAX_CARDS, 1),
      value: normalizeItem(entry.value)
    };
  }

  function normalizeItem(value) {
    return String(value || "").trim().slice(0, ITEM_MAX_LENGTH);
  }

  function ensureItemCount(items, count) {
    const next = items.slice(0, count);
    while (next.length < count) {
      next.push(getDefaultCardItem(next.length));
    }
    return next.map((item, index) => item || getDefaultCardItem(index));
  }

  function getDefaultCardItem(index) {
    return DEFAULT_ITEMS[index] || `Card Reward ${index + 1}`;
  }

  function normalizeOpenCards(values, count) {
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
    if (!params.has("cards") || !params.has("items")) return null;

    return {
      cards: params.get("cards"),
      items: params.get("items"),
      mode: params.get("mode"),
      labels: params.get("labels")
    };
  }

  function buildShareUrl(sourceConfig = state.config) {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("cards", String(sourceConfig.cardCount));
    url.searchParams.set("mode", sourceConfig.revealOneOnly ? "single" : "multiple");
    url.searchParams.set("labels", sourceConfig.showLabels ? "1" : "0");
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
        openCards: state.session.openCards,
        history: state.session.history,
        lastReveal: state.session.lastReveal
      }));
    } catch (error) {
      console.warn("Unable to save pick-a-card state.", error);
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

  function shuffleCards({ clearHistory = false, silent = false } = {}) {
    state.session.shuffledItems = shuffleArray(state.config.items);
    state.session.openCards = Array.from({ length: state.config.cardCount }, () => false);
    state.session.lastReveal = null;

    if (clearHistory) {
      state.session.history = [];
    }

    renderAll();
    triggerShuffleFeedback(elements.grid, { panel: false });
    saveState();

    if (!silent) {
      setMessage(clearHistory ? "Cards reset and shuffled." : "Cards shuffled for a new reveal order.", "success");
    }
  }

  function resetCards({ clearHistory = true, silent = false } = {}) {
    shuffleCards({ clearHistory, silent: true });
    if (!silent) {
      setMessage(clearHistory ? "Cards reset for a fresh round." : "Cards reset.", "info");
    }
  }

  function clearHistory() {
    state.session.history = [];
    renderHistory();
    renderStats();
    saveState();
    setMessage("History cleared.", "info");
  }

  function handleCardGridClick(event) {
    const button = event.target.closest("[data-card-index]");
    if (!button) return;

    const cardIndex = Number.parseInt(button.dataset.cardIndex, 10);
    if (Number.isNaN(cardIndex)) return;

    if (state.session.openCards[cardIndex]) return;

    if (state.config.revealOneOnly && state.session.openCards.some(Boolean)) {
      setMessage("One card has been revealed. Reset or reshuffle to play again.", "info");
      return;
    }

    revealCard(cardIndex);
  }

  function revealCard(cardIndex) {
    state.session.openCards[cardIndex] = true;
    const value = state.session.shuffledItems[cardIndex];
    const entry = {
      order: state.session.history.length + 1,
      cardNumber: cardIndex + 1,
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
        ? `Card ${cardIndex + 1} revealed: ${value}. One card has been revealed. Reset or reshuffle to play again.`
        : `Card ${cardIndex + 1} revealed: ${value}.`,
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
    elements.cardCountInput.value = String(draft.cardCount);
    elements.cardCountHint.textContent = `${draft.cardCount} cards ready to configure. Maximum: 16.`;
    elements.revealOneToggle.checked = draft.revealOneOnly;
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
      input.placeholder = `Card ${index + 1} result`;
      input.addEventListener("input", () => {
        draft.items[index] = normalizeItem(input.value);
      });

      const meta = document.createElement("small");
      meta.textContent = "Hidden until this card is flipped";

      field.append(input, meta);
      row.append(badge, field);
      elements.itemList.append(row);
    });
  }

  function handleDraftCardCountInput() {
    const nextCount = clampNumber(elements.cardCountInput.value, MIN_CARDS, MAX_CARDS, state.session.draftConfig.cardCount);
    state.session.draftConfig.cardCount = nextCount;
    state.session.draftConfig.items = ensureItemCount(state.session.draftConfig.items, nextCount);
    elements.cardCountInput.value = String(nextCount);
    elements.cardCountHint.textContent = `${nextCount} cards ready to configure. Maximum: 16.`;
    renderDraftItemList();
  }

  function handleDraftToggleChange() {
    state.session.draftConfig.revealOneOnly = elements.revealOneToggle.checked;
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
    state.session.draftConfig = cloneConfig(state.config);
    shuffleCards({ clearHistory: true, silent: true });
    renderSettingsModal();
    saveState();
    setMessage("Tool reset to default cards.", "info");
  }

  function saveSettings() {
    const draft = cloneConfig(state.session.draftConfig || state.config);
    draft.items = draft.items.map(normalizeItem);

    if (draft.items.some((item) => !item)) {
      setMessage("Please fill in every card result before saving.", "error");
      return;
    }

    state.config = normalizeConfig(draft);
    state.session.history = [];
    state.session.lastReveal = null;
    closeSettings();
    shuffleCards({ clearHistory: true, silent: true });
    renderAll();
    saveState();
    setMessage("Card setup updated.", "success");
  }

  function renderAll() {
    renderCards();
    renderResultPanel();
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

  function renderCards() {
    elements.grid.textContent = "";

    const hiddenExists = state.session.openCards.some(Boolean);

    state.session.shuffledItems.forEach((value, index) => {
      const isOpen = Boolean(state.session.openCards[index]);
      const isLocked = !isOpen && state.config.revealOneOnly && hiddenExists;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "card-card";
      button.style.setProperty("--shuffle-index", String(index));
      button.dataset.cardIndex = String(index);
      button.dataset.state = isOpen ? "open" : (isLocked ? "locked" : "closed");
      button.setAttribute("aria-label", isOpen ? `Card ${index + 1} revealed ${value}` : `Reveal card ${index + 1}`);
      button.disabled = isLocked;

      if (isOpen) {
        button.classList.add("is-open");
      }

      const inner = document.createElement("span");
      inner.className = "card-card__inner";

      const back = document.createElement("span");
      back.className = "card-card__face card-card__face--back";

      const backIcon = document.createElement("span");
      backIcon.className = "card-card__icon";
      backIcon.textContent = "✦";

      const backTitle = document.createElement("strong");
      backTitle.className = "card-card__title";
      backTitle.textContent = state.config.showLabels ? `Card ${index + 1}` : "Hidden Card";

      const backHint = document.createElement("span");
      backHint.className = "card-card__hint";
      backHint.textContent = isLocked ? "Locked this round" : "Tap to reveal";

      back.append(backIcon, backTitle, backHint);

      const front = document.createElement("span");
      front.className = "card-card__face card-card__face--front";

      const frontIcon = document.createElement("span");
      frontIcon.className = "card-card__icon";
      frontIcon.textContent = "✧";

      const frontValue = document.createElement("strong");
      frontValue.className = "card-card__value";
      frontValue.textContent = value;

      const frontMeta = document.createElement("span");
      frontMeta.className = "card-card__meta";
      frontMeta.textContent = `Card ${index + 1}`;

      front.append(frontIcon, frontValue, frontMeta);
      inner.append(back, front);
      button.append(inner);
      elements.grid.append(button);
    });
  }

  function renderResultPanel() {
    const lastReveal = state.session.lastReveal;

    if (!lastReveal) {
      elements.resultCard.textContent = "Ready to reveal";
      elements.resultContent.textContent = "Pick a card to uncover the hidden result.";
      return;
    }

    elements.resultCard.textContent = `Card ${lastReveal.cardNumber}`;
    elements.resultContent.textContent = lastReveal.value;
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
      label.textContent = `Card ${entry.cardNumber}`;
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
    const hiddenCount = state.session.openCards.filter((value) => !value).length;
    elements.cardCountStat.textContent = String(state.config.cardCount);
    elements.revealCountStat.textContent = String(state.session.history.length);
    elements.hiddenCountStat.textContent = String(hiddenCount);
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
      cardCount: config.cardCount,
      items: config.items.slice(),
      revealOneOnly: config.revealOneOnly,
      showLabels: config.showLabels
    };
  }

  function getRandomInt(max) {
    return Math.floor(Math.random() * max);
  }
})();
