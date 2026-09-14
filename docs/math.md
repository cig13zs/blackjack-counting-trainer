# Counting Desk math notes

This document states the rules used by the trainer and the assumptions needed for each conclusion. The core functions live in `public/core.js`; the browser and Node tests import the same file.

## Hi-Lo tags

The tag function is:

| Ranks | Tag |
| --- | ---: |
| 2, 3, 4, 5, 6 | +1 |
| 7, 8, 9 | 0 |
| 10, J, Q, K, A | -1 |

A standard deck has four cards of each rank. It therefore has 20 cards tagged +1, 12 tagged 0, and 20 tagged -1. The sum of every complete deck is zero. The same composition scales directly to the supported 1, 2, 6, and 8 deck shoes.

Every generated card has a unique ID containing its deck number, suit, and rank. Cards with the same rank and suit in separate decks remain distinct.

## Running count

For exposed cards `c1` through `cn`, the running count is:

```text
RC(n) = tag(c1) + tag(c2) + ... + tag(cn)
```

The reference sequence in the lesson is:

```text
3, 5, K, 7, Q, A, 8, 5, 4, 2
+1 +1 -1 +0 -1 -1 +0 +1 +1 +1 = +2
```

If the shoe began complete and every removed card has been exposed and counted, the running count also equals:

```text
high cards remaining - low cards remaining
```

That identity does not describe only the undealt shoe when removed cards remain unseen. A face-down card enters the running count once its rank becomes known.

An independent reshuffle erases the information in the previous sequence, so a new shoe starts at zero.

## True count

Counting Desk uses an exact-card denominator:

```text
decks remaining = remaining cards / 52
raw true count = running count / decks remaining
               = (running count * 52) / remaining cards
```

The implementation evaluates the second form. Multiplying the integer running count by 52 first keeps exact rational integer boundaries from drifting because of an intermediate floating-point division. For example, running count -15 with 15 cards remaining is exactly -52, and running count +27 with 27 cards remaining is exactly +52.

The raw quotient stays unrounded. Grading then uses one selected convention:

- Floor chooses the greatest integer less than or equal to the raw value. Floor(-1.5) is -2.
- Truncate drops the fractional part toward zero. Truncate(-1.5) is -1.

For a running count of -3 with 104 cards remaining:

```text
decks remaining = 104 / 52 = 2
raw true count = -3 / 2 = -1.5
floor result = -2
truncate result = -1
```

Negative zero is normalized to zero. When no cards remain, the denominator is zero and true count is undefined. The core returns `null` for both the raw and integer values instead of returning zero or infinity.

Exact remaining-card division makes the arithmetic auditable. It does not claim that a person at a table can see an exact denominator. Real deck estimation methods and published playing indices can vary with game rules and rounding conventions; those topics are outside this trainer.

## Scenario validity

Each true-count question comes from a prefix of a generated six-deck shoe. The generator builds all 312 distinct cards, shuffles them, exposes a prefix, and computes the running count from those exposed cards. The number of remaining cards is `312 - exposed cards`.

The set deliberately includes negative running counts and fractional quantities of decks remaining. Selection is biased for teaching coverage, so the mix of questions is not a model of real count frequencies. Reversing a shuffled card order may be used to obtain enough negative examples; reversal preserves the complete physical composition and still produces valid without-replacement prefixes.

Shoe practice uses the same finite-shoe rules. It never silently wraps or reshuffles after exhaustion. Each batch appears face up before an answer. If the learner hides it, the cards remain counted because they were already exposed. The engine updates its running count from the dealt cards, never from the learner's submitted value.

## Randomization

`shuffle` uses Fisher-Yates. It accepts an injected bounded-integer function for deterministic tests. The default uses `crypto.getRandomValues` and rejection sampling, which avoids modulo bias. The function rejects any injected result that is not an integer inside the requested range.

Random shuffles make practice order unpredictable. They are not cryptographic, casino, or statistical certification claims.

## Scoring lifecycle

A fixed exercise question has two phases: unanswered and answered. The first valid integer submission receives a grade and locks the question. A duplicate submission cannot alter the score. Next moves to the following question only after a grade exists.

Shoe practice adds revealed, optionally hidden, feedback, and complete phases. A learner cannot answer before the batch has appeared, skip directly to the next batch, or continue past the end of the shoe. The final running count of a complete shoe is zero.

## Runnable examples

From the project directory with Node.js 22 or newer:

```sh
node -e "import('./public/core.js').then(({rankTag}) => console.log(rankTag('5')))"
node -e "import('./public/core.js').then(({calculateTrueCount}) => console.log(calculateTrueCount(-3, 104, 'floor')))"
npm test
```

The first command prints `1`. The second returns raw -1.5, integer value -2, and 2 decks remaining.

## References

- [Wizard of Odds: High-Low card counting system](https://wizardofodds.com/games/blackjack/card-counting/high-low/), reviewed 2026-09-15.
- [Blackjack in Color: True count](https://www.blackjackincolor.com/truecount4.htm), reviewed 2026-09-15.

Counting Desk uses short factual rules from these references and provides its own explanations, examples, code, and tests. It does not reproduce published strategy tables or long source passages.
