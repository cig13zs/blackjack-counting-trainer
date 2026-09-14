import {
  advancePractice,
  advanceSession,
  buildShoe,
  calculateTrueCount,
  createHiddenExampleState,
  createRunningCountQuestions,
  createScoredSession,
  createShoePracticeState,
  createTrueCountScenarios,
  hidePracticeBatch,
  parseIntegerAnswer,
  rankTag,
  revealHiddenCard,
  revealPracticeBatch,
  shuffle,
  submitPracticeAnswer,
  submitSessionAnswer,
} from "./core.js";

const workspace = document.querySelector("#workspace");
const liveStatus = document.querySelector("#app-status");
const modeButtons = [...document.querySelectorAll("[data-mode]")];
const MAX_USER_ANSWER = 1000;

const state = {
  mode: "learn",
  hiddenExample: createHiddenExampleState(),
  values: null,
  running: null,
  trueCount: null,
  shoe: null,
  pendingShoeSettings: { deckCount: 1, batchSize: 1, hideBeforeAnswer: false },
};

function signed(value) {
  return value > 0 ? `+${value}` : String(value);
}

function conciseNumber(value, digits = 4) {
  if (value === null) return "undefined";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}

function roundedRelation(value) {
  return Number.isInteger(value) ? `= ${value}` : `≈ ${conciseNumber(value)}`;
}

function exactDecksText(cards) {
  return `${cards}/52 ${roundedRelation(cards / 52)} decks`;
}

function announce(message) {
  liveStatus.textContent = "";
  requestAnimationFrame(() => {
    liveStatus.textContent = message;
  });
}

function focusAfterRender(selector) {
  requestAnimationFrame(() => document.querySelector(selector)?.focus());
}

function cardMarkup(card, { small = false, faceDown = false } = {}) {
  if (faceDown) {
    return `<div class="playing-card${small ? " small" : ""} face-down" role="img" aria-label="Face-down card"></div>`;
  }
  const classes = ["playing-card", card.color === "red" ? "red" : "", small ? "small" : ""]
    .filter(Boolean)
    .join(" ");
  return `
    <div class="${classes}" role="img" aria-label="${card.rank} of ${card.suit}">
      <span class="corner"><span>${card.rank}</span><span>${card.suitSymbol}</span></span>
      <span class="card-suit" aria-hidden="true">${card.suitSymbol}</span>
      <span class="corner bottom" aria-hidden="true"><span>${card.rank}</span><span>${card.suitSymbol}</span></span>
    </div>`;
}

function progressMarkup(session) {
  const current = session.complete ? session.correctAnswers.length : session.index + 1;
  return `
    <div class="score-line">
      <span>Question <strong>${current}</strong> of ${session.correctAnswers.length}</span>
      <span>Score <strong>${session.score}</strong></span>
    </div>
    <progress class="progress-bar" value="${current}" max="${session.correctAnswers.length}">
      ${current} of ${session.correctAnswers.length}
    </progress>`;
}

function modeHeading(label, title, description) {
  return `
    <header class="mode-heading">
      <p class="section-label">${label}</p>
      <h1 id="mode-title" tabindex="-1">${title}</h1>
      <p>${description}</p>
    </header>`;
}

function feedbackMarkup(correct, heading, detail) {
  return `
    <div class="feedback${correct ? "" : " incorrect"}" role="status">
      <strong>${heading}</strong>
      <p>${detail}</p>
    </div>`;
}

function startValueSession() {
  const cards = shuffle(buildShoe(1)).slice(0, 20);
  state.values = { cards, session: createScoredSession(cards.map((card) => rankTag(card.rank))) };
}

function startRunningSession() {
  const questions = createRunningCountQuestions();
  state.running = {
    questions,
    session: createScoredSession(questions.map((question) => question.correctCount)),
  };
}

function startTrueCountSession(convention = "floor") {
  const generated = createTrueCountScenarios(20);
  state.trueCount = {
    convention,
    generated,
    session: createScoredSession(
      generated.questions.map((question) => (
        calculateTrueCount(question.runningCount, question.remainingCards, convention).value
      )),
    ),
  };
}

function startShoeSession(settings = state.pendingShoeSettings) {
  state.pendingShoeSettings = { ...settings };
  state.shoe = createShoePracticeState(settings);
}

function ensureModeState(mode) {
  if (mode === "values" && !state.values) startValueSession();
  if (mode === "running" && !state.running) startRunningSession();
  if (mode === "true" && !state.trueCount) startTrueCountSession();
  if (mode === "shoe" && !state.shoe) startShoeSession();
}

function renderLearn() {
  const hidden = state.hiddenExample;
  const referenceRanks = ["3", "5", "K", "7", "Q", "A", "8", "5", "4", "2"];
  workspace.innerHTML = `
      <div class="desk-content wide">
      ${modeHeading(
        "Lesson 01",
        "Read the table before you count",
        "Hi-Lo gives every exposed card one of three tags. Add those tags in order and keep the total in your head.",
      )}

      <div class="lesson-stack">
        <section class="lesson-block" aria-labelledby="tag-heading">
          <h2 id="tag-heading">Three tags cover every rank</h2>
          <div class="tag-table" aria-label="Hi-Lo rank values">
            <div class="tag-group">
              <span class="tag-value">+1</span>
              <strong>2 through 6</strong>
              <span>Low cards</span>
            </div>
            <div class="tag-group">
              <span class="tag-value">0</span>
              <strong>7 through 9</strong>
              <span>Neutral cards</span>
            </div>
            <div class="tag-group">
              <span class="tag-value">-1</span>
              <strong>10, J, Q, K, A</strong>
              <span>High cards</span>
            </div>
          </div>
        </section>

        <section class="lesson-block" aria-labelledby="sequence-heading">
          <h2 id="sequence-heading">A running count is a plain sum</h2>
          <p>Start at zero. Read this ten-card sequence from left to right:</p>
          <div class="reference-sequence" aria-label="Reference sequence: 3, 5, K, 7, Q, A, 8, 5, 4, 2">
            ${referenceRanks.map((rank) => `<span class="reference-token">${rank}</span>`).join("")}
          </div>
          <div class="formula">+1 + 1 - 1 + 0 - 1 - 1 + 0 + 1 + 1 + 1 = +2</div>
          <p>A positive running count means the undealt part of a complete shoe contains more high cards than low cards only when every removed card has been exposed and counted.</p>
        </section>

        <section class="lesson-block" aria-labelledby="hidden-heading">
          <h2 id="hidden-heading">Count a hidden card when it becomes known</h2>
          <p>The face-up 5 contributes +1. The face-down card contributes nothing yet because its rank is unknown.</p>
          <div class="hidden-example">
            <div class="card-row compact">
              ${cardMarkup(hidden.visibleCard, { small: true })}
              ${cardMarkup(hidden.hiddenCard, { small: true, faceDown: !hidden.hiddenRevealed })}
            </div>
            <p class="hidden-count">Exposed running count: <strong>${signed(hidden.runningCount)}</strong></p>
            ${hidden.hiddenRevealed
              ? feedbackMarkup(true, "The king is now exposed.", "+1 + (-1) = 0. A second reveal cannot count it again.")
              : ""}
            <div class="button-row centered">
              <button class="button" type="button" data-action="reveal-hidden"${hidden.hiddenRevealed ? " disabled" : ""}>Reveal the hidden card</button>
              <button class="button secondary" type="button" data-action="reset-hidden">Reset example</button>
            </div>
          </div>
        </section>

        <section class="lesson-block" aria-labelledby="true-heading">
          <h2 id="true-heading">True count adjusts for cards remaining</h2>
          <p>Divide the running count by the exact number of decks still undealt. Counting Desk uses exact cards as a training aid:</p>
          <div class="formula">true count = running count / (remaining cards / 52)</div>
          <p>Floor moves down to the next integer, so floor(-1.5) is -2. Truncate drops the fractional part toward zero, so truncate(-1.5) is -1. You choose the convention before that exercise.</p>
        </section>

        <section class="lesson-block" aria-labelledby="limits-heading">
          <h2 id="limits-heading">What the count can and cannot say</h2>
          <ul>
            <li>A fresh independent shuffle resets the running count to zero.</li>
            <li>The count summarizes the exposed cards. It does not identify the next card.</li>
            <li>A count does not guarantee a win. Rules and published strategy indices vary, and this trainer does not teach them.</li>
          </ul>
          <p>Reference reading: <a href="https://wizardofodds.com/games/blackjack/card-counting/high-low/" target="_blank" rel="noreferrer">Wizard of Odds Hi-Lo overview</a> and <a href="https://www.blackjackincolor.com/truecount4.htm" target="_blank" rel="noreferrer">Blackjack in Color on true-count conventions</a>.</p>
          <div class="button-row">
            <button class="button" type="button" data-action="go-values">Practice card values</button>
          </div>
        </section>
      </div>
    </div>`;
}

function renderValueMode() {
  const { cards, session } = state.values;
  if (session.complete) {
    workspace.innerHTML = summaryMarkup(
      "Card values complete",
      `You scored ${session.score} out of ${session.correctAnswers.length}.`,
      [
        ["Correct", session.score],
        ["Review", session.correctAnswers.length - session.score],
      ],
      "retry-values",
      "Deal 20 new cards",
    );
    return;
  }

  const card = cards[session.index];
  const correctTag = rankTag(card.rank);
  const isAnswered = session.answered;
  const correct = session.wasCorrect;
  const reason = correctTag === 1
    ? `${card.rank} is between 2 and 6, so its tag is +1.`
    : correctTag === 0
      ? `${card.rank} is between 7 and 9, so its tag is 0.`
      : `${card.rank} is 10, J, Q, K, or A, so its tag is -1.`;

  workspace.innerHTML = `
    <div class="desk-content">
      ${modeHeading("Exercise 02", "Name the card value", "Choose the Hi-Lo tag. Your first answer is the one that counts.")}
      ${progressMarkup(session)}
      <div class="card-row">${cardMarkup(card)}</div>
      <p class="question-prompt">What is this card's Hi-Lo value?</p>
      <div class="answer-grid" role="group" aria-label="Choose a Hi-Lo value">
        ${[-1, 0, 1].map((value) => `
          <button type="button" data-card-answer="${value}"${isAnswered ? " disabled" : ""}>
            ${signed(value)}
          </button>`).join("")}
      </div>
      ${isAnswered ? feedbackMarkup(
        correct,
        correct ? "Correct." : `The correct value is ${signed(correctTag)}.`,
        reason,
      ) : ""}
      ${isAnswered ? `
        <div class="button-row centered">
          <button class="button" type="button" data-action="next-value">Next card</button>
        </div>` : ""}
    </div>`;
}

function renderRunningMode() {
  const { questions, session } = state.running;
  if (session.complete) {
    workspace.innerHTML = summaryMarkup(
      "Running-count set complete",
      `You tracked 20 cards from one deck and scored ${session.score} correct updates.`,
      [
        ["Correct", session.score],
        ["Cards counted", questions.length],
      ],
      "retry-running",
      "Deal a new sequence",
    );
    return;
  }

  const question = questions[session.index];
  const isAnswered = session.answered;
  const equation = `${signed(question.previousCount)} + (${signed(question.tag)}) = ${signed(question.correctCount)}`;
  workspace.innerHTML = `
    <div class="desk-content">
      ${modeHeading("Exercise 03", "Keep the guided running count", "This 20-card sequence comes from one shuffled deck. The previous correct count stays visible while you learn the update.")}
      ${progressMarkup(session)}
      <div class="count-ledger">
        <div><span class="metric-label">Count before this card</span><span class="metric-value">${signed(question.previousCount)}</span></div>
        <div><span class="metric-label">Cards already counted</span><span class="metric-value">${session.index}</span></div>
      </div>
      <div class="card-row">${cardMarkup(question.card)}</div>
      <form class="number-form" data-form="running" novalidate>
        <div class="number-field">
          <label for="running-answer">Updated running count</label>
          <input id="running-answer" name="answer" type="text" autocomplete="off" required${isAnswered ? " disabled" : ""}>
        </div>
        <button class="button" type="submit"${isAnswered ? " disabled" : ""}>Check count</button>
        <p class="input-error" data-input-error aria-live="polite"></p>
      </form>
      ${isAnswered ? feedbackMarkup(
        session.wasCorrect,
        session.wasCorrect ? "Correct." : `The running count is ${signed(question.correctCount)}.`,
        `Previous correct count + card tag = updated count: ${equation}.`,
      ) : ""}
      ${isAnswered ? `
        <div class="button-row centered">
          <button class="button" type="button" data-action="next-running">Next card</button>
        </div>` : ""}
    </div>`;
}

function renderTrueCountMode() {
  const { convention, generated, session } = state.trueCount;
  if (session.complete) {
    workspace.innerHTML = `
      <div class="desk-content">
        ${conventionControls(convention)}
        ${summaryMarkup(
          "True-count set complete",
          `Using ${convention}, you scored ${session.score} out of ${session.correctAnswers.length}.`,
          [
            ["Correct", session.score],
            ["Convention", convention === "floor" ? "Floor" : "Truncate"],
          ],
          "retry-true",
          "Create 20 new scenarios",
          false,
        )}
      </div>`;
    return;
  }

  const question = generated.questions[session.index];
  const result = calculateTrueCount(question.runningCount, question.remainingCards, convention);
  const isAnswered = session.answered;
  const operation = convention === "floor"
    ? `Floor of the exact ratio is ${signed(result.value)}.`
    : `Truncating the exact ratio gives ${signed(result.value)}.`;

  workspace.innerHTML = `
    <div class="desk-content wide">
      ${modeHeading("Exercise 04", "Convert to a true count", "Each scenario comes from a real prefix of a shuffled six-deck shoe. Use the exact cards remaining.")}
      ${conventionControls(convention)}
      ${progressMarkup(session)}
      <div class="scenario-grid">
        <div><span class="metric-label">Running count</span><span class="metric-value">${signed(question.runningCount)}</span></div>
        <div><span class="metric-label">Cards remaining</span><span class="metric-value">${question.remainingCards}</span></div>
        <div><span class="metric-label">Decks remaining</span><span class="metric-value">${question.remainingCards}/52</span></div>
      </div>
      <form class="number-form" data-form="true" novalidate>
        <div class="number-field">
          <label for="true-answer">Integer true count</label>
          <input id="true-answer" name="answer" type="text" autocomplete="off" required${isAnswered ? " disabled" : ""}>
        </div>
        <button class="button" type="submit"${isAnswered ? " disabled" : ""}>Check true count</button>
        <p class="input-error" data-input-error aria-live="polite"></p>
      </form>
      ${isAnswered ? feedbackMarkup(
        session.wasCorrect,
        session.wasCorrect ? "Correct." : `The ${convention} result is ${signed(result.value)}.`,
        `Exact ratio: (${signed(question.runningCount)} × 52) / ${question.remainingCards}. Decimal ${roundedRelation(result.raw)}. ${operation}`,
      ) : ""}
      ${isAnswered ? `
        <div class="button-row centered">
          <button class="button" type="button" data-action="next-true">Next scenario</button>
        </div>` : ""}
    </div>`;
}

function conventionControls(convention) {
  return `
    <fieldset class="convention-form">
      <legend>Integer convention</legend>
      <div class="radio-row">
        <label><input type="radio" name="convention" value="floor"${convention === "floor" ? " checked" : ""}> Floor</label>
        <label><input type="radio" name="convention" value="truncate"${convention === "truncate" ? " checked" : ""}> Truncate</label>
      </div>
      <p class="convention-note">Changing this choice starts a new 20-question session immediately.</p>
    </fieldset>`;
}

function renderShoeMode() {
  const shoe = state.shoe;
  if (shoe.phase === "complete") {
    workspace.innerHTML = `
      <div class="desk-content">
        ${shoeSettingsMarkup()}
        ${summaryMarkup(
          "The shoe is complete",
          `You counted all ${shoe.shoe.length} cards. The final running count is ${signed(shoe.runningCount)}, as a complete Hi-Lo shoe requires.`,
          [
            ["Correct batches", `${shoe.score}/${shoe.attempts}`],
            ["Final running count", signed(shoe.runningCount)],
          ],
          "replay-shoe",
          "Shuffle and replay",
          false,
        )}
      </div>`;
    return;
  }

  const isHidden = shoe.phase === "hidden";
  const hasFeedback = shoe.phase === "feedback";
  const result = shoe.lastResult;
  const remainingFormula = hasFeedback
    ? exactDecksText(result.remainingCards)
    : "";
  const trueCountCopy = hasFeedback && result.rawTrueCount === null
    ? "True count is undefined because no undealt cards remain."
    : hasFeedback
      ? `Raw true count exact ratio: (${signed(result.correctAnswer)} × 52) / ${result.remainingCards}. Decimal ${roundedRelation(result.rawTrueCount)}.`
      : "";

  workspace.innerHTML = `
    <div class="desk-content wide shoe-mode">
      ${modeHeading("Exercise 05", "Count a complete shoe", "Every batch appears face up before you answer. The engine deals without replacement and never reshuffles midway.")}
      ${shoeSettingsMarkup()}
      <div class="score-line">
        <span>Current attempt <strong>${shoe.attempts + (hasFeedback ? 0 : 1)}</strong></span>
        <span>Correct batches <strong>${shoe.score}</strong></span>
      </div>
      <div class="card-row">
        ${shoe.currentBatch.map((card) => cardMarkup(card, { faceDown: isHidden })).join("")}
      </div>
      ${!hasFeedback ? `
        <p class="question-prompt">Enter the running count after this ${shoe.currentBatch.length === 1 ? "card" : "batch"}.</p>
        ${shoe.hideBeforeAnswer ? `
          <div class="button-row centered">
            ${isHidden
              ? "<button class=\"button secondary\" type=\"button\" data-action=\"reveal-batch\">Show this batch again</button>"
              : "<button class=\"button secondary\" type=\"button\" data-action=\"hide-batch\">Hide this batch before answering</button>"}
          </div>` : ""}
        <form class="number-form" data-form="shoe" novalidate>
          <div class="number-field">
            <label for="shoe-answer">Running count</label>
            <input id="shoe-answer" name="answer" type="text" autocomplete="off" required>
          </div>
          <button class="button" type="submit">Check count</button>
          <p class="input-error" data-input-error aria-live="polite"></p>
        </form>` : ""}
      ${hasFeedback ? feedbackMarkup(
        result.correct,
        result.correct ? "Correct." : `The running count is ${signed(result.correctAnswer)}.`,
        `Cards remaining: ${result.remainingCards}. Exact decks remaining: ${remainingFormula}. ${trueCountCopy}`,
      ) : ""}
      ${hasFeedback ? `
        <div class="button-row centered">
          <button class="button" type="button" data-action="next-batch">
            ${result.remainingCards === 0 ? "View shoe summary" : "Deal next batch"}
          </button>
        </div>` : ""}
    </div>`;
}

function shoeSettingsMarkup() {
  const pending = state.pendingShoeSettings;
  const active = state.shoe;
  const pendingChanged = pending.deckCount !== active.deckCount
    || pending.batchSize !== active.batchSize
    || pending.hideBeforeAnswer !== active.hideBeforeAnswer;
  const activeSummary = `${active.deckCount} ${active.deckCount === 1 ? "deck" : "decks"}, ${active.batchSize} ${active.batchSize === 1 ? "card" : "cards"} per batch, ${active.hideBeforeAnswer ? "hide option on" : "cards stay visible"}`;
  return `
    <details class="shoe-settings">
      <summary>
        <strong>Shoe setup</strong>
        <span>Active: ${activeSummary}</span>
      </summary>
      <div class="settings-body">
        <div class="settings-grid">
          <div class="field-group">
            <label for="deck-count">Decks</label>
            <select id="deck-count" data-setting="deckCount">
              ${[1, 2, 6, 8].map((count) => `<option value="${count}"${pending.deckCount === count ? " selected" : ""}>${count}</option>`).join("")}
            </select>
          </div>
          <div class="field-group">
            <label for="batch-size">Cards per batch</label>
            <select id="batch-size" data-setting="batchSize">
              ${[1, 2, 4].map((count) => `<option value="${count}"${pending.batchSize === count ? " selected" : ""}>${count}</option>`).join("")}
            </select>
          </div>
          <label class="check-row">
            <input type="checkbox" data-setting="hideBeforeAnswer"${pending.hideBeforeAnswer ? " checked" : ""}>
            Let me hide each batch before I answer
          </label>
        </div>
        <button class="button secondary" type="button" data-action="new-shoe">Start a new shoe with these settings</button>
        <p class="settings-note">${pendingChanged ? "These selections are pending. Apply them to start a new shoe." : "Applying these settings starts a new shoe and resets its score."}</p>
      </div>
    </details>`;
}

function summaryMarkup(title, description, metrics, action, actionLabel, includeWrapper = true) {
  const content = `
    <section class="summary" aria-labelledby="summary-title">
      <p class="section-label">Session summary</p>
      <h1 id="summary-title" tabindex="-1">${title}</h1>
      <p>${description}</p>
      <div class="summary-metrics">
        ${metrics.map(([label, value]) => `<div><span class="metric-label">${label}</span><span class="metric-value">${value}</span></div>`).join("")}
      </div>
      <div class="button-row">
        <button class="button" type="button" data-action="${action}">${actionLabel}</button>
      </div>
    </section>`;
  return includeWrapper ? `<div class="desk-content">${content}</div>` : content;
}

function render() {
  ensureModeState(state.mode);
  modeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  });

  if (state.mode === "learn") renderLearn();
  if (state.mode === "values") renderValueMode();
  if (state.mode === "running") renderRunningMode();
  if (state.mode === "true") renderTrueCountMode();
  if (state.mode === "shoe") renderShoeMode();
}

function setMode(mode, { moveFocus = false } = {}) {
  if (!["learn", "values", "running", "true", "shoe"].includes(mode)) return;
  state.mode = mode;
  render();
  announce(`${modeButtons.find((button) => button.dataset.mode === mode)?.querySelector("strong")?.textContent} mode opened.`);
  if (moveFocus) focusAfterRender("#mode-title");
}

function setInputError(form, message) {
  const input = form.elements.answer;
  form.querySelector("[data-input-error]").textContent = message;
  input.setAttribute("aria-invalid", "true");
  input.focus();
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.mode));
});

workspace.addEventListener("change", (event) => {
  const target = event.target;
  if (target.matches("input[name='convention']")) {
    startTrueCountSession(target.value);
    render();
    announce(`${target.value === "floor" ? "Floor" : "Truncate"} selected. A new 20-question session started.`);
    focusAfterRender(`input[name="convention"][value="${target.value}"]`);
    return;
  }

  if (target.matches("[data-setting='deckCount']")) {
    state.pendingShoeSettings.deckCount = Number(target.value);
  }
  if (target.matches("[data-setting='batchSize']")) {
    state.pendingShoeSettings.batchSize = Number(target.value);
  }
  if (target.matches("[data-setting='hideBeforeAnswer']")) {
    state.pendingShoeSettings.hideBeforeAnswer = target.checked;
  }
});

workspace.addEventListener("submit", (event) => {
  const form = event.target;
  if (!form.matches("[data-form]")) return;
  event.preventDefault();
  const answer = parseIntegerAnswer(form.elements.answer.value, MAX_USER_ANSWER);
  if (answer === null) {
    setInputError(form, `Enter a whole number from -${MAX_USER_ANSWER} to ${MAX_USER_ANSWER}.`);
    return;
  }

  if (form.dataset.form === "running") {
    const result = submitSessionAnswer(state.running.session, answer);
    if (!result.accepted) return;
    state.running.session = result.state;
    render();
    announce(result.correct ? "Correct running count." : "Incorrect running count. The correction is shown.");
    focusAfterRender("[data-action='next-running']");
  }

  if (form.dataset.form === "true") {
    const result = submitSessionAnswer(state.trueCount.session, answer);
    if (!result.accepted) return;
    state.trueCount.session = result.state;
    render();
    announce(result.correct ? "Correct true count." : "Incorrect true count. The calculation is shown.");
    focusAfterRender("[data-action='next-true']");
  }

  if (form.dataset.form === "shoe") {
    const result = submitPracticeAnswer(state.shoe, answer);
    if (!result.accepted) return;
    state.shoe = result.state;
    render();
    announce(result.correct ? "Correct running count." : "Incorrect running count. The correction is shown.");
    focusAfterRender("[data-action='next-batch']");
  }
});

workspace.addEventListener("click", (event) => {
  const answerButton = event.target.closest("[data-card-answer]");
  if (answerButton) {
    const result = submitSessionAnswer(state.values.session, Number(answerButton.dataset.cardAnswer));
    if (!result.accepted) return;
    state.values.session = result.state;
    render();
    announce(result.correct ? "Correct card value." : "Incorrect card value. The correction is shown.");
    focusAfterRender("[data-action='next-value']");
    return;
  }

  const button = event.target.closest("[data-action]");
  if (!button) return;
  const action = button.dataset.action;

  if (action === "reveal-hidden") {
    state.hiddenExample = revealHiddenCard(state.hiddenExample).state;
    render();
    announce("King revealed. The exposed running count is now zero.");
    focusAfterRender("[data-action='reset-hidden']");
  }
  if (action === "reset-hidden") {
    state.hiddenExample = createHiddenExampleState();
    render();
    announce("Hidden-card example reset.");
    focusAfterRender("[data-action='reveal-hidden']");
  }
  if (action === "go-values") setMode("values", { moveFocus: true });
  if (action === "retry-values") {
    startValueSession();
    render();
    announce("A new 20-card value session started.");
    focusAfterRender("[data-card-answer]");
  }
  if (action === "next-value") {
    state.values.session = advanceSession(state.values.session).state;
    render();
    focusAfterRender(state.values.session.complete ? "#summary-title" : "[data-card-answer]");
  }
  if (action === "retry-running") {
    startRunningSession();
    render();
    announce("A new running-count sequence started.");
    focusAfterRender("#running-answer");
  }
  if (action === "next-running") {
    state.running.session = advanceSession(state.running.session).state;
    render();
    focusAfterRender(state.running.session.complete ? "#summary-title" : "#running-answer");
  }
  if (action === "retry-true") {
    startTrueCountSession(state.trueCount.convention);
    render();
    announce("A new 20-question true-count session started.");
    focusAfterRender("#true-answer");
  }
  if (action === "next-true") {
    state.trueCount.session = advanceSession(state.trueCount.session).state;
    render();
    focusAfterRender(state.trueCount.session.complete ? "#summary-title" : "#true-answer");
  }
  if (action === "new-shoe" || action === "replay-shoe") {
    startShoeSession();
    render();
    announce("A newly shuffled shoe started at a running count of zero.");
    focusAfterRender("#shoe-answer");
  }
  if (action === "hide-batch") {
    state.shoe = hidePracticeBatch(state.shoe).state;
    render();
    announce("The exposed batch is now face down. Enter the count you kept.");
    focusAfterRender("#shoe-answer");
  }
  if (action === "reveal-batch") {
    state.shoe = revealPracticeBatch(state.shoe).state;
    render();
    announce("The current batch is face up again.");
    focusAfterRender("#shoe-answer");
  }
  if (action === "next-batch") {
    state.shoe = advancePractice(state.shoe).state;
    render();
    focusAfterRender(state.shoe.phase === "complete" ? "#summary-title" : "#shoe-answer");
  }
});

render();
