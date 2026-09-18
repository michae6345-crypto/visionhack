/**
 * Draws each fixture record as an order-record image.
 *
 *   npm run eval:images                    all of them
 *   npm run eval:images -- 05-weight-priced-produce   one
 *
 * The images are committed, so a reviewer never needs to run this. It is needed
 * only when a fixture's lines change, or before `npm run eval:live`, and it needs
 * a Chromium binary: set CHROMIUM_PATH, or let it find the Playwright one this
 * container ships (PLAYWRIGHT_BROWSERS_PATH), or have chromium on PATH.
 *
 * HOW FAITHFUL THESE ARE. Each style is CSS over the same printed text: a laser
 * invoice, a worn dot-matrix run, a faded photocopy, a phone photo at an angle,
 * and a hand-written sheet. The first four are a fair likeness of the artefacts
 * they imitate. The hand-written one is NOT: it is an italic face with jittered
 * baselines, which is a poor stand-in for real handwriting. Any figure measured
 * on the handwritten fixtures should be read as a floor on difficulty, not as a
 * measurement of how the model handles a real hand. eval/README.md repeats this.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

import { RECORDS, resolveRecord } from "./fixtures/records.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const imagesDir = resolve(here, "fixtures", "images");

// ---------------------------------------------------------------------------
// Chromium
// ---------------------------------------------------------------------------
function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  const browsers = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (browsers && existsSync(browsers)) {
    for (const entry of readdirSync(browsers)) {
      if (!entry.startsWith("chromium-")) continue;
      const candidate = join(browsers, entry, "chrome-linux", "chrome");
      if (existsSync(candidate)) return candidate;
    }
  }

  for (const name of ["chromium", "chromium-browser", "google-chrome", "chrome"]) {
    try {
      return execFileSync("which", [name], { encoding: "utf8" }).trim();
    } catch {
      // Not on PATH; try the next one.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const STYLE_CSS = {
  laser: `
    body { background: #f2f2f0; }
    .sheet { background: #fff; color: #111; font-family: "Liberation Mono", monospace; }
    .rule { border-color: #222; }
  `,
  dotmatrix: `
    body { background: #d9dbd2; }
    .sheet {
      background: repeating-linear-gradient(#fdfdf5 0 26px, #eef3e6 26px 52px);
      color: #2b2f2b; font-family: "DejaVu Sans Mono", monospace;
      letter-spacing: 0.6px; font-weight: 700; opacity: 0.93;
      text-shadow: 0.4px 0 0 rgba(43,47,43,0.5), -0.4px 0 0 rgba(43,47,43,0.3);
    }
    .row { filter: blur(0.25px); }
    .rule { border-color: #4a4f4a; }
  `,
  photocopy: `
    body { background: #dedede; }
    .sheet {
      background: #f7f7f4; color: #3a3a3a; font-family: "Liberation Mono", monospace;
      filter: grayscale(1) contrast(1.35) brightness(1.04);
      transform: rotate(-0.7deg);
    }
    .sheet::after {
      content: ""; position: absolute; inset: 0; pointer-events: none;
      background-image: url("data:image/svg+xml;utf8,\
<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'>\
<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/>\
<feColorMatrix type='saturate' values='0'/></filter>\
<rect width='180' height='180' filter='url(%23n)' opacity='0.22'/></svg>");
      mix-blend-mode: multiply;
    }
    .row:nth-child(4n) { opacity: 0.72; }
    .rule { border-color: #777; }
  `,
  "phone-photo": `
    body { background: #1d1f22; padding: 60px 40px; }
    .sheet {
      background: #fbfbf8; color: #15171a; font-family: "Liberation Mono", monospace;
      transform: perspective(1500px) rotateY(-5deg) rotateZ(-0.9deg) scale(0.97);
      box-shadow: 26px 34px 70px rgba(0,0,0,0.55);
    }
    .sheet::after {
      content: ""; position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(1100px 380px at 76% 12%, rgba(255,255,255,0.92), rgba(255,255,255,0) 62%);
    }
    .rule { border-color: #333; }
  `,
  handwritten: `
    body { background: #e8e6de; }
    .sheet {
      background: repeating-linear-gradient(#fffef8 0 33px, #e3e9f2 33px 34px);
      color: #1c3f8f; font-family: "DejaVu Sans", sans-serif;
      font-style: italic; font-size: 21px; letter-spacing: 0.3px;
    }
    .sheet .head { font-size: 22px; }
    .row { border: 0; }
    .rule { border-color: #7d8ba6; }
  `,
};

/** Small deterministic jitter, so a re-render produces the same image. */
function jitter(seed, spread) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return ((value - Math.floor(value)) * 2 - 1) * spread;
}

function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function rowHtml(line, index, style) {
  const { code, description, pack, qty, price } = line.printed;
  const hand = style === "handwritten";
  const transform = hand
    ? `transform: rotate(${jitter(index + 1, 0.7).toFixed(2)}deg) translateY(${jitter(index + 7, 2.2).toFixed(1)}px);`
    : "";

  const cells = hand
    ? [
        ["desc", description],
        ["pack", pack],
        ["qty", qty],
        ["price", price],
      ]
    : [
        ["code", code],
        ["desc", description],
        ["pack", pack],
        ["qty", qty],
        ["price", price],
      ];

  return `<div class="row" style="${transform}">${cells
    .map(([cls, value]) => `<span class="${cls}">${escapeHtml(value)}</span>`)
    .join("")}</div>`;
}

function html(record) {
  const { style } = record;
  const hand = style === "handwritten";
  const lineCount = record.lines.length;

  const header = hand
    ? `<div class="head">
         <div class="big">${escapeHtml(record.storeName)}</div>
         <div>order for ${escapeHtml(record.date)}</div>
       </div>`
    : `<div class="head">
         <div class="big">${escapeHtml(record.vendor)}</div>
         <div>WHOLESALE ORDER RECORD${record.invoiceNo ? ` &nbsp; ${escapeHtml(record.invoiceNo)}` : ""}</div>
         <div>SHIP TO: ${escapeHtml(record.storeName)} &nbsp;&nbsp; DATE: ${escapeHtml(record.date)}</div>
       </div>`;

  const columns = hand
    ? ""
    : `<div class="row cols">
         <span class="code">ITEM</span><span class="desc">DESCRIPTION</span>
         <span class="pack">PACK</span><span class="qty">QTY</span><span class="price">EXT</span>
       </div>`;

  const total = record.lines
    .reduce((sum, line) => sum + Number(line.printed.price || 0), 0)
    .toFixed(2);

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 40px; }
  .sheet { position: relative; padding: 34px 40px 40px; font-size: 15px; line-height: 1.45; }
  .head { margin-bottom: 18px; }
  .head .big { font-size: 22px; font-weight: 700; letter-spacing: 1px; }
  .rule { border-top: 1px solid; margin: 12px 0; }
  .row { display: flex; gap: 14px; white-space: pre; }
  .cols { font-weight: 700; }
  .code { width: 78px; }
  .desc { flex: 1; min-width: 0; overflow: hidden; }
  .pack { width: 118px; }
  .qty { width: 42px; text-align: right; }
  .price { width: 86px; text-align: right; }
  .totals { margin-top: 18px; text-align: right; font-weight: 700; }
  ${STYLE_CSS[style] ?? STYLE_CSS.laser}
</style></head>
<body><div class="sheet">
  ${header}
  <div class="rule"></div>
  ${columns}
  ${record.lines.map((line, index) => rowHtml(line, index, style)).join("\n  ")}
  <div class="rule"></div>
  <div class="totals">${lineCount} LINE${lineCount === 1 ? "" : "S"} &nbsp;&nbsp; TOTAL ${total}</div>
</div></body></html>`;
}

/**
 * Tall enough for the content and no taller. The screenshot is the viewport, so
 * a generous guess leaves a band of empty background under the sheet.
 */
function heightFor(record) {
  const rowHeight = record.style === "handwritten" ? 31 : 22;
  const chrome = record.style === "phone-photo" ? 150 : 70;
  return Math.round(240 + record.lines.length * rowHeight + chrome);
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const wanted = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
const selected = wanted.length > 0 ? RECORDS.filter((r) => wanted.includes(r.id)) : RECORDS;

if (selected.length === 0) {
  console.error(`No fixture matches ${wanted.join(", ")}`);
  process.exit(1);
}

const chromium = findChromium();
if (!chromium) {
  console.error(
    "No Chromium found. Set CHROMIUM_PATH to a Chrome or Chromium binary.\n" +
      "The images are committed, so this is only needed when a fixture changes.",
  );
  process.exit(1);
}

mkdirSync(imagesDir, { recursive: true });
const scratch = resolve(tmpdir(), `ledger-eval-${process.pid}`);
mkdirSync(scratch, { recursive: true });

let rendered = 0;
try {
  for (const entry of selected) {
    const record = resolveRecord(entry);
    const page = resolve(scratch, `${record.id}.html`);
    writeFileSync(page, html(record));

    const out = resolve(imagesDir, `${record.id}.png`);
    execFileSync(
      chromium,
      [
        "--headless",
        "--no-sandbox",
        "--disable-gpu",
        "--hide-scrollbars",
        "--force-device-scale-factor=1",
        `--screenshot=${out}`,
        `--window-size=1000,${heightFor(record)}`,
        `file://${page}`,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    rendered++;
    console.log(`${record.id}.png  ${record.style}  ${record.lines.length} lines`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`\n${rendered} image${rendered === 1 ? "" : "s"} written to eval/fixtures/images/`);
