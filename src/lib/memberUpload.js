import { parseAmount } from './amounts';

// Lower-case and strip everything except letters/digits, so "Social Fee (AED)" -> "socialfeeaed".
const norm = (h) => String(h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

// Finds the first column whose normalised heading satisfies the test.
function pick(keys, test) {
  return keys.find((k) => test(norm(k)));
}

export const SOCIAL_KEY_PREFIX = 'upload-social-';

/**
 * Reads the rows of the uploaded sheet. Headings are matched loosely, so
 * "Social", "Social Fee", "Opening Social Fee Due" or "social amount" all work.
 *
 * - Social amount: ALWAYS an amount the member owes (a charge), whatever sign is typed.
 *   Blank = leave as is. 0 = clear any social fee previously uploaded for the month.
 * - Meeting opening balance (new members only): negative = owed, positive = credit.
 */
export function parseMemberSheet(raw) {
  let invalid = 0;
  const parsed = [];
  const keys = raw.length ? Object.keys(raw[0]) : [];
  // Use the union of keys across rows, in case the first row has gaps.
  raw.forEach((r) => Object.keys(r).forEach((k) => { if (!keys.includes(k)) keys.push(k); }));

  const nameKey = pick(keys, (n) => n === 'name' || n === 'membername' || n === 'fullname' || n === 'member');
  const companyKey = pick(keys, (n) => n.includes('company') || n.includes('business'));
  const emailKey = pick(keys, (n) => n.includes('email') || n === 'mail');
  const phoneKey = pick(keys, (n) => n.includes('phone') || n.includes('mobile') || n.includes('whatsapp') || n === 'tel' || n === 'contact');
  const statusKey = pick(keys, (n) => n === 'status');
  const socialKeys = keys.filter((k) => norm(k).includes('social'));
  const meetingKeys = keys.filter((k) => norm(k).includes('meeting') && !norm(k).includes('social'));

  for (const r of raw) {
    const name = nameKey ? String(r[nameKey] ?? '').trim() : '';
    if (!name) continue;

    let social = null;
    for (const k of socialKeys) {
      if (isBlank(r[k])) continue;
      const p = parseAmount(r[k]);
      if (!p.valid) { invalid++; continue; }
      social = Math.abs(p.value);
      break;
    }

    let meetingOpening = 0;
    for (const k of meetingKeys) {
      if (isBlank(r[k])) continue;
      const p = parseAmount(r[k]);
      if (!p.valid) { invalid++; continue; }
      meetingOpening = p.value;
      break;
    }

    const statusRaw = statusKey ? String(r[statusKey] ?? '').trim().toLowerCase() : '';
    parsed.push({
      name,
      companyName: companyKey ? String(r[companyKey] ?? '').trim() : '',
      email: emailKey ? String(r[emailKey] ?? '').trim() : '',
      phone: phoneKey ? String(r[phoneKey] ?? '').trim() : '',
      active: statusRaw === '' ? null : !(statusRaw === 'disabled' || statusRaw === 'inactive'),
      social,
      meetingOpening,
    });
  }
  return { rows: parsed, invalid, hasSocialColumn: socialKeys.length > 0 };
}
