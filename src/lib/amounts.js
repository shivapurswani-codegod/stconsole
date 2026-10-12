// Parses amounts typed/pasted into Excel: 100, "100", "1,250.50", "(100)" (accounting negative), "AED -100"
export function parseAmount(value) {
  if (value === null || value === undefined || value === '') return { value: 0, valid: true };
  if (typeof value === 'number') return Number.isFinite(value) ? { value, valid: true } : { value: 0, valid: false };
  let s = String(value).trim();
  if (s === '' || s === '-') return { value: 0, valid: true };
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  s = s.replace(/aed|,|\s/gi, '');
  if (s.startsWith('-')) { negative = !negative; s = s.slice(1); }
  const n = Number(s);
  if (!Number.isFinite(n)) return { value: 0, valid: false };
  return { value: negative ? -n : n, valid: true };
}
