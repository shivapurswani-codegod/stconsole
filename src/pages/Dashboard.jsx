import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { C, Card, PageHeader, StatCard, LedgerTape, fmt, todayISO } from '../lib/theme';
import { amountOwed, catLabel, isCashPayment, totalBalance } from '../lib/fees';

export default function Dashboard({ data, kitty, setView, setComposer }) {
  const { settings, venueEntries, events, miscEntries, feeMembers } = data;

  const activeCount = feeMembers.filter(m => m.active).length || settings.active_members;
  const weeklyEstimate = activeCount * settings.weekly_fee_per_member;
  const upcomingEvents = events.filter(e => e.date >= todayISO()).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const totalOutstanding = feeMembers.reduce((s, m) => s + amountOwed(totalBalance(m.ledger)), 0);

  const feed = [
    ...venueEntries.map(e => ({ date: e.date, label: `Venue — ${e.attendance || 0} attendance, ${e.visitors || 0} visitors`, amt: (e.visitors || 0) * settings.visitor_fee - (e.attendance || 0) * settings.venue_paid_per_attendee })),
    ...feeMembers.flatMap(m => (m.ledger || []).filter(isCashPayment).map(l => ({ date: l.date, label: `${m.name} — ${catLabel(l.category)} payment`, amt: Number(l.amount) }))),
    ...events.map(e => ({ date: e.date, label: `Event — ${e.name}`, amt: -Number(e.budget || 0) })),
    ...miscEntries.map(e => ({ date: e.date, label: e.note || 'Miscellaneous', amt: e.type === 'credit' ? Number(e.amount) : -Number(e.amount) })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  return (
    <div className="stc-fade">
      <PageHeader title="Dashboard" sub="Chapter kitty overview" />
      <div style={{ maxWidth: 420, marginBottom: 22 }}><LedgerTape balance={kitty} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <StatCard label="Members outstanding" value={`AED ${fmt(totalOutstanding)}`} hint={`${feeMembers.filter(m => totalBalance(m.ledger) < 0).length} with a balance due`} onClick={() => setView('members')} />
        <StatCard label="Venue fee / week (est.)" value={`AED ${fmt(weeklyEstimate)}`} hint={`${activeCount} active members`} onClick={() => setView('venue')} />
        <StatCard label="Upcoming events" value={upcomingEvents.length} hint={upcomingEvents[0] ? `Next: ${upcomingEvents[0].name}` : 'None scheduled'} onClick={() => setView('events')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
        <Card style={{ padding: 18 }}>
          <div className="stc-serif" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: C.ink }}>Recent activity</div>
          {feed.length === 0 && <div className="stc-sans" style={{ fontSize: 13, color: C.inkSoft }}>No entries yet.</div>}
          {feed.map((f, i) => (
            <div key={i} className="stc-row" style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 4px', borderTop: i ? `1px solid ${C.line}` : 'none' }}>
              <div className="stc-sans" style={{ fontSize: 13, color: C.ink }}>{f.label}<div style={{ fontSize: 11, color: C.inkSoft }}>{f.date}</div></div>
              <div className="stc-mono" style={{ fontSize: 13, fontWeight: 700, color: f.amt >= 0 ? C.green : C.rust, display: 'flex', alignItems: 'center', gap: 3 }}>
                {f.amt >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />} AED {fmt(Math.abs(f.amt))}
              </div>
            </div>
          ))}
        </Card>

        <Card style={{ padding: 18 }}>
          <div className="stc-serif" style={{ fontSize: 15, fontWeight: 600, marginBottom: 12, color: C.ink }}>Upcoming events</div>
          {upcomingEvents.length === 0 && <div className="stc-sans" style={{ fontSize: 13, color: C.inkSoft }}>No events scheduled.</div>}
          {upcomingEvents.map(ev => (
            <div key={ev.id} className="stc-row" style={{ padding: '8px 4px' }}>
              <div className="stc-sans" style={{ fontSize: 13, color: C.ink }}>{ev.name}<div style={{ fontSize: 11, color: C.inkSoft }}>{ev.date}</div></div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
