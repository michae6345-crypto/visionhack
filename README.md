# Ledger

Photograph a wholesale order record. Ledger reads the line items, counts them
against the USDA SNAP staple-food stocking standard that takes effect on
4 November 2026, and tells the store owner what is short and what to buy. It
also tracks the license and permit dates a corner store has to renew.

```bash
npm install
npm run demo     # score a record end to end, no API key needed
```

## What this is, and what it is not

**Ledger is a self-assessment aid. It is not a compliance determination.**

Only USDA decides whether a store is authorized for SNAP. Ledger reads one
photograph of one order record and compares what it can count against the
numbers in the rule. It cannot see the shelf, it does not know what sold since
the delivery, and it has no standing to determine eligibility.

Ledger does not guarantee authorization, and no result it produces should be
described that way. A green result means the lines it could read on that record
meet the Criterion A thresholds. It does not mean the store passes an
inspection.

### The rule, as encoded

Criterion A of the updated staple-food stocking standard, effective
**4 November 2026**:

| Requirement | Value |
| --- | --- |
| Varieties in each of the four staple categories | 7 |
| Stocking units per variety before it counts at all | 3 |
| Stocking units per category | 21 |
| Stocking units across all four categories | 84 |
| Categories carrying at least one perishable variety | 3 of 4 |

The four categories are dairy, grains, protein, and fruits and vegetables. A
variety below three units contributes nothing: not to the variety count, and not
to the unit totals. Variety counts round down. Butter other than peanut butter,
and all jerky, are accessory foods that count for nothing.

Sources, and the limits of what they support, are in
[docs/regulatory-basis.md](docs/regulatory-basis.md):

- [SNAP Stocking Standards Final Rule](https://www.fna.usda.gov/snap/retailer/stocking-standards-rule)
- [Final Rule: Updated Staple Food Stocking Standards](https://www.fna.usda.gov/snap/fr-050826)

The thresholds live in one file, [`lib/rules/standard.ts`](lib/rules/standard.ts),
with no copy, no locale and no model anywhere near them.
[`scripts/standard.test.mjs`](scripts/standard.test.mjs) tests them with no API
key in the file.

### How accurate is the extraction?

**The vision model's accuracy has not been measured.** Nothing in this
repository establishes how often it reads a photographed order record correctly,
because no response stored here came from a real model run.
[`eval/RESULTS.md`](eval/RESULTS.md) prints "not measured" for that section, and
will keep printing it until someone with an `OPENROUTER_API_KEY` runs
`npm run eval:live`.

What **is** measured is everything after the model: the pack and quantity
parsers, the storage override, the accessory rules, the partition step, the
standard and the scorecard. Across 24 fixture records and 319 hand-labeled line
items:

| | |
| --- | --- |
| Pass/fail agreement with a hand scoring of the same record | 24 of 24 |
| Records scored as a pass that should fail | 0 |
| Lines counted that should have been held back | 0 |
| Countable lines held back | 0 |
| Category rows agreeing on varieties, units and perishables | 96 of 96 |

Read those numbers with the caveats attached in
[`eval/README.md`](eval/README.md). The fixtures are synthetic, the handwritten
ones simulate an irregular hand rather than photograph one, and on the
weight-priced lines the rule the fixtures encode is the same rule the parsers
implement, so agreement there is weaker evidence than it looks.

Two things the eval has already caught: a gap in the whole-produce storage list
that cost a store its perishable credit for potatoes, limes and carrots, and a
weakness in the eval's own failure gate that let a wrong threshold pass. Both
are written up in [`eval/README.md`](eval/README.md).

### Known failure modes

- **Weight-priced lines cannot be counted.** `ROMA TOMATOES 25 LB CS` carries no
  sellable unit count, so Ledger holds the line back rather than guessing one. A
  produce-heavy order record can be almost entirely unreadable this way, and the
  store will look far shorter than it is.
- **Container and grade columns are not counts.** `BUSHEL`, `BOX`, `4x4` and
  `40 #` are all held back for the same reason.
- **Abbreviations and multi-pack SKUs** (`WHL MLK GALLON`, `16 / 3 #`) are the
  cases where a plausible misreading exists. They are the lines worth checking
  by hand.
- **Handwriting** is the least tested path in the system, and the fixtures do
  not yet stand in for it honestly.

Every one of these fails in the safe direction: a line Ledger cannot read is a
line it does not count, so the store is told it is shorter than it is rather
than longer.

### If the scan and your own count disagree

**Trust your count.** Then:

1. Look at the held-back lines. Ledger lists every line it read and did not
   count, with the reason. Most disagreements are here, and most of those are
   lines sold by weight.
2. Check the pack column. Ledger counts sellable units, not cases. A case of
   24 yogurt cups is 24 units; a 40 lb box of loose tomatoes is not 40.
3. Remember the record is not the shelf. An order record shows what was
   delivered, not what is still there, and not what the store already had.
4. Count what USDA counts: what is continuously stocked and offered for sale on
   the shelf, not what an invoice says arrived.

If your count says you meet the standard and Ledger says otherwise, your count
is the one that matters. Ledger has no way to see the shelf, and USDA is not
going to ask it.

## Getting started

```bash
git clone https://github.com/michae6345-crypto/visionhack.git
cd visionhack
npm install

npm run demo      # score a fixture record in the terminal, no key required
npm run eval      # rebuild eval/RESULTS.md from the stored responses
npm run dev       # the web app on http://localhost:3000
```

The demo, the eval and the whole test suite run with no API key and no network.
A key is needed only to scan a new image.

### Environment variables

| Variable | Required for | Notes |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | `POST /api/scan`, `npm run eval:live`, `npm run smoke` | An `sk-or-...` key from [openrouter.ai](https://openrouter.ai). **Server-side only.** Never prefix it with `NEXT_PUBLIC_` and never import it into a client component. |
| `CHROMIUM_PATH` | `npm run eval:images` | Path to a Chrome or Chromium binary. Only needed to redraw the fixture images, which are committed. |

Copy `.env.example` to `.env.local` and fill in the key. Nothing else is
configurable through the environment.

On Vercel, set `OPENROUTER_API_KEY` in the project settings and then
**redeploy**: environment variable changes do not apply to existing deployments.
Without the key, `/api/scan` returns a 500 whose message says exactly that. A
500 mentioning credits means the OpenRouter account needs topping up, and that
one does not need a redeploy.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Unit and contract tests. No key, no network |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run demo` | Score one fixture record end to end, keyless |
| `npm run eval` | Rebuild `eval/RESULTS.md` from stored responses |
| `npm run eval:live` | Call the model on every fixture image and record it. Needs a key |
| `npm run eval:images` | Redraw the fixture images. Needs Chromium |
| `npm run smoke` | Boot the production build and check the API guards. Run `npm run build` first |

## How it works

A photographed record goes through two vision passes, and then through code that
does not trust either of them.

1. **Transcribe.** Pass 1 copies the printed lines verbatim: description, pack
   column, quantity column, and whether the line is legible at all. It does not
   interpret anything.
2. **Classify.** Pass 2 assigns a category, a variety, and how the item is
   stored.
3. **Reconcile.** [`lib/vision/pipeline.ts`](lib/vision/pipeline.ts) throws away
   the model's own pack and quantity figures and re-derives them from the
   transcription with strict parsers. A number the model inferred rather than
   read never reaches the count. This is the layer that decides most of the
   arithmetic.
4. **Partition.** [`lib/rules/partition.ts`](lib/rules/partition.ts) splits the
   lines into counted and held back, re-checking every rule in code rather than
   trusting the prompt.
5. **Score.** [`lib/rules/standard.ts`](lib/rules/standard.ts) does the
   arithmetic. [`lib/rules/optimizer.ts`](lib/rules/optimizer.ts) solves for the
   fewest added stocking units that clear every unmet requirement at once, and
   records which requirement each purchase clears.

Structure is enforced by tool calls: each pass declares exactly one function
generated from a Zod schema, and anything that is not a single schema-valid call
to that function is rejected. Model prose is never read as data.

`POST /api/scan` is documented in [docs/api-scan.md](docs/api-scan.md).

## Repository layout

| Path | |
| --- | --- |
| `app/` | Next.js App Router pages and the scan route |
| `lib/rules/` | The standard, the partition step, the optimizer, the constants |
| `lib/vision/` | Prompts, Zod schemas, the two-pass pipeline |
| `eval/` | Fixtures, metrics, harness, results |
| `scripts/` | Tests, the demo, the smoke check |
| `site/` | Static fallback published to GitHub Pages |

## Contributing

- Keep changes focused and easy to review.
- Add or update tests when behavior changes.
- Run `npm test`, `npm run eval` and `npm run typecheck` before opening a PR. CI
  runs all three, and fails if `eval/RESULTS.md` is out of date.
- Do not weaken the regulatory language. If a result looks bad, the result is
  the thing to fix.
- Never commit secrets, credentials, or local environment files.
