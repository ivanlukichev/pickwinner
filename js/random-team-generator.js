(function () {
  const page = document.querySelector(".team-generator-page");
  if (!page) return;

  const STORAGE_KEY = "pickwinner.randomTeamGenerator.v1";
  const PARTICIPANT_MAX_LENGTH = 80;
  const MAX_PARTICIPANTS = 200;
  const MAX_TEAMS = 50;
  const SHUFFLE_FEEDBACK_DURATION = 420;
  const DEFAULT_PARTICIPANTS = ["Alice", "Bob", "John", "Maria", "Tom", "Kate"];
  const sharedConfig = loadConfigFromUrl();

  const elements = {
    participantInput: document.querySelector("[data-participant-input]"),
    participantHint: document.querySelector("[data-participant-hint]"),
    teamCountInput: document.querySelector("[data-team-count]"),
    teamCountHint: document.querySelector("[data-team-count-hint]"),
    teamSizeInput: document.querySelector("[data-team-size]"),
    teamSizeHint: document.querySelector("[data-team-size-hint]"),
    teamLabels: document.querySelector("[data-team-labels]"),
    generateButton: document.querySelector("[data-generate-button]"),
    shuffleButton: document.querySelector("[data-shuffle-button]"),
    resetButton: document.querySelector("[data-reset-button]"),
    shareButton: document.querySelector("[data-share-button]"),
    participantCount: document.querySelector("[data-participant-count]"),
    generatedCount: document.querySelector("[data-generated-count]"),
    teamsEmpty: document.querySelector("[data-teams-empty]"),
    teamsHint: document.querySelector("[data-teams-hint]"),
    teamResults: document.querySelector("[data-team-results]"),
    message: document.querySelector("[data-message]")
  };

  const state = {
    config: sharedConfig ? normalizeConfig(sharedConfig) : loadInitialConfig(),
    session: {
      generatedTeams: [],
      generatedCount: 0,
      message: {
        tone: "info",
        text: "Paste at least two participants and press Generate Teams."
      }
    }
  };

  restoreSession();
  bindEvents();
  syncDerivedValues();
  syncFormFromState();
  renderAll();
  saveState();

  function bindEvents() {
    elements.participantInput.addEventListener("input", handleParticipantInput);
    elements.teamCountInput.addEventListener("input", handleTeamCountInput);
    elements.teamSizeInput.addEventListener("input", handleTeamSizeInput);
    elements.teamLabels.addEventListener("change", handleToggleChange);
    elements.generateButton.addEventListener("click", generateTeams);
    elements.shuffleButton.addEventListener("click", shuffleParticipants);
    elements.resetButton.addEventListener("click", resetList);
    elements.shareButton.addEventListener("click", copyShareLink);
  }

  function getDefaultConfig() {
    return {
      rawParticipantsText: DEFAULT_PARTICIPANTS.join("\n"),
      splitMode: "teams",
      teamCount: 2,
      playersPerTeam: 3,
      useTeamLabels: true
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
      console.warn("Unable to read local random-team-generator config.", error);
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

      state.session.generatedCount = clampNumber(parsed.generatedCount, 0, 9999, 0);
      state.session.generatedTeams = Array.isArray(parsed.generatedTeams)
        ? normalizeGeneratedTeams(parsed.generatedTeams)
        : [];
    } catch (error) {
      console.warn("Unable to restore random-team-generator session.", error);
    }
  }

  function normalizeConfig(input) {
    const base = getDefaultConfig();
    const source = input && typeof input === "object" ? input : {};
    const parsed = {
      rawParticipantsText: normalizeParticipantsText(source.rawParticipantsText ?? source.participants ?? base.rawParticipantsText),
      splitMode: source.splitMode === "size" ? "size" : "teams",
      teamCount: clampNumber(source.teamCount ?? source.teams ?? base.teamCount, 2, MAX_TEAMS, base.teamCount),
      playersPerTeam: clampNumber(source.playersPerTeam ?? source.size ?? base.playersPerTeam, 1, MAX_PARTICIPANTS, base.playersPerTeam),
      useTeamLabels: toBoolean(source.useTeamLabels ?? source.labels, base.useTeamLabels)
    };

    return parsed;
  }

  function normalizeParticipantsText(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => normalizeParticipant(line))
      .filter((line, index, lines) => line || index < lines.length - 1)
      .join("\n");
  }

  function normalizeParticipant(value) {
    return String(value || "").trim().slice(0, PARTICIPANT_MAX_LENGTH);
  }

  function normalizeGeneratedTeams(teams) {
    return teams
      .map((team) => ({
        name: String(team.name || "").trim().slice(0, 40),
        members: Array.isArray(team.members)
          ? team.members.map(normalizeParticipant).filter(Boolean)
          : []
      }))
      .filter((team) => team.name && team.members.length);
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

  function getParsedParticipants() {
    return state.config.rawParticipantsText
      .split(/\r?\n/)
      .map(normalizeParticipant)
      .filter(Boolean);
  }

  function loadConfigFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("participants")) return null;

    return {
      teams: params.get("teams"),
      size: params.get("size"),
      splitMode: params.get("mode"),
      labels: params.get("labels"),
      participants: params.get("participants")
        .split("|")
        .map((item) => decodeURIComponent(item))
        .join("\n")
    };
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        config: state.config,
        generatedTeams: state.session.generatedTeams,
        generatedCount: state.session.generatedCount
      }));
    } catch (error) {
      console.warn("Unable to save random-team-generator state.", error);
    }
  }

  function syncFormFromState() {
    elements.participantInput.value = state.config.rawParticipantsText;
    elements.teamCountInput.value = String(state.config.teamCount);
    elements.teamSizeInput.value = String(state.config.playersPerTeam);
    elements.teamLabels.checked = state.config.useTeamLabels;
  }

  function syncDerivedValues() {
    const participantCount = getParsedParticipants().length;
    const safeCount = Math.max(participantCount, 2);

    if (state.config.splitMode === "teams") {
      state.config.teamCount = clampNumber(state.config.teamCount, 2, Math.min(MAX_TEAMS, safeCount), 2);
      state.config.playersPerTeam = Math.max(1, Math.ceil(safeCount / state.config.teamCount));
    } else {
      state.config.playersPerTeam = clampNumber(state.config.playersPerTeam, 1, safeCount, 1);
      state.config.teamCount = Math.max(2, Math.min(MAX_TEAMS, Math.ceil(safeCount / state.config.playersPerTeam)));
    }

    if (participantCount && state.config.teamCount > participantCount) {
      state.config.teamCount = participantCount;
      state.config.playersPerTeam = 1;
      state.config.splitMode = "teams";
    }

    elements.teamCountInput.max = String(Math.min(MAX_TEAMS, Math.max(2, safeCount)));
    elements.teamSizeInput.max = String(Math.max(1, safeCount));
  }

  function renderTeamSettingHints() {
    const participantCount = getParsedParticipants().length;
    const maxTeams = Math.min(MAX_TEAMS, Math.max(2, participantCount || 2));
    const teamCountInvalid = Number.parseInt(elements.teamCountInput.value, 10) > maxTeams;
    const teamSizeInvalid = Number.parseInt(elements.teamSizeInput.value, 10) > Math.max(1, participantCount || 1);

    elements.teamCountInput.classList.toggle("is-invalid", teamCountInvalid);
    elements.teamSizeInput.classList.toggle("is-invalid", teamSizeInvalid);
    elements.teamCountInput.setAttribute("aria-invalid", teamCountInvalid ? "true" : "false");
    elements.teamSizeInput.setAttribute("aria-invalid", teamSizeInvalid ? "true" : "false");

    elements.teamCountHint.textContent = participantCount
      ? `Up to ${maxTeams} teams with the current participant list.`
      : "Add participants first to calculate valid team counts.";

    elements.teamSizeHint.textContent = participantCount
      ? `Estimated size: about ${state.config.playersPerTeam} player${state.config.playersPerTeam === 1 ? "" : "s"} per team.`
      : "Add participants first to calculate team sizes.";
  }

  function renderParticipantHint() {
    const participants = getParsedParticipants();
    const isOverLimit = participants.length > MAX_PARTICIPANTS;
    elements.participantInput.classList.toggle("is-invalid", isOverLimit);
    elements.participantInput.setAttribute("aria-invalid", isOverLimit ? "true" : "false");

    if (isOverLimit) {
      elements.participantHint.textContent = `You can enter up to ${MAX_PARTICIPANTS} participants. Remove a few names before generating teams.`;
      elements.participantHint.classList.add("is-warning");
      return;
    }

    elements.participantHint.textContent = "Paste names line by line. The random team generator will shuffle the list fairly before building teams.";
    elements.participantHint.classList.remove("is-warning");
  }

  function getValidationMessage() {
    const participants = getParsedParticipants();

    if (participants.length < 2) {
      return "Please enter at least two participants.";
    }

    if (participants.length > MAX_PARTICIPANTS) {
      return `You can enter up to ${MAX_PARTICIPANTS} participants.`;
    }

    return "";
  }

  function handleParticipantInput(event) {
    state.config.rawParticipantsText = normalizeParticipantsText(event.target.value);
    if (event.target.value !== state.config.rawParticipantsText) {
      event.target.value = state.config.rawParticipantsText;
    }
    syncDerivedValues();
    syncFormFromState();
    saveState();
    renderAll();
  }

  function handleTeamCountInput() {
    state.config.splitMode = "teams";
    state.config.teamCount = clampNumber(elements.teamCountInput.value, 2, MAX_TEAMS, state.config.teamCount);
    syncDerivedValues();
    syncFormFromState();
    saveState();
    renderAll();
  }

  function handleTeamSizeInput() {
    state.config.splitMode = "size";
    state.config.playersPerTeam = clampNumber(elements.teamSizeInput.value, 1, MAX_PARTICIPANTS, state.config.playersPerTeam);
    syncDerivedValues();
    syncFormFromState();
    saveState();
    renderAll();
  }

  function handleToggleChange() {
    state.config.useTeamLabels = elements.teamLabels.checked;
    renderAll();
    saveState();
  }

  function buildShareUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("teams", String(state.config.teamCount));
    url.searchParams.set("size", String(state.config.playersPerTeam));
    url.searchParams.set("mode", state.config.splitMode);
    url.searchParams.set("labels", state.config.useTeamLabels ? "1" : "0");
    url.searchParams.set("participants", getParsedParticipants().map((name) => encodeURIComponent(name)).join("|"));
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

  function shuffleArray(values) {
    const next = values.slice();
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  function shuffleParticipants() {
    const participants = getParsedParticipants();

    if (participants.length < 2) {
      setMessage("Please enter at least two participants before shuffling.", "error");
      return;
    }

    state.config.rawParticipantsText = shuffleArray(participants).join("\n");
    syncFormFromState();
    saveState();
    renderAll();
    triggerShuffleFeedback(elements.participantInput);
    setMessage("Participant list shuffled.", "success");
  }

  function resetList() {
    state.config = getDefaultConfig();
    state.session.generatedTeams = [];
    state.session.generatedCount = 0;
    syncDerivedValues();
    syncFormFromState();
    saveState();
    renderAll();
    setMessage("Participant list reset.", "info");
  }

  function generateTeams() {
    const validationMessage = getValidationMessage();
    if (validationMessage) {
      setMessage(validationMessage, "error");
      return;
    }

    const participants = getParsedParticipants();

    syncDerivedValues();

    const teamCount = state.config.teamCount;
    const shuffled = shuffleArray(participants);
    const groups = Array.from({ length: teamCount }, () => []);

    shuffled.forEach((participant, index) => {
      groups[index % teamCount].push(participant);
    });

    state.session.generatedTeams = groups
      .filter((members) => members.length)
      .map((members, index) => ({
        name: getTeamLabel(index),
        members
      }));

    state.session.generatedCount += 1;
    saveState();
    renderAll();
    setMessage(`${state.session.generatedTeams.length} random team${state.session.generatedTeams.length === 1 ? "" : "s"} generated.`, "success");
  }

  function getTeamLabel(index) {
    if (state.config.useTeamLabels) {
      return `Team ${index + 1}`;
    }

    return `Group ${toAlphaLabel(index)}`;
  }

  function toAlphaLabel(index) {
    let value = index;
    let label = "";

    do {
      label = String.fromCharCode(65 + (value % 26)) + label;
      value = Math.floor(value / 26) - 1;
    } while (value >= 0);

    return label;
  }

  function renderAll() {
    renderParticipantHint();
    renderTeamSettingHints();
    renderButtons();
    renderStats();
    renderTeams();
    renderMessage();
  }

  function renderButtons() {
    const participants = getParsedParticipants();
    const validationMessage = getValidationMessage();

    elements.generateButton.disabled = Boolean(validationMessage);
    elements.shuffleButton.disabled = participants.length < 2;
    elements.resetButton.disabled = !state.config.rawParticipantsText.trim();
    elements.shareButton.disabled = false;
  }

  function renderStats() {
    elements.participantCount.textContent = String(getParsedParticipants().length);
    elements.generatedCount.textContent = String(state.session.generatedCount);
  }

  function renderTeams() {
    elements.teamResults.textContent = "";

    if (!state.session.generatedTeams.length) {
      elements.teamResults.hidden = true;
      elements.teamsEmpty.hidden = false;
      elements.teamsHint.hidden = false;
      return;
    }

    const fragment = document.createDocumentFragment();

    state.session.generatedTeams.forEach((team, index) => {
      const card = document.createElement("article");
      card.className = "team-result-card";

      const title = document.createElement("h4");
      title.textContent = getTeamLabel(index);

      const list = document.createElement("ol");
      list.className = "team-member-list";

      team.members.forEach((member) => {
        const item = document.createElement("li");
        item.textContent = member;
        list.append(item);
      });

      card.append(title, list);
      fragment.append(card);
    });

    elements.teamResults.append(fragment);
    elements.teamResults.hidden = false;
    elements.teamsEmpty.hidden = true;
    elements.teamsHint.hidden = true;
  }

  function renderMessage() {
    elements.message.textContent = state.session.message.text;
    elements.message.dataset.tone = state.session.message.tone;
  }

  function setMessage(text, tone) {
    state.session.message = { text, tone };
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
})();
