// Sponsorship is not tracked at the moment.
export const FEE_CATEGORIES = [
  { key: 'meeting', label: 'Meeting Fee' },
  { key: 'social', label: 'Social Event' },
];
export const catLabel = (key) => FEE_CATEGORIES.find(c => c.key === key)?.label || key;

// Opening-balance credits imported from a previous treasurer are NOT cash received now,
// so they must never count towards the kitty, "collected" figures or receipts.
export const OPENING_METHOD = 'opening-balance';
export const isCashPayment = (l) => l.type === 'payment' && l.method !== OPENING_METHOD;

// SIGN CONVENTION (used everywhere): NEGATIVE = member owes money (shown red),
// POSITIVE = member is in credit / paid ahead (shown green).
const signed = (l) => (l.type === 'payment' ? Number(l.amount) : -Number(l.amount));
export const categoryBalance = (ledger, category) => (ledger || []).filter(l => l.category === category).reduce((s, l) => s + signed(l), 0);
export const totalBalance = (ledger) => (ledger || []).reduce((s, l) => s + signed(l), 0);
export const amountOwed = (balance) => Math.max(0, -balance);
