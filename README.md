# Counting Desk

Counting Desk is a local website for learning the Hi-Lo blackjack counting system. It starts with the three rank tags, then moves through card classification, guided running-count updates, true-count arithmetic, and a complete-shoe memory exercise.

Watch the [video demo](https://www.youtube.com/shorts/e2pefY0z4gU) to see the trainer in use.

The project uses browser ES modules and Node's built-in HTTP server. It has no package dependencies, accounts, analytics, remote fonts, or remote images.

## Run it

Install Node.js 22 or newer. You do not need to run `npm install`.

On Windows, extract the project and double-click `start.cmd`. Keep the terminal window open, then visit [http://127.0.0.1:4173](http://127.0.0.1:4173).

On any supported platform, run:

```sh
npm start
```

You can choose another port with:

```sh
node server.mjs 8080
```

The server binds to `127.0.0.1`. It serves only the allowlisted files in `public/` and does not open a browser automatically.

## Training modes

1. Learn covers the rank tags, the running-count sum, a fixed hidden-card example, true-count conventions, and the limits of what a count can tell you.
2. Card values grades 20 rank-and-suit cards. Each question accepts one scored answer before Next becomes available.
3. Running count deals 20 cards without replacement from one standard deck. It shows the previous correct count so you can practice each update.
4. True count creates 20 valid scenarios from shuffled six-deck shoe prefixes. You choose floor or truncate. Changing that choice starts a new session.
5. Shoe practice deals a finite 1, 2, 6, or 8 deck shoe in batches of 1, 2, or 4 cards. You can keep a batch visible or hide it before entering the count.

Progress lives in memory for the current tab. Reloading the page resets every score and shoe.

## Math and scope

Ranks 2 through 6 have a tag of +1. Ranks 7 through 9 have a tag of 0. Ranks 10, J, Q, K, and A have a tag of -1. A complete deck contains 20 low cards, 12 neutral cards, and 20 high cards, so its tag sum is zero.

True count uses the exact number of undealt cards:

```text
raw true count = (running count * 52) / remaining cards
```

Counting Desk keeps the raw quotient and applies the selected integer convention only when grading. An empty shoe has no defined true count. See [docs/math.md](docs/math.md) for the full assumptions, examples, and implementation invariants.

The exact-card denominator is a training aid. Real play requires estimating decks remaining. Counting Desk does not provide basic strategy, wagering advice, deviation tables, house-edge claims, bankroll guidance, an EV calculator, or a prediction of the next card. A count does not guarantee a win.

The true-count generator deliberately selects several negative-count examples for practice. Their frequency is teaching-biased and does not estimate how often real counts occur. Every scenario still comes from a physically valid shuffled shoe prefix.

## Test it

Run the built-in Node test runner:

```sh
npm test
```

The tests check card tags and deck composition, unique card IDs, deterministic Fisher-Yates fixtures, full-prefix count conservation, exact true-count integerization against a BigInt rational oracle, generated scenarios, session scoring locks, hidden-card reveal state, shoe exhaustion, public input boundaries, and static-server restrictions.

Continuous integration runs the same command on Windows and Linux with Node 22 and Node 24.

## Sources and related work

These pages informed the mathematical scope. Counting Desk's lessons and code are original text and implementation.

- [Wizard of Odds: High-Low card counting system](https://wizardofodds.com/games/blackjack/card-counting/high-low/) for rank tags, exposed-card running counts, and the running-count-to-decks-remaining formula.
- [Blackjack in Color: True count](https://www.blackjackincolor.com/truecount4.htm) for the fact that deck estimation and integer conventions differ.
- [mhluska/blackjack-simulator](https://github.com/mhluska/blackjack-simulator) as an existing MIT-licensed command-line blackjack and simulation project. Counting Desk does not copy or depend on its code.

Sources were reviewed on 2026-09-15. This project does not claim certification by any source.

## License

[MIT](LICENSE), copyright Counting Desk contributors.
