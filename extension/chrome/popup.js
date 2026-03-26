(function () {
  const STORAGE_KEY = "pickwinner.extension.coinFlip.lastResult";
  const FLIP_DURATION_MS = 1180;
  const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const elements = {
    stage: document.querySelector("[data-coin-stage]"),
    button: document.querySelector("[data-action-button]"),
    coinButton: document.querySelector("[data-flip-button]"),
    resultPanel: document.querySelector("[data-result-panel]"),
    resultText: document.querySelector("[data-result-text]"),
    resultMeta: document.querySelector("[data-result-meta]"),
    coinInner: document.querySelector("[data-coin-inner]")
  };

  if (!elements.stage || !elements.button || !elements.coinButton || !elements.resultPanel || !elements.resultText || !elements.resultMeta || !elements.coinInner) {
    return;
  }

  const state = {
    isFlipping: false,
    currentResult: loadStoredResult(),
    currentRotation: 0,
    animationFrame: 0
  };

  bindEvents();
  renderInitialState();

  function bindEvents() {
    elements.button.addEventListener("click", startFlip);
    elements.coinButton.addEventListener("click", startFlip);
  }

  function loadStoredResult() {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      return normalizeResult(stored);
    } catch (error) {
      return "";
    }
  }

  function storeResult(result) {
    try {
      window.localStorage.setItem(STORAGE_KEY, result);
    } catch (error) {
      return;
    }
  }

  function normalizeResult(value) {
    return value === "Heads" || value === "Tails" ? value : "";
  }

  function getRandomResult() {
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      window.crypto.getRandomValues(buffer);
      return buffer[0] % 2 === 0 ? "Heads" : "Tails";
    }

    return Math.random() < 0.5 ? "Heads" : "Tails";
  }

  function renderInitialState() {
    if (state.currentResult) {
      applyResult(state.currentResult, false);
      return;
    }

    elements.stage.dataset.side = "heads";
    elements.resultPanel.dataset.state = "idle";
    elements.resultText.textContent = "Ready to flip";
    elements.resultMeta.textContent = "Flip the coin to decide.";
    elements.button.textContent = "Flip Coin";
  }

  function startFlip() {
    if (state.isFlipping) return;

    state.isFlipping = true;
    const nextResult = getRandomResult();
    const targetRotation = getTargetRotation(nextResult);

    elements.stage.classList.add("is-flipping");
    elements.resultPanel.dataset.state = "flipping";
    elements.resultText.textContent = "Flipping...";
    elements.resultMeta.textContent = "The coin is in the air.";
    elements.button.disabled = true;
    elements.coinButton.disabled = true;
    elements.button.textContent = "Flipping...";

    if (REDUCED_MOTION) {
      finishFlip(nextResult, targetRotation);
      return;
    }

    animateFlip(targetRotation, nextResult);
  }

  function applyResult(result, updateRotation) {
    const side = result.toLowerCase();
    elements.stage.dataset.side = side;
    elements.resultPanel.dataset.state = side;
    elements.resultText.textContent = result;
    elements.resultMeta.textContent = result === "Heads" ? "Heads wins this flip." : "Tails wins this flip.";

    if (!updateRotation) {
      elements.coinInner.style.transform = result === "Heads" ? "rotateY(0deg)" : "rotateY(180deg)";
      state.currentRotation = result === "Heads" ? 0 : 180;
    }
  }

  function animateFlip(targetRotation, result) {
    const startRotation = state.currentRotation;
    const startTime = performance.now();

    window.cancelAnimationFrame(state.animationFrame);

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / FLIP_DURATION_MS, 1);
      const eased = easeOutQuart(progress);
      const rotation = startRotation + (targetRotation - startRotation) * eased;
      const tilt = Math.sin(progress * Math.PI) * 9;

      elements.coinInner.style.transform = "rotateX(" + tilt.toFixed(2) + "deg) rotateY(" + rotation.toFixed(2) + "deg)";

      if (progress < 1) {
        state.animationFrame = window.requestAnimationFrame(tick);
        return;
      }

      finishFlip(result, targetRotation);
    }

    state.animationFrame = window.requestAnimationFrame(tick);
  }

  function finishFlip(result, targetRotation) {
    state.currentRotation = targetRotation;
    elements.stage.classList.remove("is-flipping");
    elements.coinInner.style.transform = "rotateY(" + targetRotation + "deg)";
    applyResult(result, true);
    state.currentResult = result;
    storeResult(result);
    state.isFlipping = false;
    elements.button.disabled = false;
    elements.coinButton.disabled = false;
    elements.button.textContent = "Flip Coin";
  }

  function getTargetRotation(result) {
    const desired = result === "Heads" ? 0 : 180;
    const current = normalizeRotation(state.currentRotation);
    const extra = (desired - current + 360) % 360;
    const fullTurns = 5 + Math.floor(Math.random() * 2);
    return state.currentRotation + fullTurns * 360 + extra;
  }

  function normalizeRotation(value) {
    return ((value % 360) + 360) % 360;
  }

  function easeOutQuart(value) {
    return 1 - Math.pow(1 - value, 4);
  }
})();
