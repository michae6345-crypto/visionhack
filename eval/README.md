# eval

Ledger tells a store whether its order record meets a federal stocking standard.
Nothing in the repository used to report how often that was right. This directory
is the answer, and its most important job is to be honest about which parts of
the answer are missing.

```bash
npm run eval          # replay stored responses, write RESULTS.md — no key, no network
npm run eval:live     # call the model on every fixture image and record what it says
npm run eval:images   # redraw the fixture images (needs Chromium)
npm run eval -- --fixture 05-weight-priced-produce   # one record, line by line
```

[RESULTS.md](RESULTS.md) is generated. CI regenerates it and fails if the
committed copy is stale, so the numbers in it always belong to the code beside
them.

## The one thing to know first

**Extraction accuracy has not been measured.** No response in `responses/` came
from a real model run, because the work that built this harness had no API key.
Every figure `RESULTS.md` reports today describes the code *after* the model.
How well the vision model reads a photographed order record is unknown, and the
top-level README says so in the same words.

Running `npm run eval:live` with an `OPENROUTER_API_KEY` fixes that: it records
what the model actually returns for each fixture image, and the accuracy section
of `RESULTS.md` fills in on the next run.

## Two kinds of stored response

Each file in `responses/` carries a `source`, and the harness keeps the two apart
and refuses to average them.

| `source` | Where it came from | What it can measure |
| --- | --- | --- |
| `authored` | Derived from the fixture by `authored.mjs` | Only the pipeline after the model |
| `recorded` | Returned by the model for the fixture image | Extraction accuracy |

An authored response has the right transcription by construction, so scoring the
model against it would be measuring a copy of the answer key. What it does
measure is worth having: the pack and quantity parsers, the storage override,
the accessory rules, the confidence floor, the partition step, the stocking
standard and the scorecard — everything that decides the verdict once the words
are on the page.

Authored responses are **deliberately wrong in two ways**, because a response
that read everything correctly would not exercise the guards built for a model
that does not:

1. On a line with no printed unit count, they offer the first number in sight.
   `ROMA TOMATOES 25 LB CS` comes back as a 25-pack. The deterministic parsers
   have to throw that away, and an overcount here is the harness's hard failure.
2. Unrefrigerated whole produce comes back as shelf-stable, because a model is
   reading paper rather than looking at a chiller. The storage override has to
   recover the perishable flag from the description.

The second one has already earned its keep: it showed that the whole-produce
pattern list had no entry for potatoes, limes or carrots and did not strip the
word `BAG`, so a store whose only fresh produce was russet potatoes was recorded
as carrying no perishable produce at all. That is fixed in
`lib/vision/pipeline.ts`, and the list is still a hand-maintained list, so the
next gap is a matter of time. It fails in the safe direction — a missed
perishable makes a store look shorter than it is, never longer.

## The fixtures

24 order records, 319 line items, in `fixtures/`.

- `fixtures/lines.mjs` is the line library. Each entry holds what is **printed**
  on the image and what a careful person reading that line **records**: category,
  variety, storage, units per pack, packs, and whether the line can be counted.
- `fixtures/records.mjs` composes them into records and commits the expected
  verdict for each.
- `fixtures/images/*.png` are the rendered images, committed so nobody needs
  Chromium to run the eval.

**Every fixture is synthetic.** No real store's order record is in this
repository. The product names are brands a corner store carries, but no vendor,
invoice number, price or store name here is real, and none of the lines was
transcribed from a real document. That is a limitation, not a feature: a real
order record has coffee stains, continuation pages, hand-written amendments,
vendor-specific column layouts and abbreviations nobody outside that vendor uses.

### What "ground truth" means here

The truth label is **the reading available from the record**, not the reality on
the shelf. A 25 lb case of loose tomatoes has no printed unit count, so a person
scoring that record cannot count its units either; the fixture says the line
cannot be counted, and the reason. Labelling it with a guessed unit count would
measure the pipeline against something no reader could produce, and would reward
guessing — the one behaviour that can tell a store it passes when it does not.

There is a circularity to watch here. The rule "no printed unit count means no
count" is both what the fixtures label and what the parsers implement, so
agreement on those lines is weaker evidence than it looks. The lines that carry
real information are the ones where a plausible reading exists and is wrong:
`16 / 3 #` is a 16-pack and not a weight, `4x4` is a size grade, `TOMATO GRAPE
PINT` is countable only because a `12 CT` pack column sits beside it.

### Where the expected verdicts come from

`reference-scoring.mjs` is a second implementation of the stocking standard,
written from the published rule rather than from `lib/rules/standard.ts`, sharing
no code with it. It produced the `expected` block committed on each record, and
`tools/expected.mjs` re-checks that the committed literals still agree with it.
The harness compares the app against those literals, never against a fresh run of
either implementation.

Four records were then worked through by hand, and all four caught arithmetic
errors in the first draft of the committed numbers:

| Record | Hand-worked | First draft said |
| --- | --- | --- |
| `01` produce | 150 + 20 + 16 + 24 + 12 + 24 + 200 = **446** | 458 |
| `15` protein | 12 + 12 + 18 + 16 = **58** | 94 |
| `21` dairy | 8 + 9 + 12 + 12 + 12 + 12 + 24 + 12 + 6 = **107** | 128 |
| `23` grains | (16 + 2) + 24 = **42** | 30 |

### How the images were made

`render.mjs` draws each record as HTML and screenshots it with Chromium, in five
styles: a laser invoice, a dot-matrix run on green-bar paper, a faded photocopy,
a phone photo held at an angle, and a hand-written sheet.

The first four are a fair likeness. **The hand-written one is not.** It is an
italic typeface with jittered baselines on ruled paper, which is a poor stand-in
for a real hand: no letter-shape variation, no pen pressure, no crossings-out,
no drift. Treat any figure from the handwritten fixtures as a floor on
difficulty, not as a measurement of how the model reads handwriting. The same
applies, less severely, to glare and skew: they are CSS, not optics.

## Can the harness fail?

A score of 100% is only worth reading if the harness can report anything else, so
it was checked by breaking things on purpose:

| Deliberate break | Caught? |
| --- | --- |
| Pack parser accepts `40 #` as a 40-pack | Yes — 9 overcounted lines, non-zero exit |
| Minimum units per variety changed from 3 to 2 | Yes, after the gate was tightened — 3 category rows disagree |

The second one was not caught at first: the verdict stayed the same on all 24
records while the numbers underneath moved, and the gate only looked at verdicts.
It now fails on any category row whose varieties, units or perishable flag
disagree with the hand scoring.

## What the harness fails on

`npm run eval` exits non-zero when, on authored responses, any of these is true:

- a line was counted that the fixture says cannot be counted (an overcount);
- a countable line was held back;
- a record's verdict disagrees with the hand scoring in either direction;
- a category row disagrees on varieties, units or the perishable flag;
- the pipeline rejected an authored response outright;
- a fixture has no stored response.

Figures from recorded model responses are reported and never gated. Gating them
would turn a measurement into a target.

## Changing a fixture

```bash
node eval/tools/expected.mjs            # does the committed verdict still hold?
node eval/tools/record-responses.mjs    # rewrite authored responses
npm run eval:images                     # redraw the images
npm run eval                            # rewrite RESULTS.md
```

`record-responses.mjs` never overwrites a response whose source is `recorded`:
that file is evidence of what a model said, and the tool is not.
