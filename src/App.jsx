import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import { C, FontStyle } from './lib/theme';
import { isCashPayment } from './lib/fees';
import { LOGO_DATA_URI } from './lib/logo';
import { useConsoleData } from './lib/useConsoleData';
import Sidebar from './components/Sidebar';
import PaymentComposer from './components/PaymentComposer';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Venue from './pages/Venue';
import Members from './pages/Members';
import Receipts from './pages/Receipts';
import Events from './pages/Events';
import Misc from './pages/Misc';
import Settings from './pages/Settings';

const Spinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.paper }}>
    <FontStyle />
    <Loader2 size={22} color={C.inkSoft} style={{ animation: 'spin 1s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out
  const [view, setView] = useState('dashboard');
  const [composer, setComposer] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session), () => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  const c = useConsoleData(!!session);

  const kitty = useMemo(() => {
    if (!c.settings) return 0;
    const venueNet = c.venueEntries.reduce((s, e) => s + Number(e.visitors) * c.settings.visitor_fee - Number(e.attendance) * c.settings.venue_paid_per_attendee, 0);
    // Only real cash received counts — imported opening-balance credits do not.
    const memberPayments = c.feeMembers.reduce((s, m) => s + (m.ledger || []).filter(isCashPayment).reduce((a, l) => a + Number(l.amount), 0), 0);
    const eventsSpend = c.events.reduce((s, e) => s + Number(e.budget || 0), 0);
    const miscNet = c.miscEntries.reduce((s, e) => s + (e.type === 'credit' ? Number(e.amount) : -Number(e.amount)), 0);
    return Number(c.settings.kitty_initial) + venueNet + memberPayments - eventsSpend + miscNet;
  }, [c.settings, c.venueEntries, c.feeMembers, c.events, c.miscEntries]);

  if (session === undefined) return <Spinner />;
  if (!session) return <Login />;
  if (c.loading) return <Spinner />;

  if (!c.settings) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.paper, padding: 24 }}>
        <FontStyle />
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div className="stc-serif" style={{ fontSize: 20, fontWeight: 700, color: C.ink, marginBottom: 10 }}>Couldn't load the console</div>
          <div className="stc-sans" style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>{c.loadError || 'The database connection failed.'}</div>
          <button onClick={() => c.refetch()} className="stc-sans" style={{ padding: '9px 16px', borderRadius: 4, background: C.ink, color: C.paper, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Try again</button>
        </div>
      </div>
    );
  }

  const data = {
    settings: c.settings, venueEntries: c.venueEntries, events: c.events, miscEntries: c.miscEntries,
    feeMembers: c.feeMembers, holidays: c.holidays,
  };

  const pages = {
    dashboard: <Dashboard data={data} kitty={kitty} setView={setView} setComposer={setComposer} />,
    venue: <Venue data={data} actions={c} />,
    members: <Members data={data} actions={c} setComposer={setComposer} />,
    receipts: <Receipts data={data} />,
    events: <Events data={data} actions={c} />,
    misc: <Misc data={data} actions={c} />,
    settings: <Settings data={data} actions={c} />,
  };

  return (
    <div style={{ minHeight: '100vh', background: C.paper, display: 'flex', position: 'relative' }}>
      <FontStyle />
      <img src={LOGO_DATA_URI} alt="BNI Insomniacs" style={{ position: 'absolute', top: 14, right: 18, width: '2cm', height: '2cm', objectFit: 'contain', zIndex: 40 }} />

      {c.busy > 0 && (
        <div className="stc-sans" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 80, background: C.ink, color: '#fff', fontSize: 12.5, fontWeight: 600, padding: '7px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Working…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      {c.actionError && (
        <div className="stc-sans" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 90, maxWidth: 560, background: C.rustSoft, color: C.rust, border: `1px solid ${C.rust}`, fontSize: 13, padding: '10px 14px', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>{c.actionError}</div>
          <button onClick={c.clearActionError} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.rust, padding: 0 }}><X size={15} /></button>
        </div>
      )}

      {composer && <PaymentComposer initial={composer} settings={c.settings} onClose={() => setComposer(null)} />}
      <Sidebar view={view} setView={setView} />
      <div className="stc-scroll" style={{ flex: 1, padding: '96px 28px 28px 28px', overflow: 'auto' }}>
        {pages[view]}
      </div>
    </div>
  );
}
