import { useState, useEffect, useMemo } from 'react';
import { Target, Briefcase, TrendingUp, BarChart2, Download, X, Minus, Pencil } from 'lucide-react';
import {
  giocataAdd, giocataUpdate, giocataDelete, giocateListen,
  transazioneAdd, transazioneDelete, transazioniListen,
  calcStats, calcFinanze, calcAdvancedStats,
  calcDailyCumulative, calcDailyCassa, calcByBookmaker,
} from '../services/analyticsdb';

// ─── Costanti ─────────────────────────────────────────
const TIPI_GIOCATA = ['Singola', 'Multipla', 'Chicca', 'Antepost', 'Listone'];
const BOOKMAKERS = [
  'Bet365','Sisal','Snai','ePlay24','Lottomatica','Eurobet','Planetwin365',
  'William Hill','Betway','Bwin','888sport','Unibet','Betfair','GoldBet',
  'Betaland','NetBet','Betsson','Admiralbet','Novibet','Pokerstars Sports',
  'Gioco Digitale','Betclic','Leovegas','Sportbet','Marathonbet',
];
const RISULTATI = [
  { value: 'pending', label: 'In attesa', color: 'var(--du-text-muted)' },
  { value: 'won',     label: 'Vinta',     color: '#22A55A' },
  { value: 'lost',    label: 'Persa',     color: '#C93535' },
  { value: 'void',    label: 'Void',      color: '#D4911A' },
];
const TIPI_TX = [
  { value: 'entrata',      label: 'Entrata',      color: '#22A55A' },
  { value: 'uscita',       label: 'Uscita',       color: '#C93535' },
  { value: 'investimento', label: 'Investimento', color: '#818CF8' },
];
const CHART_FILTERS = [
  { label: '1S', value: '1s' },
  { label: '1M', value: '1m' },
  { label: '3M', value: '3m' },
  { label: '1A', value: '1a' },
  { label: 'Tutto', value: 'tutto' },
];

// ─── Helpers ──────────────────────────────────────────
const fmt    = n => (n >= 0 ? '+' : '') + n.toFixed(2) + '€';
const fmtAbs = n => Math.abs(n).toFixed(2) + '€';
const fmtDate = iso => iso
  ? new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })
  : '—';
const fmtMonth = ym => {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
};
const fmtDay = iso => iso
  ? new Date(iso + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' })
  : '—';
const giocataProfit = g => {
  const s = parseFloat(g.stake) || 0, q = parseFloat(g.quota) || 0;
  if (g.risultato === 'won')  return s * (q - 1);
  if (g.risultato === 'lost') return -s;
  return 0;
};

function exportGiocateCSV(giocate) {
  const headers = ['Data','Tipo','Bookmaker','Descrizione','Quota','Stake','Risultato','P/L €','Note'];
  const rows = giocate.map(g => {
    const s = parseFloat(g.stake) || 0, q = parseFloat(g.quota) || 0;
    const pl = g.risultato === 'won'  ? (s*(q-1)).toFixed(2)
             : g.risultato === 'lost' ? (-s).toFixed(2) : '0.00';
    return [g.data, g.tipo, g.bookmaker||'', g.descrizione, q.toFixed(2), s.toFixed(2), g.risultato, pl, g.note||'']
      .map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['﻿'+csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `giocate_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Grafico generico ─────────────────────────────────
function LineChart({ allPoints, title, currentLabel }) {
  const [filter, setFilter] = useState('tutto');

  const points = useMemo(() => {
    let pts = allPoints;
    if (filter !== 'tutto' && pts.length > 0) {
      const now = new Date();
      const co  = new Date(now);
      if (filter === '1s') co.setDate(now.getDate() - 7);
      else if (filter === '1m') co.setMonth(now.getMonth() - 1);
      else if (filter === '3m') co.setMonth(now.getMonth() - 3);
      else if (filter === '1a') co.setFullYear(now.getFullYear() - 1);
      const cutStr = co.toISOString().split('T')[0];
      pts = pts.filter(p => p.date >= cutStr);
    }
    return pts.length > 0 ? [{ date: '', value: 0 }, ...pts] : [];
  }, [allPoints, filter]);

  const lastVal   = points.length > 1 ? points[points.length - 1].value : null;
  const lineColor = lastVal != null ? (lastVal >= 0 ? '#22c55e' : '#f87171') : '#22c55e';

  const chartBody = () => {
    if (points.length < 2) {
      return <div className="an-chart-empty">Nessun dato nel periodo selezionato</div>;
    }
    const W = 600, H = 150;
    const PAD = { top: 14, right: 14, bottom: 22, left: 46 };
    const iW = W - PAD.left - PAD.right, iH = H - PAD.top - PAD.bottom;
    const vals = points.map(p => p.value);
    const minV = Math.min(...vals), maxV = Math.max(...vals);
    const range = maxV - minV || 1;
    const cx = i => PAD.left + (i / (points.length - 1)) * iW;
    const cy = v => PAD.top  + (1 - (v - minV) / range)  * iH;
    const pathD = points.map((p,i) => `${i===0?'M':'L'}${cx(i).toFixed(1)},${cy(p.value).toFixed(1)}`).join(' ');
    const zY = cy(Math.max(minV, 0));
    const areaD = `${pathD} L${cx(points.length-1).toFixed(1)},${zY.toFixed(1)} L${cx(0).toFixed(1)},${zY.toFixed(1)} Z`;
    const gId = title.replace(/\s+/g,'');
    const yTicks = [...new Set([minV, minV+range/2, maxV])];
    const firstDate = points[1]?.date || '';
    const lastDate  = points[points.length-1]?.date || '';
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="an-chart-svg" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gId+'p'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#22c55e" stopOpacity="0.22"/>
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.01"/>
          </linearGradient>
          <linearGradient id={gId+'n'} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f87171" stopOpacity="0.01"/>
            <stop offset="100%" stopColor="#f87171" stopOpacity="0.22"/>
          </linearGradient>
        </defs>
        {yTicks.map((v,i) => (
          <g key={i}>
            <line x1={PAD.left} y1={cy(v)} x2={W-PAD.right} y2={cy(v)} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
            <text x={PAD.left-4} y={cy(v)+3} textAnchor="end" fill="rgba(91,198,245,0.35)" fontSize="8.5">{v.toFixed(0)}€</text>
          </g>
        ))}
        {minV < 0 && maxV > 0 && (
          <line x1={PAD.left} y1={cy(0)} x2={W-PAD.right} y2={cy(0)} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3,3"/>
        )}
        {firstDate && <text x={PAD.left}       y={H-4} fill="rgba(91,198,245,0.3)" fontSize="8">{fmtDate(firstDate)}</text>}
        {lastDate  && <text x={W-PAD.right}     y={H-4} textAnchor="end" fill="rgba(91,198,245,0.3)" fontSize="8">{fmtDate(lastDate)}</text>}
        <path d={areaD} fill={`url(#${lastVal>=0?gId+'p':gId+'n'})`}/>
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
        <circle cx={cx(points.length-1)} cy={cy(lastVal)} r="3.5" fill={lineColor}/>
      </svg>
    );
  };

  return (
    <div className="an-chart-wrap">
      <div className="an-chart-header">
        <span className="an-chart-title">{title}</span>
        <span className="an-chart-last" style={{ color: lineColor }}>{currentLabel}</span>
      </div>
      <div className="an-chart-filters">
        {CHART_FILTERS.map(f => (
          <button key={f.value} className={`an-chart-filter ${filter===f.value?'active':''}`} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>
      {chartBody()}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────
function StatCard({ label, value, sub, color, big }) {
  return (
    <div className="an-stat-card">
      <div className="an-stat-label">{label}</div>
      <div className="an-stat-value" style={{ color: color||'var(--text-hi)', fontSize: big?'26px':'20px' }}>{value}</div>
      {sub && <div className="an-stat-sub">{sub}</div>}
    </div>
  );
}

// ─── Bookmaker Table ──────────────────────────────────
function BookmakerTable({ giocate }) {
  const data = useMemo(() => calcByBookmaker(giocate), [giocate]);
  if (data.length === 0) return null;
  return (
    <div className="an-bk-wrap">
      <div className="an-section-label" style={{ marginBottom: 8 }}><TrendingUp size={13} strokeWidth={1.5} aria-hidden="true"/> Performance per Bookmaker</div>
      <div className="an-bk-table">
        <div className="an-bk-header">
          <span>Bookmaker</span><span>Tip</span><span>SR%</span><span>Profit</span><span>ROI</span>
        </div>
        {data.map(bk => (
          <div key={bk.name} className="an-bk-row">
            <span className="an-bk-name">{bk.name}</span>
            <span className="an-bk-val">{bk.totali}</span>
            <span className="an-bk-val">{bk.sr}%</span>
            <span className="an-bk-val" style={{ color: bk.profit>=0?'#22c55e':'#f87171' }}>
              {bk.profit>=0?'+':''}{bk.profit.toFixed(2)}€
            </span>
            <span className="an-bk-val" style={{ color: bk.roi>=0?'#22c55e':'#f87171' }}>{bk.roi}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── GiocataForm ─────────────────────────────────────
function GiocataForm({ onAdd }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ data: today, tipo: 'Singola', bookmaker: '', descrizione: '', quota: '', stake: '', risultato: 'pending', note: '' });
  const [loading, setLoading] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    if (!form.descrizione || !form.quota || !form.stake) return;
    setLoading(true);
    await onAdd({ ...form, quota: parseFloat(form.quota), stake: parseFloat(form.stake) });
    setForm(f => ({ ...f, bookmaker:'', descrizione:'', quota:'', stake:'', risultato:'pending', note:'' }));
    setLoading(false);
  }
  return (
    <form className="an-form" onSubmit={submit}>
      <div className="an-form-row">
        <input type="date" className="an-input" value={form.data} onChange={e => upd('data', e.target.value)} />
        <select className="an-select" value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
          {TIPI_GIOCATA.map(t => <option key={t}>{t}</option>)}
        </select>
        <input className="an-input an-input-book" list="bookmakers-list" placeholder="Bookmaker..." value={form.bookmaker} onChange={e => upd('bookmaker', e.target.value)} />
        <datalist id="bookmakers-list">{BOOKMAKERS.map(b => <option key={b} value={b}/>)}</datalist>
      </div>
      <input className="an-input an-input-full" placeholder="Descrizione — es. Milan vs Inter, 1X2 Casa" value={form.descrizione} onChange={e => upd('descrizione', e.target.value)} required />
      <div className="an-form-row">
        <input className="an-input" placeholder="Quota" type="number" step="0.01" min="1" value={form.quota} onChange={e => upd('quota', e.target.value)} required />
        <input className="an-input" placeholder="Stake (€)" type="number" step="0.01" min="0" value={form.stake} onChange={e => upd('stake', e.target.value)} required />
        <select className="an-select" value={form.risultato} onChange={e => upd('risultato', e.target.value)}>
          {RISULTATI.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </div>
      <input className="an-input an-input-full" placeholder="Note (opzionale)" value={form.note} onChange={e => upd('note', e.target.value)} />
      <button className="an-submit-btn" type="submit" disabled={loading}>+ Aggiungi giocata</button>
    </form>
  );
}

// ─── GiocataRow ───────────────────────────────────────
function GiocataRow({ g, onUpdateRisultato, onDelete }) {
  const [editRis, setEditRis] = useState(false);
  const stake = parseFloat(g.stake)||0, quota = parseFloat(g.quota)||0;
  const profit = giocataProfit(g);
  const profitColor = g.risultato==='won'?'#22c55e':g.risultato==='lost'?'#f87171':'var(--text-lo)';
  const ris = RISULTATI.find(r => r.value === g.risultato);
  return (
    <div className="an-row an-row-g">
      <div className="an-row-date">{fmtDate(g.data)}</div>
      <div className="an-row-tipo">{g.tipo}</div>
      <div className="an-row-book">{g.bookmaker || <span style={{opacity:0.3}}>—</span>}</div>
      <div className="an-row-desc">{g.descrizione}</div>
      <div className="an-row-quota">@{quota.toFixed(2)}</div>
      <div className="an-row-stake">{stake.toFixed(2)}€</div>
      {editRis ? (
        <div className="an-ris-select-wrap">
          {RISULTATI.map(r => (
            <button key={r.value} className="an-ris-option" style={{ color: r.color }}
              onClick={() => { onUpdateRisultato(g.id, r.value); setEditRis(false); }}>
              {r.label}
            </button>
          ))}
        </div>
      ) : (
        <button className="an-ris-badge" style={{ color: ris?.color||'var(--text-lo)' }}
          onClick={() => setEditRis(true)} title="Modifica risultato">
          {ris?.label||'—'}
        </button>
      )}
      <div className="an-row-profit" style={{ color: profitColor }}>
        {g.risultato==='pending' ? '—' : fmt(profit)}
      </div>
      <button className="an-delete-btn" onClick={() => onDelete(g.id)} aria-label="Elimina"><X size={12} strokeWidth={2}/></button>
    </div>
  );
}

// ─── Giocate raggruppate ──────────────────────────────
function GiocateGrouped({ giocate, onUpdateRisultato, onDelete }) {
  const grouped = useMemo(() => {
    const months = new Map();
    giocate.forEach(g => {
      const date = g.data || '0000-00-00';
      const mk = date.slice(0, 7);
      if (!months.has(mk)) months.set(mk, new Map());
      const days = months.get(mk);
      if (!days.has(date)) days.set(date, []);
      days.get(date).push(g);
    });
    return months;
  }, [giocate]);

  const monthP = days => { let t=0; days.forEach(gs => gs.forEach(g => { t+=giocataProfit(g); })); return t; };
  const dayP   = gs => gs.reduce((s,g) => s+giocataProfit(g), 0);
  const hasPending = gs => gs.some(g => g.risultato==='pending');

  return (
    <div className="an-grouped">
      {[...grouped.entries()].map(([mk, days]) => {
        const mp = monthP(days);
        const mpC = mp>0?'#22c55e':mp<0?'#f87171':'var(--text-lo)';
        return (
          <div key={mk} className="an-group-month-block">
            <div className="an-group-month-header">
              <span className="an-group-month-label">{fmtMonth(mk)}</span>
              <span className="an-group-month-profit" style={{ color: mpC }}>{fmt(mp)}</span>
            </div>
            {[...days.entries()].map(([dk, gs]) => {
              const dp = dayP(gs);
              const dpC = dp>0?'#22c55e':dp<0?'#f87171':'var(--text-lo)';
              return (
                <div key={dk} className="an-group-day-block">
                  <div className="an-group-day-header">
                    <span className="an-group-day-label">{fmtDay(dk)}</span>
                    <span className="an-group-day-profit" style={{ color: hasPending(gs)?'var(--text-lo)':dpC }}>
                      {hasPending(gs) ? <Minus size={12}/> : fmt(dp)}
                    </span>
                  </div>
                  <div className="an-table">
                    <div className="an-table-header an-table-header-g">
                      <span>Data</span><span>Tipo</span><span>Book</span>
                      <span>Descrizione</span><span>Quota</span><span>Stake</span>
                      <span>Risultato</span><span>P/L</span><span></span>
                    </div>
                    {gs.map(g => (
                      <GiocataRow key={g.id} g={g} onUpdateRisultato={onUpdateRisultato} onDelete={onDelete}/>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── TransazioneForm ──────────────────────────────────
function TransazioneForm({ onAdd }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ data: today, tipo: 'entrata', descrizione: '', importo: '', note: '' });
  const [loading, setLoading] = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    if (!form.descrizione || !form.importo) return;
    setLoading(true);
    await onAdd({ ...form, importo: parseFloat(form.importo) });
    setForm(f => ({ ...f, descrizione:'', importo:'', note:'' }));
    setLoading(false);
  }
  return (
    <form className="an-form" onSubmit={submit}>
      <div className="an-form-row">
        <input type="date" className="an-input" value={form.data} onChange={e => upd('data', e.target.value)} />
        <select className="an-select" value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
          {TIPI_TX.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      <input className="an-input an-input-full" placeholder="Descrizione" value={form.descrizione} onChange={e => upd('descrizione', e.target.value)} required />
      <div className="an-form-row">
        <input className="an-input" placeholder="Importo (€)" type="number" step="0.01" min="0" value={form.importo} onChange={e => upd('importo', e.target.value)} required />
        <input className="an-input an-input-flex" placeholder="Note" value={form.note} onChange={e => upd('note', e.target.value)} />
      </div>
      <button className="an-submit-btn" type="submit" disabled={loading}>+ Aggiungi voce</button>
    </form>
  );
}

// ─── TransazioneRow ───────────────────────────────────
function TransazioneRow({ t, onDelete }) {
  const tx = TIPI_TX.find(x => x.value === t.tipo);
  const sign = t.tipo === 'entrata' ? '+' : '−';
  const color = tx?.color || 'var(--text-hi)';
  return (
    <div className="an-row">
      <div className="an-row-date">{fmtDate(t.data)}</div>
      <div className="an-row-tipo" style={{ color }}>{tx?.label||t.tipo}</div>
      <div className="an-row-desc an-row-desc-wide">{t.descrizione}</div>
      {t.note && <div className="an-row-note">{t.note}</div>}
      <div className="an-row-importo" style={{ color }}>{sign}{fmtAbs(t.importo)}</div>
      <button className="an-delete-btn" onClick={() => onDelete(t.id)} aria-label="Elimina"><X size={12} strokeWidth={2}/></button>
    </div>
  );
}

// ─── PAGINA PRINCIPALE ────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab]               = useState('giocate');
  const [giocate, setGiocate]       = useState([]);
  const [transazioni, setTransazioni] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [capIniziale, setCapIniziale] = useState(() => {
    const v = localStorage.getItem('du_cap_iniziale');
    return v ? parseFloat(v) : null;
  });
  const [capInput, setCapInput]     = useState('');
  const [showCapForm, setShowCapForm] = useState(false);

  useEffect(() => {
    // Listener in tempo reale — tutti i collaboratori vedono i dati aggiornati
    const unsubG = giocateListen(data => { setGiocate(data); setLoading(false); });
    const unsubT = transazioniListen(data => { setTransazioni(data); });
    return () => { unsubG(); unsubT(); };
  }, []);

  async function handleAddGiocata(e)          { await giocataAdd(e); }
  async function handleUpdateRisultato(id, r) { await giocataUpdate(id, { risultato: r }); }
  async function handleDeleteGiocata(id) {
    if (!confirm('Eliminare questa giocata?')) return;
    await giocataDelete(id);
  }
  async function handleAddTransazione(e) { await transazioneAdd(e); }
  async function handleDeleteTransazione(id) {
    if (!confirm('Eliminare questa voce?')) return;
    await transazioneDelete(id);
  }
  function saveCapIniziale() {
    const v = parseFloat(capInput);
    if (isNaN(v) || v < 0) return;
    localStorage.setItem('du_cap_iniziale', v);
    setCapIniziale(v);
    setCapInput('');
    setShowCapForm(false);
  }

  // Calcoli
  const stats = calcStats(giocate);
  const adv   = calcAdvancedStats(giocate);
  const fin   = calcFinanze(transazioni);

  const saldoTotale  = fin.saldo + stats.profit - stats.pendingStaked;
  const capAttuale   = capIniziale != null ? capIniziale + stats.profit : null;
  const progressione = capIniziale != null && capIniziale > 0
    ? ((stats.profit / capIniziale) * 100).toFixed(1) : null;

  const profitColor = stats.profit >= 0 ? '#22c55e' : '#f87171';
  const saldoColor  = saldoTotale  >= 0 ? '#22c55e' : '#f87171';
  const roiColor    = stats.roi    >= 0 ? '#22c55e' : '#f87171';

  const profitPoints = useMemo(() => calcDailyCumulative(giocate),   [giocate]);
  const cassaPoints  = useMemo(() => calcDailyCassa(transazioni),     [transazioni]);

  return (
    <div className="an-page">
      <div className="an-header">
        <div>
          <h1 className="an-title">Gestionale</h1>
          <p className="an-subtitle">Uso interno — performance tip + cassa progetto</p>
        </div>
      </div>

      {/* ── PANNELLO RIASSUNTIVO FISSO ── */}
      <div className="an-top-summary">
        <div
          className={`an-summary-panel ${tab==='giocate'?'active':''}`}
          onClick={() => setTab('giocate')}
        >
          <div className="an-summary-icon"><Target size={18} strokeWidth={1.5} aria-hidden="true"/></div>
          <div className="an-summary-body">
            <div className="an-summary-label">Giocate</div>
            <div className="an-summary-main" style={{ color: profitColor }}>{fmt(stats.profit)}</div>
            <div className="an-summary-subs">
              ROI {stats.roi}% · SR {stats.strikeRate}% · {stats.totali} tip
            </div>
          </div>
        </div>
        <div
          className={`an-summary-panel ${tab==='transazioni'?'active':''}`}
          onClick={() => setTab('transazioni')}
        >
          <div className="an-summary-icon"><Briefcase size={18} strokeWidth={1.5} aria-hidden="true"/></div>
          <div className="an-summary-body">
            <div className="an-summary-label">Cassa Progetto</div>
            <div className="an-summary-main" style={{ color: saldoColor }}>{fmt(saldoTotale)}</div>
            <div className="an-summary-subs">
              Entr {fin.entrate.toFixed(0)}€ · Usc {fin.uscite.toFixed(0)}€ · Inv {fin.investimenti.toFixed(0)}€
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="an-tabs">
        <button className={`an-tab ${tab==='giocate'?'active':''}`} onClick={() => setTab('giocate')}>
          <Target size={14} strokeWidth={1.5} aria-hidden="true"/>
          Giocate {stats.totali > 0 && <span className="an-tab-count">{stats.totali}</span>}
        </button>
        <button className={`an-tab ${tab==='transazioni'?'active':''}`} onClick={() => setTab('transazioni')}>
          <Briefcase size={14} strokeWidth={1.5} aria-hidden="true"/>
          Cassa {transazioni.length > 0 && <span className="an-tab-count">{transazioni.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className="an-loading"><div className="cs-spinner"/> Caricamento...</div>
      ) : (
        <>
          {/* ═══ TAB GIOCATE ═══ */}
          {tab === 'giocate' && (
            <div className="an-content">

              {/* Grafico profit */}
              <LineChart
                allPoints={profitPoints}
                title="Curva Profitto"
                currentLabel={fmt(stats.profit)}
              />

              {/* Stats principali */}
              <div className="an-dashboard-section">
                <div className="an-cards-row">
                  <StatCard label="Profitto Totale" value={fmt(stats.profit)}
                    sub={`${stats.chiuse} chiuse su ${stats.totali}`} color={profitColor} big />
                  <StatCard label="ROI" value={stats.roi+'%'}
                    sub={`su ${stats.totalStaked}€ giocati`} color={roiColor} />
                  <StatCard label="Strike Rate" value={stats.strikeRate+'%'}
                    sub={`${stats.vinte}V — ${stats.perse}P — ${stats.void}N`} color="var(--blue)" />
                  <StatCard label="In attesa" value={stats.pending}
                    sub={`${stats.pendingStaked.toFixed(2)}€ impegnati`} color="var(--text-mid)" />
                </div>
              </div>

              {/* Statistiche avanzate */}
              <div className="an-dashboard-section">
                <div className="an-section-label" style={{ marginBottom: 8 }}><BarChart2 size={13} strokeWidth={1.5} aria-hidden="true"/> Statistiche Avanzate</div>
                <div className="an-stats-extra">
                  <div className="an-extra-card">
                    <span className="an-extra-label">Drawdown max</span>
                    <span className="an-extra-val" style={{ color: adv.maxDrawdown>0?'#f87171':'var(--text-lo)' }}>
                      {adv.maxDrawdown>0 ? '−'+adv.maxDrawdown.toFixed(2)+'€' : '—'}
                    </span>
                  </div>
                  <div className="an-extra-card">
                    <span className="an-extra-label">Serie vittorie max</span>
                    <span className="an-extra-val" style={{ color:'#22c55e' }}>{adv.maxWinStreak||'—'}</span>
                  </div>
                  <div className="an-extra-card">
                    <span className="an-extra-label">Serie sconfitte max</span>
                    <span className="an-extra-val" style={{ color:'#f87171' }}>{adv.maxLossStreak||'—'}</span>
                  </div>
                  <div className="an-extra-card">
                    <span className="an-extra-label">Puntata media</span>
                    <span className="an-extra-val">{adv.avgStake>0 ? adv.avgStake.toFixed(2)+'€' : '—'}</span>
                  </div>
                  <div className="an-extra-card">
                    <span className="an-extra-label">Puntata massima</span>
                    <span className="an-extra-val">{adv.maxStake>0 ? adv.maxStake.toFixed(2)+'€' : '—'}</span>
                  </div>
                  <div className="an-extra-card">
                    <span className="an-extra-label">Quota media</span>
                    <span className="an-extra-val" style={{ color:'var(--blue)' }}>{adv.avgQuota||'—'}</span>
                  </div>
                  <div className="an-extra-card">
                    <span className="an-extra-label">Miglior profitto</span>
                    <span className="an-extra-val" style={{ color:'#22c55e' }}>
                      {adv.bestProfit>0 ? '+'+adv.bestProfit.toFixed(2)+'€' : '—'}
                    </span>
                  </div>
                  <div className="an-extra-card">
                    <span className="an-extra-label">Peggior perdita</span>
                    <span className="an-extra-val" style={{ color:'#f87171' }}>
                      {adv.worstLoss>0 ? '−'+adv.worstLoss.toFixed(2)+'€' : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Breakdown bookmaker */}
              <BookmakerTable giocate={giocate} />

              {/* Form + lista */}
              <div className="an-section-separator"/>
              <div className="an-section-label" style={{ marginBottom: 8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span>Registro Giocate</span>
                {giocate.length > 0 && (
                  <button className="an-export-btn" onClick={() => exportGiocateCSV(giocate)}>
                    <Download size={12} strokeWidth={1.5} aria-hidden="true"/> CSV
                  </button>
                )}
              </div>
              <GiocataForm onAdd={handleAddGiocata} />
              {giocate.length === 0
                ? <div className="an-empty">Nessuna giocata registrata. Aggiungi la prima.</div>
                : <GiocateGrouped giocate={giocate} onUpdateRisultato={handleUpdateRisultato} onDelete={handleDeleteGiocata} />
              }
            </div>
          )}

          {/* ═══ TAB CASSA ═══ */}
          {tab === 'transazioni' && (
            <div className="an-content">

              {/* Grafico cassa */}
              <LineChart
                allPoints={cassaPoints}
                title="Andamento Cassa"
                currentLabel={fmt(fin.saldo)}
              />

              {/* Stats cassa */}
              <div className="an-dashboard-section">
                <div className="an-cards-row">
                  <StatCard label="Saldo Cassa" value={fmt(fin.saldo)}
                    sub="entrate − uscite − investimenti" color={fin.saldo>=0?'#22c55e':'#f87171'} big />
                  <StatCard label="Pocket Totale" value={fmt(saldoTotale)}
                    sub={`cassa + profit tip (${fmt(stats.profit)})`} color={saldoColor} />
                  <StatCard label="Entrate"      value={'+'+fin.entrate.toFixed(2)+'€'}      color="#22c55e" />
                  <StatCard label="Uscite"       value={'−'+fin.uscite.toFixed(2)+'€'}       color="#f87171" />
                </div>
                <div className="an-cards-row" style={{ marginTop: 8 }}>
                  <StatCard label="Investimenti" value={fin.investimenti.toFixed(2)+'€'} color="#818CF8"
                    sub="non conteggiate come uscita operativa" />
                  {stats.pendingStaked > 0 && (
                    <StatCard label="Stake in gioco" value={'−'+stats.pendingStaked.toFixed(2)+'€'}
                      sub={`${stats.pending} tip ancora aperte`} color="#facc15" />
                  )}
                </div>
              </div>

              {/* Capitale */}
              <div className="an-dashboard-section">
                <div className="an-section-label" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 8 }}>
                  <span>Capitale</span>
                  <button className="an-cap-edit-btn" onClick={() => setShowCapForm(v => !v)}>
                    {capIniziale != null ? <><Pencil size={12} strokeWidth={1.5}/> Modifica</> : '+ Imposta'}
                  </button>
                </div>
                {showCapForm && (
                  <div className="an-cap-form">
                    <input className="an-input" type="number" step="1" min="0"
                      placeholder="Capitale iniziale (€)" value={capInput}
                      onChange={e => setCapInput(e.target.value)} />
                    <button className="an-submit-btn" style={{ marginTop:0, flex:'0 0 auto' }} onClick={saveCapIniziale}>Salva</button>
                  </div>
                )}
                <div className="an-cards-row">
                  <StatCard label="Capitale iniziale" value={capIniziale!=null ? capIniziale.toFixed(2)+'€' : '—'}
                    sub="imposta il valore di partenza" color="var(--text-mid)" />
                  <StatCard label="Capitale attuale"  value={capAttuale!=null ? capAttuale.toFixed(2)+'€' : '—'}
                    sub="iniziale + profit tip" color={capAttuale!=null&&capAttuale>=(capIniziale||0)?'#22c55e':'#f87171'} />
                  <StatCard label="Progressione"      value={progressione!=null ? progressione+'%' : '—'}
                    sub="profit / capitale iniziale" color={progressione!=null?(parseFloat(progressione)>=0?'#22c55e':'#f87171'):'var(--text-lo)'} />
                </div>
              </div>

              {/* Form + lista */}
              <div className="an-section-separator"/>
              <div className="an-section-label" style={{ marginBottom: 8 }}>Registro Cassa</div>
              <TransazioneForm onAdd={handleAddTransazione} />
              {transazioni.length === 0
                ? <div className="an-empty">Nessuna voce. Aggiungi entrate, uscite o investimenti.</div>
                : (
                  <div className="an-table">
                    <div className="an-table-header">
                      <span>Data</span><span>Tipo</span><span>Descrizione</span>
                      <span></span><span>Importo</span><span></span>
                    </div>
                    {transazioni.map(t => (
                      <TransazioneRow key={t.id} t={t} onDelete={handleDeleteTransazione}/>
                    ))}
                  </div>
                )
              }
            </div>
          )}
        </>
      )}
    </div>
  );
}
