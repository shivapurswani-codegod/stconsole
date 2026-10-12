// Timezone-proof date helpers.
// RULE: never convert a local Date through toISOString() (that shifts the day/month
// in any timezone ahead of UTC, e.g. Dubai). Everything here is plain calendar math
// on 'YYYY-MM' / 'YYYY-MM-DD' strings, and every loop has a hard upper limit.

const pad = (n) => String(n).padStart(2, '0');
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const isMonthStr = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// Local calendar date of a Date object as 'YYYY-MM-DD'
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISODate(new Date());
export const currentMonthStr = () => todayISO().slice(0, 7);

export function addMonths(monthStr, n) {
  const [y, m] = monthStr.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  return `${ny}-${pad(total - ny * 12 + 1)}`;
}

// Inclusive list of months. Hard-capped so it can never loop forever.
export function monthsFromTo(start, end, max = 60) {
  const out = [];
  let cur = start;
  while (cur <= end && out.length < max) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

export const daysInMonth = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export const monthRange = (monthStr) => ({ start: `${monthStr}-01`, end: `${monthStr}-${pad(daysInMonth(monthStr))}` });
export const lastDayOfMonth = (monthStr) => monthRange(monthStr).end;

export const monthLabel = (monthStr) => {
  const [y, m] = monthStr.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

// Every Wednesday of a month as 'YYYY-MM-DD' (day-of-week of a local calendar date is tz-safe)
export function wednesdaysInMonth(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const out = [];
  for (let d = 1; d <= daysInMonth(monthStr); d++) {
    if (new Date(y, m - 1, d).getDay() === 3) out.push(`${monthStr}-${pad(d)}`);
  }
  return out;
}

// Whole days from today to a 'YYYY-MM-DD' date (negative = in the past)
export function daysBetween(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [ty, tm, td] = todayISO().split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
}
