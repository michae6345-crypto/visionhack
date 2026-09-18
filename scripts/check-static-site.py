#!/usr/bin/env python3
"""Check the static fallback in site/ without a browser or a network.

The whole value of site/ is that it works when nothing else does, so the things
that would quietly break it are checked here and in CI:

- every local asset a page references actually exists;
- no page depends on JavaScript to become readable;
- the scan demo's saved result still scores the way the rule engine would; and
- the thresholds in site/assets/app.js still match lib/rules/standard.ts.

    python3 scripts/check-static-site.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
PAGES = sorted(SITE.glob("*.html"))

failures: list[str] = []


def check(condition: bool, message: str) -> None:
    if not condition:
        failures.append(message)


# --------------------------------------------------------------------------
# Pages exist and reference only assets that are present
# --------------------------------------------------------------------------
check(bool(PAGES), "site/ contains no HTML pages — run brand/tools/build-static-site.py")

LOCAL_REF = re.compile(r'(?:src|href)="((?!https?:|//|#|mailto:|data:)[^"]+)"')

for page in PAGES:
    html = page.read_text(encoding="utf-8")
    for ref in sorted(set(LOCAL_REF.findall(html))):
        target = SITE / ref.split("#")[0].split("?")[0]
        check(target.exists(), f"{page.name} references missing asset {ref}")

    # GitHub Pages serves the site from a /<repo>/ subpath, so a root-relative
    # path would 404 there while working locally.
    for ref in sorted(set(re.findall(r'(?:src|href)="(/[^/][^"]*)"', html))):
        failures.append(f"{page.name} uses a root-relative path {ref}; use a relative one")

    # Nothing may be invisible until a script runs. The reveal animation is
    # gated behind html.js, which only exists once the inline head script runs.
    check('class="js"' in html or "className=\"js\"" in html,
          f"{page.name} is missing the html.js marker that gates the reveal animation")

check((SITE / ".nojekyll").exists(), "site/.nojekyll is missing — Jekyll would drop _-prefixed paths")

css = (SITE / "assets" / "style.css").read_text(encoding="utf-8")
check(".js .reveal{opacity:0" in css,
      "style.css hides .reveal without the .js gate, so a page with no JS would be blank")

# --------------------------------------------------------------------------
# Thresholds agree with the rule engine
# --------------------------------------------------------------------------
app = (SITE / "assets" / "app.js").read_text(encoding="utf-8")
engine = (ROOT / "lib" / "rules" / "standard.ts").read_text(encoding="utf-8")


def ts_const(name: str) -> int:
    m = re.search(rf"export const {name} = (\d+)", engine)
    return int(m.group(1)) if m else -1


def js_rule(name: str) -> int:
    m = re.search(rf"\b{name}: (\d+)", app)
    return int(m.group(1)) if m else -1


for js_name, ts_name in [
    ("varietiesPerCategory", "REQUIRED_VARIETIES_PER_CATEGORY"),
    ("unitsPerCategory", "REQUIRED_UNITS_PER_CATEGORY"),
    ("totalUnits", "REQUIRED_TOTAL_UNITS"),
    ("perishableCategories", "REQUIRED_PERISHABLE_CATEGORIES"),
]:
    check(js_rule(js_name) == ts_const(ts_name),
          f"app.js RULES.{js_name}={js_rule(js_name)} but lib/rules/standard.ts "
          f"{ts_name}={ts_const(ts_name)}")

# --------------------------------------------------------------------------
# The saved scan scores the way the rule engine would score it
# --------------------------------------------------------------------------
# site/assets/app.js is the source of truth; this re-derives the totals from the
# same table so a hand-edited row cannot make the demo claim something untrue.
rows = re.findall(
    r"\['([^']+)',\s*'(\w+)',\s*'([^']+)',\s*(\d+),\s*(\d+),\s*(\d+),\s*(true|false)\]", app)
check(len(rows) >= 3, "could not read the saved scan's line items out of app.js")

by_cat: dict[str, dict] = {}
for desc, cat, variety, qty, pack, units, perishable in rows:
    check(int(qty) * int(pack) == int(units),
          f"saved scan: {desc} says {qty} x {pack} but claims {units} units")
    c = by_cat.setdefault(cat, {"varieties": set(), "units": 0, "perishable": False})
    c["varieties"].add(variety.strip().lower())
    c["units"] += int(units)
    c["perishable"] = c["perishable"] or perishable == "true"

required = js_rule("varietiesPerCategory")
total = sum(c["units"] for c in by_cat.values())
met = sum(1 for c in by_cat.values() if len(c["varieties"]) >= required)
perishables = sum(1 for c in by_cat.values() if c["perishable"])

check(total >= js_rule("totalUnits") or met < 4,
      "saved scan is below the unit total yet claims every category is met")
check(not (met == 4 and perishables >= js_rule("perishableCategories") and total < js_rule("totalUnits")),
      "saved scan would report a pass it has not earned")

summary = (f"{len(rows)} counted lines, {total} units, {met}/4 categories at "
           f"{required} varieties, {perishables} with a perishable")

# --------------------------------------------------------------------------
if failures:
    print(f"{len(failures)} problem(s) in site/:\n")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)

print(f"site/ OK — {len(PAGES)} pages, saved scan: {summary}")
