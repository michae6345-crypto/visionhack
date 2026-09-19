/**
 * Turns a set of programmes into a calendar file the store owner can open in
 * whatever they already use. No account, no backend: the .ics is built in the
 * browser and handed straight to them.
 *
 * Dates here are the typical renewal months for a California retailer. They
 * are a starting point that the owner corrects with their own certificate
 * dates once they are in the product, which is exactly what the event
 * description tells them to do.
 */

export interface ProgrammeSchedule {
  abbr: string;
  /** What the event is called in the calendar. */
  title: string;
  /** Month (1-12) and day the filing is typically due. */
  month: number;
  day: number;
  /** Whether it repeats every year or every other year. */
  everyYears: 1 | 2;
  /** Who you file with. */
  office: string;
  /** What the renewal actually involves. */
  note: string;
}

export const SCHEDULES: Record<string, ProgrammeSchedule> = {
  SNAP: {
    abbr: "SNAP",
    title: "SNAP retailer authorization: stocking review",
    month: 11,
    day: 4,
    everyYears: 1,
    office: "USDA Food and Nutrition Service",
    note: "Check the shelf against the staple stocking minimums before the review date. Seven varieties and 21 units in each of the four categories, with a perishable in three of them.",
  },
  WIC: {
    abbr: "WIC",
    title: "WIC vendor authorization: price list due",
    month: 9,
    day: 30,
    everyYears: 1,
    office: "State WIC agency",
    note: "Submit the current shelf prices for every item on the vendor food list. Late price lists are the most common reason a vendor agreement lapses.",
  },
  EBT: {
    abbr: "EBT",
    title: "EBT terminal and settlement check",
    month: 1,
    day: 15,
    everyYears: 1,
    office: "Your EBT processor",
    note: "Confirm the terminal is settling and the retailer number on file still matches your SNAP authorization.",
  },
  CHP: {
    abbr: "CHP",
    title: "County health permit renewal",
    month: 9,
    day: 21,
    everyYears: 1,
    office: "County environmental health department",
    note: "Pay the annual fee and book the inspection. The permit must be posted where customers can see it.",
  },
  TRL: {
    abbr: "TRL",
    title: "Tobacco retail license renewal",
    month: 12,
    day: 31,
    everyYears: 1,
    office: "State tax authority",
    note: "Renew before expiry. Selling on a lapsed license is a separate violation from selling without one.",
  },
  ABC: {
    abbr: "ABC",
    title: "Alcohol license renewal",
    month: 8,
    day: 1,
    everyYears: 1,
    office: "State alcoholic beverage control",
    note: "Pay the renewal fee and confirm the operating conditions attached to the license still match how you trade.",
  },
  "W&M": {
    abbr: "W&M",
    title: "Weights and measures: scale certification",
    month: 6,
    day: 14,
    everyYears: 1,
    office: "County sealer of weights and measures",
    note: "Every scale you sell by has to carry a current seal. Book the inspection before the sticker expires.",
  },
  BTC: {
    abbr: "BTC",
    title: "Business tax certificate renewal",
    month: 1,
    day: 31,
    everyYears: 1,
    office: "City finance department",
    note: "File the annual renewal and pay the tax based on last year's gross receipts.",
  },
  EPA: {
    abbr: "EPA",
    title: "Hazardous waste and refrigerant filing",
    month: 3,
    day: 1,
    everyYears: 1,
    office: "EPA and the state environmental agency",
    note: "File the annual report and check that every used-oil and refrigerant manifest for the year is on file.",
  },
  OSHA: {
    abbr: "OSHA",
    title: "Workplace safety: postings and log review",
    month: 2,
    day: 1,
    everyYears: 1,
    office: "OSHA",
    note: "Post the injury summary from 1 February to 30 April and confirm the hazard communication sheets are current.",
  },
  DOT: {
    abbr: "DOT",
    title: "Hazmat shipping registration",
    month: 6,
    day: 30,
    everyYears: 1,
    office: "US Department of Transportation",
    note: "Renew the registration and confirm anyone who signs a shipping paper still holds current training.",
  },
  FDA: {
    abbr: "FDA",
    title: "FDA food facility registration renewal",
    month: 12,
    day: 31,
    everyYears: 2,
    office: "US Food and Drug Administration",
    note: "Registration renews in even-numbered years between 1 October and 31 December.",
  },
  TTB: {
    abbr: "TTB",
    title: "TTB permit review",
    month: 7,
    day: 1,
    everyYears: 1,
    office: "Alcohol and Tobacco Tax and Trade Bureau",
    note: "Confirm the permit details still match your ownership and premises. Changes have to be reported, not renewed.",
  },
  BAR: {
    abbr: "BAR",
    title: "Automotive repair registration renewal",
    month: 5,
    day: 1,
    everyYears: 1,
    office: "State bureau of automotive repair",
    note: "Renew the registration and confirm the sign and written-estimate rules are being followed.",
  },
  RSP: {
    abbr: "RSP",
    title: "Seller's permit: annual review",
    month: 4,
    day: 15,
    everyYears: 1,
    office: "State tax authority",
    note: "Confirm the permit details and that resale certificates on file are still valid.",
  },
  BOP: {
    abbr: "BOP",
    title: "Board of pharmacy renewal",
    month: 10,
    day: 1,
    everyYears: 1,
    office: "State board of pharmacy",
    note: "Renew the site license and confirm every pharmacist on the roster is current.",
  },
  FIRE: {
    abbr: "FIRE",
    title: "Fire marshal inspection",
    month: 4,
    day: 1,
    everyYears: 1,
    office: "Local fire department",
    note: "Book the annual inspection. Extinguisher tags, exit signs and stored quantities are what gets checked.",
  },
  CoO: {
    abbr: "CoO",
    title: "Certificate of occupancy: check on file",
    month: 1,
    day: 10,
    everyYears: 1,
    office: "City building department",
    note: "The certificate does not expire, but it has to match how the premises is used. Confirm it still does.",
  },
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** The next occurrence of month/day at or after today, honouring the cycle. */
function nextDate(s: ProgrammeSchedule, from: Date): string {
  let year = from.getFullYear();
  const due = new Date(year, s.month - 1, s.day);
  if (due < from) year += 1;
  if (s.everyYears === 2 && year % 2 !== 0) year += 1;
  return `${year}${pad(s.month)}${pad(s.day)}`;
}

/** Escapes the characters iCalendar treats as structure. */
function esc(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds a line to the 75-octet limit the spec asks for. */
function fold(line: string) {
  if (line.length <= 73) return line;
  const parts: string[] = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    parts.push(" " + rest.slice(0, 72));
    rest = rest.slice(72);
  }
  parts.push(" " + rest);
  return parts.join("\r\n");
}

export interface CalendarEvent {
  abbr: string;
  title: string;
  /** YYYYMMDD */
  date: string;
  office: string;
  note: string;
  everyYears: 1 | 2;
}

export function eventsFor(abbrs: string[], from = new Date()): CalendarEvent[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return abbrs
    .map((a) => SCHEDULES[a])
    .filter((s): s is ProgrammeSchedule => Boolean(s))
    .map((s) => ({
      abbr: s.abbr,
      title: s.title,
      date: nextDate(s, start),
      office: s.office,
      note: s.note,
      everyYears: s.everyYears,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Formats YYYYMMDD for reading, e.g. "4 Nov 2026". */
export function readableDate(yyyymmdd: string): string {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

/** Days from today until the given YYYYMMDD. */
export function daysUntil(yyyymmdd: string, from = new Date()): number {
  const y = Number(yyyymmdd.slice(0, 4));
  const m = Number(yyyymmdd.slice(4, 6));
  const d = Number(yyyymmdd.slice(6, 8));
  const target = new Date(y, m - 1, d).getTime();
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  return Math.round((target - start) / 86400000);
}

/** One all-day event per programme, each with 30-day and 7-day reminders. */
export function buildIcs(abbrs: string[], from = new Date()): string {
  const events = eventsFor(abbrs, from);
  const stamp =
    `${from.getUTCFullYear()}${pad(from.getUTCMonth() + 1)}${pad(from.getUTCDate())}` +
    `T${pad(from.getUTCHours())}${pad(from.getUTCMinutes())}${pad(from.getUTCSeconds())}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ledger//Permit calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Ledger permit calendar",
  ];

  for (const ev of events) {
    const end = `${ev.date.slice(0, 4)}${ev.date.slice(4, 6)}${pad(
      Number(ev.date.slice(6, 8)) + 1,
    )}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${ev.abbr.toLowerCase().replace(/[^a-z0-9]/g, "")}-${ev.date}@ledger.co`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ev.date}`,
      `DTEND;VALUE=DATE:${end}`,
      `RRULE:FREQ=YEARLY;INTERVAL=${ev.everyYears}`,
      fold(`SUMMARY:${esc(`${ev.abbr}: ${ev.title}`)}`),
      fold(
        `DESCRIPTION:${esc(
          `${ev.note}\n\nFiled with: ${ev.office}\n\nThis date is the usual one for a California retailer. Replace it with the date on your own certificate.\n\nAdded from ledger.co`,
        )}`,
      ),
      "BEGIN:VALARM",
      "TRIGGER:-P30D",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(`${ev.abbr} due in 30 days`)}`),
      "END:VALARM",
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      fold(`DESCRIPTION:${esc(`${ev.abbr} due in 7 days`)}`),
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** Hands the .ics to the browser as a download. */
export function downloadIcs(abbrs: string[], filename = "ledger-permit-calendar.ics") {
  const blob = new Blob([buildIcs(abbrs)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
