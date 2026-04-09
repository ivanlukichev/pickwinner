(function () {
  const page = document.querySelector(".spin-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.spinWheel.config.v1";
  const SHARE_PARAM = "wheel";
  const ITEM_MAX_LENGTH = 80;
  const HISTORY_LIMIT = 30;
  const SHUFFLE_FEEDBACK_DURATION = 480;
  const TAU = Math.PI * 2;
  const DEFAULT_ITEMS = [
    "Gift Card",
    "Free Coffee",
    "Bonus Prize",
    "Mystery Box",
    "Discount",
    "Lucky Pick"
  ];
  const PALETTE = [
    { fill: "#dbeafe", text: "#1e3a8a", muted: "#cbd5e1" },
    { fill: "#bfdbfe", text: "#1d4ed8", muted: "#cbd5e1" },
    { fill: "#fef3c7", text: "#b45309", muted: "#e5e7eb" },
    { fill: "#fde68a", text: "#92400e", muted: "#e5e7eb" },
    { fill: "#dcfce7", text: "#166534", muted: "#d1d5db" },
    { fill: "#fce7f3", text: "#be185d", muted: "#e5e7eb" },
    { fill: "#ede9fe", text: "#6d28d9", muted: "#ddd6fe" },
    { fill: "#fee2e2", text: "#b91c1c", muted: "#fecaca" }
  ];

  const elements = {
    sectionCount: document.querySelector("[data-section-count]"),
    itemList: document.querySelector("[data-item-list]"),
    itemImport: document.querySelector("[data-item-import]"),
    importItems: document.querySelector("[data-import-items]"),
    spinTotal: document.querySelector("[data-spin-total]"),
    spinTotalHint: document.querySelector("[data-spin-total-hint]"),
    allowRepeats: document.querySelector("[data-allow-repeats]"),
    unlimitedWins: document.querySelector("[data-unlimited-wins]"),
    maxWins: document.querySelector("[data-max-wins]"),
    removeAfterWin: document.querySelector("[data-remove-after-win]"),
    spinButton: document.querySelector("[data-spin-button]"),
    shuffleButton: document.querySelector("[data-shuffle-button]"),
    resetResultsButton: document.querySelector("[data-reset-results-button]"),
    resetToolButton: document.querySelector("[data-reset-tool-button]"),
    shareButton: document.querySelector("[data-share-button]"),
    clearHistoryButton: document.querySelector("[data-clear-history-button]"),
    openSettingsButtons: document.querySelectorAll("[data-open-settings]"),
    closeSettingsButtons: document.querySelectorAll("[data-close-settings]"),
    settingsModal: document.querySelector("[data-settings-modal]"),
    settingsPanel: document.querySelector(".spin-settings-modal__panel"),
    settingsBackdrop: document.querySelector("[data-settings-backdrop]"),
    message: document.querySelector("[data-message]"),
    remainingSpins: document.querySelector("[data-remaining-spins]"),
    settingsTotalSpins: document.querySelector("[data-settings-total-spins]"),
    visibleCount: document.querySelector("[data-visible-count]"),
    eligibleCount: document.querySelector("[data-eligible-count]"),
    resultPanel: document.querySelector("[data-result-panel]"),
    resultWinner: document.querySelector("[data-result-winner]"),
    resultMeta: document.querySelector("[data-result-meta]"),
    historyList: document.querySelector("[data-history-list]"),
    historyEmpty: document.querySelector("[data-history-empty]"),
    historyHint: document.querySelector("[data-history-hint]"),
    wheelStage: document.querySelector("[data-wheel-stage]"),
    canvas: document.querySelector("[data-wheel-canvas]")
  };

  const context = elements.canvas.getContext("2d");
  let resizeFrame = 0;

  const state = {
    config: loadInitialConfig(),
    session: {
      wins: [],
      removed: [],
      results: [],
      isSpinning: false,
      currentRotation: 0,
      animationFrame: 0,
      lastWinnerLabel: "",
      lastWinnerSpin: 0,
      message: {
        tone: "info",
        text: "Fill the wheel items and press Spin to reveal a fair result."
      },
      lastFocusedSettingsTrigger: null
    }
  };

  resetSessionArrays({ keepResults: false });
  populateSectionCountOptions();
  bindEvents();
  resizeCanvas();
  syncFormFromConfig();
  renderAll();
  saveConfig();

  function bindEvents() {
    elements.sectionCount.addEventListener("change", handleSectionCountChange);
    elements.spinTotal.addEventListener("input", renderSpinTotalState);
    elements.spinTotal.addEventListener("change", handleSettingChange);
    elements.allowRepeats.addEventListener("change", handleSettingChange);
    elements.unlimitedWins.addEventListener("change", handleSettingChange);
    elements.maxWins.addEventListener("change", handleSettingChange);
    elements.removeAfterWin.addEventListener("change", handleSettingChange);
    elements.importItems.addEventListener("click", importItemsFromTextarea);
    elements.spinButton.addEventListener("click", startSpin);
    elements.shuffleButton.addEventListener("click", shuffleItems);
    elements.resetResultsButton.addEventListener("click", () => resetResults("Results have been reset."));
    elements.clearHistoryButton.addEventListener("click", () => resetResults("Results have been reset."));
    elements.resetToolButton.addEventListener("click", resetTool);
    elements.shareButton.addEventListener("click", copyShareLink);
    elements.openSettingsButtons.forEach((button) => {
      button.addEventListener("click", openSettingsModal);
    });
    elements.closeSettingsButtons.forEach((button) => {
      button.addEventListener("click", closeSettingsModal);
    });
    elements.settingsBackdrop.addEventListener("click", closeSettingsModal);

    window.addEventListener("resize", () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resizeCanvas);
    });

    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSettingsModal();
      }
    });
  }

  function getDefaultConfig() {
    return {
      items: DEFAULT_ITEMS.slice(),
      totalSpins: 6,
      allowRepeatWinners: true,
      unlimitedWins: true,
      maxWinsPerItem: 1,
      removeAfterWin: false
    };
  }

  function loadInitialConfig() {
    const fromUrl = loadConfigFromUrl();
    if (fromUrl) return normalizeConfig(fromUrl);

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return normalizeConfig(JSON.parse(stored));
      }
    } catch (error) {
      console.warn("Unable to read local spin-wheel config.", error);
    }

    return getDefaultConfig();
  }

  function normalizeConfig(input) {
    const base = getDefaultConfig();
    const source = input && typeof input === "object" ? input : {};
    const requestedCount = clampNumber(source.sectionCount ?? source.c ?? source.items?.length ?? source.i?.length ?? base.items.length, 2, 50, base.items.length);
    const rawItems = Array.isArray(source.items)
      ? source.items
      : Array.isArray(source.i)
        ? source.i
        : base.items;
    const items = [];

    for (let index = 0; index < requestedCount; index += 1) {
      const rawValue = typeof rawItems[index] === "string" ? rawItems[index] : "";
      const normalized = normalizeItemLabel(rawValue);
      if (normalized) {
        items.push(normalized);
      } else if (DEFAULT_ITEMS[index]) {
        items.push(DEFAULT_ITEMS[index]);
      } else {
        items.push(`Prize ${index + 1}`);
      }
    }

    const config = {
      items,
      totalSpins: clampNumber(source.totalSpins ?? source.s ?? base.totalSpins, 1, 100, base.totalSpins),
      allowRepeatWinners: toBoolean(source.allowRepeatWinners ?? source.a, base.allowRepeatWinners),
      unlimitedWins: toBoolean(source.unlimitedWins ?? source.u, base.unlimitedWins),
      maxWinsPerItem: clampNumber(source.maxWinsPerItem ?? source.m ?? base.maxWinsPerItem, 1, 100, base.maxWinsPerItem),
      removeAfterWin: toBoolean(source.removeAfterWin ?? source.r, base.removeAfterWin)
    };

    const configCapacity = getConfigSpinCapacity(config);
    if (configCapacity !== Infinity) {
      config.totalSpins = Math.min(config.totalSpins, Math.max(1, Math.min(100, configCapacity)));
    }

    return config;
  }

  function toBoolean(value, fallback) {
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
    return fallback;
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function normalizeItemLabel(value) {
    return String(value || "").trim().slice(0, ITEM_MAX_LENGTH);
  }

  function loadConfigFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get(SHARE_PARAM);
    if (!encoded) return null;

    try {
      return JSON.parse(decodeBase64Url(encoded));
    } catch (error) {
      console.warn("Unable to decode shared wheel config.", error);
      return null;
    }
  }

  function encodeBase64Url(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }

  function decodeBase64Url(value) {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function saveConfig() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    } catch (error) {
      console.warn("Unable to save local spin-wheel config.", error);
    }
  }

  function syncFormFromConfig() {
    elements.sectionCount.value = state.config.items.length;
    elements.spinTotal.max = String(getMaxConfigurableTotalSpins());
    elements.spinTotal.value = state.config.totalSpins;
    elements.allowRepeats.checked = state.config.allowRepeatWinners;
    elements.unlimitedWins.checked = state.config.unlimitedWins;
    elements.maxWins.value = state.config.maxWinsPerItem;
    elements.removeAfterWin.checked = state.config.removeAfterWin;
  }

  function populateSectionCountOptions() {
    const fragment = document.createDocumentFragment();
    for (let count = 2; count <= 50; count += 1) {
      const option = document.createElement("option");
      option.value = String(count);
      option.textContent = `${count} sections`;
      fragment.append(option);
    }
    elements.sectionCount.replaceChildren(fragment);
  }

  function bindItemInput(input, index) {
    input.addEventListener("input", (event) => {
      const normalizedValue = normalizeItemLabel(event.target.value);
      state.config.items[index] = normalizedValue;
      if (event.target.value !== normalizedValue) {
        event.target.value = normalizedValue;
      }
      event.target.classList.toggle("is-invalid", !normalizedValue);
      saveConfig();
      renderStats();
      renderButtons();
      drawWheel();
    });
  }

  function renderItemInputs() {
    const fragment = document.createDocumentFragment();

    state.config.items.forEach((label, index) => {
      const row = document.createElement("div");
      row.className = "spin-item-row";

      const badge = document.createElement("span");
      badge.className = "spin-item-row__index";
      badge.textContent = String(index + 1);

      const body = document.createElement("div");
      body.className = "spin-item-row__body";

      const srLabel = document.createElement("label");
      const inputId = `wheel-item-${index}`;
      srLabel.className = "spin-sr-only";
      srLabel.setAttribute("for", inputId);
      srLabel.textContent = `Wheel item ${index + 1}`;

      const input = document.createElement("input");
      input.id = inputId;
      input.type = "text";
      input.value = label;
      input.placeholder = `Item ${index + 1}`;
      input.maxLength = 80;
      if (!label.trim()) {
        input.classList.add("is-invalid");
      }
      bindItemInput(input, index);

      const meta = document.createElement("div");
      meta.className = "spin-item-row__meta";
      const status = describeItemStatus(index);
      if (status.tone) {
        meta.classList.add(status.tone);
      }
      meta.textContent = status.text;

      body.append(srLabel, input, meta);
      row.append(badge, body);
      fragment.append(row);
    });

    elements.itemList.replaceChildren(fragment);
  }

  function describeItemStatus(index) {
    const wins = state.session.wins[index] || 0;
    if (state.session.removed[index]) {
      return { text: wins > 0 ? `Won ${wins} time${wins === 1 ? "" : "s"} · removed` : "Removed from the wheel", tone: "is-warning" };
    }

    if (wins === 0) {
      return { text: "Ready to win", tone: "" };
    }

    const maxWins = getMaxWinsLimit();
    if (maxWins !== Infinity && wins >= maxWins) {
      return { text: `Won ${wins} time${wins === 1 ? "" : "s"} · limit reached`, tone: "is-warning" };
    }

    return { text: `Won ${wins} time${wins === 1 ? "" : "s"}`, tone: "is-success" };
  }

  function resetSessionArrays({ keepResults }) {
    const length = state.config.items.length;
    const previousWins = state.session.wins.slice(0, length);
    const previousRemoved = state.session.removed.slice(0, length);

    state.session.wins = Array.from({ length }, (_, index) => previousWins[index] || 0);
    state.session.removed = Array.from({ length }, (_, index) => previousRemoved[index] || false);

    if (!keepResults) {
      state.session.wins.fill(0);
      state.session.removed.fill(false);
      state.session.results = [];
      state.session.lastWinnerLabel = "";
      state.session.lastWinnerSpin = 0;
    }
  }

  function handleSectionCountChange() {
    const nextCount = clampNumber(elements.sectionCount.value, 2, 50, state.config.items.length);
    if (nextCount === state.config.items.length) {
      elements.sectionCount.value = nextCount;
      return;
    }

    const nextItems = state.config.items.slice(0, nextCount);
    while (nextItems.length < nextCount) {
      nextItems.push(DEFAULT_ITEMS[nextItems.length] || `Prize ${nextItems.length + 1}`);
    }
    state.config.items = nextItems;
    elements.sectionCount.value = nextCount;
    resetSessionArrays({ keepResults: true });
    const { value: adjustedSpins, clamped } = clampTotalSpinsToCapacity();
    saveConfig();
    renderAll();

    if (clamped) {
      setMessage(`Configured spins adjusted to ${adjustedSpins} to match the available wheel items.`, "info");
    }
  }

  function handleSettingChange() {
    const requestedSpinTotal = elements.spinTotal.value;
    state.config.allowRepeatWinners = elements.allowRepeats.checked;
    state.config.unlimitedWins = elements.unlimitedWins.checked;
    state.config.maxWinsPerItem = clampNumber(elements.maxWins.value, 1, 100, state.config.maxWinsPerItem);
    state.config.removeAfterWin = elements.removeAfterWin.checked;
    const { value: adjustedSpins, clamped } = clampTotalSpinsToCapacity(requestedSpinTotal);

    syncFormFromConfig();
    saveConfig();
    renderAll();

    if (clamped) {
      setMessage(`Configured spins adjusted to ${adjustedSpins} to match the current wheel rules.`, "info");
    }
  }

  function importItemsFromTextarea() {
    const lines = elements.itemImport.value
      .split(/\r?\n/)
      .map((line) => normalizeItemLabel(line))
      .filter(Boolean)
      .slice(0, 50);

    if (lines.length < 2) {
      setMessage("Please add at least two lines to import wheel items.", "error");
      return;
    }

    state.config.items = lines;
    elements.itemImport.value = "";
    resetSessionArrays({ keepResults: false });
    const { value: adjustedSpins, clamped } = clampTotalSpinsToCapacity();
    syncFormFromConfig();
    saveConfig();
    renderAll();

    if (clamped) {
      setMessage(`Imported ${lines.length} wheel items. Configured spins adjusted to ${adjustedSpins}.`, "success");
      return;
    }

    setMessage(`Imported ${lines.length} wheel items.`, "success");
  }

  function shuffleItems() {
    if (state.session.isSpinning) return;
    const shuffled = state.config.items.slice();
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = getRandomInt(index + 1);
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }

    state.config.items = shuffled;
    resetSessionArrays({ keepResults: false });
    saveConfig();
    renderAll();
    triggerShuffleFeedback(elements.wheelStage);
    setMessage("Wheel items shuffled and results reset.", "success");
  }

  function resetResults(message) {
    if (state.session.isSpinning) return;
    cancelAnimationFrame(state.session.animationFrame);
    state.session.isSpinning = false;
    state.session.wins = state.config.items.map(() => 0);
    state.session.removed = state.config.items.map(() => false);
    state.session.results = [];
    state.session.lastWinnerLabel = "";
    state.session.lastWinnerSpin = 0;
    renderAll();
    setMessage(message, "info");
  }

  function resetTool() {
    if (state.session.isSpinning) return;
    cancelAnimationFrame(state.session.animationFrame);
    state.config = getDefaultConfig();
    state.session.currentRotation = 0;
    state.session.message = {
      tone: "info",
      text: "Tool reset to the default demo setup."
    };
    resetSessionArrays({ keepResults: false });
    syncFormFromConfig();
    saveConfig();
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    renderAll();
  }

  async function copyShareLink() {
    const shareUrl = buildShareUrl();

    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage("Share link copied to clipboard.", "success");
    } catch (error) {
      window.prompt("Copy this share link:", shareUrl);
      setMessage("Share link ready to copy.", "info");
    }
  }

  function buildShareUrl() {
    const payload = encodeBase64Url(
      JSON.stringify({
        c: state.config.items.length,
        i: state.config.items.map((item) => normalizeItemLabel(item)),
        s: state.config.totalSpins,
        a: state.config.allowRepeatWinners ? 1 : 0,
        u: state.config.unlimitedWins ? 1 : 0,
        m: state.config.maxWinsPerItem,
        r: state.config.removeAfterWin ? 1 : 0
      })
    );
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set(SHARE_PARAM, payload);
    return url.toString();
  }

  function setMessage(text, tone) {
    state.session.message = { text, tone };
    renderMessage();
  }

  function renderMessage() {
    elements.message.textContent = state.session.message.text;
    elements.message.dataset.tone = state.session.message.tone;
  }

  function getConfigMaxWinsLimit(config) {
    if (!config.allowRepeatWinners) return 1;
    if (config.unlimitedWins) return Infinity;
    return config.maxWinsPerItem;
  }

  function getConfigSpinCapacity(config) {
    const itemCount = Array.isArray(config.items) ? config.items.length : 0;
    if (itemCount === 0) return 0;

    if (config.removeAfterWin) {
      return itemCount;
    }

    const maxWinsLimit = getConfigMaxWinsLimit(config);
    if (maxWinsLimit === Infinity) {
      return Infinity;
    }

    return itemCount * maxWinsLimit;
  }

  function getVisibleIndices() {
    return state.config.items.reduce((accumulator, item, index) => {
      if (!state.session.removed[index]) accumulator.push(index);
      return accumulator;
    }, []);
  }

  function getMaxWinsLimit() {
    return getConfigMaxWinsLimit(state.config);
  }

  function getEligibleIndices(visibleIndices = getVisibleIndices()) {
    const maxWinsLimit = getMaxWinsLimit();
    return visibleIndices.filter((index) => {
      const wins = state.session.wins[index] || 0;
      return wins < maxWinsLimit;
    });
  }

  function getAvailableWinCapacity(visibleIndices = getVisibleIndices()) {
    const eligibleIndices = getEligibleIndices(visibleIndices);
    if (eligibleIndices.length === 0) return 0;

    if (state.config.removeAfterWin) {
      return eligibleIndices.length;
    }

    const maxWinsLimit = getMaxWinsLimit();
    if (maxWinsLimit === Infinity) {
      return Infinity;
    }

    return eligibleIndices.reduce((total, index) => {
      const wins = state.session.wins[index] || 0;
      return total + Math.max(0, maxWinsLimit - wins);
    }, 0);
  }

  function getRemainingSpins() {
    const configuredRemaining = Math.max(0, state.config.totalSpins - state.session.results.length);
    const availableCapacity = getAvailableWinCapacity();
    if (availableCapacity === Infinity) {
      return configuredRemaining;
    }

    return Math.max(0, Math.min(configuredRemaining, availableCapacity));
  }

  function getMaxConfigurableTotalSpins() {
    const availableCapacity = getAvailableWinCapacity();
    if (availableCapacity === Infinity) {
      return 100;
    }

    return Math.max(1, Math.min(100, state.session.results.length + availableCapacity));
  }

  function clampTotalSpinsToCapacity(preferredValue = state.config.totalSpins) {
    const maxAllowed = getMaxConfigurableTotalSpins();
    const minAllowed = Math.min(Math.max(1, state.session.results.length), maxAllowed);
    const fallback = clampNumber(state.config.totalSpins, minAllowed, maxAllowed, minAllowed);
    const requestedValue = Number.parseInt(preferredValue, 10);
    const nextValue = clampNumber(preferredValue, minAllowed, maxAllowed, fallback);

    state.config.totalSpins = nextValue;

    return {
      value: nextValue,
      clamped: !Number.isNaN(requestedValue) && requestedValue !== nextValue,
      maxAllowed
    };
  }

  function getSpinValidationMessage() {
    const itemCount = state.config.items.length;
    if (itemCount < 2) {
      return "Add at least 2 wheel items before spinning.";
    }

    if (state.config.items.some((item) => !item.trim())) {
      return "Please fill in all wheel items before spinning.";
    }

    if (state.session.isSpinning) {
      return "The wheel is already spinning.";
    }

    if (getRemainingSpins() <= 0) {
      return "No spins remaining.";
    }

    const visibleIndices = getVisibleIndices();
    if (visibleIndices.length < 2) {
      return "At least 2 active items are required to spin.";
    }

    if (getEligibleIndices(visibleIndices).length === 0) {
      return "No available items left to win.";
    }

    return "";
  }

  function startSpin() {
    const validationMessage = getSpinValidationMessage();
    if (validationMessage) {
      setMessage(validationMessage, "error");
      renderAll();
      return;
    }

    const visibleIndices = getVisibleIndices();
    const eligibleIndices = getEligibleIndices(visibleIndices);
    // Fairness first: choose one eligible sector uniformly before any animation starts.
    const winnerIndex = eligibleIndices[getRandomInt(eligibleIndices.length)];
    const winnerVisibleIndex = visibleIndices.indexOf(winnerIndex);
    const sectorAngle = TAU / visibleIndices.length;
    // Pick a random stopping point inside the selected sector, avoiding its edges.
    const safePadding = Math.min(sectorAngle * 0.18, Math.max(0.02, sectorAngle / 2 - 0.02));
    const offsetWithinSector = sectorAngle <= safePadding * 2
      ? sectorAngle / 2
      : safePadding + getRandomFloat() * (sectorAngle - safePadding * 2);
    const desiredRotation = calculateTargetRotation(winnerVisibleIndex, sectorAngle, offsetWithinSector);
    const duration = 4200 + getRandomInt(1200);

    state.session.isSpinning = true;
    state.session.lastWinnerLabel = "";
    setMessage("Spinning...", "info");
    renderAll();

    animateSpin({
      from: state.session.currentRotation,
      to: desiredRotation,
      duration,
      onComplete: () => {
        state.session.currentRotation = desiredRotation;
        state.session.isSpinning = false;
        finalizeWinner(winnerIndex);
      }
    });
  }

  function calculateTargetRotation(winnerVisibleIndex, sectorAngle, offsetWithinSector) {
    // Animation only visualizes the preselected outcome by rotating to the chosen point.
    const desiredNormalized = modulo(-(winnerVisibleIndex * sectorAngle + offsetWithinSector), TAU);
    const currentNormalized = modulo(state.session.currentRotation, TAU);
    const fullTurns = 4 + getRandomInt(4);
    const extra = modulo(desiredNormalized - currentNormalized, TAU);
    return state.session.currentRotation + fullTurns * TAU + extra;
  }

  function animateSpin({ from, to, duration, onComplete }) {
    const startTime = performance.now();

    const frame = (timestamp) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutQuint(progress);

      state.session.currentRotation = from + (to - from) * eased;
      drawWheel();

      if (progress < 1) {
        state.session.animationFrame = requestAnimationFrame(frame);
        return;
      }

      onComplete();
      renderAll();
    };

    cancelAnimationFrame(state.session.animationFrame);
    state.session.animationFrame = requestAnimationFrame(frame);
  }

  function appendWinnerResult(index, { updateCurrentWinner = true } = {}) {
    const winnerLabel = state.config.items[index].trim();
    state.session.wins[index] += 1;
    if (state.config.removeAfterWin) {
      state.session.removed[index] = true;
    }

    const spinNumber = state.session.results.length + 1;
    state.session.results.push({
      label: winnerLabel,
      spinNumber
    });
    state.session.results = state.session.results.slice(-HISTORY_LIMIT);
    if (updateCurrentWinner) {
      state.session.lastWinnerLabel = winnerLabel;
      state.session.lastWinnerSpin = spinNumber;
    }

    return winnerLabel;
  }

  function autoAppendLastEligibleWinner() {
    if (getRemainingSpins() <= 0) return "";

    const visibleIndices = getVisibleIndices();
    const eligibleIndices = getEligibleIndices(visibleIndices);
    if (eligibleIndices.length !== 1) return "";

    return appendWinnerResult(eligibleIndices[0], { updateCurrentWinner: false });
  }

  function finalizeWinner(index) {
    const winnerLabel = appendWinnerResult(index);
    const autoAddedLabel = autoAppendLastEligibleWinner();

    renderAll();
    flashWinnerPanel();

    const nextValidationMessage = getSpinValidationMessage();
    if (autoAddedLabel) {
      setMessage(`Winner selected fairly: ${winnerLabel}. Final remaining item added to results: ${autoAddedLabel}.`, "success");
    } else if (nextValidationMessage === "No available items left to win." || nextValidationMessage === "At least 2 active items are required to spin." || nextValidationMessage === "No spins remaining.") {
      setMessage(nextValidationMessage, "info");
    } else {
      setMessage(`Winner selected fairly: ${winnerLabel}.`, "success");
    }
  }

  function flashWinnerPanel() {
    elements.resultPanel.classList.remove("is-highlight");
    void elements.resultPanel.offsetWidth;
    elements.resultPanel.classList.add("is-highlight");
  }

  function renderResultPanel() {
    if (!state.session.lastWinnerLabel) {
      elements.resultWinner.textContent = "Ready to spin";
      elements.resultMeta.textContent = "Fill the wheel items and press Spin to reveal a fair result.";
      return;
    }

    elements.resultWinner.textContent = state.session.lastWinnerLabel;
    elements.resultMeta.textContent = `Spin ${state.session.lastWinnerSpin} of ${state.config.totalSpins} completed. ${getRemainingSpins()} spin${getRemainingSpins() === 1 ? "" : "s"} remaining.`;
  }

  function renderHistory() {
    const hasResults = state.session.results.length > 0;
    elements.historyEmpty.hidden = hasResults;
    elements.historyHint.hidden = hasResults;
    elements.historyList.hidden = !hasResults;

    if (!hasResults) {
      elements.historyList.replaceChildren();
      return;
    }

    const fragment = document.createDocumentFragment();

    state.session.results.forEach((result) => {
      const item = document.createElement("li");
      const entry = document.createElement("div");
      const title = document.createElement("strong");
      const meta = document.createElement("span");

      entry.className = "spin-history__entry";
      title.textContent = result.label;
      meta.textContent = `Spin ${result.spinNumber}`;

      entry.append(title, meta);
      item.append(entry);
      fragment.append(item);
    });

    elements.historyList.replaceChildren(fragment);
  }

  function renderStats() {
    elements.remainingSpins.textContent = String(getRemainingSpins());
    elements.settingsTotalSpins.textContent = String(state.config.totalSpins);
    elements.visibleCount.textContent = String(getVisibleIndices().length);
    elements.eligibleCount.textContent = String(getEligibleIndices().length);
  }

  function renderSpinTotalState() {
    const maxAllowed = getMaxConfigurableTotalSpins();
    const requestedValue = Number.parseInt(elements.spinTotal.value, 10);
    const isOverLimit = !Number.isNaN(requestedValue) && requestedValue > maxAllowed;

    elements.spinTotal.classList.toggle("is-invalid", isOverLimit);
    elements.spinTotal.setAttribute("aria-invalid", isOverLimit ? "true" : "false");

    if (isOverLimit) {
      elements.spinTotalHint.textContent = `You cannot set more than ${maxAllowed} spin${maxAllowed === 1 ? "" : "s"} with the current wheel rules.`;
      elements.spinTotalHint.classList.add("is-warning");
      return;
    }

    elements.spinTotalHint.textContent = `Maximum available with the current setup: ${maxAllowed} spin${maxAllowed === 1 ? "" : "s"}.`;
    elements.spinTotalHint.classList.remove("is-warning");
  }

  function renderToggles() {
    elements.maxWins.disabled = !state.config.allowRepeatWinners || state.config.unlimitedWins;
    elements.maxWins.closest(".spin-field").classList.toggle("is-disabled", elements.maxWins.disabled);
    elements.unlimitedWins.closest(".spin-toggle").classList.toggle("is-disabled", !state.config.allowRepeatWinners);
    elements.unlimitedWins.disabled = !state.config.allowRepeatWinners;
  }

  function renderButtons() {
    const validationMessage = getSpinValidationMessage();
    elements.spinButton.disabled = Boolean(validationMessage);
    elements.spinButton.textContent = state.session.isSpinning ? "Spinning..." : "Spin";
    elements.spinButton.dataset.spinState = state.session.isSpinning ? "spinning" : "idle";

    const disableWhileSpinning = state.session.isSpinning;
    const hasResults = state.session.results.length > 0;
    elements.shuffleButton.disabled = disableWhileSpinning;
    elements.resetResultsButton.disabled = disableWhileSpinning || !hasResults;
    elements.resetToolButton.disabled = disableWhileSpinning;
    elements.shareButton.disabled = disableWhileSpinning;
    elements.clearHistoryButton.disabled = disableWhileSpinning || !hasResults;
    elements.importItems.disabled = disableWhileSpinning;
  }

  function openSettingsModal(event) {
    if (!elements.settingsModal || !elements.settingsBackdrop) return;
    state.session.lastFocusedSettingsTrigger = event?.currentTarget || document.activeElement;
    elements.settingsModal.hidden = false;
    elements.settingsBackdrop.hidden = false;
    elements.settingsModal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("has-modal-open");
    document.body.classList.add("has-modal-open");
    requestAnimationFrame(() => {
      elements.settingsPanel?.focus();
    });
  }

  function closeSettingsModal() {
    if (!elements.settingsModal || !elements.settingsBackdrop || elements.settingsModal.hidden) return;
    elements.settingsModal.hidden = true;
    elements.settingsBackdrop.hidden = true;
    elements.settingsModal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("has-modal-open");
    document.body.classList.remove("has-modal-open");
    if (state.session.lastFocusedSettingsTrigger instanceof HTMLElement) {
      state.session.lastFocusedSettingsTrigger.focus();
    }
  }

  function renderAll() {
    syncFormFromConfig();
    renderToggles();
    renderItemInputs();
    renderStats();
    renderSpinTotalState();
    renderResultPanel();
    renderHistory();
    renderButtons();
    renderMessage();
    drawWheel();
  }

  function triggerShuffleFeedback(target) {
    if (!target) return;
    target.classList.remove("shuffle-feedback-panel", "is-shuffling");
    void target.offsetWidth;
    target.classList.add("shuffle-feedback-panel", "is-shuffling");
    window.setTimeout(() => {
      target.classList.remove("is-shuffling");
    }, SHUFFLE_FEEDBACK_DURATION);
  }

  function resizeCanvas() {
    const rect = elements.wheelStage.getBoundingClientRect();
    const targetSize = Math.max(280, Math.min(rect.width - 32, 620));
    const ratio = window.devicePixelRatio || 1;
    elements.canvas.width = targetSize * ratio;
    elements.canvas.height = targetSize * ratio;
    elements.canvas.style.width = `${targetSize}px`;
    elements.canvas.style.height = `${targetSize}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    drawWheel();
  }

  function drawWheel() {
    const width = elements.canvas.width / (window.devicePixelRatio || 1);
    const height = elements.canvas.height / (window.devicePixelRatio || 1);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 18;

    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(centerX, centerY);

    const visibleIndices = getVisibleIndices();
    const eligibleSet = new Set(getEligibleIndices(visibleIndices));
    if (visibleIndices.length === 0) {
      drawEmptyWheel(radius);
      context.restore();
      return;
    }

    const sectorAngle = TAU / visibleIndices.length;
    visibleIndices.forEach((itemIndex, visibleIndex) => {
      const color = PALETTE[itemIndex % PALETTE.length];
      const eligible = eligibleSet.has(itemIndex);
      const startAngle = -Math.PI / 2 + state.session.currentRotation + visibleIndex * sectorAngle;
      const endAngle = startAngle + sectorAngle;

      context.beginPath();
      context.moveTo(0, 0);
      context.arc(0, 0, radius, startAngle, endAngle);
      context.closePath();
      context.fillStyle = eligible ? color.fill : "rgba(226, 232, 240, 0.8)";
      context.fill();
      context.lineWidth = visibleIndices.length > 24 ? 1.25 : 2;
      context.strokeStyle = "rgba(255, 255, 255, 0.95)";
      context.stroke();

      drawSectorLabel({
        label: state.config.items[itemIndex],
        startAngle,
        sectorAngle,
        radius,
        color: eligible ? color.text : "#64748b",
        totalVisible: visibleIndices.length
      });
    });

    context.beginPath();
    context.arc(0, 0, radius * 0.13, 0, TAU);
    context.fillStyle = "#ffffff";
    context.fill();
    context.lineWidth = 8;
    context.strokeStyle = "rgba(29, 78, 216, 0.14)";
    context.stroke();

    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.lineWidth = 4;
    context.strokeStyle = "rgba(255, 255, 255, 0.9)";
    context.stroke();

    context.restore();
  }

  function drawEmptyWheel(radius) {
    context.beginPath();
    context.arc(0, 0, radius, 0, TAU);
    context.fillStyle = "rgba(241, 245, 249, 0.95)";
    context.fill();

    context.fillStyle = "#475569";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "600 18px Inter, system-ui, sans-serif";
    context.fillText("Add at least two visible items", 0, 0);
  }

  function drawSectorLabel({ label, startAngle, sectorAngle, radius, color, totalVisible }) {
    const sanitized = label.trim() || "Untitled";
    const maxChars = Math.max(4, Math.floor(sectorAngle * 22));
    const shortLabel = sanitized.length > maxChars ? `${sanitized.slice(0, Math.max(3, maxChars - 1))}…` : sanitized;
    const fontSize = Math.max(9, Math.min(18, radius * 0.09, 26 - totalVisible * 0.22));
    const textRadius = totalVisible > 24 ? radius * 0.74 : radius * 0.78;
    const midAngle = startAngle + sectorAngle / 2;

    context.save();
    context.rotate(midAngle);
    context.textAlign = "right";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.font = `700 ${fontSize}px Inter, system-ui, sans-serif`;
    context.fillText(shortLabel, textRadius, 0, radius * 0.62);
    context.restore();
  }

  function easeOutQuint(value) {
    return 1 - Math.pow(1 - value, 5);
  }

  function modulo(value, base) {
    return ((value % base) + base) % base;
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

  function getRandomFloat() {
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return buffer[0] / 0x100000000;
    }

    return Math.random();
  }

})();
