import { addMonths, monthsFromTo } from './dates';
import { meetingsInMonth } from './reports';

// Pure function (easy to test): works out which monthly meeting-fee charges are missing.
// One lump-sum charge per member per month = (Wednesdays − holidays) × weekly fee.
// Each charge carries an auto_key ("meeting-YYYY-MM"); the database refuses a second
// charge with the same key, so a charge can never be posted twice.
export function planAccrual({ members, holidays, weeklyFee, today }) {
  const rows = [];
  const cursors = [];
  if (!(weeklyFee > 0)) return { rows, cursors };
  const currentMonth = today.slice(0, 7);

  for (const m of members) {
    if (!m.active) continue;
    const lastMonth = m.last_accrual_date ? m.last_accrual_date.slice(0, 7) : addMonths(currentMonth, -1);
    const startMonth = addMonths(lastMonth, 1);
    if (startMonth > currentMonth) continue;

    const existingKeys = new Set((m.ledger || []).map(l => l.auto_key).filter(Boolean));
    for (const monthStr of monthsFromTo(startMonth, currentMonth, 36)) {
      const info = meetingsInMonth(monthStr, holidays);
      const key = `meeting-${monthStr}`;
      if (info.effective > 0 && !existingKeys.has(key)) {
        rows.push({
          member_id: m.id, date: `${monthStr}-01`, type: 'charge', category: 'meeting',
          amount: info.effective * weeklyFee,
          note: `Meeting fee — ${info.effective} meeting${info.effective === 1 ? '' : 's'}`,
          auto_key: key,
        });
      }
    }
    cursors.push({ id: m.id, last_accrual_date: `${currentMonth}-01` });
  }
  return { rows, cursors };
}
