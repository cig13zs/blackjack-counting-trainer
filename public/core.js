export const RANKS = Object.freeze([
  "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A",
]);

export const SUITS = Object.freeze([
  Object.freeze({ name: "clubs", symbol: "♣", color: "black" }),
  Object.freeze({ name: "diamonds", symbol: "♦", color: "red" }),
  Object.freeze({ name: "hearts", symbol: "♥", color: "red" }),
  Object.freeze({ name: "spades", symbol: "♠", color: "black" }),
]);

export const DECK_CHOICES = Object.freeze([1, 2, 6, 8]);
export const BATCH_CHOICES = Object.freeze([1, 2, 4]);
export const COUNT_CONVENTIONS = Object.freeze(["floor", "truncate"]);

const MAX_RUNNING_COUNT = Math.floor(Number.MAX_SAFE_INTEGER / 52);
const UINT32_RANGE = 0x1_0000_0000;

function requireSafeInteger(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a safe integer from ${min} to ${max}.`);
  }
  return value;
}

function requireChoice(value, choices, name) {
  if (!choices.includes(value)) {
    throw new RangeError(`${name} must be one of: ${choices.join(", ")}.`);
  }
  return value;
}

function requireCard(card, name = "card") {
  if (!card || typeof card !== "object") {
    throw new TypeError(`${name} must be a card object.`);
  }
  rankTag(card.rank);
  return card;
}

export function rankTag(rank) {
  if (typeof rank !== "string" || !RANKS.includes(rank)) {
    throw new RangeError(`Unsupported rank: ${String(rank)}.`);
  }
  if (["2", "3", "4", "5", "6"].includes(rank)) return 1;
  if (["7", "8", "9"].includes(rank)) return 0;
  return -1;
}

export function parseIntegerAnswer(value, maxAbsoluteValue = 1000) {
  requireSafeInteger(maxAbsoluteValue, "maxAbsoluteValue", 0, MAX_RUNNING_COUNT);
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!/^[+-]?\d+$/.test(clean)) return null;
  const parsed = Number(clean);
  if (!Number.isSafeInteger(parsed) || Math.abs(parsed) > maxAbsoluteValue) return null;
  return Object.is(parsed, -0) ? 0 : parsed;
}

export function buildShoe(deckCount = 1) {
  requireChoice(deckCount, DECK_CHOICES, "deckCount");
  const cards = [];

  for (let deck = 0; deck < deckCount; deck += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push(Object.freeze({
          id: `d${deck + 1}-${suit.name}-${rank}`,
          deck: deck + 1,
          rank,
          suit: suit.name,
          suitSymbol: suit.symbol,
          color: suit.color,
          tag: rankTag(rank),
        }));
      }
    }
  }

  return cards;
}

export function secureRandomInt(maxExclusive) {
  requireSafeInteger(maxExclusive, "maxExclusive", 1, 0xffff_ffff);
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error("A cryptographic random-number source is required.");
  }

  const cutoff = Math.floor(UINT32_RANGE / maxExclusive) * maxExclusive;
  const buffer = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buffer);
  } while (buffer[0] >= cutoff);

  return buffer[0] % maxExclusive;
}

export function shuffle(values, randomInt = secureRandomInt) {
  if (!Array.isArray(values)) throw new TypeError("values must be an array.");
  if (typeof randomInt !== "function") throw new TypeError("randomInt must be a function.");

  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    requireSafeInteger(swapIndex, "randomInt result", 0, index);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function sumTags(cards) {
  if (!Array.isArray(cards)) throw new TypeError("cards must be an array.");
  return cards.reduce((total, card, index) => {
    requireCard(card, `cards[${index}]`);
    return total + rankTag(card.rank);
  }, 0);
}

export function runningCountSteps(cards, startingCount = 0) {
  if (!Array.isArray(cards)) throw new TypeError("cards must be an array.");
  requireSafeInteger(startingCount, "startingCount", -MAX_RUNNING_COUNT, MAX_RUNNING_COUNT);

  let count = startingCount;
  return cards.map((card, index) => {
    requireCard(card, `cards[${index}]`);
    const previousCount = count;
    const tag = rankTag(card.rank);
    count += tag;
    return Object.freeze({ card, previousCount, tag, correctCount: count });
  });
}

export function createRunningCountQuestions(randomInt = secureRandomInt) {
  return runningCountSteps(shuffle(buildShoe(1), randomInt).slice(0, 20));
}

export function calculateTrueCount(runningCount, remainingCards, convention = "floor") {
  requireSafeInteger(
    runningCount,
    "runningCount",
    -MAX_RUNNING_COUNT,
    MAX_RUNNING_COUNT,
  );
  requireSafeInteger(remainingCards, "remainingCards", 0, Number.MAX_SAFE_INTEGER);
  requireChoice(convention, COUNT_CONVENTIONS, "convention");

  if (remainingCards === 0) {
    return Object.freeze({ raw: null, value: null, decksRemaining: 0 });
  }

  // Multiply first so exact rational integer boundaries do not drift across an integer.
  const raw = (runningCount * 52) / remainingCards;
  const integerValue = convention === "floor" ? Math.floor(raw) : Math.trunc(raw);
  return Object.freeze({
    raw: Object.is(raw, -0) ? 0 : raw,
    value: Object.is(integerValue, -0) ? 0 : integerValue,
    decksRemaining: remainingCards / 52,
  });
}

function prefixCounts(shoe) {
  let count = 0;
  return shoe.map((card) => {
    count += rankTag(card.rank);
    return count;
  });
}

function evenlyPick(values, count) {
  if (count === 0) return [];
  if (values.length < count) throw new RangeError("Not enough values to select from.");
  return Array.from({ length: count }, (_, index) => {
    const offset = Math.floor(((index + 0.5) * values.length) / count);
    return values[Math.min(offset, values.length - 1)];
  });
}

export function createTrueCountScenarios(questionCount = 20, randomInt = secureRandomInt) {
  requireSafeInteger(questionCount, "questionCount", 1, 50);
  let shoe = shuffle(buildShoe(6), randomInt);
  let counts = prefixCounts(shoe);
  const negativeNeeded = Math.min(4, questionCount);

  let negativeExposedCounts = counts
    .map((count, index) => ({ count, exposedCount: index + 1 }))
    .filter(({ count, exposedCount }) => count < 0 && exposedCount < shoe.length)
    .map(({ exposedCount }) => exposedCount);

  if (negativeExposedCounts.length < negativeNeeded) {
    shoe = [...shoe].reverse();
    counts = prefixCounts(shoe);
    negativeExposedCounts = counts
      .map((count, index) => ({ count, exposedCount: index + 1 }))
      .filter(({ count, exposedCount }) => count < 0 && exposedCount < shoe.length)
      .map(({ exposedCount }) => exposedCount);
  }

  const selected = new Set(evenlyPick(negativeExposedCounts, negativeNeeded));
  for (let slot = 1; selected.size < questionCount; slot += 1) {
    let exposedCount = Math.floor((slot * shoe.length) / (questionCount + 1));
    exposedCount = Math.max(1, Math.min(shoe.length - 1, exposedCount));

    // Most questions use a fractional number of decks remaining.
    if ((shoe.length - exposedCount) % 52 === 0) exposedCount += 1;
    while (selected.has(exposedCount) && exposedCount < shoe.length - 1) exposedCount += 1;
    while (selected.has(exposedCount) && exposedCount > 1) exposedCount -= 1;
    selected.add(exposedCount);
  }

  const questions = [...selected]
    .slice(0, questionCount)
    .sort((a, b) => a - b)
    .map((exposedCount, index) => Object.freeze({
      id: `tc-${index + 1}-${exposedCount}`,
      exposedCount,
      runningCount: counts[exposedCount - 1],
      remainingCards: shoe.length - exposedCount,
      decksRemaining: (shoe.length - exposedCount) / 52,
    }));

  return Object.freeze({ shoe: Object.freeze([...shoe]), questions: Object.freeze(questions) });
}

export function createScoredSession(correctAnswers) {
  if (!Array.isArray(correctAnswers) || correctAnswers.length === 0) {
    throw new TypeError("correctAnswers must be a non-empty array.");
  }
  correctAnswers.forEach((answer, index) => {
    requireSafeInteger(answer, `correctAnswers[${index}]`, -MAX_RUNNING_COUNT, MAX_RUNNING_COUNT);
  });

  return Object.freeze({
    correctAnswers: Object.freeze([...correctAnswers]),
    index: 0,
    score: 0,
    answered: false,
    complete: false,
    submittedAnswer: null,
    wasCorrect: null,
  });
}

export function submitSessionAnswer(session, submittedAnswer) {
  if (!session || typeof session !== "object") throw new TypeError("session is required.");
  requireSafeInteger(submittedAnswer, "submittedAnswer", -MAX_RUNNING_COUNT, MAX_RUNNING_COUNT);
  if (session.complete || session.answered) {
    return Object.freeze({ state: session, accepted: false, correct: session.wasCorrect });
  }

  const correct = submittedAnswer === session.correctAnswers[session.index];
  const state = Object.freeze({
    ...session,
    score: session.score + Number(correct),
    answered: true,
    submittedAnswer,
    wasCorrect: correct,
  });
  return Object.freeze({ state, accepted: true, correct });
}

export function advanceSession(session) {
  if (!session || typeof session !== "object") throw new TypeError("session is required.");
  if (session.complete || !session.answered) {
    return Object.freeze({ state: session, advanced: false });
  }

  const complete = session.index === session.correctAnswers.length - 1;
  const state = Object.freeze({
    ...session,
    index: complete ? session.index : session.index + 1,
    answered: false,
    complete,
    submittedAnswer: null,
    wasCorrect: null,
  });
  return Object.freeze({ state, advanced: true });
}

const HIDDEN_VISIBLE_CARD = Object.freeze({
  id: "lesson-hearts-5",
  deck: 1,
  rank: "5",
  suit: "hearts",
  suitSymbol: "♥",
  color: "red",
  tag: 1,
});

const HIDDEN_CARD = Object.freeze({
  id: "lesson-spades-K",
  deck: 1,
  rank: "K",
  suit: "spades",
  suitSymbol: "♠",
  color: "black",
  tag: -1,
});

export function createHiddenExampleState() {
  return Object.freeze({
    visibleCard: HIDDEN_VISIBLE_CARD,
    hiddenCard: HIDDEN_CARD,
    hiddenRevealed: false,
    runningCount: rankTag(HIDDEN_VISIBLE_CARD.rank),
  });
}

export function revealHiddenCard(state) {
  if (!state || typeof state !== "object") throw new TypeError("state is required.");
  if (state.hiddenRevealed) return Object.freeze({ state, revealed: false });
  return Object.freeze({
    state: Object.freeze({
      ...state,
      hiddenRevealed: true,
      runningCount: state.runningCount + rankTag(state.hiddenCard.rank),
    }),
    revealed: true,
  });
}

function dealPracticeBatch(state) {
  if (!["ready", "feedback"].includes(state.phase)) {
    return Object.freeze({ state, dealt: false });
  }
  if (state.position >= state.shoe.length) {
    return Object.freeze({
      state: Object.freeze({ ...state, phase: "complete", currentBatch: Object.freeze([]) }),
      dealt: false,
    });
  }

  const currentBatch = state.shoe.slice(
    state.position,
    Math.min(state.position + state.batchSize, state.shoe.length),
  );
  const runningCount = state.runningCount + sumTags(currentBatch);
  return Object.freeze({
    state: Object.freeze({
      ...state,
      position: state.position + currentBatch.length,
      runningCount,
      phase: "revealed",
      currentBatch: Object.freeze(currentBatch),
      lastResult: null,
    }),
    dealt: true,
  });
}

export function createShoePracticeState(
  { deckCount = 1, batchSize = 1, hideBeforeAnswer = false } = {},
  randomInt = secureRandomInt,
) {
  requireChoice(deckCount, DECK_CHOICES, "deckCount");
  requireChoice(batchSize, BATCH_CHOICES, "batchSize");
  if (typeof hideBeforeAnswer !== "boolean") {
    throw new TypeError("hideBeforeAnswer must be a boolean.");
  }

  const initial = Object.freeze({
    deckCount,
    batchSize,
    hideBeforeAnswer,
    shoe: Object.freeze(shuffle(buildShoe(deckCount), randomInt)),
    position: 0,
    runningCount: 0,
    phase: "ready",
    currentBatch: Object.freeze([]),
    score: 0,
    attempts: 0,
    lastResult: null,
  });
  return dealPracticeBatch(initial).state;
}

export function hidePracticeBatch(state) {
  if (!state || typeof state !== "object") throw new TypeError("state is required.");
  if (!state.hideBeforeAnswer || state.phase !== "revealed") {
    return Object.freeze({ state, hidden: false });
  }
  return Object.freeze({ state: Object.freeze({ ...state, phase: "hidden" }), hidden: true });
}

export function revealPracticeBatch(state) {
  if (!state || typeof state !== "object") throw new TypeError("state is required.");
  if (state.phase !== "hidden") {
    return Object.freeze({ state, revealed: false });
  }
  return Object.freeze({ state: Object.freeze({ ...state, phase: "revealed" }), revealed: true });
}

export function submitPracticeAnswer(state, submittedAnswer) {
  if (!state || typeof state !== "object") throw new TypeError("state is required.");
  requireSafeInteger(submittedAnswer, "submittedAnswer", -MAX_RUNNING_COUNT, MAX_RUNNING_COUNT);
  if (!["revealed", "hidden"].includes(state.phase)) {
    return Object.freeze({ state, accepted: false, correct: state.lastResult?.correct ?? null });
  }

  const correct = submittedAnswer === state.runningCount;
  const trueCount = calculateTrueCount(state.runningCount, state.shoe.length - state.position, "truncate");
  const lastResult = Object.freeze({
    submittedAnswer,
    correctAnswer: state.runningCount,
    correct,
    remainingCards: state.shoe.length - state.position,
    decksRemaining: (state.shoe.length - state.position) / 52,
    rawTrueCount: trueCount.raw,
  });
  return Object.freeze({
    state: Object.freeze({
      ...state,
      phase: "feedback",
      score: state.score + Number(correct),
      attempts: state.attempts + 1,
      lastResult,
    }),
    accepted: true,
    correct,
  });
}

export function advancePractice(state) {
  if (!state || typeof state !== "object") throw new TypeError("state is required.");
  if (state.phase !== "feedback") return Object.freeze({ state, advanced: false });
  const result = dealPracticeBatch(state);
  return Object.freeze({ state: result.state, advanced: true });
}
