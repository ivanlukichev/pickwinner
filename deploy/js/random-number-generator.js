(function () {
  const page = document.querySelector(".number-generator-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.randomNumberGenerator.v1";
  const MAX_RANGE_SIZE = 1000000;
  const MAX_RESULTS_PER_DRAW = 100;
  const HISTORY_LIMIT = 30;

  const elements = {
    minInput: document.querySelector("[data-min-input]"),
    maxInput: document.querySelector("[data-max-input]"),
    rangeHint: document.querySelector("[data-range-hint]"),
    countInput: document.querySelector("[data-count-input]"),
    countHint: document.querySelector("[data-count-hint]"),
    allowDuplicates: document.querySelector("[data-allow-duplicates]"),
    sortResults: document.querySelector("[data-sort-results]"),
    generateButton: document.querySelector("[data-generate-button]"),
    resetButton: document.querySelector("[data-reset-button]"),
    shareButton: document.querySelector("[data-share-button]"),
    clearHistoryButton: document.querySelector("[data-clear-history-button]"),
    generatedTotal: document.querySelector("[data-generated-total]"),
    rangeSize: document.querySelector("[data-range-size]"),
    modeLabel: document.querySelector("[data-mode-label]"),
    actionHelper: document.querySelector("[data-action-helper]"),
    modeTabs: document.querySelectorAll("[data-mode-tab]"),
    multipleSettings: document.querySelector("[data-multiple-settings]"),
    resultPanel: document.querySelector("[data-result-panel]"),
    resultLabel: document.querySelector("[data-result-label]"),
    resultValue: document.querySelector("[data-result-value]"),
    resultMeta: document.querySelector("[data-result-meta]"),
    resultList: document.querySelector("[data-result-list]"),
    historyList: document.querySelector("[data-history-list]"),
    historyEmpty: document.querySelector("[data-history-empty]"),
    historyHint: document.querySelector("[data-history-hint]"),
    message: document.querySelector("[data-message]")
  };

  const state = {
    config: loadInitialConfig(),
    session: {
      history: [],
      currentValues: [],
      isGenerating: false,
      previewTimer: 0,
      message: {
        tone: "info",
        text: ""
      }
    }
  };

  state.session.message.text = state.config.mode === "multiple"
    ? "Set a range and press Generate Numbers."
    : "Set a range and press Generate Number.";

  restoreSession();
  bindEvents();
  syncFormFromState();
  renderAll();
  saveState();

  function bindEvents() {
    elements.minInput.addEventListener("input", handleRangeInput);
    elements.maxInput.addEventListener("input", handleRangeInput);
    elements.countInput.addEventListener("input", handleSettingsInput);
    elements.countInput.addEventListener("change", handleSettingsChange);
    elements.allowDuplicates.addEventListener("change", handleSettingsChange);
    elements.sortResults.addEventListener("change", handleSettingsChange);
    elements.generateButton.addEventListener("click", startGenerate);
    elements.resetButton.addEventListener("click", resetGenerator);
    elements.shareButton.addEventListener("click", copyShareLink);
    elements.clearHistoryButton.addEventListener("click", clearHistory);
    elements.modeTabs.forEach((tab) => {
      tab.addEventListener("click", () => setMode(tab.dataset.modeValue || "single"));
    });
  }

  function getDefaultConfig() {
    return {
      mode: "single",
      minText: "1",
      maxText: "100",
      count: 1,
      allowDuplicates: false,
      sortResults: false
    };
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
      console.warn("Unable to read local random-number-generator config.", error);
    }

    return getDefaultConfig();
  }

  function restoreSession() {
    if (loadConfigFromUrl()) return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed) return;

      state.session.history = Array.isArray(parsed.history)
        ? parsed.history
          .map((entry) => normalizeHistoryEntry(entry))
          .filter((entry) => entry.values.length > 0)
          .slice(-HISTORY_LIMIT)
        : [];

      state.session.currentValues = Array.isArray(parsed.currentValues)
        ? normalizeNumbers(parsed.currentValues)
        : [];
    } catch (error) {
      console.warn("Unable to restore random-number-generator session.", error);
    }
  }

  function normalizeConfig(input) {
    const base = getDefaultConfig();
    const source = input && typeof input === "object" ? input : {};
    const mode = source.mode === "multiple" ? "multiple" : "single";

    return {
      mode,
      minText: sanitizeIntegerString(source.minText ?? source.min ?? base.minText, base.minText),
      maxText: sanitizeIntegerString(source.maxText ?? source.max ?? base.maxText, base.maxText),
      count: clampNumber(source.count ?? source.c ?? base.count, 1, MAX_RESULTS_PER_DRAW, base.count),
      allowDuplicates: toBoolean(source.allowDuplicates ?? source.duplicates ?? source.dupes ?? source.d, base.allowDuplicates),
      sortResults: toBoolean(source.sortResults ?? source.sort ?? source.s, base.sortResults)
    };
  }

  function normalizeHistoryEntry(entry) {
    return {
      order: clampNumber(entry.order, 1, 9999, 1),
      values: normalizeNumbers(entry.values)
    };
  }

  function normalizeNumbers(values) {
    return Array.isArray(values)
      ? values
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value))
      : [];
  }

  function sanitizeIntegerString(value, fallback) {
    const text = String(value ?? "").trim();
    if (!text) return "";
    const parsed = Number.parseInt(text, 10);
    if (Number.isNaN(parsed)) return String(fallback);
    return String(parsed);
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
    if (!params.has("min") || !params.has("max")) return null;

    return {
      mode: params.get("mode"),
      min: params.get("min"),
      max: params.get("max"),
      count: params.get("count"),
      duplicates: params.get("duplicates"),
      sort: params.get("sort")
    };
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        config: state.config,
        history: state.session.history,
        currentValues: state.session.currentValues
      }));
    } catch (error) {
      console.warn("Unable to save random-number-generator state.", error);
    }
  }

  function syncFormFromState() {
    elements.minInput.value = state.config.minText;
    elements.maxInput.value = state.config.maxText;
    elements.countInput.value = String(state.config.count);
    elements.allowDuplicates.checked = state.config.allowDuplicates;
    elements.sortResults.checked = state.config.sortResults;
  }

  function getBounds() {
    const min = Number.parseInt(state.config.minText, 10);
    const max = Number.parseInt(state.config.maxText, 10);

    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      return { valid: false, min: 0, max: 0, rangeSize: 0 };
    }

    const rangeSize = max - min + 1;
    return {
      valid: max > min && rangeSize > 0 && rangeSize <= MAX_RANGE_SIZE,
      min,
      max,
      rangeSize
    };
  }

  function getActiveCount() {
    return state.config.mode === "single" ? 1 : state.config.count;
  }

  function getCountLimit() {
    const bounds = getBounds();
    if (!bounds.valid) {
      return MAX_RESULTS_PER_DRAW;
    }

    if (state.config.allowDuplicates) {
      return MAX_RESULTS_PER_DRAW;
    }

    return Math.max(1, Math.min(MAX_RESULTS_PER_DRAW, bounds.rangeSize));
  }

  function syncCount() {
    const maxAllowed = getCountLimit();
    state.config.count = clampNumber(state.config.count, 1, maxAllowed, 1);
    elements.countInput.max = String(maxAllowed);
    elements.countInput.value = String(state.config.count);
    return maxAllowed;
  }

  function setMode(mode) {
    const nextMode = mode === "multiple" ? "multiple" : "single";
    if (state.config.mode === nextMode) return;

    state.config.mode = nextMode;
    state.session.message = {
      tone: "info",
      text: nextMode === "single"
        ? "Single Number mode is active."
        : "Multiple Numbers mode is active."
    };

    renderAll();
    saveState();
  }

  function handleRangeInput(event) {
    if (event.target === elements.minInput) {
      state.config.minText = elements.minInput.value.trim();
    } else {
      state.config.maxText = elements.maxInput.value.trim();
    }

    syncCount();
    saveState();
    renderAll();
  }

  function handleSettingsInput() {
    renderCountHint();
  }

  function handleSettingsChange() {
    const requestedCount = Number.parseInt(elements.countInput.value, 10);
    state.config.count = clampNumber(elements.countInput.value, 1, MAX_RESULTS_PER_DRAW, state.config.count);
    state.config.allowDuplicates = elements.allowDuplicates.checked;
    state.config.sortResults = elements.sortResults.checked;
    const maxAllowed = syncCount();

    renderAll();
    saveState();

    if (!Number.isNaN(requestedCount) && requestedCount > maxAllowed) {
      setMessage(`Number count adjusted to ${maxAllowed} to match the current range.`, "info");
    }
  }

  function renderTabs() {
    elements.modeTabs.forEach((tab) => {
      const isActive = tab.dataset.modeValue === state.config.mode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });

    elements.multipleSettings.hidden = state.config.mode !== "multiple";
  }

  function renderRangeHint() {
    const bounds = getBounds();
    const hasMin = state.config.minText !== "";
    const hasMax = state.config.maxText !== "";
    const minInvalid = hasMin && !Number.isInteger(Number.parseInt(state.config.minText, 10));
    const maxInvalid = hasMax && !Number.isInteger(Number.parseInt(state.config.maxText, 10));
    const rangeTooWide = !minInvalid && !maxInvalid && hasMin && hasMax && Number.parseInt(state.config.maxText, 10) - Number.parseInt(state.config.minText, 10) + 1 > MAX_RANGE_SIZE;
    const invalidOrder = !minInvalid && !maxInvalid && hasMin && hasMax && Number.parseInt(state.config.maxText, 10) <= Number.parseInt(state.config.minText, 10);

    elements.minInput.classList.toggle("is-invalid", minInvalid || invalidOrder || rangeTooWide);
    elements.maxInput.classList.toggle("is-invalid", maxInvalid || invalidOrder || rangeTooWide);

    if (!hasMin || !hasMax) {
      elements.rangeHint.textContent = "Enter a minimum and maximum number to start generating.";
      elements.rangeHint.classList.remove("is-warning");
      return;
    }

    if (minInvalid || maxInvalid) {
      elements.rangeHint.textContent = "Use whole numbers for both minimum and maximum values.";
      elements.rangeHint.classList.add("is-warning");
      return;
    }

    if (invalidOrder) {
      elements.rangeHint.textContent = "Maximum number must be greater than minimum number.";
      elements.rangeHint.classList.add("is-warning");
      return;
    }

    if (rangeTooWide) {
      elements.rangeHint.textContent = `The range can include up to ${formatNumber(MAX_RANGE_SIZE)} values.`;
      elements.rangeHint.classList.add("is-warning");
      return;
    }

    elements.rangeHint.textContent = state.config.mode === "single"
      ? `Generate a random number between ${formatNumber(bounds.min)} and ${formatNumber(bounds.max)}.`
      : `Generate multiple random numbers between ${formatNumber(bounds.min)} and ${formatNumber(bounds.max)}.`;
    elements.rangeHint.classList.remove("is-warning");
  }

  function renderCountHint() {
    const maxAllowed = getCountLimit();
    const requestedCount = Number.parseInt(elements.countInput.value, 10);
    const isOverLimit = !Number.isNaN(requestedCount) && requestedCount > maxAllowed;

    elements.countInput.classList.toggle("is-invalid", isOverLimit);
    elements.countInput.setAttribute("aria-invalid", isOverLimit ? "true" : "false");

    if (isOverLimit) {
      if (maxAllowed === MAX_RESULTS_PER_DRAW) {
        elements.countHint.textContent = `You can generate up to ${MAX_RESULTS_PER_DRAW} numbers at a time.`;
      } else {
        elements.countHint.textContent = `Only ${maxAllowed} unique numbers available in this range without duplicates.`;
      }
      elements.countHint.classList.add("is-warning");
      return;
    }

    elements.countHint.textContent = `You can generate up to ${maxAllowed} numbers with the current settings.`;
    elements.countHint.classList.remove("is-warning");
  }

  function buildShareUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("mode", state.config.mode);
    url.searchParams.set("min", state.config.minText || "1");
    url.searchParams.set("max", state.config.maxText || "100");
    if (state.config.mode === "multiple") {
      url.searchParams.set("count", String(state.config.count));
      url.searchParams.set("duplicates", String(state.config.allowDuplicates));
      url.searchParams.set("sort", String(state.config.sortResults));
    }
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

  function getValidationMessage() {
    if (state.session.isGenerating) {
      return "A number draw is already in progress.";
    }

    const bounds = getBounds();
    if (!state.config.minText || !state.config.maxText) {
      return "Please enter both minimum and maximum numbers.";
    }

    if (!Number.isInteger(Number.parseInt(state.config.minText, 10)) || !Number.isInteger(Number.parseInt(state.config.maxText, 10))) {
      return "Use whole numbers for the selected range.";
    }

    if (Number.parseInt(state.config.maxText, 10) <= Number.parseInt(state.config.minText, 10)) {
      return "Maximum number must be greater than minimum number.";
    }

    if (bounds.rangeSize > MAX_RANGE_SIZE) {
      return `The range can include up to ${formatNumber(MAX_RANGE_SIZE)} values.`;
    }

    if (state.config.mode === "multiple" && state.config.count > MAX_RESULTS_PER_DRAW) {
      return `You can generate up to ${MAX_RESULTS_PER_DRAW} numbers at a time.`;
    }

    if (state.config.mode === "multiple" && !state.config.allowDuplicates && state.config.count > bounds.rangeSize) {
      return `Only ${bounds.rangeSize} unique numbers available in this range without duplicates.`;
    }

    return "";
  }

  function startGenerate() {
    const validationMessage = getValidationMessage();
    if (validationMessage) {
      setMessage(validationMessage, "error");
      renderAll();
      return;
    }

    const bounds = getBounds();
    const count = getActiveCount();
    const results = generateRandomValues(bounds.min, bounds.max, count, state.config.mode === "multiple" && state.config.allowDuplicates);

    if (state.config.mode === "multiple" && state.config.sortResults) {
      results.sort((a, b) => a - b);
    }

    state.session.isGenerating = true;
    setMessage("Generating...", "info");
    renderButtons();
    runGenerationAnimation(bounds.min, bounds.max, count, results);
  }

  function runGenerationAnimation(min, max, count, finalResults) {
    const duration = 800 + getRandomInt(401);
    const interval = 70;
    const startedAt = performance.now();

    elements.resultPanel.dataset.state = "drawing";

    const tick = () => {
      const previewResults = generateRandomValues(min, max, count, true);
      renderCurrentResult(previewResults, { preview: true });

      if (performance.now() - startedAt >= duration) {
        clearInterval(state.session.previewTimer);
        finalizeDraw(finalResults);
      }
    };

    tick();
    state.session.previewTimer = window.setInterval(tick, interval);
  }

  function finalizeDraw(values) {
    clearInterval(state.session.previewTimer);
    state.session.isGenerating = false;
    state.session.currentValues = values.slice();

    state.session.history.push({
      order: state.session.history.length + 1,
      values: values.slice()
    });
    state.session.history = state.session.history.slice(-HISTORY_LIMIT);

    renderAll();
    flashResultPanel();
    setMessage(
      values.length === 1
        ? `Random number generated fairly: ${formatNumber(values[0])}.`
        : `${values.length} random numbers generated fairly.`,
      "success"
    );
    saveState();
  }

  function generateRandomValues(min, max, count, allowDuplicates) {
    if (allowDuplicates) {
      return Array.from({ length: count }, () => getRandomIntInclusive(min, max));
    }

    const pool = new Set();
    while (pool.size < count) {
      pool.add(getRandomIntInclusive(min, max));
    }
    return Array.from(pool);
  }

  function flashResultPanel() {
    elements.resultPanel.classList.remove("is-highlight");
    void elements.resultPanel.offsetWidth;
    elements.resultPanel.classList.add("is-highlight");
  }

  function resetGenerator() {
    if (state.session.isGenerating) return;
    state.config = getDefaultConfig();
    state.session.history = [];
    state.session.currentValues = [];
    state.session.message = {
      tone: "info",
      text: "Generator reset to the default range."
    };
    syncFormFromState();
    renderAll();
    saveState();
  }

  function clearHistory() {
    if (state.session.isGenerating) return;
    state.session.history = [];
    renderAll();
    saveState();
    setMessage("History cleared.", "info");
  }

  function renderCurrentResult(values, { preview = false } = {}) {
    const hasValues = Array.isArray(values) && values.length > 0;
    elements.resultPanel.dataset.state = preview ? "drawing" : "idle";

    if (!hasValues) {
      elements.resultLabel.textContent = state.config.mode === "single" ? "Result" : "Numbers Generated";
      elements.resultValue.textContent = "Ready to generate";
      elements.resultMeta.textContent = "Selected randomly";
      elements.resultList.hidden = true;
      elements.resultList.replaceChildren();
      return;
    }

    if (values.length === 1) {
      elements.resultLabel.textContent = "Result";
      elements.resultValue.textContent = formatNumber(values[0]);
      elements.resultMeta.textContent = preview ? "Generating..." : "Selected randomly";
      elements.resultList.hidden = true;
      elements.resultList.replaceChildren();
      return;
    }

    elements.resultLabel.textContent = "Numbers Generated";
    elements.resultValue.textContent = values.map((value) => formatNumber(value)).join(", ");
    elements.resultMeta.textContent = preview
      ? "Generating from the selected range..."
      : state.config.sortResults
        ? "Sorted from low to high"
        : "Selected randomly";

    const fragment = document.createDocumentFragment();
    values.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = formatNumber(value);
      fragment.append(item);
    });
    elements.resultList.replaceChildren(fragment);
    elements.resultList.hidden = false;
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
      title.textContent = formatHistoryValues(entry.values);
      meta.textContent = `Draw #${entry.order}`;

      wrapper.append(title, meta);
      item.append(wrapper);
      fragment.append(item);
    });

    elements.historyList.replaceChildren(fragment);
  }

  function renderStats() {
    const bounds = getBounds();
    const generatedTotal = state.session.history.reduce((sum, entry) => sum + entry.values.length, 0);

    elements.generatedTotal.textContent = formatNumber(generatedTotal);
    elements.rangeSize.textContent = bounds.valid ? formatNumber(bounds.rangeSize) : "0";
    elements.modeLabel.textContent = state.config.mode === "single" ? "Single Number" : "Multiple Numbers";
  }

  function renderButtons() {
    const disabled = Boolean(getValidationMessage());
    elements.generateButton.disabled = disabled;
    elements.generateButton.textContent = state.session.isGenerating
      ? "Generating..."
      : state.config.mode === "single"
        ? "Generate Number"
        : "Generate Numbers";
    elements.generateButton.dataset.spinState = state.session.isGenerating ? "spinning" : "idle";

    elements.resetButton.disabled = state.session.isGenerating;
    elements.shareButton.disabled = state.session.isGenerating;
    elements.clearHistoryButton.disabled = state.session.isGenerating || state.session.history.length === 0;
  }

  function renderActionHelper() {
    elements.actionHelper.textContent = state.config.mode === "single"
      ? "Single Number mode picks one fair result from the current range."
      : "Multiple Numbers mode draws a set of values using your count and duplicate rules.";
  }

  function renderMessage() {
    elements.message.textContent = state.session.message.text;
    elements.message.dataset.tone = state.session.message.tone;
  }

  function setMessage(text, tone) {
    state.session.message = { text, tone };
    renderMessage();
  }

  function renderAll() {
    syncFormFromState();
    syncCount();
    renderTabs();
    renderRangeHint();
    renderCountHint();
    renderStats();
    renderActionHelper();
    renderCurrentResult(state.session.currentValues);
    renderHistory();
    renderButtons();
    renderMessage();
  }

  function formatHistoryValues(values) {
    if (values.length <= 5) {
      return values.map((value) => formatNumber(value)).join(", ");
    }
    const preview = values.slice(0, 5).map((value) => formatNumber(value)).join(", ");
    return `${preview}, ...`;
  }

  function formatNumber(value) {
    return Number(value).toLocaleString("en-US");
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

  function getRandomIntInclusive(min, max) {
    return min + getRandomInt(max - min + 1);
  }
})();
