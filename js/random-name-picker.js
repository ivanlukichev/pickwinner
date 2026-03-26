(function () {
  const page = document.querySelector(".name-picker-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.randomNamePicker.v1";
  const SHARE_PARAM = "picker";
  const NAME_MAX_LENGTH = 80;
  const MAX_NAMES = 1000;
  const MAX_WINNERS_PER_DRAW = 100;
  const HISTORY_LIMIT = 30;
  const SHUFFLE_FEEDBACK_DURATION = 420;
  const DEFAULT_NAMES = [
    "John",
    "Emma",
    "Michael",
    "Sophia",
    "Daniel"
  ];
  const sharedConfig = loadConfigFromUrl();

  const elements = {
    nameInput: document.querySelector("[data-name-input]"),
    nameInputHint: document.querySelector("[data-name-input-hint]"),
    winnerCount: document.querySelector("[data-winner-count]"),
    winnerCountHint: document.querySelector("[data-winner-count-hint]"),
    removeAfterDraw: document.querySelector("[data-remove-after-draw]"),
    allowDuplicates: document.querySelector("[data-allow-duplicates]"),
    pickButtons: document.querySelectorAll("[data-pick-button]"),
    shuffleButton: document.querySelector("[data-shuffle-button]"),
    resetButton: document.querySelector("[data-reset-button]"),
    shareButton: document.querySelector("[data-share-button]"),
    clearHistoryButton: document.querySelector("[data-clear-history-button]"),
    totalNames: document.querySelector("[data-total-names]"),
    availableCount: document.querySelector("[data-available-count]"),
    pickedCount: document.querySelector("[data-picked-count]"),
    resultPanel: document.querySelector("[data-result-panel]"),
    resultLabel: document.querySelector("[data-result-label]"),
    resultWinner: document.querySelector("[data-result-winner]"),
    resultMeta: document.querySelector("[data-result-meta]"),
    resultList: document.querySelector("[data-result-list]"),
    historyList: document.querySelector("[data-history-list]"),
    historyEmpty: document.querySelector("[data-history-empty]"),
    historyHint: document.querySelector("[data-history-hint]"),
    message: document.querySelector("[data-message]")
  };

  const state = {
    config: sharedConfig ? normalizeConfig(sharedConfig) : loadInitialConfig(),
    session: {
      history: [],
      currentWinners: [],
      isPicking: false,
      previewTimer: 0,
      message: {
        tone: "info",
        text: "Paste at least one name and press Draw Winners."
      }
    }
  };

  restoreSession();
  bindEvents();
  syncFormFromState();
  renderAll();
  saveState();

  function bindEvents() {
    elements.nameInput.addEventListener("input", handleNameInput);
    elements.winnerCount.addEventListener("input", handleSettingInput);
    elements.winnerCount.addEventListener("change", handleSettingChange);
    elements.removeAfterDraw.addEventListener("change", handleSettingChange);
    elements.allowDuplicates.addEventListener("change", handleSettingChange);
    elements.pickButtons.forEach((button) => button.addEventListener("click", startPick));
    elements.shuffleButton.addEventListener("click", shuffleNames);
    elements.resetButton.addEventListener("click", resetList);
    elements.shareButton.addEventListener("click", copyShareLink);
    elements.clearHistoryButton.addEventListener("click", clearHistory);
  }

  function getDefaultConfig() {
    return {
      rawNamesText: DEFAULT_NAMES.join("\n"),
      winnersPerDraw: 1,
      removeAfterDraw: false,
      allowDuplicateNames: true
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
      console.warn("Unable to read local random-name-picker config.", error);
    }

    return getDefaultConfig();
  }

  function restoreSession() {
    if (sharedConfig) return;

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!parsed || !Array.isArray(parsed.history)) return;

      state.session.history = parsed.history
        .map((item) => ({
          order: clampNumber(item.order, 1, 9999, 1),
          name: normalizeName(item.name)
        }))
        .filter((item) => item.name)
        .slice(-HISTORY_LIMIT);

      state.session.currentWinners = Array.isArray(parsed.currentWinners)
        ? parsed.currentWinners.map((name) => normalizeName(name)).filter(Boolean)
        : [];
    } catch (error) {
      console.warn("Unable to restore random-name-picker session.", error);
    }
  }

  function normalizeConfig(input) {
    const base = getDefaultConfig();
    const source = input && typeof input === "object" ? input : {};

    return {
      rawNamesText: normalizeNamesText(source.rawNamesText ?? source.t ?? base.rawNamesText),
      winnersPerDraw: clampNumber(source.winnersPerDraw ?? source.w ?? base.winnersPerDraw, 1, MAX_WINNERS_PER_DRAW, base.winnersPerDraw),
      removeAfterDraw: toBoolean(source.removeAfterDraw ?? source.r, base.removeAfterDraw),
      allowDuplicateNames: toBoolean(source.allowDuplicateNames ?? source.d, base.allowDuplicateNames)
    };
  }

  function normalizeName(value) {
    return String(value || "").trim().slice(0, NAME_MAX_LENGTH);
  }

  function normalizeNamesText(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => normalizeName(line))
      .filter((line, index, lines) => line || index < lines.length - 1)
      .join("\n");
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
    const encoded = params.get(SHARE_PARAM);
    if (!encoded) return null;

    try {
      return JSON.parse(decodeBase64Url(encoded));
    } catch (error) {
      console.warn("Unable to decode shared random-name-picker config.", error);
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

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        config: state.config,
        history: state.session.history,
        currentWinners: state.session.currentWinners
      }));
    } catch (error) {
      console.warn("Unable to save random-name-picker state.", error);
    }
  }

  function syncFormFromState() {
    elements.nameInput.value = state.config.rawNamesText;
    elements.winnerCount.value = state.config.winnersPerDraw;
    elements.removeAfterDraw.checked = state.config.removeAfterDraw;
    elements.allowDuplicates.checked = state.config.allowDuplicateNames;
  }

  function getParsedNames() {
    const lines = state.config.rawNamesText
      .split(/\r?\n/)
      .map((line) => normalizeName(line))
      .filter(Boolean);

    if (state.config.allowDuplicateNames) {
      return lines;
    }

    const seen = new Set();
    return lines.filter((name) => {
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }

  function getWinnerCountLimit() {
    return Math.max(1, Math.min(MAX_WINNERS_PER_DRAW, getParsedNames().length || 1));
  }

  function syncWinnerCount() {
    const maxAllowed = getWinnerCountLimit();
    const nextValue = clampNumber(state.config.winnersPerDraw, 1, maxAllowed, 1);
    state.config.winnersPerDraw = nextValue;
    elements.winnerCount.max = String(maxAllowed);
    elements.winnerCount.value = String(nextValue);
    return { maxAllowed, value: nextValue };
  }

  function renderWinnerCountHint() {
    const maxAllowed = getWinnerCountLimit();
    const requestedValue = Number.parseInt(elements.winnerCount.value, 10);
    const isOverLimit = !Number.isNaN(requestedValue) && requestedValue > maxAllowed;

    elements.winnerCount.classList.toggle("is-invalid", isOverLimit);
    elements.winnerCount.setAttribute("aria-invalid", isOverLimit ? "true" : "false");

    if (isOverLimit) {
      if (maxAllowed === MAX_WINNERS_PER_DRAW) {
        elements.winnerCountHint.textContent = `You can draw up to ${MAX_WINNERS_PER_DRAW} winners at a time.`;
      } else {
        elements.winnerCountHint.textContent = `Only ${maxAllowed} name${maxAllowed === 1 ? "" : "s"} available right now.`;
      }
      elements.winnerCountHint.classList.add("is-warning");
      return;
    }

    elements.winnerCountHint.textContent = `You can draw up to ${maxAllowed} winner${maxAllowed === 1 ? "" : "s"} from the current list.`;
    elements.winnerCountHint.classList.remove("is-warning");
  }

  function renderNameInputHint() {
    const cleanedNamesCount = state.config.rawNamesText
      .split(/\r?\n/)
      .map((line) => normalizeName(line))
      .filter(Boolean)
      .length;
    const isOverLimit = cleanedNamesCount > MAX_NAMES;

    elements.nameInput.classList.toggle("is-invalid", isOverLimit);
    elements.nameInput.setAttribute("aria-invalid", isOverLimit ? "true" : "false");

    if (isOverLimit) {
      elements.nameInputHint.textContent = `You can enter up to ${MAX_NAMES} names. Remove a few entries before drawing.`;
      elements.nameInputHint.classList.add("is-warning");
      return;
    }

    elements.nameInputHint.textContent = "Paste names, one per line. The random name picker will choose fairly from your list.";
    elements.nameInputHint.classList.remove("is-warning");
  }

  function handleNameInput(event) {
    state.config.rawNamesText = normalizeNamesText(event.target.value);
    if (event.target.value !== state.config.rawNamesText) {
      event.target.value = state.config.rawNamesText;
    }
    syncWinnerCount();
    saveState();
    renderAll();
  }

  function handleSettingInput() {
    renderWinnerCountHint();
  }

  function handleSettingChange() {
    const requestedWinnerCount = Number.parseInt(elements.winnerCount.value, 10);
    state.config.winnersPerDraw = clampNumber(elements.winnerCount.value, 1, MAX_WINNERS_PER_DRAW, state.config.winnersPerDraw);
    state.config.removeAfterDraw = elements.removeAfterDraw.checked;
    state.config.allowDuplicateNames = elements.allowDuplicates.checked;
    const { maxAllowed, value } = syncWinnerCount();
    saveState();
    renderAll();

    if (!Number.isNaN(requestedWinnerCount) && requestedWinnerCount > maxAllowed) {
      setMessage(`Winner count adjusted to ${maxAllowed} to match the current list.`, "info");
    }
  }

  function buildShareUrl() {
    const payload = encodeBase64Url(JSON.stringify({
      t: state.config.rawNamesText,
      w: state.config.winnersPerDraw,
      r: state.config.removeAfterDraw ? 1 : 0,
      d: state.config.allowDuplicateNames ? 1 : 0
    }));

    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set(SHARE_PARAM, payload);
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

  function setMessage(text, tone) {
    state.session.message = { text, tone };
    renderMessage();
  }

  function renderMessage() {
    elements.message.textContent = state.session.message.text;
    elements.message.dataset.tone = state.session.message.tone;
  }

  function getValidationMessage() {
    if (state.session.isPicking) {
      return "A draw is already in progress.";
    }

    if (state.config.rawNamesText
      .split(/\r?\n/)
      .map((line) => normalizeName(line))
      .filter(Boolean)
      .length > MAX_NAMES) {
      return `You can enter up to ${MAX_NAMES} names.`;
    }

    if (getParsedNames().length === 0) {
      return "Please enter at least one name.";
    }

    return "";
  }

  function sampleUniqueItems(list, count) {
    const pool = list.slice();
    for (let index = pool.length - 1; index > 0; index -= 1) {
      const swapIndex = getRandomInt(index + 1);
      [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
    }
    return pool.slice(0, count);
  }

  function startPick() {
    const validationMessage = getValidationMessage();
    if (validationMessage) {
      setMessage(validationMessage, "error");
      renderAll();
      return;
    }

    const names = getParsedNames();
    const winnersCount = Math.min(state.config.winnersPerDraw, names.length);
    const winners = sampleUniqueItems(names, winnersCount);

    state.session.isPicking = true;
    setMessage("Drawing...", "info");
    renderButtons();
    runDrawAnimation(names, winners);
  }

  function runDrawAnimation(names, winners) {
    const duration = 1050 + getRandomInt(400);
    const interval = 90;
    const startedAt = performance.now();

    elements.resultPanel.dataset.state = "drawing";
    elements.resultLabel.textContent = "LATEST WINNER";
    elements.resultList.hidden = true;
    elements.resultList.replaceChildren();

    const tick = () => {
      const preview = sampleUniqueItems(names, Math.min(Math.max(1, state.config.winnersPerDraw), names.length));
      renderCurrentResult(preview, { preview: true });

      if (performance.now() - startedAt >= duration) {
        clearInterval(state.session.previewTimer);
        finalizeDraw(winners);
      }
    };

    tick();
    state.session.previewTimer = window.setInterval(tick, interval);
  }

  function finalizeDraw(winners) {
    clearInterval(state.session.previewTimer);
    state.session.isPicking = false;
    state.session.currentWinners = winners.slice();

    winners.forEach((name) => {
      state.session.history.push({
        order: state.session.history.length + 1,
        name
      });
    });
    state.session.history = state.session.history.slice(-HISTORY_LIMIT);

    if (state.config.removeAfterDraw) {
      const remainingNames = getParsedNames();
      winners.forEach((winner) => {
        const index = remainingNames.indexOf(winner);
        if (index >= 0) {
          remainingNames.splice(index, 1);
        }
      });
      state.config.rawNamesText = remainingNames.join("\n");
      syncWinnerCount();
    }

    renderAll();
    flashResultPanel();
    setMessage(
      winners.length === 1
        ? `Winner selected fairly: ${winners[0]}.`
        : `${winners.length} winners selected fairly.`,
      "success"
    );
    saveState();
  }

  function flashResultPanel() {
    elements.resultPanel.classList.remove("is-highlight");
    void elements.resultPanel.offsetWidth;
    elements.resultPanel.classList.add("is-highlight");
  }

  function shuffleNames() {
    if (state.session.isPicking) return;
    const names = getParsedNames();
    if (names.length === 0) {
      setMessage("Please enter at least one name.", "error");
      return;
    }

    const shuffled = sampleUniqueItems(names, names.length);
    state.config.rawNamesText = shuffled.join("\n");
    syncWinnerCount();
    renderAll();
    triggerShuffleFeedback(elements.nameInput);
    saveState();
    setMessage("Names shuffled.", "success");
  }

  function resetList() {
    if (state.session.isPicking) return;
    state.config.rawNamesText = "";
    state.config.winnersPerDraw = 1;
    state.session.history = [];
    state.session.currentWinners = [];
    state.session.message = {
      tone: "info",
      text: "Name list and history cleared."
    };
    syncFormFromState();
    renderAll();
    saveState();
  }

  function clearHistory() {
    if (state.session.isPicking) return;
    state.session.history = [];
    renderAll();
    saveState();
    setMessage("History cleared.", "info");
  }

  function renderCurrentResult(winners, { preview = false } = {}) {
    const hasWinners = Array.isArray(winners) && winners.length > 0;
    elements.resultPanel.dataset.state = preview ? "drawing" : "idle";

    if (!hasWinners) {
      elements.resultLabel.textContent = "LATEST WINNER";
      elements.resultWinner.textContent = "Ready to pick";
      elements.resultMeta.textContent = "Selected randomly";
      elements.resultList.hidden = true;
      elements.resultList.replaceChildren();
      return;
    }

    elements.resultLabel.textContent = "LATEST WINNER";

    if (winners.length === 1) {
      elements.resultWinner.textContent = winners[0];
      elements.resultMeta.textContent = preview ? "Drawing..." : "Selected randomly";
      elements.resultList.hidden = true;
      elements.resultList.replaceChildren();
      return;
    }

    elements.resultWinner.textContent = preview ? "Drawing winners..." : `${winners.length} winners selected`;
    elements.resultMeta.textContent = preview ? "Selecting randomly..." : "Selected randomly";

    const fragment = document.createDocumentFragment();
    winners.forEach((winner) => {
      const item = document.createElement("li");
      item.textContent = winner;
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
      title.textContent = entry.name;
      meta.textContent = `Draw #${entry.order}`;

      wrapper.append(title, meta);
      item.append(wrapper);
      fragment.append(item);
    });

    elements.historyList.replaceChildren(fragment);
  }

  function renderStats() {
    const parsedNames = getParsedNames();
    elements.totalNames.textContent = String(parsedNames.length);
    elements.availableCount.textContent = String(parsedNames.length);
    elements.pickedCount.textContent = String(state.session.history.length);
  }

  function renderButtons() {
    const parsedNames = getParsedNames();
    const disableWhilePicking = state.session.isPicking;
    const hasHistory = state.session.history.length > 0;
    elements.pickButtons.forEach((button) => {
      button.disabled = Boolean(getValidationMessage());
      button.textContent = state.session.isPicking ? "Drawing..." : "Draw Winners";
      button.dataset.spinState = state.session.isPicking ? "spinning" : "idle";
    });

    elements.shuffleButton.disabled = disableWhilePicking || parsedNames.length < 2;
    elements.resetButton.disabled = disableWhilePicking;
    elements.shareButton.disabled = disableWhilePicking;
    elements.clearHistoryButton.disabled = disableWhilePicking || !hasHistory;
  }

  function renderAll() {
    syncFormFromState();
    syncWinnerCount();
    renderWinnerCountHint();
    renderNameInputHint();
    renderStats();
    renderCurrentResult(state.session.currentWinners);
    renderHistory();
    renderButtons();
    renderMessage();
  }

  function triggerShuffleFeedback(target) {
    if (!target) return;
    target.classList.remove("shuffle-feedback-field", "is-shuffling");
    void target.offsetWidth;
    target.classList.add("shuffle-feedback-field", "is-shuffling");
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
