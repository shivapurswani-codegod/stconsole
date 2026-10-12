import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { addMonths, currentMonthStr, todayISO } from './dates';
import { planAccrual } from './accrual';
import { uuid } from './ids';
import { OPENING_METHOD } from './fees';
import { SOCIAL_KEY_PREFIX } from './memberUpload';

// Turns a thrown/rejected request into the same {data, error} shape Supabase normally returns.
const safe = (p) => Promise.resolve(p).then((r) => r, (e) => ({ data: null, error: e }));

async function loadAll() {
  const [s, v, e, mi, fm, fl, hol] = await Promise.all([
    safe(supabase.from('settings').select('*').eq('id', 1).maybeSingle()),
    safe(supabase.from('venue_entries').select('*').order('date', { ascending: false })),
    safe(supabase.from('events').select('*').order('date', { ascending: false })),
    safe(supabase.from('misc_entries').select('*').order('date', { ascending: false })),
    safe(supabase.from('fee_members').select('*').order('name', { ascending: true })),
    safe(supabase.from('fee_ledger').select('*')),
    safe(supabase.from('holidays').select('*').order('date', { ascending: true })),
  ]);
  const errors = [s, v, e, mi, fm, fl, hol].map((r) => r.error).filter(Boolean);

  let settings = s.data;
  if (!settings && !s.error) {
    // First run: the settings row is missing — create it with defaults instead of failing.
    await safe(supabase.from('settings').upsert({ id: 1 }, { onConflict: 'id', ignoreDuplicates: true }));
    const again = await safe(supabase.from('settings').select('*').eq('id', 1).maybeSingle());
    settings = again.data;
    if (again.error) errors.push(again.error);
  }

  const ledgerByMember = {};
  (fl.data || []).forEach((l) => { (ledgerByMember[l.member_id] ||= []).push(l); });
  const feeMembers = (fm.data || []).map((m) => ({ ...m, ledger: ledgerByMember[m.id] || [] }));

  return {
    settings: settings || null,
    venueEntries: v.data || [], events: e.data || [], miscEntries: mi.data || [],
    holidays: hol.data || [], feeMembers,
    errors,
  };
}

async function applyAccrual(plan) {
  try {
    if (plan.rows.length) {
      const { error } = await supabase.from('fee_ledger').upsert(plan.rows, { onConflict: 'member_id,auto_key', ignoreDuplicates: true });
      if (error) return error; // do NOT move the cursor if the charges weren't saved
    }
    const results = await Promise.all(plan.cursors.map((c) =>
      safe(supabase.from('fee_members').update({ last_accrual_date: c.last_accrual_date }).eq('id', c.id))));
    const bad = results.find((r) => r.error);
    return bad ? bad.error : null;
  } catch (e) { return e; }
}

export function useConsoleData(enabled) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(0);
  const [state, setState] = useState({
    settings: null, venueEntries: [], events: [], miscEntries: [], holidays: [], feeMembers: [],
  });
  const chain = useRef(Promise.resolve());
  const membersRef = useRef([]);

  const runRefresh = useCallback(async () => {
    let d = await loadAll();
    if (d.settings) {
      const plan = planAccrual({ members: d.feeMembers, holidays: d.holidays, weeklyFee: Number(d.settings.weekly_fee_per_member), today: todayISO() });
      if (plan.rows.length || plan.cursors.length) {
        const err = await applyAccrual(plan);
        if (err) setActionError(`Couldn't post this month's meeting fees: ${err.message}`);
        d = await loadAll(); // single pass only — this can never loop
      }
    }
    membersRef.current = d.feeMembers;
    const { errors, ...rest } = d;
    setState(rest);
    if (!d.settings) setLoadError(errors[0]?.message || 'The settings could not be loaded.');
    else { setLoadError(null); if (errors.length) setActionError(`Some data could not be loaded: ${errors[0].message}`); }
    setLoading(false);
  }, []);

  // Refreshes run strictly one after another so they can never overlap.
  const refresh = useCallback(() => {
    const next = chain.current.then(runRefresh, runRefresh);
    chain.current = next.catch(() => {});
    return next.catch((e) => { setLoadError(e.message || String(e)); setLoading(false); });
  }, [runRefresh]);

  // Only start once login is confirmed (requests before that are silently rejected by the database).
  useEffect(() => { if (enabled) refresh(); }, [enabled, refresh]);

  const mutate = useCallback(async (label, fn, { silent } = {}) => {
    setBusy((b) => b + 1);
    try {
      const { error } = await safe(fn());
      if (error && !silent) setActionError(`${label} failed: ${error.message}`);
      await refresh();
      return { error: error || null };
    } finally { setBusy((b) => b - 1); }
  }, [refresh]);

  const t = (name) => supabase.from(name);
  const prevMonthStart = () => `${addMonths(currentMonthStr(), -1)}-01`;

  const actions = {
    addVenueEntry: (e) => mutate('Saving venue entry', () => t('venue_entries').insert(e)),
    removeVenueEntry: (id) => mutate('Deleting venue entry', () => t('venue_entries').delete().eq('id', id)),
    addEvent: (e) => mutate('Saving event', () => t('events').insert(e)),
    removeEvent: (id) => mutate('Deleting event', () => t('events').delete().eq('id', id)),
    addMisc: (e) => mutate('Saving entry', () => t('misc_entries').insert(e)),
    removeMisc: (id) => mutate('Deleting entry', () => t('misc_entries').delete().eq('id', id)),
    updateSettings: (patch) => mutate('Saving settings', () => t('settings').update(patch).eq('id', 1)),
    addHoliday: (h) => mutate('Saving holiday', () => t('holidays').insert(h), { silent: true }),
    removeHoliday: (id) => mutate('Deleting holiday', () => t('holidays').delete().eq('id', id)),
    // New members start "one month behind", so the current month's fee is posted straight away.
    addFeeMember: (m) => mutate('Saving member', () => t('fee_members').insert({ ...m, last_accrual_date: prevMonthStart() })),
    updateFeeMember: (id, patch) => mutate('Saving member', () => t('fee_members').update(patch).eq('id', id)),
    removeFeeMember: (id) => mutate('Deleting member', () => t('fee_members').delete().eq('id', id)),
    // Disabling/enabling freezes billing from the current month onwards.
    toggleFeeMemberActive: (m) => mutate('Updating member', () => t('fee_members').update({ active: !m.active, last_accrual_date: `${currentMonthStr()}-01` }).eq('id', m.id)),
    addLedgerEntry: (memberId, entry) => mutate('Saving entry', () => t('fee_ledger').insert({ ...entry, member_id: memberId })),
    removeLedgerEntry: (id) => mutate('Deleting entry', () => t('fee_ledger').delete().eq('id', id)),
  };

  // Deletes several members (and, by cascade, their whole fee history) in one request.
  const removeFeeMembers = useCallback(async (ids) => {
    if (!ids.length) return { error: null };
    return mutate('Deleting members', () => supabase.from('fee_members').delete().in('id', ids));
  }, [mutate]);

  // Bulk import: a handful of batched requests instead of dozens of one-by-one calls.
  // rows come from parseMemberSheet(). opts: { openingDate, month, socialDate }
  //  - New members are added, with their meeting-fee opening balance (if any).
  //  - Existing members (matched by email, else name) get blank details filled in / updated.
  //  - Social amount (new AND existing members) is posted as a charge dated inside `month`,
  //    keyed "upload-social-YYYY-MM", so uploading again simply corrects the amount.
  const bulkUpsertFeeMembers = useCallback(async (rows, opts) => {
    const { openingDate, month, socialDate } = opts;
    setBusy((b) => b + 1);
    try {
      const byEmail = new Map(); const byName = new Map();
      membersRef.current.forEach((m) => {
        if (m.email) byEmail.set(m.email.trim().toLowerCase(), m);
        byName.set(m.name.trim().toLowerCase(), m);
      });
      const socialKey = `${SOCIAL_KEY_PREFIX}${month}`;
      const seen = new Set(); const inserts = []; const ledgerRows = []; const updates = [];
      const socialSet = []; const socialClear = [];
      let skipped = 0; let meetingIgnored = 0; let socialTotal = 0;

      for (const row of rows) {
        const emailKey = (row.email || '').trim().toLowerCase();
        const nameKey = row.name.trim().toLowerCase();
        const dedupe = emailKey || `name:${nameKey}`;
        if (seen.has(dedupe)) { skipped++; continue; }
        seen.add(dedupe);
        const match = (emailKey && byEmail.get(emailKey)) || byName.get(nameKey) || null;
        let memberId;
        if (match) {
          memberId = match.id;
          const patch = { name: row.name };
          if (row.companyName) patch.company_name = row.companyName;
          if (row.phone) patch.phone = row.phone;
          if (row.email) patch.email = row.email;
          if (row.active !== null) patch.active = row.active;
          updates.push({ id: match.id, patch });
          if (row.meetingOpening) meetingIgnored++;
        } else {
          memberId = uuid();
          inserts.push({ id: memberId, name: row.name, company_name: row.companyName, email: row.email, phone: row.phone, active: row.active !== false, last_accrual_date: prevMonthStart() });
          if (row.meetingOpening < 0) ledgerRows.push({ member_id: memberId, date: openingDate, type: 'charge', category: 'meeting', amount: Math.abs(row.meetingOpening), note: 'Opening balance', method: '' });
          if (row.meetingOpening > 0) ledgerRows.push({ member_id: memberId, date: openingDate, type: 'payment', category: 'meeting', amount: row.meetingOpening, note: 'Opening balance (credit)', method: OPENING_METHOD });
        }
        if (row.social !== null) {
          if (row.social > 0) {
            socialSet.push({ member_id: memberId, date: socialDate, type: 'charge', category: 'social', amount: row.social, note: 'Social fee', method: '', auto_key: socialKey });
            socialTotal += row.social;
          } else socialClear.push(memberId);
        }
      }

      if (inserts.length) {
        const { error } = await safe(t('fee_members').insert(inserts));
        if (error) { setActionError(`Bulk upload failed: ${error.message}`); return { error }; }
      }
      if (ledgerRows.length) {
        const { error } = await safe(t('fee_ledger').insert(ledgerRows));
        if (error) { setActionError(`Members were added, but their opening balances failed: ${error.message}`); await refresh(); return { error }; }
      }
      const updateResults = await Promise.all(updates.map((u) => safe(t('fee_members').update(u.patch).eq('id', u.id))));
      const updateFailed = updateResults.find((r) => r.error);
      if (socialSet.length) {
        // No ignoreDuplicates here: re-uploading must overwrite the earlier amount.
        const { error } = await safe(t('fee_ledger').upsert(socialSet, { onConflict: 'member_id,auto_key' }));
        if (error) { setActionError(`Members were saved, but the social amounts failed: ${error.message}`); await refresh(); return { error }; }
      }
      if (socialClear.length) {
        const { error } = await safe(t('fee_ledger').delete().in('member_id', socialClear).eq('auto_key', socialKey));
        if (error) { setActionError(`Social amounts could not be cleared: ${error.message}`); await refresh(); return { error }; }
      }
      await refresh();
      return {
        added: inserts.length, updated: updates.length, skipped, meetingIgnored,
        socialCount: socialSet.length, socialCleared: socialClear.length, socialTotal,
        warning: updateFailed ? updateFailed.error.message : null, error: null,
      };
    } finally { setBusy((b) => b - 1); }
  }, [refresh]);

  return {
    loading, loadError, actionError, clearActionError: () => setActionError(null), busy,
    ...state, refetch: refresh, ...actions, removeFeeMembers, bulkUpsertFeeMembers,
  };
}
