import React, { useState } from 'react';
import { Download, Trash2, X } from 'lucide-react';
import { C, Btn, fmt, balanceColor } from '../lib/theme';
import { catLabel, OPENING_METHOD } from '../lib/fees';
import { downloadMemberStatementPDF } from '../lib/pdf';
import ConfirmModal from './ConfirmModal';

const COLS = 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr) 28px';
const cell = { padding: '7px 6px', borderTop: `1px solid ${C.line}` };

export default function MemberStatementModal({ member, onClose, onDeleteEntry }) {
  const [toDelete, setToDelete] = useState(null);
  // oldest first; same-day entries keep the order they were created in
  const sorted = [...(member.ledger || [])].sort((a, b) => a.date.localeCompare(b.date) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  let running = 0;
  const rows = sorted.map(l => {
    running += l.type === 'payment' ? Number(l.amount) : -Number(l.amount);
    return { ...l, running };
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(28,36,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 55, padding: 16 }} onClick={onClose}>
      <div className="stc-fade stc-scroll" onClick={(e) => e.stopPropagation()} style={{ background: C.card, borderRadius: 8, width: 700, maxWidth: '100%', maxHeight: '85vh', overflow: 'auto' }}>
        <div style={{ padding: 18, borderBottom: `1px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="stc-serif" style={{ fontSize: 16, fontWeight: 600, color: C.ink }}>{member.name} — statement</div>
            <div className="stc-sans" style={{ fontSize: 12, color: C.inkSoft }}>{member.company_name} · Balance: negative (red) = owed, positive (green) = in credit</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Btn variant="outline" icon={Download} onClick={() => downloadMemberStatementPDF({ member, ledger: member.ledger })}>PDF</Btn>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft }}><X size={18} /></button>
          </div>
        </div>
        <div style={{ padding: '4px 18px 18px' }}>
          {rows.length === 0 && <div className="stc-sans" style={{ fontSize: 13, color: C.inkSoft, padding: '16px 0' }}>No transactions yet.</div>}
          {rows.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: COLS, fontSize: 12 }}>
              {['Date', 'Type', 'Category', 'Amount', 'Note', 'Balance', ''].map((h, i) => (
                <div key={i} className="stc-sans" style={{ fontWeight: 700, color: C.inkSoft, textTransform: 'uppercase', fontSize: 10.5, padding: '8px 6px', borderBottom: `1px solid ${C.line}` }}>{h}</div>
              ))}
              {rows.map((l, i) => (
                <React.Fragment key={l.id || i}>
                  <div className="stc-sans" style={cell}>{l.date}</div>
                  <div className="stc-sans" style={{ ...cell, color: l.type === 'charge' ? C.rust : C.green }}>{l.type === 'charge' ? 'Charge' : 'Payment'}</div>
                  <div className="stc-sans" style={cell}>{catLabel(l.category)}</div>
                  <div className="stc-mono" style={cell}>{fmt(l.amount)}</div>
                  <div className="stc-sans" style={{ ...cell, color: C.inkSoft }}>{l.note}{l.method === OPENING_METHOD ? '' : (l.method ? ` · ${l.method}` : '')}</div>
                  <div className="stc-mono" style={{ ...cell, fontWeight: 700, color: balanceColor(l.running) }}>{fmt(l.running)}</div>
                  <div style={cell}>
                    {onDeleteEntry && l.id && <button title="Delete this entry" onClick={() => setToDelete(l)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.inkSoft, padding: 0 }}><Trash2 size={13} /></button>}
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>
      {toDelete && (
        <ConfirmModal title="Delete this entry?"
          message={`Remove the ${toDelete.type} of AED ${fmt(toDelete.amount)} dated ${toDelete.date}? The member's balance will be recalculated. This can't be undone.`}
          confirmLabel="Delete" onCancel={() => setToDelete(null)}
          onConfirm={() => { onDeleteEntry(toDelete.id); setToDelete(null); }} />
      )}
    </div>
  );
}
