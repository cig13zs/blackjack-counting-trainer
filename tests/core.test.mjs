import assert from "node:assert/strict";
import test from "node:test";

import {
  BATCH_CHOICES,
  DECK_CHOICES,
  RANKS,
  SUITS,
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
  runningCountSteps,
  shuffle,
  submitPracticeAnswer,
  submitSessionAnswer,
  sumTags,
} from "../public/core.js";

const ORACLE = Object.freeze({
  "2": 1,
  "3": 1,
  "4": 1,
  "5": 1,
  "6": 1,
  "7": 0,
  "8": 0,
  "9": 0,
  "10": -1,
  J: -1,
  Q: -1,
  K: -1,
  A: -1,
});

function cyclingRandomInt() {
  let value = 7;
  return (maxExclusive) => {
    value = (value * 17 + 11) % 997;
    return value % maxExclusive;
  };
}

test("all 52 card tags match an independent rank oracle", () => {
  const deck = buildShoe(1);
  assert.equal(deck.length, 52);
  for (const card of deck) {
    assert.equal(card.tag, ORACLE[card.rank], card.id);
    assert.equal(rankTag(card.rank), ORACLE[card.rank], card.id);
  }
});

for (const deckCount of DECK_CHOICES) {
  test(`${deckCount}-deck shoe has the exact composition and unique IDs`, () => {
    const shoe = buildShoe(deckCount);
    assert.equal(shoe.length, 52 * deckCount);
    assert.equal(new Set(shoe.map((card) => card.id)).size, shoe.length);

    for (const rank of RANKS) {
      assert.equal(shoe.filter((card) => card.rank === rank).length, 4 * deckCount);
    }
    for (const suit of SUITS) {
      assert.equal(shoe.filter((card) => card.suit === suit.name).length, 13 * deckCount);
    }

    assert.equal(shoe.filter((card) => ORACLE[card.rank] === 1).length, 20 * deckCount);
    assert.equal(shoe.filter((card) => ORACLE[card.rank] === 0).length, 12 * deckCount);
    assert.equal(shoe.filter((card) => ORACLE[card.rank] === -1).length, 20 * deckCount);
    assert.equal(sumTags(shoe), 0);
  });
}

test("shuffle follows a deterministic Fisher-Yates fixture without mutating input", () => {
  const original = ["a", "b", "c", "d"];
  const shuffled = shuffle(original, () => 0);
  assert.deepEqual(shuffled, ["b", "c", "d", "a"]);
  assert.deepEqual(original, ["a", "b", "c", "d"]);
  assert.deepEqual([...shuffled].sort(), original);
});

test("shuffle rejects out-of-range and noninteger RNG results", () => {
  assert.throws(() => shuffle([1, 2], () => 2), /randomInt result/);
  assert.throws(() => shuffle([1, 2], () => 0.5), /randomInt result/);
  assert.throws(() => shuffle({}, () => 0), /array/);
});

test("every prefix running count equals remaining high cards minus remaining low cards", () => {
  const shoe = shuffle(buildShoe(8), cyclingRandomInt());
  let runningCount = 0;
  for (let exposedCount = 0; exposedCount <= shoe.length; exposedCount += 1) {
    if (exposedCount > 0) runningCount += ORACLE[shoe[exposedCount - 1].rank];
    const remaining = shoe.slice(exposedCount);
    const remainingHigh = remaining.filter((card) => ORACLE[card.rank] === -1).length;
    const remainingLow = remaining.filter((card) => ORACLE[card.rank] === 1).length;
    assert.equal(runningCount, remainingHigh - remainingLow, `prefix ${exposedCount}`);
  }
});

test("the published reference sequence finishes at +2", () => {
  const ranks = ["3", "5", "K", "7", "Q", "A", "8", "5", "4", "2"];
  const cards = ranks.map((rank, index) => ({ rank, id: `reference-${index}` }));
  const steps = runningCountSteps(cards);
  assert.deepEqual(steps.map((step) => step.correctCount), [1, 2, 1, 1, 0, -1, -1, 0, 1, 2]);
  assert.equal(steps.at(-1).correctCount, 2);
});

test("running-count questions are 20 cards dealt without replacement", () => {
  const questions = createRunningCountQuestions(cyclingRandomInt());
  assert.equal(questions.length, 20);
  assert.equal(new Set(questions.map((question) => question.card.id)).size, 20);
  questions.forEach((question, index) => {
    const expectedPrevious = index === 0 ? 0 : questions[index - 1].correctCount;
    assert.equal(question.previousCount, expectedPrevious);
    assert.equal(question.correctCount, expectedPrevious + ORACLE[question.card.rank]);
  });
});

test("true count handles negative floor and truncation differently", () => {
  assert.deepEqual(calculateTrueCount(-3, 104, "floor"), {
    raw: -1.5,
    value: -2,
    decksRemaining: 2,
  });
  assert.deepEqual(calculateTrueCount(-3, 104, "truncate"), {
    raw: -1.5,
    value: -1,
    decksRemaining: 2,
  });
});

test("true count preserves exact rational integer boundaries", () => {
  assert.equal(calculateTrueCount(-15, 15, "floor").raw, -52);
  assert.equal(calculateTrueCount(-15, 15, "floor").value, -52);
  assert.equal(calculateTrueCount(27, 27, "floor").raw, 52);
  assert.equal(calculateTrueCount(27, 27, "floor").value, 52);
});

test("floor and truncate match a BigInt rational oracle", () => {
  for (let remainingCards = 1; remainingCards <= 416; remainingCards += 1) {
    const denominator = BigInt(remainingCards);
    for (let runningCount = -160; runningCount <= 160; runningCount += 1) {
      const numerator = BigInt(runningCount * 52);
      const truncated = numerator / denominator;
      const remainder = numerator % denominator;
      const floored = numerator < 0n && remainder !== 0n ? truncated - 1n : truncated;
      assert.equal(
        calculateTrueCount(runningCount, remainingCards, "truncate").value,
        Number(truncated),
      );
      assert.equal(
        calculateTrueCount(runningCount, remainingCards, "floor").value,
        Number(floored),
      );
    }
  }
});

test("true count uses exact remaining-card denominators", () => {
  const result = calculateTrueCount(5, 130, "floor");
  assert.equal(result.decksRemaining, 2.5);
  assert.equal(result.raw, 2);
  assert.equal(result.value, 2);
});

test("an empty shoe has an undefined true count", () => {
  assert.deepEqual(calculateTrueCount(0, 0, "floor"), {
    raw: null,
    value: null,
    decksRemaining: 0,
  });
});

test("true-count scenarios come from valid six-deck prefixes", () => {
  const generated = createTrueCountScenarios(20, cyclingRandomInt());
  assert.equal(generated.shoe.length, 312);
  assert.equal(generated.questions.length, 20);
  assert.ok(generated.questions.filter((question) => question.runningCount < 0).length >= 4);
  assert.ok(generated.questions.some((question) => question.remainingCards % 52 !== 0));

  for (const question of generated.questions) {
    const exposed = generated.shoe.slice(0, question.exposedCount);
    assert.equal(question.runningCount, exposed.reduce((total, card) => total + ORACLE[card.rank], 0));
    assert.equal(question.remainingCards, generated.shoe.length - question.exposedCount);
    assert.equal(question.decksRemaining, question.remainingCards / 52);
  }
});

test("a scored question accepts only one submission", () => {
  const initial = createScoredSession([1, 0]);
  const first = submitSessionAnswer(initial, 1);
  assert.equal(first.accepted, true);
  assert.equal(first.state.score, 1);

  const duplicate = submitSessionAnswer(first.state, 0);
  assert.equal(duplicate.accepted, false);
  assert.strictEqual(duplicate.state, first.state);
  assert.equal(duplicate.state.score, 1);

  const advanced = advanceSession(duplicate.state);
  assert.equal(advanced.advanced, true);
  assert.equal(advanced.state.index, 1);
});

test("an incorrect running-count answer never becomes engine state", () => {
  const correctAnswers = [1, 0, -1];
  let session = createScoredSession(correctAnswers);
  session = submitSessionAnswer(session, 99).state;
  assert.equal(session.score, 0);
  assert.equal(session.correctAnswers[session.index], 1);
  session = advanceSession(session).state;
  assert.equal(session.correctAnswers[session.index], 0);
});

test("the hidden card counts once and only after reveal", () => {
  const initial = createHiddenExampleState();
  assert.equal(initial.runningCount, 1);
  assert.equal(initial.hiddenRevealed, false);

  const first = revealHiddenCard(initial);
  assert.equal(first.revealed, true);
  assert.equal(first.state.runningCount, 0);
  const duplicate = revealHiddenCard(first.state);
  assert.equal(duplicate.revealed, false);
  assert.strictEqual(duplicate.state, first.state);
  assert.equal(duplicate.state.runningCount, 0);
});

test("shoe practice exposes before input, never adopts a wrong answer, and exhausts once", () => {
  let state = createShoePracticeState(
    { deckCount: 1, batchSize: 4, hideBeforeAnswer: true },
    cyclingRandomInt(),
  );
  assert.equal(state.phase, "revealed");
  assert.equal(state.currentBatch.length, 4);

  const hidden = hidePracticeBatch(state);
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.state.phase, "hidden");
  const shownAgain = revealPracticeBatch(hidden.state);
  assert.equal(shownAgain.revealed, true);
  assert.equal(shownAgain.state.phase, "revealed");
  const hiddenAgain = hidePracticeBatch(shownAgain.state);
  const correctEngineCount = hiddenAgain.state.runningCount;
  state = submitPracticeAnswer(hiddenAgain.state, 99).state;
  assert.equal(state.lastResult.correct, false);
  assert.equal(state.runningCount, correctEngineCount);

  while (state.phase !== "complete") {
    if (state.phase === "feedback") {
      state = advancePractice(state).state;
    } else {
      state = submitPracticeAnswer(state, state.runningCount).state;
    }
  }

  assert.equal(state.position, 52);
  assert.equal(state.runningCount, 0);
  assert.equal(state.attempts, 13);
  assert.equal(advancePractice(state).advanced, false);
});

test("practice prevents double submission", () => {
  const initial = createShoePracticeState({ deckCount: 1, batchSize: 1 }, cyclingRandomInt());
  const first = submitPracticeAnswer(initial, initial.runningCount);
  const duplicate = submitPracticeAnswer(first.state, initial.runningCount);
  assert.equal(first.accepted, true);
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.state.attempts, 1);
});

test("invalid public inputs fail clearly", () => {
  for (const value of [0, 3, 9, NaN, Infinity, "1"]) {
    assert.throws(() => buildShoe(value), /deckCount/);
  }
  for (const rank of ["1", "11", "ace", "", null, NaN]) {
    assert.throws(() => rankTag(rank), /rank/i);
  }
  for (const value of [NaN, Infinity, -Infinity, 1.2, "2"]) {
    assert.throws(() => calculateTrueCount(value, 52, "floor"), /runningCount/);
  }
  for (const value of [-1, NaN, Infinity, 1.2, "52"]) {
    assert.throws(() => calculateTrueCount(1, value, "floor"), /remainingCards/);
  }
  assert.throws(() => calculateTrueCount(1, 52, "round"), /convention/);
  assert.throws(
    () => createShoePracticeState({ deckCount: 1, batchSize: 3 }),
    /batchSize/,
  );
  assert.deepEqual(BATCH_CHOICES, [1, 2, 4]);
});

test("answer parsing accepts signed whole numbers and bounds extreme input", () => {
  assert.equal(parseIntegerAnswer(" -12 "), -12);
  assert.equal(parseIntegerAnswer("+3"), 3);
  assert.equal(parseIntegerAnswer("-0"), 0);
  for (const value of ["", "1.5", "1e2", "1001", "-1001", "1000000000000000", null]) {
    assert.equal(parseIntegerAnswer(value, 1000), null);
  }
  assert.throws(() => parseIntegerAnswer("2", Infinity), /maxAbsoluteValue/);
});
