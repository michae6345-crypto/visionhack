/**
 * Store data: the shape, where it is kept, and the status engine that turns a
 * renewal date into ok / soon / critical / expired / missing / na.
 *
 * There is no database. Everything lives in the browser. localStorage is tried
 * first and an in-memory map takes over when it throws, which is what happens
 * inside a cross-origin iframe where storage access is blocked. The demo has to
 * survive being embedded in the Framer site, so a throw here must never reach
 * the UI.
 */
import type { ScanResult } from "./mock-data";
import {
  OBLIGATIONS,
  SNAP_RULE,
  getObligation,
  statusField,
  type Obligation,
  type ObligationKey,
} from "./compliance";

export type Status = "ok" | "soon" | "critical" | "expired" | "missing" | "na";

/** Days out at which a renewal starts showing as soon / critical. */
export const SOON_DAYS = 90;
export const CRITICAL_DAYS = 30;

/** A food handler card is valid three years from issue. */
export const FOOD_HANDLER_VALID_YEARS = 3;

export interface Employee {
  id: string;
  name: string;
  /** ISO yyyy-mm-dd. */
  cardExpires: string;
}

export interface ObligationState {
  /** Field key -> whatever the store typed. */
  values: Record<string, string>;
  /** Indexes into the obligation's requirements list that are ticked. */
  done: number[];
  /** Set when the store does not do this at all, e.g. sells nothing by weight. */
  notApplicable?: boolean;
  note?: string;
}

/** The last invoice scored, kept so the dashboard survives a reload. */
export interface StoredScan {
  /** When the scan ran, ISO datetime. */
  at: string;
  result: ScanResult;
}

export interface Store {
  name: string;
  address: string;
  obligations: Partial<Record<ObligationKey, ObligationState>>;
  employees: Employee[];
  lastScan?: StoredScan;
}

export const STORAGE_KEY = "ledger.store.v1";

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------
/** Today as yyyy-mm-dd in the viewer's own timezone. */
export function today(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Whole days from `from` to `iso`. Negative means the date has passed.
 *
 * Both sides are parsed as local calendar dates rather than instants, so a
 * renewal never appears a day early for a viewer west of UTC.
 */
export function daysUntil(iso: string, from: string = today()): number | null {
  const a = parseISODate(from);
  const b = parseISODate(iso);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function parseISODate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso ?? "").trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** "in 12 days", "today", "14 days ago". */
export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days > 0) return `in ${days} day${days === 1 ? "" : "s"}`;
  const n = Math.abs(days);
  return `${n} day${n === 1 ? "" : "s"} ago`;
}

export function formatDate(iso: string): string {
  const d = parseISODate(iso);
  if (!d) return "Not set";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Status engine
// ---------------------------------------------------------------------------
export function statusFromDays(days: number | null): Status {
  if (days === null) return "missing";
  if (days < 0) return "expired";
  if (days <= CRITICAL_DAYS) return "critical";
  if (days <= SOON_DAYS) return "soon";
  return "ok";
}

export interface ObligationStatus {
  key: ObligationKey;
  status: Status;
  /** Null when there is no date to count down to. */
  days: number | null;
  /** The date the status is derived from, if any. */
  date: string | null;
  /** Requirements ticked / total. */
  checked: number;
  total: number;
}

/**
 * Food handler cards have no single store-wide date, so the roster drives it:
 * the soonest card to expire is the one that can fail an inspection.
 */
function foodHandlerStatus(store: Store): { days: number | null; date: string | null } {
  const dated = store.employees
    .map((e) => ({ date: e.cardExpires, days: daysUntil(e.cardExpires) }))
    .filter((e): e is { date: string; days: number } => e.days !== null);
  if (dated.length === 0) return { days: null, date: null };
  const soonest = dated.reduce((a, b) => (b.days < a.days ? b : a));
  return { days: soonest.days, date: soonest.date };
}

export function evaluate(store: Store, o: Obligation): ObligationStatus {
  const state = store.obligations[o.key];
  const total = o.requirements.length;
  const checked = state?.done?.length ?? 0;

  if (state?.notApplicable) {
    return { key: o.key, status: "na", days: null, date: null, checked, total };
  }

  /*
   * SNAP is the one obligation with two ways to fail. The renewal date is the
   * calendar half; the staple-stocking standard is the shelf half, and a store
   * whose last invoice came back short is at risk whatever the date says. A
   * scan older than the rule's window is not evidence of today's shelves, so it
   * stops counting rather than propping the score up.
   */
  if (o.key === "snap") {
    const evidence = scanEvidence(store);
    if (evidence?.fresh && evidence.result.overallStatus === "fail") {
      const field = statusField(o);
      const raw = field ? state?.values?.[field.key] : undefined;
      const days = raw ? daysUntil(raw) : null;
      return { key: o.key, status: "critical", days, date: days !== null ? raw! : null, checked, total };
    }
  }

  if (o.key === "foodHandler") {
    const { days, date } = foodHandlerStatus(store);
    return { key: o.key, status: statusFromDays(days), days, date, checked, total };
  }

  const field = statusField(o);
  const raw = field ? state?.values?.[field.key] : undefined;
  const days = raw ? daysUntil(raw) : null;
  return {
    key: o.key,
    status: statusFromDays(days),
    days,
    date: raw && days !== null ? raw : null,
    checked,
    total,
  };
}

export function evaluateAll(store: Store): ObligationStatus[] {
  return OBLIGATIONS.map((o) => evaluate(store, o));
}

/** Sort order for the dashboard: worst first, then soonest. */
const STATUS_RANK: Record<Status, number> = {
  expired: 0,
  missing: 1,
  critical: 2,
  soon: 3,
  ok: 4,
  na: 5,
};

export function bySeverity(a: ObligationStatus, b: ObligationStatus): number {
  const rank = STATUS_RANK[a.status] - STATUS_RANK[b.status];
  if (rank !== 0) return rank;
  if (a.days !== null && b.days !== null) return a.days - b.days;
  return 0;
}

export const STATUS_LABEL: Record<Status, string> = {
  ok: "On track",
  soon: "Due soon",
  critical: "Due now",
  expired: "Expired",
  missing: "Not set",
  na: "Not applicable",
};

/**
 * Share of applicable obligations that are on track, 0..1.
 * Not-applicable ones are excluded rather than counted as passes.
 */
export function readiness(statuses: ObligationStatus[]): {
  ratio: number;
  ok: number;
  applicable: number;
} {
  const applicable = statuses.filter((s) => s.status !== "na");
  const ok = applicable.filter((s) => s.status === "ok").length;
  return {
    ratio: applicable.length === 0 ? 1 : ok / applicable.length,
    ok,
    applicable: applicable.length,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
let memory: Store | null = null;

/**
 * localStorage is absent on the server and throws in a partitioned iframe.
 * Both cases fall through to the in-memory copy.
 */
function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const ls = window.localStorage;
    const probe = "__ledger_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

export function emptyStore(): Store {
  return { name: "", address: "", obligations: {}, employees: [] };
}

// ---------------------------------------------------------------------------
// Stocking evidence
// ---------------------------------------------------------------------------
export interface ScanEvidence {
  result: ScanResult;
  /** Whole days since the scan. */
  ageDays: number;
  /**
   * Whether the scan still counts. Orders inside the rule's 21-day window are
   * evidence of stock on the shelf; older than that and it proves nothing about
   * what is there today.
   */
  fresh: boolean;
}

export function scanEvidence(store: Store, from: string = today()): ScanEvidence | null {
  const scan = store.lastScan;
  if (!scan?.result) return null;
  const scannedOn = scan.at.slice(0, 10);
  const days = daysUntil(scannedOn, from);
  if (days === null) return null;
  const ageDays = Math.max(0, -days);
  return { result: scan.result, ageDays, fresh: ageDays <= SNAP_RULE.recentOrderWindowDays };
}

export function loadStore(): Store | null {
  const ls = safeLocalStorage();
  if (!ls) return memory;
  try {
    const raw = ls.getItem(STORAGE_KEY);
    if (!raw) return memory;
    return normalize(JSON.parse(raw) as Partial<Store>);
  } catch {
    return memory;
  }
}

export function saveStore(store: Store): void {
  memory = store;
  const ls = safeLocalStorage();
  if (!ls) return;
  try {
    ls.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota or a blocked iframe. The in-memory copy above still holds.
  }
}

export function clearStore(): void {
  memory = null;
  const ls = safeLocalStorage();
  try {
    ls?.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do — memory is already cleared.
  }
}

/** Fill in anything a stored blob is missing so the UI never reads undefined. */
export function normalize(raw: Partial<Store> | null | undefined): Store {
  const base = emptyStore();
  if (!raw || typeof raw !== "object") return base;
  const obligations: Store["obligations"] = {};
  for (const [key, value] of Object.entries(raw.obligations ?? {})) {
    if (!getObligation(key)) continue; // drop keys from an older shape
    obligations[key as ObligationKey] = {
      values: value?.values ?? {},
      done: Array.isArray(value?.done) ? value.done : [],
      notApplicable: value?.notApplicable ?? false,
      note: value?.note ?? "",
    };
  }
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    address: typeof raw.address === "string" ? raw.address : "",
    obligations,
    employees: Array.isArray(raw.employees)
      ? raw.employees.filter((e) => e && typeof e.name === "string")
      : [],
    // Carried through explicitly. Rebuilding the store field by field is how
    // this got dropped on reload the first time.
    lastScan: validScan(raw.lastScan),
  };
}

/** A stored scan is only usable if it still has a timestamp and a scorecard. */
function validScan(raw: Partial<StoredScan> | null | undefined): StoredScan | undefined {
  if (!raw || typeof raw.at !== "string" || !raw.result) return undefined;
  const result = raw.result as ScanResult;
  if (!Array.isArray(result.categories)) return undefined;
  return { at: raw.at, result };
}

export function stateFor(store: Store, key: ObligationKey): ObligationState {
  return store.obligations[key] ?? { values: {}, done: [], notApplicable: false, note: "" };
}

export function withObligation(
  store: Store,
  key: ObligationKey,
  patch: Partial<ObligationState>,
): Store {
  return {
    ...store,
    obligations: { ...store.obligations, [key]: { ...stateFor(store, key), ...patch } },
  };
}

// ---------------------------------------------------------------------------
// Sample store
// ---------------------------------------------------------------------------
/** Offset from today, so the sample never goes stale between demos. */
function inDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/**
 * A store mid-way through getting compliant: two things already lapsed, one
 * landing this month, the rest in hand. Dates are relative to today on purpose.
 */
export function sampleStore(): Store {
  return {
    name: "Rivera's Corner Market",
    address: "4218 S Central Ave, Los Angeles, CA 90011",
    employees: [
      { id: "e1", name: "Marisol Rivera", cardExpires: inDays(402) },
      { id: "e2", name: "Junior Rivera", cardExpires: inDays(211) },
      { id: "e3", name: "Delia Santos", cardExpires: inDays(-16) },
      { id: "e4", name: "Kevin Ortiz", cardExpires: inDays(58) },
    ],
    obligations: {
      snap: {
        values: { fnsNumber: "0412887", reauthorizationDue: inDays(320) },
        done: [1, 3, 4],
        note: "Reauthorization packet arrived. Dairy is the gap.",
      },
      wic: {
        values: { vendorNumber: "WIC-55120", contractEnds: inDays(303) },
        done: [1, 2, 3],
      },
      healthPermit: {
        values: { permitNumber: "PR0091447", expires: inDays(129), lastGrade: "A (94)" },
        done: [0, 1, 2, 3],
      },
      foodHandler: { values: {}, done: [0, 1] },
      abc: {
        values: { licenseNumber: "20-618420", licenseType: "Type 20 off-sale", renewsOn: inDays(22) },
        done: [0, 2, 3],
        note: "Renewal notice on the office wall.",
      },
      tobacco: {
        values: { stateLicense: "CDTFA-104773", cityPermitDue: inDays(-9) },
        done: [1, 2, 3],
        note: "City permit lapsed. State license is current.",
      },
      scale: { values: { deviceCount: "1 deli scale", registrationDue: inDays(188) }, done: [0, 1, 2] },
      businessTax: {
        values: { accountNumber: "0002318844-0001-2", renewalDue: inDays(169) },
        done: [0, 1, 2],
      },
    },
  };
}
