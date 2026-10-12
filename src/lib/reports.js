import { FEE_CATEGORIES, isCashPayment } from './fees';
import { monthRange, wednesdaysInMonth } from './dates';

export { addMonths, monthsFromTo, monthRange, monthLabel, currentMonthStr } from './dates';

// Opening balance (everything before the month) + this month's payments − charges = closing balance.
// NEGATIVE = owed, POSITIVE = in credit. `cashPaid` excludes imported opening-balance credits.
export function memberMonthSnapshot(ledger, monthStr) {
  const { start, end } = monthRange(monthStr);
  const byCategory = {};
  let opening = 0, charged = 0, paid = 0, cashPaid = 0;

  FEE_CATEGORIES.forEach(({ key }) => {
    const entries = (ledger || []).filter(l => l.category === key);
    const o = entries.filter(l => l.date < start).reduce((s, l) => s + (l.type === 'payment' ? Number(l.amount) : -Number(l.amount)), 0);
    const inMonth = entries.filter(l => l.date >= start && l.date <= end);
    const c = inMonth.filter(l => l.type === 'charge').reduce((s, l) => s + Number(l.amount), 0);
    const p = inMonth.filter(l => l.type === 'payment').reduce((s, l) => s + Number(l.amount), 0);
    const cp = inMonth.filter(isCashPayment).reduce((s, l) => s + Number(l.amount), 0);
    byCategory[key] = { opening: o, charged: c, paid: p, closing: o + p - c };
    opening += o; charged += c; paid += p; cashPaid += cp;
  });

  return { opening, charged, paid, cashPaid, closing: opening + paid - charged, byCategory };
}

export function receiptNumber(entry) {
  return `RCPT-${(entry.date || '').replace(/-/g, '')}-${String(entry.id || '').slice(0, 6).toUpperCase()}`;
}

// Meetings held in a month = Wednesdays in that month minus marked holidays.
export function meetingsInMonth(monthStr, holidays) {
  const wednesdays = wednesdaysInMonth(monthStr);
  const holidaySet = new Set((holidays || []).map(h => h.date));
  const excluded = wednesdays.filter(d => holidaySet.has(d));
  return { total: wednesdays.length, excluded: excluded.length, effective: wednesdays.length - excluded.length, excludedDates: excluded };
}
