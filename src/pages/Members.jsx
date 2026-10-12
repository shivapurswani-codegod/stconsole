import React, { useMemo, useRef, useState } from 'react';
import { Ban, CalendarClock, CreditCard, Download, FileSpreadsheet, Image as ImageIcon, Loader2, MessageCircle, Pencil, Plus, Power, ScrollText, Search, Trash2, Upload, UserPlus } from 'lucide-react';
import { C, Card, PageHeader, StatCard, TableHead, Btn, Field, inputStyle, fmt, balanceColor } from '../lib/theme';
import { FEE_CATEGORIES, amountOwed } from '../lib/fees';
import { LedgerModal, MemberEditModal } from '../components/MemberModals';
import MemberStatementModal from '../components/MemberStatementModal';
import ConfirmModal from '../components/ConfirmModal';
import { currentMonthStr, memberMonthSnapshot, meetingsInMonth, monthLabel } from '../lib/reports';
import { addMonths, isMonthStr, lastDayOfMonth, todayISO } from '../lib/dates';
import { parseMemberSheet } from '../lib/memberUpload';
import { loadHtml2Canvas, loadXLSX } from '../lib/loaders';
import { downloadMemberStatementSheetPDF } from '../lib/pdf';

const FILTERS = ['All', 'Active', 'Disabled', 'Overdue'];
const iconBtn = { background: 'none', border: 'none', cursor: 'pointer' };

export default function Members({ data, actions, setComposer }) {
  const members = data.feeMembers;
  const holidays = data.holidays || [];
  const [month, setMonth] = useState(currentMonthStr());
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [ledgerModal, setLedgerModal] = useState(null);
  const [statementMemberId, setStatementMemberId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [upload, setUpload] = useState({ busy: false, msg: '', ok: true });
  const [selected, setSelected] = useState(() => new Set());
  const [openingDate, setOpeningDate] = useState(lastDayOfMonth(addMonths(currentMonthStr(), -1)));
  const fileRef = useRef(null);
  const tableRef = useRef(null);

  const monthLabelText = monthLabel(month);

  const saveMember = (form) => {
    if (editing && editing !== 'new') actions.updateFeeMember(editing.id, { name: form.name, company_name: form.companyName, email: form.email, phone: form.phone });
    else actions.addFeeMember({ name: form.name, company_name: form.companyName, email: form.email, phone: form.phone, active: true });
  };

  // Statement for the selected month. NEGATIVE (red) = owed, POSITIVE (green) = in credit.
  const rows = useMemo(() => members.map(m => {
    const snap = memberMonthSnapshot(m.ledger, month);
    return {
      member: m, opening: snap.opening,
      meeting: snap.byCategory.meeting.paid - snap.byCategory.meeting.charged,
      social: snap.byCategory.social.paid - snap.byCategory.social.charged,
      cashPaid: snap.cashPaid, current: snap.closing,
    };
  }), [members, month]);

  const filtered = rows.filter(r => {
    const m = r.member;
    if (filter === 'Active' && !m.active) return false;
    if (filter === 'Disabled' && m.active) return false;
    if (filter === 'Overdue' && r.current >= 0) return false;
    if (search && !(`${m.name} ${m.company_name || ''}`.toLowerCase().includes(search.toLowerCase()))) return false;
    return true;
  }).sort((a, b) => a.current - b.current); // most owed first

  // Selection is limited to members that exist (a member deleted elsewhere drops out automatically).
  const memberIds = useMemo(() => new Set(members.map(m => m.id)), [members]);
  const selectedIds = [...selected].filter(id => memberIds.has(id));
  const visibleIds = filtered.map(r => r.member.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
  const toggleOne = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAllVisible = () => setSelected(prev => {
    const n = new Set(prev);
    if (allVisibleSelected) visibleIds.forEach(id => n.delete(id)); else visibleIds.forEach(id => n.add(id));
    return n;
  });
  const selectedMembers = members.filter(m => selected.has(m.id));

  const totalOutstanding = rows.reduce((s, r) => s + amountOwed(r.current), 0);
  const collected = rows.reduce((s, r) => s + r.cashPaid, 0);
  const overdueCount = rows.filter(r => r.current < 0).length;
  const meetingInfo = meetingsInMonth(month, holidays);

  const guarded = (fn) => async () => { try { await fn(); } catch (e) { console.error(e); window.alert(`Something went wrong: ${e.message || e}`); } };

  const downloadTemplate = guarded(async () => {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const sample = [
      { Name: 'Sample Member A', 'Company Name': 'Acme Trading', Email: 'a@example.com', Phone: '9715XXXXXXXX', Status: 'Active', 'Opening Meeting Fee Due': -100, 'Social Fee': 150 },
      { Name: 'Sample Member B', 'Company Name': 'Beta LLC', Email: 'b@example.com', Phone: '9715XXXXXXXX', Status: 'Active', 'Opening Meeting Fee Due': 50, 'Social Fee': '' },
    ];
    const notes = [
      { Note: 'Delete the two sample rows before uploading your real list.' },
      { Note: 'Social Fee: the amount the member owes for social events. It is always treated as DUE (a positive number is fine; the sign is ignored).' },
      { Note: 'Social Fee is applied to the month selected on the Members page when you upload, for new AND existing members.' },
      { Note: 'Uploading again for the same month corrects the Social Fee (it does not add it twice). Leave the cell blank to keep it as is; type 0 to remove it.' },
      { Note: 'Opening Meeting Fee Due: NEGATIVE number (or in brackets, e.g. (100)) = the member owes this; POSITIVE = in credit. Applied to NEW members only.' },
      { Note: 'Existing members (matched by email, otherwise by name) get their details updated; blank cells never erase what is already saved.' },
      { Note: 'Status: Active or Disabled (blank = no change).' },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), 'Members');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notes), 'Read me');
    XLSX.writeFile(wb, 'st-console-members-template.xlsx');
  });

  const exportExcel = guarded(async () => {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    const sheetRows = rows.map(r => ({
      Name: r.member.name, 'Company Name': r.member.company_name || '', Email: r.member.email || '', Phone: r.member.phone || '',
      Status: r.member.active ? 'Active' : 'Disabled',
      'Opening Balance': r.opening, [`${monthLabelText} Meeting Fee`]: r.meeting, 'Social Fee': r.social, 'Current Balance': r.current,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), monthLabelText);
    XLSX.writeFile(wb, `st-console-members-${month}.xlsx`);
  });

  const exportPDF = () => downloadMemberStatementSheetPDF({
    monthLabelText,
    rows: rows.map(r => ({ name: r.member.name, company: r.member.company_name, opening: r.opening, meeting: r.meeting, social: r.social, current: r.current, status: r.member.active ? 'Active' : 'Disabled' })),
  });

  const exportImage = guarded(async () => {
    if (!tableRef.current) return;
    const html2canvas = await loadHtml2Canvas();
    const canvas = await html2canvas(tableRef.current, { backgroundColor: '#FFFFFF', scale: 2 });
    const link = document.createElement('a');
    link.download = `st-console-members-${month}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  const handleBulkUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpload({ busy: true, msg: 'Reading file…', ok: true });
    try {
      const XLSX = await loadXLSX();
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const { rows: parsed, invalid, hasSocialColumn } = parseMemberSheet(raw);

      if (parsed.length === 0) { setUpload({ busy: false, ok: false, msg: 'No members found. Please use the downloaded template (names go in the "Name" column).' }); return; }
      setUpload({ busy: true, msg: `Uploading ${parsed.length} member${parsed.length === 1 ? '' : 's'}…`, ok: true });
      // Social fees are dated inside the month being viewed so they show in that month's Social Fee column.
      const socialDate = todayISO().startsWith(month) ? todayISO() : lastDayOfMonth(month);
      const res = await actions.bulkUpsertFeeMembers(parsed, { openingDate, month, socialDate });
      if (res.error) { setUpload({ busy: false, ok: false, msg: `Upload failed: ${res.error.message}` }); return; }
      const parts = [`${res.added} added, ${res.updated} updated`];
      if (res.socialCount) parts.push(`Social fee set for ${res.socialCount} member${res.socialCount === 1 ? '' : 's'} (AED ${fmt(res.socialTotal)}) in ${monthLabelText}`);
      if (res.socialCleared) parts.push(`${res.socialCleared} social fee${res.socialCleared === 1 ? '' : 's'} cleared`);
      const extra = [
        res.skipped ? `${res.skipped} duplicate row(s) skipped` : '',
        invalid ? `${invalid} unreadable amount(s) ignored` : '',
        res.meetingIgnored ? `Opening meeting balance ignored for ${res.meetingIgnored} existing member(s)` : '',
        !hasSocialColumn ? 'No Social column found in the file' : '',
        res.warning ? `Some details could not be updated: ${res.warning}` : '',
      ].filter(Boolean).join(' · ');
      setUpload({ busy: false, ok: !res.warning, msg: `Done — ${parts.join('. ')}.${extra ? ' ' + extra : ''}` });
    } catch (err) {
      console.error(err);
      setUpload({ busy: false, ok: false, msg: `Could not read that file: ${err.message || err}. Please use the downloaded template.` });
    }
  };

  return (
    <div className="stc-fade">
      <PageHeader title="Members" sub="Monthly statement — meeting and social fees per member"
        action={<Btn variant="primary" icon={UserPlus} onClick={() => setEditing('new')}>Add member</Btn>} />

      <Card style={{ padding: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" style={{ ...inputStyle, width: 160 }} value={month} onChange={(e) => isMonthStr(e.target.value) && setMonth(e.target.value)} />
          {month !== currentMonthStr() && <Btn variant="outline" onClick={() => setMonth(currentMonthStr())}>This month</Btn>}
          <div className="stc-sans" style={{ fontSize: 12, color: C.inkSoft, marginLeft: 4 }}>
            <CalendarClock size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
            {meetingInfo.effective} meeting{meetingInfo.effective === 1 ? '' : 's'} in {monthLabelText}
            {meetingInfo.excluded > 0 && ` (${meetingInfo.excluded} holiday${meetingInfo.excluded === 1 ? '' : 's'} excluded)`}
          </div>
          <div style={{ flex: 1 }} />
          <Btn variant="outline" icon={Download} onClick={exportExcel}>Excel</Btn>
          <Btn variant="outline" icon={Download} onClick={exportPDF}>PDF</Btn>
          <Btn variant="brass" icon={ImageIcon} onClick={exportImage}>Image</Btn>
        </div>
        <div className="stc-sans" style={{ fontSize: 12, color: C.inkSoft, marginTop: 8 }}>
          Opening Balance carries forward from the end of last month. Meeting Fee / Social Fee show this month's net movement only. Current Balance = Opening + Meeting + Social. Negative (red) = owed, positive (green) = in credit.
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
        <StatCard label={`Outstanding — ${monthLabelText}`} value={`AED ${fmt(totalOutstanding)}`} />
        <StatCard label={`Collected — ${monthLabelText}`} value={`AED ${fmt(collected)}`} />
        <StatCard label="Members overdue" value={overdueCount} />
      </div>

      <Card style={{ padding: 14, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Btn variant="outline" icon={FileSpreadsheet} onClick={downloadTemplate}>Download upload template</Btn>
          <div style={{ width: 190 }}>
            <Field label="Opening balances dated"><input style={inputStyle} type="date" value={openingDate} onChange={(e) => e.target.value && setOpeningDate(e.target.value)} /></Field>
          </div>
          <Btn variant="outline" icon={upload.busy ? Loader2 : Upload} disabled={upload.busy} onClick={() => fileRef.current?.click()}>{upload.busy ? 'Uploading…' : 'Bulk upload (Excel)'}</Btn>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleBulkUpload} style={{ display: 'none' }} />
        </div>
        <div className="stc-sans" style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 8 }}>
          Social Fee in the file is always treated as owed and is posted to the month selected above (upload again to correct it). Opening meeting balances are for new members only and are recorded on the date above (default: last day of last month).
        </div>
        {upload.msg && <div className="stc-sans" style={{ fontSize: 12.5, marginTop: 8, color: upload.ok ? C.green : C.rust }}>{upload.msg}</div>}
      </Card>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} className="stc-sans stc-btn"
            style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1px solid ${filter === f ? C.brass : C.line}`, background: filter === f ? C.brassSoft : 'transparent', color: filter === f ? C.brassDeep : C.inkSoft }}>
            {f}
          </button>
        ))}
        <div style={{ position: 'relative', marginLeft: 'auto', width: 220 }}>
          <Search size={14} color={C.inkSoft} style={{ position: 'absolute', left: 9, top: 10 }} />
          <input style={{ ...inputStyle, paddingLeft: 28 }} placeholder="Search name or company" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="stc-sans" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.brassSoft, border: `1px solid ${C.brass}`, borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 13, color: C.brassDeep, fontWeight: 600 }}>
          {selectedIds.length} member{selectedIds.length === 1 ? '' : 's'} selected
          <div style={{ flex: 1 }} />
          <Btn variant="outline" onClick={() => setSelected(new Set())}>Clear selection</Btn>
          <Btn variant="danger" icon={Trash2} onClick={() => setConfirmAction({ type: 'bulkDelete' })}>Delete selected ({selectedIds.length})</Btn>
        </div>
      )}

      <Card style={{ overflow: 'hidden' }} ref={tableRef}>
        <TableHead cols={['Name', 'Opening Balance', `${monthLabelText} Meeting Fee`, 'Social Fee', 'Current Balance', 'Status', '']} lastColWidth={144} leadWidth={28}
          lead={<input type="checkbox" aria-label="Select all shown members" checked={allVisibleSelected} onChange={toggleAllVisible} disabled={visibleIds.length === 0} style={{ cursor: 'pointer' }} />} />
        {filtered.length === 0 && <div className="stc-sans" style={{ padding: 16, fontSize: 13, color: C.inkSoft }}>{members.length === 0 ? 'No members yet — add one, or use the bulk upload above.' : 'No members match this view.'}</div>}
        {filtered.map(r => {
          const m = r.member;
          return (
            <div key={m.id} className="stc-row" style={{ display: 'grid', gridTemplateColumns: '28px repeat(6,minmax(0,1fr)) 144px', padding: '10px 14px', borderTop: `1px solid ${C.line}`, alignItems: 'center' }}>
              <div><input type="checkbox" aria-label={`Select ${m.name}`} checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} style={{ cursor: 'pointer' }} /></div>
              <div>
                <div className="stc-sans" style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                {m.company_name && <div className="stc-sans" style={{ fontSize: 11, color: C.inkSoft }}>{m.company_name}</div>}
              </div>
              <div className="stc-mono" style={{ fontSize: 13, color: balanceColor(r.opening) }}>{fmt(r.opening)}</div>
              <div className="stc-mono" style={{ fontSize: 13, color: balanceColor(r.meeting) }}>{fmt(r.meeting)}</div>
              <div className="stc-mono" style={{ fontSize: 13, color: balanceColor(r.social) }}>{fmt(r.social)}</div>
              <div className="stc-mono" style={{ fontSize: 13, fontWeight: 700, color: balanceColor(r.current) }}>{fmt(r.current)}</div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: m.active ? C.green : C.inkSoft, background: m.active ? C.greenSoft : C.paperDim, padding: '3px 8px', borderRadius: 20 }}>{m.active ? 'Active' : 'Disabled'}</span>
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <button title="View statement" onClick={() => setStatementMemberId(m.id)} style={{ ...iconBtn, color: C.ink }}><ScrollText size={14} /></button>
                <button title="Record payment" onClick={() => setLedgerModal({ member: m, type: 'payment' })} style={{ ...iconBtn, color: C.green }}><CreditCard size={14} /></button>
                <button title="Add charge" onClick={() => setLedgerModal({ member: m, type: 'charge' })} style={{ ...iconBtn, color: C.brass }}><Plus size={14} /></button>
                <button title="Message" onClick={() => setComposer({ name: m.name, phone: m.phone, email: m.email, reason: 'outstanding balance', amount: amountOwed(r.current) })} style={{ ...iconBtn, color: C.ink }}><MessageCircle size={14} /></button>
                <button title="Edit" onClick={() => setEditing(m)} style={{ ...iconBtn, color: C.inkSoft }}><Pencil size={14} /></button>
                <button title={m.active ? 'Disable' : 'Enable'} onClick={() => m.active ? setConfirmAction({ type: 'disable', member: m }) : actions.toggleFeeMemberActive(m)} style={{ ...iconBtn, color: m.active ? C.rust : C.green }}>{m.active ? <Ban size={14} /> : <Power size={14} />}</button>
                <button title="Remove" onClick={() => setConfirmAction({ type: 'delete', member: m })} style={{ ...iconBtn, color: C.inkSoft }}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })}
      </Card>

      {editing && <MemberEditModal member={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={saveMember} />}
      {statementMemberId && (() => {
        const m = members.find(mm => mm.id === statementMemberId);
        return m ? <MemberStatementModal member={m} onClose={() => setStatementMemberId(null)} onDeleteEntry={(id) => actions.removeLedgerEntry(id)} /> : null;
      })()}
      {ledgerModal && (
        <LedgerModal
          title={`${ledgerModal.type === 'payment' ? 'Record payment' : 'Add charge'} — ${ledgerModal.member.name}`}
          type={ledgerModal.type} categories={FEE_CATEGORIES}
          onClose={() => setLedgerModal(null)}
          onSave={(entry) => actions.addLedgerEntry(ledgerModal.member.id, entry)}
        />
      )}
      {confirmAction?.type === 'disable' && (
        <ConfirmModal title="Disable this member?"
          message={`${confirmAction.member.name} will stop being charged meeting fees from now on. Their existing balance stays as-is — you can re-enable them any time.`}
          confirmLabel="Disable" onCancel={() => setConfirmAction(null)}
          onConfirm={() => { actions.toggleFeeMemberActive(confirmAction.member); setConfirmAction(null); }} />
      )}
      {confirmAction?.type === 'delete' && (
        <ConfirmModal title="Delete this member?"
          message={`This permanently removes ${confirmAction.member.name} and their entire fee history (charges, payments, receipts). This can't be undone.`}
          confirmLabel="Delete" onCancel={() => setConfirmAction(null)}
          onConfirm={() => { actions.removeFeeMember(confirmAction.member.id); setSelected(prev => { const n = new Set(prev); n.delete(confirmAction.member.id); return n; }); setConfirmAction(null); }} />
      )}
      {confirmAction?.type === 'bulkDelete' && (
        <ConfirmModal title={`Delete ${selectedMembers.length} member${selectedMembers.length === 1 ? '' : 's'}?`}
          message={(
            <>
              This permanently removes the {selectedMembers.length === 1 ? 'member' : `${selectedMembers.length} members`} below and their entire fee history (charges, payments, receipts). This can't be undone.
              <div style={{ marginTop: 8, maxHeight: 140, overflowY: 'auto', color: C.ink, fontWeight: 600 }}>
                {selectedMembers.slice(0, 10).map(m => <div key={m.id}>{m.name}</div>)}
                {selectedMembers.length > 10 && <div style={{ color: C.inkSoft, fontWeight: 400 }}>…and {selectedMembers.length - 10} more</div>}
              </div>
            </>
          )}
          confirmLabel={`Delete ${selectedMembers.length}`} onCancel={() => setConfirmAction(null)}
          onConfirm={() => { const ids = selectedMembers.map(m => m.id); setConfirmAction(null); setSelected(new Set()); actions.removeFeeMembers(ids); }} />
      )}
    </div>
  );
}
