(function () {
  const page = document.querySelector(".coin-flip-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.coinFlip.v1";
  const HISTORY_LIMIT = 30;

  const elements = {
    flipButton: document.querySelector("[data-flip-button]"),
    resetButton: document.querySelector("[data-reset-button]"),
    shareButton: document.querySelector("[data-share-button]"),
    clearHistoryButton: document.querySelector("[data-clear-history-button]"),
    coinTrigger: document.querySelector("[data-coin-trigger]"),
    coinStage: document.querySelector("[data-coin-stage]"),
    coinInner: document.querySelector("[data-coin-inner]"),
    flipCountStat: document.querySelector("[data-flip-count-stat]"),
    headsCountStat: document.querySelector("[data-heads-count-stat]"),
    tailsCountStat: document.querySelector("[data-tails-count-stat]"),
    resultPanel: document.querySelector("[data-result-panel]"),
    resultBadge: document.querySelector("[data-result-badge]"),
    resultTitle: document.querySelector("[data-result-title]"),
    resultMeta: document.querySelector("[data-result-meta]"),
    latestPanel: document.querySelector("[data-latest-panel]"),
    latestTitle: document.querySelector("[data-latest-title]"),
    latestMeta: document.querySelector("[data-latest-meta]"),
    historyList: document.querySelector("[data-history-list]"),
    historyEmpty: document.querySelector("[data-history-empty]"),
    historyHint: document.querySelector("[data-history-hint]"),
    message: document.querySelector("[data-message]")
  };

  const state = {
    session: loadInitialSession()
  };

  bindEvents();
  renderAll();
  saveState();

  function bindEvents() {
    elements.flipButton.addEventListener("click", startFlip);
    elements.coinTrigger.addEventListener("click", startFlip);
    elements.resetButton.addEventListener("click", resetTool);
    elements.shareButton.addEventListener("click", copyShareLink);
    elements.clearHistoryButton.addEventListener("click", clearHistory);
  }

  function getDefaultSession() {
    return {
      history: [],
      currentResult: "",
      displayResult: "Heads",
      flipCount: 0,
      headsCount: 0,
      tailsCount: 0,
      isFlipping: false,
      currentRotation: 0,
      animationFrame: 0,
      message: {
        tone: "info",
        text: "Flip the coin to reveal a fair heads or tails result."
      }
    };
  }

  function loadInitialSession() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return getDefaultSession();
      const parsed = JSON.parse(stored);
      return normalizeSession(parsed);
    } catch (error) {
      console.warn("Unable to restore local coin-flip state.", error);
      return getDefaultSession();
    }
  }

  function normalizeSession(input) {
    const base = getDefaultSession();
    const source = input && typeof input === "object" ? input : {};
    const history = Array.isArray(source.history)
      ? source.history
        .map(normalizeHistoryEntry)
        .filter((entry) => entry.result)
        .slice(0, HISTORY_LIMIT)
      : [];

    const currentResult = normalizeResult(source.currentResult);
    const counts = countResults(history);

    return {
      history,
      currentResult,
      displayResult: currentResult || "Heads",
      flipCount: clampNumber(source.flipCount, 0, 999999, history.length),
      headsCount: clampNumber(source.headsCount, 0, 999999, counts.heads),
      tailsCount: clampNumber(source.tailsCount, 0, 999999, counts.tails),
      isFlipping: false,
      currentRotation: Number.isFinite(source.currentRotation) ? source.currentRotation : 0,
      animationFrame: 0,
      message: base.message
    };
  }

  function normalizeHistoryEntry(entry) {
    if (typeof entry === "string") {
      return {
        result: normalizeResult(entry),
        order: 0
      };
    }

    return {
      result: normalizeResult(entry?.result),
      order: clampNumber(entry?.order, 0, 999999, 0)
    };
  }

  function normalizeResult(value) {
    if (value === "Heads" || value === "Tails") return value;
    return "";
  }

  function clampNumber(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  }

  function countResults(results) {
    return results.reduce((counts, result) => {
      if (result.result === "Heads") counts.heads += 1;
      if (result.result === "Tails") counts.tails += 1;
      return counts;
    }, { heads: 0, tails: 0 });
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        history: state.session.history,
        currentResult: state.session.currentResult,
        flipCount: state.session.flipCount,
        headsCount: state.session.headsCount,
        tailsCount: state.session.tailsCount,
        currentRotation: state.session.currentRotation
      }));
    } catch (error) {
      console.warn("Unable to save coin-flip state.", error);
    }
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

  function easeOutCubic(value) {
    return 1 - Math.pow(1 - value, 3);
  }

  function modulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function getFairResult() {
    return getRandomInt(2) === 0 ? "Heads" : "Tails";
  }

  function getTargetRotation(result) {
    const desiredNormalized = result === "Heads" ? 0 : 180;
    const currentNormalized = modulo(state.session.currentRotation, 360);
    const fullTurns = 5 + getRandomInt(3);
    const extra = modulo(desiredNormalized - currentNormalized, 360);
    return state.session.currentRotation + fullTurns * 360 + extra;
  }

  function startFlip() {
    if (state.session.isFlipping) return;

    const result = getFairResult();
    const targetRotation = getTargetRotation(result);
    const duration = 1150 + getRandomInt(250);
    const startedAt = performance.now();
    const startingSide = state.session.currentResult || state.session.displayResult || "Heads";
    const sideChanges = 7 + getRandomInt(4);

    state.session.isFlipping = true;
    setMessage("Flipping the coin...", "info");
    renderAll();

    animateFlip({
      from: state.session.currentRotation,
      to: targetRotation,
      duration,
      result,
      startingSide,
      sideChanges,
      onComplete: () => {
        state.session.currentRotation = targetRotation;
        state.session.isFlipping = false;
        finalizeFlip(result, startedAt);
      }
    });
  }

  function animateFlip({ from, to, duration, result, startingSide, sideChanges, onComplete }) {
    const startTime = performance.now();
    let lastPhase = -1;

    const frame = (timestamp) => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const phase = Math.min(sideChanges, Math.floor(progress * (sideChanges + 1)));

      state.session.currentRotation = from + (to - from) * eased;
      if (phase !== lastPhase) {
        lastPhase = phase;
        if (phase >= sideChanges) {
          state.session.displayResult = result;
        } else {
          state.session.displayResult = phase % 2 === 0
            ? startingSide
            : startingSide === "Heads" ? "Tails" : "Heads";
        }
      }
      renderCoin();

      if (progress < 1) {
        state.session.animationFrame = requestAnimationFrame(frame);
        return;
      }

      state.session.currentRotation = modulo(to, 360);
      onComplete();
    };

    cancelAnimationFrame(state.session.animationFrame);
    state.session.animationFrame = requestAnimationFrame(frame);
  }

  function finalizeFlip(result, startedAt) {
    state.session.currentResult = result;
    state.session.displayResult = result;
    state.session.history.unshift({
      result,
      order: state.session.flipCount + 1
    });
    state.session.history = state.session.history.slice(0, HISTORY_LIMIT);
    state.session.flipCount += 1;
    if (result === "Heads") state.session.headsCount += 1;
    if (result === "Tails") state.session.tailsCount += 1;

    saveState();
    renderAll();
    setMessage(`${result} selected randomly in ${Math.max(1, Math.round((performance.now() - startedAt) / 100) / 10)}s.`, "success");
  }

  async function copyShareLink() {
    const shareUrl = new URL(window.location.href);
    shareUrl.search = "";
    shareUrl.hash = "";

    try {
      await navigator.clipboard.writeText(shareUrl.toString());
      setMessage("Shareable link copied.", "success");
    } catch (error) {
      window.prompt("Copy this shareable link:", shareUrl.toString());
      setMessage("Shareable link ready to copy.", "info");
    }
  }

  function clearHistory() {
    state.session.history = [];
    state.session.currentResult = "";
    state.session.flipCount = 0;
    state.session.headsCount = 0;
    state.session.tailsCount = 0;
    saveState();
    renderAll();
    setMessage("Flip history cleared.", "info");
  }

  function resetTool() {
    cancelAnimationFrame(state.session.animationFrame);
    state.session = getDefaultSession();
    saveState();
    renderAll();
    setMessage("Coin flip reset.", "info");
  }

  function renderAll() {
    renderButtons();
    renderStats();
    renderCoin();
    renderResult();
    renderLatest();
    renderHistory();
    renderMessage();
  }

  function renderButtons() {
    const disableWhileFlipping = state.session.isFlipping;
    const hasSessionState = state.session.history.length > 0 || Boolean(state.session.currentResult);

    elements.flipButton.disabled = disableWhileFlipping;
    elements.flipButton.textContent = disableWhileFlipping ? "Flipping..." : "Flip Coin";
    elements.coinTrigger.disabled = disableWhileFlipping;
    elements.resetButton.disabled = disableWhileFlipping || !hasSessionState;
    elements.shareButton.disabled = disableWhileFlipping;
    elements.clearHistoryButton.disabled = disableWhileFlipping || state.session.history.length === 0;
  }

  function renderStats() {
    elements.flipCountStat.textContent = String(state.session.flipCount);
    elements.headsCountStat.textContent = String(state.session.headsCount);
    elements.tailsCountStat.textContent = String(state.session.tailsCount);
  }

  function renderCoin() {
    elements.coinStage.classList.toggle("is-flipping", state.session.isFlipping);
    elements.coinStage.dataset.side = (state.session.displayResult || state.session.currentResult || "Heads").toLowerCase();
    elements.coinInner.style.transform = state.session.isFlipping
      ? `rotateY(${state.session.currentRotation}deg)`
      : "none";
  }

  function renderResult() {
    const result = state.session.currentResult;
    elements.resultPanel.dataset.result = result ? result.toLowerCase() : "idle";

    if (!result) {
      elements.resultBadge.textContent = "Result";
      elements.resultTitle.textContent = "Ready to flip";
      elements.resultMeta.textContent = "Flip the coin to reveal a fair heads or tails result.";
      return;
    }

    elements.resultBadge.textContent = result.toUpperCase();
    elements.resultTitle.textContent = result;
    elements.resultMeta.textContent = "Selected randomly";
  }

  function renderLatest() {
    const result = state.session.currentResult;
    elements.latestPanel.dataset.result = result ? result.toLowerCase() : "idle";

    if (!result) {
      elements.latestTitle.textContent = "Ready to flip";
      elements.latestMeta.textContent = "Flip the coin to see result.";
      return;
    }

    elements.latestTitle.textContent = result;
    elements.latestMeta.textContent = "Selected randomly";
  }

  function renderHistory() {
    if (!state.session.history.length) {
      elements.historyEmpty.hidden = false;
      elements.historyHint.hidden = false;
      elements.historyList.hidden = true;
      elements.historyList.replaceChildren();
      return;
    }

    elements.historyEmpty.hidden = true;
    elements.historyHint.hidden = true;
    elements.historyList.hidden = false;

    const fragment = document.createDocumentFragment();

    state.session.history.forEach((historyEntry, index) => {
      const item = document.createElement("li");
      const wrapper = document.createElement("div");
      const title = document.createElement("strong");
      const meta = document.createElement("span");

      wrapper.className = "spin-history__entry";
      title.textContent = historyEntry.result;
      meta.textContent = historyEntry.order ? `Flip #${historyEntry.order}` : `Flip #${state.session.flipCount - index}`;

      wrapper.append(title, meta);
      item.append(wrapper);
      fragment.append(item);
    });

    elements.historyList.replaceChildren(fragment);
  }

  function setMessage(text, tone) {
    state.session.message = { text, tone };
    renderMessage();
  }

  function renderMessage() {
    elements.message.textContent = state.session.message.text;
    elements.message.dataset.tone = state.session.message.tone;
  }
})();
