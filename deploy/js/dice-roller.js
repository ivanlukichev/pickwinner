(function () {
  const page = document.querySelector(".dice-roller-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.diceRoller.v1";
  const HISTORY_LIMIT = 30;
  const DICE_TYPES = {
    d4: 4,
    d6: 6,
    d8: 8,
    d10: 10,
    d12: 12,
    d20: 20
  };
  const DEFAULT_CONFIG = {
    count: 1,
    type: "d6",
    showTotal: true,
    sortResults: false
  };
  const sharedConfig = loadConfigFromUrl();

  const elements = {
    countInput: document.querySelector("[data-dice-count]"),
    typeInput: document.querySelector("[data-dice-type]"),
    showTotal: document.querySelector("[data-show-total]"),
    sortResults: document.querySelector("[data-sort-results]"),
    presetButtons: document.querySelectorAll("[data-preset-count][data-preset-type]"),
    rollButton: document.querySelector("[data-roll-button]"),
    resetButton: document.querySelector("[data-reset-button]"),
    shareButton: document.querySelector("[data-share-button]"),
    clearHistoryButton: document.querySelector("[data-clear-history-button]"),
    diceCountStat: document.querySelector("[data-dice-count-stat]"),
    diceTypeStat: document.querySelector("[data-dice-type-stat]"),
    rollCountStat: document.querySelector("[data-roll-count-stat]"),
    diceDisplay: document.querySelector("[data-dice-display]"),
    resultPanel: document.querySelector("[data-result-panel]"),
    resultTitle: document.querySelector("[data-result-title]"),
    resultMeta: document.querySelector("[data-result-meta]"),
    resultList: document.querySelector("[data-result-list]"),
    latestPanel: document.querySelector("[data-latest-panel]"),
    latestLabel: document.querySelector("[data-latest-label]"),
    latestValues: document.querySelector("[data-latest-values]"),
    latestTotal: document.querySelector("[data-latest-total]"),
    historyList: document.querySelector("[data-history-list]"),
    historyEmpty: document.querySelector("[data-history-empty]"),
    historyHint: document.querySelector("[data-history-hint]"),
    message: document.querySelector("[data-message]")
  };

  const state = {
    config: sharedConfig ? normalizeConfig(sharedConfig) : loadInitialConfig(),
    session: {
      history: [],
      currentRoll: null,
      displayValues: [],
      rollCount: 0,
      isRolling: false,
      previewTimer: 0,
      completeTimer: 0,
      message: {
        tone: "info",
        text: "Choose a dice setup and press Roll Dice."
      }
    }
  };

  restoreSession();
  syncFormFromState();
  syncDisplayValues();
  bindEvents();
  renderAll();
  saveState();

  function bindEvents() {
    elements.countInput.addEventListener("change", handleConfigChange);
    elements.typeInput.addEventListener("change", handleConfigChange);
    elements.showTotal.addEventListener("change", handleConfigChange);
    elements.sortResults.addEventListener("change", handleConfigChange);
    elements.presetButtons.forEach((button) => button.addEventListener("click", () => applyPreset(button)));
    elements.rollButton.addEventListener("click", startRoll);
    elements.resetButton.addEventListener("click", resetRoller);
    elements.shareButton.addEventListener("click", copyShareLink);
    elements.clearHistoryButton.addEventListener("click", clearHistory);
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
      console.warn("Unable to read local dice-roller config.", error);
    }

    return { ...DEFAULT_CONFIG };
  }

  function restoreSession() {
    if (sharedConfig) return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || typeof parsed !== "object") return;

      state.session.rollCount = clampNumber(parsed.rollCount, 0, 9999, 0);
      state.session.history = Array.isArray(parsed.history)
        ? parsed.history.map(normalizeHistoryEntry).filter((entry) => entry.values.length).slice(0, HISTORY_LIMIT)
        : [];
      state.session.currentRoll = parsed.currentRoll ? normalizeHistoryEntry(parsed.currentRoll) : null;
    } catch (error) {
      console.warn("Unable to restore dice-roller session.", error);
    }
  }

  function normalizeConfig(input) {
    const source = input && typeof input === "object" ? input : {};
    const type = Object.prototype.hasOwnProperty.call(DICE_TYPES, source.type) ? source.type : DEFAULT_CONFIG.type;

    return {
      count: clampNumber(source.count, 1, 10, DEFAULT_CONFIG.count),
      type,
      showTotal: toBoolean(source.showTotal ?? source.total, DEFAULT_CONFIG.showTotal),
      sortResults: toBoolean(source.sortResults ?? source.sort, DEFAULT_CONFIG.sortResults)
    };
  }

  function normalizeHistoryEntry(entry) {
    return {
      notation: String(entry.notation || "").trim(),
      type: Object.prototype.hasOwnProperty.call(DICE_TYPES, entry.type) ? entry.type : "d6",
      values: Array.isArray(entry.values)
        ? entry.values
          .map((value) => Number.parseInt(value, 10))
          .filter((value) => Number.isInteger(value))
        : [],
      total: Number.isInteger(entry.total) ? entry.total : 0
    };
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

  function loadConfigFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("count") || !params.has("type")) return null;

    return {
      count: params.get("count"),
      type: params.get("type"),
      total: params.get("total"),
      sort: params.get("sort")
    };
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        config: state.config,
        history: state.session.history,
        currentRoll: state.session.currentRoll,
        rollCount: state.session.rollCount
      }));
    } catch (error) {
      console.warn("Unable to save dice-roller state.", error);
    }
  }

  function syncFormFromState() {
    elements.countInput.value = String(state.config.count);
    elements.typeInput.value = state.config.type;
    elements.showTotal.checked = state.config.showTotal;
    elements.sortResults.checked = state.config.sortResults;
  }

  function syncDisplayValues() {
    if (state.session.currentRoll && state.session.currentRoll.type === state.config.type && state.session.currentRoll.values.length === state.config.count) {
      state.session.displayValues = state.session.currentRoll.values.slice();
      return;
    }

    state.session.displayValues = Array.from({ length: state.config.count }, () => 1);
  }

  function handleConfigChange() {
    state.config.count = clampNumber(elements.countInput.value, 1, 10, state.config.count);
    state.config.type = Object.prototype.hasOwnProperty.call(DICE_TYPES, elements.typeInput.value) ? elements.typeInput.value : state.config.type;
    state.config.showTotal = elements.showTotal.checked;
    state.config.sortResults = elements.sortResults.checked;
    state.session.currentRoll = null;
    syncDisplayValues();
    saveState();
    renderAll();
  }

  function applyPreset(button) {
    state.config.count = clampNumber(button.dataset.presetCount, 1, 10, state.config.count);
    state.config.type = Object.prototype.hasOwnProperty.call(DICE_TYPES, button.dataset.presetType) ? button.dataset.presetType : state.config.type;
    state.session.currentRoll = null;
    syncFormFromState();
    syncDisplayValues();
    saveState();
    renderAll();
    setMessage(`Preset applied: ${state.config.count}x${state.config.type.toUpperCase()}.`, "info");
  }

  function buildShareUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("count", String(state.config.count));
    url.searchParams.set("type", state.config.type);
    url.searchParams.set("total", state.config.showTotal ? "1" : "0");
    url.searchParams.set("sort", state.config.sortResults ? "1" : "0");
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

  function clearHistory() {
    state.session.history = [];
    saveState();
    renderAll();
    setMessage("Roll history cleared.", "info");
  }

  function resetRoller() {
    window.clearInterval(state.session.previewTimer);
    window.clearTimeout(state.session.completeTimer);
    state.config = { ...DEFAULT_CONFIG };
    state.session.history = [];
    state.session.currentRoll = null;
    state.session.rollCount = 0;
    state.session.isRolling = false;
    syncFormFromState();
    syncDisplayValues();
    saveState();
    renderAll();
    setMessage("Dice roller reset.", "info");
  }

  function getNotation() {
    return `${state.config.count}x${state.config.type.toUpperCase()}`;
  }

  function getRandomValue() {
    return Math.floor(Math.random() * DICE_TYPES[state.config.type]) + 1;
  }

  function startRoll() {
    if (state.session.isRolling) return;

    state.session.isRolling = true;
    setMessage("Rolling virtual dice...", "info");
    renderAll();

    const finalValues = Array.from({ length: state.config.count }, () => getRandomValue());
    const startedAt = Date.now();

    window.clearInterval(state.session.previewTimer);
    state.session.previewTimer = window.setInterval(() => {
      state.session.displayValues = Array.from({ length: state.config.count }, () => getRandomValue());
      renderDice();
    }, 90);

    window.clearTimeout(state.session.completeTimer);
    state.session.completeTimer = window.setTimeout(() => {
      window.clearInterval(state.session.previewTimer);

      const settledValues = state.config.sortResults ? finalValues.slice().sort((a, b) => a - b) : finalValues.slice();
      const total = settledValues.reduce((sum, value) => sum + value, 0);
      const entry = {
        notation: getNotation(),
        type: state.config.type,
        values: settledValues,
        total
      };

      state.session.currentRoll = entry;
      state.session.displayValues = settledValues.slice();
      state.session.history.unshift(entry);
      state.session.history = state.session.history.slice(0, HISTORY_LIMIT);
      state.session.rollCount += 1;
      state.session.isRolling = false;
      saveState();
      renderAll();
      setMessage(`Roll complete in ${Math.max(1, Math.round((Date.now() - startedAt) / 100) / 10)}s.`, "success");
    }, 950);
  }

  function renderAll() {
    renderButtons();
    renderStats();
    renderDice();
    renderResult();
    renderLatest();
    renderHistory();
    renderMessage();
  }

  function renderButtons() {
    const disableWhileRolling = state.session.isRolling;

    elements.rollButton.disabled = disableWhileRolling;
    elements.rollButton.textContent = disableWhileRolling ? "Rolling..." : "Roll Dice";
    elements.resetButton.disabled = disableWhileRolling;
    elements.shareButton.disabled = disableWhileRolling;
    elements.clearHistoryButton.disabled = disableWhileRolling || state.session.history.length === 0;
    elements.countInput.disabled = disableWhileRolling;
    elements.typeInput.disabled = disableWhileRolling;
    elements.showTotal.disabled = disableWhileRolling;
    elements.sortResults.disabled = disableWhileRolling;
    elements.presetButtons.forEach((button) => {
      button.disabled = disableWhileRolling;
    });
  }

  function renderStats() {
    elements.diceCountStat.textContent = String(state.config.count);
    elements.diceTypeStat.textContent = state.config.type.toUpperCase();
    elements.rollCountStat.textContent = String(state.session.rollCount);
  }

  function renderDice() {
    elements.diceDisplay.textContent = "";
    const fragment = document.createDocumentFragment();
    const values = state.session.displayValues.length === state.config.count
      ? state.session.displayValues
      : Array.from({ length: state.config.count }, () => 1);

    values.forEach((value) => {
      const token = document.createElement("div");
      token.className = `dice-token dice-token--${state.config.type}`;
      if (state.session.isRolling) {
        token.classList.add("is-rolling");
      }

      if (state.config.type === "d6") {
        const face = createD6Face(value);
        const valueLabel = document.createElement("span");
        valueLabel.className = "dice-token__value";
        valueLabel.textContent = String(value);
        token.append(face, valueLabel);
      } else {
        const typeLabel = document.createElement("span");
        typeLabel.className = "dice-token__type";
        typeLabel.textContent = state.config.type.toUpperCase();

        const number = document.createElement("strong");
        number.className = "dice-token__value";
        number.textContent = String(value);
        token.append(typeLabel, number);
      }

      fragment.append(token);
    });

    elements.diceDisplay.append(fragment);
  }

  function createD6Face(value) {
    const visibleByValue = {
      1: [5],
      2: [1, 9],
      3: [1, 5, 9],
      4: [1, 3, 7, 9],
      5: [1, 3, 5, 7, 9],
      6: [1, 3, 4, 6, 7, 9]
    };

    const face = document.createElement("div");
    face.className = "dice-face";
    const visible = new Set(visibleByValue[value] || []);

    for (let index = 1; index <= 9; index += 1) {
      const pip = document.createElement("span");
      pip.className = "dice-face__pip";
      if (visible.has(index)) {
        pip.classList.add("is-visible");
      }
      face.append(pip);
    }

    return face;
  }

  function renderResult() {
    const roll = state.session.currentRoll;

    if (state.session.isRolling) {
      elements.resultPanel.dataset.state = "rolling";
      elements.resultTitle.textContent = "Rolling...";
      elements.resultMeta.textContent = `${getNotation()} in progress`;
      elements.resultList.hidden = true;
      return;
    }

    elements.resultPanel.dataset.state = "ready";

    if (!roll) {
      elements.resultTitle.textContent = "Ready to roll";
      elements.resultMeta.textContent = "Roll the current dice set to see the result.";
      elements.resultList.hidden = true;
      return;
    }

    if (roll.values.length === 1) {
      elements.resultTitle.textContent = `Final Roll: ${roll.values[0]}`;
    } else {
      elements.resultTitle.textContent = `Results: ${roll.values.join(", ")}`;
    }

    elements.resultMeta.textContent = state.config.showTotal
      ? `Total: ${roll.total}`
      : `${roll.notation} completed`;

    elements.resultList.textContent = "";
    roll.values.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = String(value);
      elements.resultList.append(item);
    });
    elements.resultList.hidden = false;
  }

  function renderLatest() {
    const roll = state.session.currentRoll;

    if (state.session.isRolling) {
      elements.latestPanel.dataset.state = "rolling";
      elements.latestLabel.textContent = "Rolling...";
      elements.latestValues.textContent = `${getNotation()} in progress`;
      elements.latestTotal.hidden = true;
      return;
    }

    elements.latestPanel.dataset.state = "ready";

    if (!roll) {
      elements.latestLabel.textContent = "Ready to roll";
      elements.latestValues.textContent = "Pick a dice setup and roll.";
      elements.latestTotal.hidden = true;
      return;
    }

    elements.latestLabel.textContent = roll.notation;
    elements.latestValues.textContent = roll.values.join(", ");
    if (state.config.showTotal) {
      elements.latestTotal.textContent = `Total: ${roll.total}`;
      elements.latestTotal.hidden = false;
    } else {
      elements.latestTotal.hidden = true;
    }
  }

  function renderHistory() {
    elements.historyList.textContent = "";

    if (!state.session.history.length) {
      elements.historyList.hidden = true;
      elements.historyEmpty.hidden = false;
      elements.historyHint.hidden = false;
      return;
    }

    state.session.history.forEach((entry) => {
      const item = document.createElement("li");
      const row = document.createElement("div");
      row.className = "spin-history__entry";

      const label = document.createElement("strong");
      label.textContent = entry.notation;

      const value = document.createElement("span");
      value.textContent = state.config.showTotal
        ? `-> ${entry.values.join(", ")} (Total: ${entry.total})`
        : `-> ${entry.values.join(", ")}`;

      row.append(label, value);
      item.append(row);
      elements.historyList.append(item);
    });

    elements.historyList.hidden = false;
    elements.historyEmpty.hidden = true;
    elements.historyHint.hidden = true;
  }

  function renderMessage() {
    elements.message.textContent = state.session.message.text;
    elements.message.dataset.tone = state.session.message.tone;
  }

  function setMessage(text, tone) {
    state.session.message = { text, tone };
    renderMessage();
  }
})();
