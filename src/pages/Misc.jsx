import React, { useState } from 'react';
import { loadXLSX } from '../lib/loaders';
import { Download, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { C, Card, PageHeader, TableHead, Field, Btn, inputStyle, fmt, todayISO } from '../lib/theme';
import { downloadMiscReceiptPDF } from '../lib/pdf';

const firstOfThisMonth = () => `${todayISO().slice(0, 7)}-01`;

export default function Misc({ data, actions }) {
  const { miscEntries } = data;
  const [form, setForm] = useState({ date: todayISO(), type: 'debit', amount: '', note: '', invoiceUrl: '' });
  const [fromDate, setFromDate] = useState(firstOfThisMonth());
  const [toDate, setToDate] = useState(todayISO());

  const add = () => {
    if (!form.amount) return;
    actions.addMisc({ date: form.date, type: form.type, amount: Number(form.amount), note: form.note, invoice_url: form.type === 'debit' ? form.invoiceUrl : '' });
    setForm({ date: todayISO(), type: 'debit', amount: '', note: '', invoiceUrl: '' });
  };

  const exportRange = async () => {
    try {
    const inRange = miscEntries.filter(e => (!fromDate || e.date >= fromDate) && (!toDate || e.date <= toDate));
    const sorted = [...inRange].sort((a, b) => a.date.localeCompare(b.date));
    const totalCredits = sorted.filter(e => e.type === 'credit').reduce((s, e) => s + Number(e.amount), 0);
    const totalDebits = sorted.filter(e => e.type === 'debit').reduce((s, e) => s + Number(e.amount), 0);

    const sheetRows = sorted.map(e => ({
      Date: e.date, Type: e.type === 'credit' ? 'Credit' : 'Debit', Amount: e.amount, Note: e.note || '', 'Invoice URL': e.invoice_url || '',
    }));
    sheetRows.push({ Date: '', Type: '', Amount: '', Note: '', 'Invoice URL': '' });
    sheetRows.push({ Date: '', Type: 'Total Credits', Amount: totalCredits, Note: '', 'Invoice URL': '' });
    sheetRows.push({ Date: '', Type: 'Total Debits', Amount: totalDebits, Note: '', 'Invoice URL': '' });
    sheetRows.push({ Date: '', Type: 'Net', Amount: totalCredits - totalDebits, Note: '', 'Invoice URL': '' });

    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), 'Miscellaneous');
    XLSX.writeFile(wb, `st-console-miscellaneous-${fromDate}-to-${toDate}.xlsx`);
    } catch (e) { console.error(e); window.alert(`Could not create the Excel file: ${e.message || e}`); }
  };

  const rows = [...miscEntries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="stc-fade">
      <PageHeader title="Miscellaneous" sub="One-off debits or credits to the chapter kitty" />
      <Card style={{ padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="Date"><input style={inputStyle} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Type">
            <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
            </select>
          </Field>
          <Field label="Amount (AED)"><input style={inputStyle} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></Field>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: form.type === 'debit' ? '1.5fr 1.5fr auto' : '1fr auto', gap: 10, alignItems: 'end' }}>
          <Field label="Note"><input style={inputStyle} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
          {form.type === 'debit' && (
            <Field label="Invoice URL (optional)"><input style={inputStyle} placeholder="Link to invoice copy" value={form.invoiceUrl} onChange={(e) => setForm({ ...form, invoiceUrl: e.target.value })} /></Field>
          )}
          <Btn variant="primary" icon={Plus} onClick={add}>Add entry</Btn>
        </div>
      </Card>

      <Card style={{ padding: 16, marginBottom: 18 }}>
        <div className="stc-sans" style={{ fontSize: 12, color: C.inkSoft, marginBottom: 10, fontWeight: 600 }}>Export a date range to Excel</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <Field label="From"><input style={inputStyle} type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></Field>
          <Field label="To"><input style={inputStyle} type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} /></Field>
          <Btn variant="brass" icon={Download} onClick={exportRange}>Export Excel</Btn>
        </div>
      </Card>

      <Card style={{ overflow: 'hidden' }}>
        <TableHead cols={['Date', 'Type', 'Amount', 'Note', '']} lastColWidth={64} />
        {rows.length === 0 && <div className="stc-sans" style={{ padding: 16, fontSize: 13, color: C.inkSoft }}>No entries yet.</div>}
        {rows.map(e => (
          <div key={e.id} className="stc-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr)) 64px', padding: '10px 14px', borderTop: `1px solid ${C.line}`, alignItems: 'center' }}>
            <div className="stc-sans" style={{ fontSize: 13 }}>{e.date}</div>
            <div className="stc-sans" style={{ fontSize: 13, textTransform: 'capitalize' }}>{e.type}</div>
            <div className="stc-mono" style={{ fontSize: 13, fontWeight: 700, color: e.type === 'credit' ? C.green : C.rust }}>{e.type === 'credit' ? '+' : '-'}{fmt(e.amount)}</div>
            <div className="stc-sans" style={{ fontSize: 13, color: C.inkSoft }}>{e.note}</div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              {e.type === 'credit' && <button title="Download receipt (PDF)" onClick={() => downloadMiscReceiptPDF({ entry: e })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.brass }}><Download size={14} /></button>}
              {e.type === 'debit' && e.invoice_url && <a href={e.invoice_url} target="_blank" rel="noreferrer" title="Open invoice copy" style={{ color: C.brass, display: 'flex', alignItems: 'center' }}><ExternalLink size={14} /></a>}
              <button title="Remove" onClick={() => actions.removeMisc(e.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft }}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
