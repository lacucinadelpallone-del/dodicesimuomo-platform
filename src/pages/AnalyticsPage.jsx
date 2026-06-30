import { useState, useEffect, useMemo, useRef } from 'react';
import { Target, Briefcase, TrendingUp, BarChart2, Download, X, Minus, Pencil, Brain, Sparkles, AlertTriangle, ScanLine, Check, Radio, Calendar, Users, ChevronLeft, ChevronRight, ArrowDownToLine } from 'lucide-react';
import {
  giocataAdd, giocataUpdate, giocataDelete, giocateListen,
  transazioneAdd, transazioneDelete, transazioniListen,
  calcStats, calcFinanze, calcAdvancedStats,
  calcDailyCumulative, calcDailyCassa, calcByBookmaker,
  monitoringAdd, prelievAdd, prelievDelete, prelieviListen, calcConti,
} from '../services/analyticsdb';

// ─── Costanti ─────────────────────────────────────────
const TIPI_GIOCATA = ['Singola', 'Multipla', 'Chicca', 'Antepost', 'Listone'];
const CONTI_PERSONE = ['Gaetano', 'Antonio', 'Luca', 'Biondi'];
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

// Net profit per accounting / totals
const giocataProfit = g => {
  const s = parseFloat(g.stake) || 0, q = parseFloat(g.quota) || 0;
  if (g.risultato === 'won')  return s * (q - 1);
  if (g.risultato === 'lost') return -s;
  return 0;
};

function exportGiocateCSV(giocate) {
  const headers = ['Data','Tipo','Bookmaker','Descrizione','Quota','Stake','Risultato','P/L netto €','Incasso €','Note'];
  const rows = giocate.map(g => {
    const s = parseFloat(g.stake) || 0, q = parseFloat(g.quota) || 0;
    const pl = g.risultato === 'won'  ? (s*(q-1)).toFixed(2)
             : g.risultato === 'lost' ? (-s).toFixed(2) : '0.00';
    const incasso = g.risultato === 'won' ? (s*q).toFixed(2) : '0.00';
    return [g.data, g.tipo, g.bookmaker||'', g.descrizione, q.toFixed(2), s.toFixed(2), g.risultato, pl, incasso, g.note||'']
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

// ─── Grafico ─────────────────────────────────────────
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

// ─── Scan scontrino ──────────────────────────────────
async function resizeImageToBase64(file, maxPx = 1200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      // JPEG a qualità 0.88 — buon bilanciamento nitidezza/peso
      const base64 = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
      resolve(base64);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Helpers monitoraggio ─────────────────────────────

const TOP_LEAGUES = [
  'world cup','champions league','europa league','conference league',
  'premier league','serie a','la liga','bundesliga','ligue 1',
  'eredivisie','primeira liga','super lig','pro league',
  'nations league','european championship','copa america',
  'africa cup','asian cup','copa libertadores','copa sudamericana',
  'fa cup','coppa italia','copa del rey','dfb pokal','coupe de france',
];

function getLeaguePriority(name) {
  const n = (name || '').toLowerCase();
  for (let i = 0; i < TOP_LEAGUES.length; i++) {
    if (n.includes(TOP_LEAGUES[i])) return i;
  }
  return 999;
}

function groupFixtures(fixtures) {
  const map = new Map();
  fixtures.forEach(f => {
    const key = String(f.league.id);
    if (!map.has(key)) map.set(key, { league: f.league, fixtures: [] });
    map.get(key).fixtures.push(f);
  });
  return [...map.values()].sort((a, b) =>
    getLeaguePriority(a.league.name) - getLeaguePriority(b.league.name)
  );
}

function filterAndGroup(fixtures, filterText) {
  const q = filterText.trim().toLowerCase();
  const filtered = q
    ? fixtures.filter(f =>
        f.teams.home.name.toLowerCase().includes(q) ||
        f.teams.away.name.toLowerCase().includes(q) ||
        f.league.name.toLowerCase().includes(q) ||
        (f.league.country || '').toLowerCase().includes(q)
      )
    : fixtures;
  return groupFixtures(filtered);
}

function extractPick(desc) {
  const d = (desc || '').toUpperCase().trim();
  if (/\bGG\b/.test(d))  return 'GG';
  if (/\bNG\b/.test(d))  return 'NG';
  const m = d.match(/\b(OVER|UNDER)\s*([\d.,]+)/);
  if (m) return `${m[1]} ${m[2].replace(',', '.')}`;
  if (/\b1X\b/.test(d))  return '1X';
  if (/\bX2\b/.test(d))  return 'X2';
  if (/\b12\b/.test(d))  return '12';
  if (/ 1$/.test(d))     return '1';
  if (/ 2$/.test(d))     return '2';
  if (/ X$/.test(d))     return 'X';
  return '';
}

function extractFirstTeam(desc) {
  const d = (desc || '').trim();
  const cleaned = d.replace(/\s+(GG|NG|1X2|1X|X2|12|OVER[\s\d.,]+|UNDER[\s\d.,]+|\b[12X]\b)\s*$/i, '').trim();
  const parts = cleaned.split(/\s+(?:vs\.?|–|-|\/|contro)\s+/i);
  return parts[0].trim().split(/\s+/).slice(0, 2).join(' ');
}

function fmtFixtureDate(iso) {
  return new Date(iso).toLocaleDateString('it-IT', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

// ─── GiocataForm ─────────────────────────────────────
function GiocataForm({ onAdd }) {
  const today = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ data: today, tipo: 'Singola', bookmaker: '', conto: '', descrizione: '', quota: '', stake: '', risultato: 'pending', note: '' });
  const [loading,  setLoading]  = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanInfo, setScanInfo] = useState(null);
  const [scanErr,  setScanErr]  = useState('');
  const fileRef = useRef(null);

  // ── Stato monitoraggio inline ──
  const [monitora,      setMonitora]      = useState(false);
  const [mMode,         setMMode]         = useState('date'); // 'team' | 'date'
  const [mTeamSearch,   setMTeamSearch]   = useState('');
  const [mTeams,        setMTeams]        = useState([]);
  const [mSelTeam,      setMSelTeam]      = useState(null);
  const [mFixtures,     setMFixtures]     = useState([]);
  const [mDateFixtures, setMDateFixtures] = useState([]);
  const [mDate,         setMDate]         = useState(new Date().toISOString().split('T')[0]);
  const [mDateFilter,   setMDateFilter]   = useState('');
  const [mSelFixture,   setMSelFixture]   = useState(null);
  const [mPick,         setMPick]         = useState('');
  const [mLoading,      setMLoading]      = useState(false);
  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function mSearch(name) {
    if (!name || name.length < 3) { setMTeams([]); return; }
    setMLoading(true);
    try {
      const r = await fetch(`/api/fixtures?search=${encodeURIComponent(name)}`);
      setMTeams(((await r.json()).response || []).slice(0, 7));
    } finally { setMLoading(false); }
  }

  async function mLoadFixtures(teamId) {
    setMLoading(true); setMFixtures([]);
    try {
      const r = await fetch(`/api/fixtures?team=${teamId}`);
      setMFixtures((await r.json()).response || []);
    } finally { setMLoading(false); }
  }

  async function mLoadByDate(date) {
    if (!date) return;
    setMLoading(true); setMDateFixtures([]);
    try {
      const r = await fetch(`/api/fixtures?date=${date}`);
      setMDateFixtures((await r.json()).response || []);
    } finally { setMLoading(false); }
  }

  function autoFillMonitora(descrizione) {
    const team = extractFirstTeam(descrizione);
    const pick = extractPick(descrizione);
    setMDateFilter(team);
    setMPick(pick);
    setMTeamSearch(team);
    setMTeams([]); setMSelTeam(null); setMFixtures([]); setMSelFixture(null);
    // Carica le partite di oggi per default (modalità data)
    mLoadByDate(new Date().toISOString().split('T')[0]);
  }

  function resetMonitora() {
    setMonitora(false); setMMode('date');
    setMTeamSearch(''); setMTeams([]); setMSelTeam(null);
    setMFixtures([]); setMDateFixtures([]); setMDateFilter('');
    setMDate(new Date().toISOString().split('T')[0]);
    setMSelFixture(null); setMPick('');
  }

  async function handleScanFile(e) {
    const file = e.target.files?.[0];
    if (!fileRef.current) return;
    fileRef.current.value = '';
    if (!file) return;

    setScanning(true); setScanErr(''); setScanInfo(null);
    try {
      const base64 = await resizeImageToBase64(file);
      const res = await fetch('/api/scan-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mediaType: 'image/jpeg' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore scansione');

      const newDesc = data.descrizione || '';
      setForm(f => ({
        ...f,
        tipo:        TIPI_GIOCATA.includes(data.tipo) ? data.tipo : f.tipo,
        bookmaker:   data.bookmaker   || f.bookmaker,
        quota:       data.quota       != null ? String(data.quota) : f.quota,
        stake:       data.stake       != null ? String(data.stake) : f.stake,
        descrizione: newDesc          || f.descrizione,
        data:        data.data        || f.data,
        risultato:   data.risultato   || f.risultato,
      }));
      setScanInfo({
        stake: data.stake, possibileRitorno: data.possibileRitorno,
        quota: data.quota, bookmaker: data.bookmaker,
        tipo: data.tipo, risultato: data.risultato, data: data.data,
      });

      // Se la giocata è pending e c'è una descrizione → attiva monitoraggio auto
      if ((data.risultato === 'pending' || !data.risultato) && newDesc) {
        setMonitora(true);
        autoFillMonitora(newDesc);
      }
    } catch (err) {
      setScanErr(err.message);
    }
    setScanning(false);
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.descrizione || !form.quota || !form.stake) return;
    if (!form.conto) { alert('Seleziona il conto (persona) su cui è stata effettuata la giocata.'); return; }
    if (monitora && !mSelFixture) {
      alert('Seleziona la partita da monitorare, oppure disattiva il monitoraggio.');
      return;
    }
    setLoading(true);
    const newId = await onAdd({ ...form, quota: parseFloat(form.quota), stake: parseFloat(form.stake) });

    if (monitora && mSelFixture) {
      await monitoringAdd({
        fixtureId:   mSelFixture.fixture.id,
        pick:        (mPick.trim() || '?').toUpperCase(),
        stake:       parseFloat(form.stake) || 0,
        quota:       parseFloat(form.quota) || 0,
        giocataId:   newId || '',
        descrizione: form.descrizione,
        teamHome:    mSelFixture.teams.home.name,
        teamAway:    mSelFixture.teams.away.name,
        status:      'active',
        notifiedEvents: [],
        finalSent:   false,
      });
    }

    setForm(f => ({ ...f, bookmaker:'', conto:'', descrizione:'', quota:'', stake:'', risultato:'pending', note:'' }));
    setScanInfo(null); setScanErr('');
    resetMonitora();
    setLoading(false);
  }

  return (
    <div className="an-form-wrap">
      {/* ── Scan scontrino ── */}
      <div className="an-scan-bar">
        <button type="button" className="an-scan-btn" onClick={() => fileRef.current?.click()} disabled={scanning}>
          {scanning
            ? <><div className="cs-spinner" style={{width:14,height:14}}/> Lettura in corso…</>
            : <><ScanLine size={15} strokeWidth={1.5}/> Scansiona scontrino</>
          }
        </button>
        <span className="an-scan-hint">Carica screenshot → il form si precompila</span>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScanFile} />
      </div>

      {scanErr && <div className="an-scan-error"><X size={13} strokeWidth={2}/> {scanErr}</div>}

      {scanInfo && (
        <div className="an-scan-result">
          <Check size={13} strokeWidth={2.5} className="an-scan-check"/>
          <span className="an-scan-result-text">
            <b>{scanInfo.tipo}</b>
            {scanInfo.bookmaker ? <> · <b>{scanInfo.bookmaker}</b></> : null}
            {scanInfo.data ? <> · {new Date(scanInfo.data + 'T12:00:00').toLocaleDateString('it-IT',{day:'2-digit',month:'short'})}</> : null}
            {scanInfo.stake ? <> · <b>{scanInfo.stake.toFixed(2)}€</b></> : null}
            {scanInfo.quota ? <> @<b>{scanInfo.quota}</b></> : null}
            {scanInfo.possibileRitorno ? <> → <b>{scanInfo.possibileRitorno.toFixed(2)}€</b></> : null}
            {scanInfo.risultato === 'lost' ? <> · <span style={{color:'#f87171'}}>Persa</span></> : null}
            {scanInfo.risultato === 'won'  ? <> · <span style={{color:'#22c55e'}}>Vinta</span></> : null}
          </span>
          <span className="an-scan-edit-note">Controlla e modifica se necessario</span>
        </div>
      )}

      <form className="an-form" onSubmit={submit}>
        <div className="an-form-row">
          <input type="date" className="an-input" value={form.data} onChange={e => upd('data', e.target.value)} />
          <select className="an-select" value={form.tipo} onChange={e => upd('tipo', e.target.value)}>
            {TIPI_GIOCATA.map(t => <option key={t}>{t}</option>)}
          </select>
          <input className="an-input an-input-book" list="bookmakers-list" placeholder="Bookmaker..." value={form.bookmaker} onChange={e => upd('bookmaker', e.target.value)} />
          <datalist id="bookmakers-list">{BOOKMAKERS.map(b => <option key={b} value={b}/>)}</datalist>
          <select className={`an-select an-select-conto${!form.conto?' an-select-conto--empty':''}`} value={form.conto} onChange={e => upd('conto', e.target.value)} required>
            <option value="">Conto *</option>
            {CONTI_PERSONE.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <input className="an-input an-input-full" placeholder="Descrizione — es. Milan vs Inter Over 2.5" value={form.descrizione} onChange={e => upd('descrizione', e.target.value)} required />
        <div className="an-form-row">
          <input className="an-input" placeholder="Quota" type="number" step="0.01" min="1" value={form.quota} onChange={e => upd('quota', e.target.value)} required />
          <input className="an-input" placeholder="Stake (€)" type="number" step="0.01" min="0" value={form.stake} onChange={e => upd('stake', e.target.value)} required />
          <select className="an-select" value={form.risultato} onChange={e => upd('risultato', e.target.value)}>
            {RISULTATI.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <input className="an-input an-input-full" placeholder="Note (opzionale)" value={form.note} onChange={e => upd('note', e.target.value)} />

        {/* ── Monitora live (solo se pending) ── */}
        {form.risultato === 'pending' && (
          <div className="an-monitora-inline">
            <label className="an-monitora-toggle-label">
              <input type="checkbox" checked={monitora} onChange={ev => {
                setMonitora(ev.target.checked);
                if (ev.target.checked) {
                  if (form.descrizione) autoFillMonitora(form.descrizione);
                  else mLoadByDate(mDate);
                } else {
                  resetMonitora();
                }
              }}/>
              <Radio size={12} strokeWidth={2}/> Monitora live su Telegram
            </label>

            {monitora && (
              <div className="an-monitora-body">
                {mSelFixture ? (
                  <div className="an-mfix-chosen">
                    <span>⚽ <b>{mSelFixture.teams.home.name}</b> – <b>{mSelFixture.teams.away.name}</b></span>
                    <span className="an-mfix-chosen-sub">{fmtFixtureDate(mSelFixture.fixture.date)} · {mSelFixture.league.name}</span>
                    <button type="button" className="an-mfix-change" onClick={() => { setMSelFixture(null); setMSelTeam(null); }}>Cambia</button>
                  </div>
                ) : (
                  <>
                    {/* ── Tab Squadra / Data ── */}
                    <div className="an-mfix-tabs">
                      <button type="button" className={`an-mfix-tab${mMode==='date'?' active':''}`}
                        onClick={() => { setMMode('date'); if (!mDateFixtures.length) mLoadByDate(mDate); }}>
                        Per data
                      </button>
                      <button type="button" className={`an-mfix-tab${mMode==='team'?' active':''}`}
                        onClick={() => setMMode('team')}>
                        Per squadra
                      </button>
                    </div>

                    {mMode === 'date' && (
                      <>
                        <div className="an-mfix-date-row">
                          <input type="date" className="an-input" value={mDate}
                            onChange={ev => { setMDate(ev.target.value); mLoadByDate(ev.target.value); }}
                            style={{width:'auto'}}
                          />
                          <input className="an-input" placeholder="Filtra per squadra / competizione…"
                            value={mDateFilter} onChange={ev => setMDateFilter(ev.target.value)}
                            style={{flex:1}}
                          />
                        </div>
                        {mLoading && <span className="an-mfix-loading">Carico partite…</span>}
                        {!mLoading && mDateFixtures.length === 0 && <span className="an-mfix-loading">Nessuna partita trovata per questa data.</span>}
                        <div className="an-mfix-list">
                          {filterAndGroup(mDateFixtures, mDateFilter).map(group => (
                            <div key={group.league.id} className="an-mfix-league-group">
                              <div className="an-mfix-league-header">
                                {group.league.logo && <img src={group.league.logo} width={13} height={13} alt="" style={{borderRadius:2}}/>}
                                <span>{group.league.name}</span>
                                {group.league.country && <span className="an-mfix-country">{group.league.country}</span>}
                              </div>
                              {group.fixtures.map(f => (
                                <button type="button" key={f.fixture.id} className="an-mfix-item an-mfix-item--fix"
                                  onClick={() => setMSelFixture(f)}>
                                  <span className="an-mfix-date">{fmtFixtureDate(f.fixture.date)}</span>
                                  <span className="an-mfix-match">{f.teams.home.name} – {f.teams.away.name}</span>
                                </button>
                              ))}
                            </div>
                          ))}
                        </div>
                      </>
                    )}

                    {mMode === 'team' && (
                      <>
                        <input
                          className="an-input an-input-full"
                          placeholder="Cerca squadra (in inglese es. Italy, France)…"
                          value={mTeamSearch}
                          onChange={ev => { setMTeamSearch(ev.target.value); setMSelTeam(null); mSearch(ev.target.value); }}
                        />
                        {mLoading && <span className="an-mfix-loading">Ricerca…</span>}
                        {!mSelTeam && mTeams.length > 0 && (
                          <div className="an-mfix-list">
                            {mTeams.map(t => (
                              <button type="button" key={t.team.id} className="an-mfix-item"
                                onClick={() => { setMSelTeam(t.team); mLoadFixtures(t.team.id); }}>
                                {t.team.logo && <img src={t.team.logo} width={16} height={16} alt="" style={{borderRadius:2}}/>}
                                <span>{t.team.name}</span>
                                <span className="an-mfix-country">{t.team.country}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {mSelTeam && (
                          <div className="an-mfix-list">
                            {mLoading && <span className="an-mfix-loading">Carico partite…</span>}
                            {!mLoading && mFixtures.length === 0 && <span className="an-mfix-loading">Nessuna partita nei prossimi 7 giorni.</span>}
                            {mFixtures.map(f => (
                              <button type="button" key={f.fixture.id} className="an-mfix-item an-mfix-item--fix"
                                onClick={() => setMSelFixture(f)}>
                                <span className="an-mfix-date">{fmtFixtureDate(f.fixture.date)}</span>
                                <span className="an-mfix-match">{f.teams.home.name} – {f.teams.away.name}</span>
                                <span className="an-mfix-league">{f.league.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
                <div className="an-mfix-pick-row">
                  <span className="an-mfix-pick-label">Pick:</span>
                  <input
                    className="an-input"
                    placeholder="1 / 2 / X / Over 2.5 / GG…"
                    value={mPick}
                    onChange={ev => setMPick(ev.target.value)}
                    style={{flex:1}}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <button className="an-submit-btn" type="submit" disabled={loading || (monitora && !mSelFixture)}>
          {monitora && mSelFixture ? '+ Aggiungi e avvia monitoraggio 📡' : '+ Aggiungi giocata'}
        </button>
      </form>
    </div>
  );
}

// ─── MonitoraModal ────────────────────────────────────
function MonitoraModal({ giocata, onClose }) {
  const today = new Date().toISOString().split('T')[0];
  const [mode,         setMode]         = useState('date'); // 'date' | 'team'
  const [teamSearch,   setTeamSearch]   = useState('');
  const [teams,        setTeams]        = useState([]);
  const [selTeam,      setSelTeam]      = useState(null);
  const [fixtures,     setFixtures]     = useState([]);
  const [dateFixtures, setDateFixtures] = useState([]);
  const [date,         setDate]         = useState(today);
  const [dateFilter,   setDateFilter]   = useState('');
  const [selFixture,   setSelFixture]   = useState(null);
  const [pick,         setPick]         = useState(() => extractPick(giocata.descrizione || ''));
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [done,         setDone]         = useState(false);
  const [apiDebug,     setApiDebug]     = useState('');

  useEffect(() => { loadByDate(today); }, []);

  async function searchTeams(name) {
    if (name.length < 3) { setTeams([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`/api/fixtures?search=${encodeURIComponent(name)}`);
      setTeams(((await r.json()).response || []).slice(0, 8));
    } finally { setLoading(false); }
  }

  async function loadFixtures(teamId) {
    setLoading(true); setFixtures([]);
    try {
      const r = await fetch(`/api/fixtures?team=${teamId}`);
      setFixtures((await r.json()).response || []);
    } finally { setLoading(false); }
  }

  async function loadByDate(d) {
    if (!d) return;
    setLoading(true); setDateFixtures([]); setApiDebug('');
    try {
      const r = await fetch(`/api/fixtures?date=${d}`);
      const json = await r.json();
      const list = json.response || [];
      setDateFixtures(list);
      if (list.length === 0) {
        const errMsg = json.error || (json.errors ? Object.values(json.errors).join(' · ') : '');
        setApiDebug(errMsg
          ? `Errore API: ${errMsg}`
          : `0 partite trovate per ${d} — il piano API potrebbe non includere il Mondiale.`
        );
      } else {
        setApiDebug(`${list.length} partite trovate`);
      }
    } catch(e) {
      setApiDebug(`Errore: ${e.message}`);
    } finally { setLoading(false); }
  }

  async function avvia() {
    if (!selFixture || !pick.trim()) return;
    setSaving(true);
    try {
      await monitoringAdd({
        fixtureId:   selFixture.fixture.id,
        pick:        pick.trim().toUpperCase(),
        stake:       parseFloat(giocata.stake) || 0,
        quota:       parseFloat(giocata.quota) || 0,
        giocataId:   giocata.id,
        descrizione: giocata.descrizione || '',
        teamHome:    selFixture.teams.home.name,
        teamAway:    selFixture.teams.away.name,
        status:      'active',
        notifiedEvents: [],
        finalSent:   false,
      });
      setDone(true);
      setTimeout(onClose, 1600);
    } finally { setSaving(false); }
  }

  const groupedDate = filterAndGroup(dateFixtures, dateFilter);

  return (
    <div className="monitora-overlay" onClick={onClose}>
      <div className="monitora-modal" onClick={e => e.stopPropagation()}>
        <div className="monitora-header">
          <span><Radio size={14}/> Monitora live</span>
          <button onClick={onClose} className="monitora-close"><X size={15}/></button>
        </div>
        <div className="monitora-desc">
          <span className="monitora-desc-text">{giocata.descrizione || '—'}</span>
          <span className="monitora-desc-meta">@{parseFloat(giocata.quota||0).toFixed(2)} • {giocata.stake}€</span>
        </div>

        {done ? (
          <div className="monitora-done">✅ Monitoraggio avviato! Il bot ti notificherà su Telegram.</div>
        ) : selFixture ? (
          <div className="monitora-pick-step">
            <div className="monitora-fixture-chosen">
              <span>⚽</span>
              <div>
                <div className="monitora-fixture-chosen-name">{selFixture.teams.home.name} vs {selFixture.teams.away.name}</div>
                <div className="monitora-fixture-chosen-sub">{fmtFixtureDate(selFixture.fixture.date)} • {selFixture.league.name}</div>
              </div>
              <button className="monitora-change-btn" onClick={() => setSelFixture(null)}>Cambia</button>
            </div>
            <div className="monitora-pick-label">Pick (es. 1 · 2 · X · Over 2.5 · GG)</div>
            <input
              className="monitora-input"
              placeholder="Inserisci il pick…"
              value={pick}
              onChange={e => setPick(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && avvia()}
              autoFocus
            />
            <button className="monitora-save-btn" disabled={!pick.trim() || saving} onClick={avvia}>
              {saving ? 'Avvio…' : '📡 Avvia monitoraggio'}
            </button>
          </div>
        ) : (
          <>
            {/* Tab selector */}
            <div className="monitora-tabs">
              <button className={`monitora-tab${mode==='date'?' active':''}`} onClick={() => setMode('date')}>Per data</button>
              <button className={`monitora-tab${mode==='team'?' active':''}`} onClick={() => setMode('team')}>Per squadra</button>
            </div>

            {mode === 'date' && (
              <>
                <div className="monitora-date-row">
                  <input type="date" className="monitora-input" value={date} style={{width:'auto'}}
                    onChange={e => { setDate(e.target.value); loadByDate(e.target.value); }}/>
                  <input className="monitora-input" placeholder="Filtra per squadra / competizione…"
                    value={dateFilter} onChange={e => setDateFilter(e.target.value)} autoFocus style={{flex:1}}/>
                </div>
                {loading && <div className="monitora-loading">Carico partite…</div>}
                {!loading && apiDebug && dateFixtures.length === 0 && <div className="monitora-debug">{apiDebug}</div>}
                {!loading && dateFixtures.length > 0 && groupedDate.length === 0 && (
                  <div className="monitora-empty">Nessuna partita corrisponde — prova in inglese (Italy, France…)</div>
                )}
                <div className="monitora-fixtures-list">
                  {groupedDate.map(group => (
                    <div key={group.league.id} className="monitora-league-group">
                      <div className="monitora-league-header">
                        {group.league.logo && <img src={group.league.logo} width={14} height={14} alt="" style={{borderRadius:2}}/>}
                        <span>{group.league.name}</span>
                        {group.league.country && <span className="monitora-league-country">· {group.league.country}</span>}
                      </div>
                      {group.fixtures.map(f => (
                        <button key={f.fixture.id} className="monitora-fixture-item" onClick={() => setSelFixture(f)}>
                          <span className="monitora-fixture-date">{fmtFixtureDate(f.fixture.date)}</span>
                          <span className="monitora-fixture-match">{f.teams.home.name} – {f.teams.away.name}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}

            {mode === 'team' && (
              <>
                <input
                  className="monitora-input"
                  placeholder="Cerca squadra in inglese (es. Italy, France)…"
                  value={teamSearch}
                  onChange={e => { setTeamSearch(e.target.value); searchTeams(e.target.value); setSelTeam(null); }}
                  autoFocus
                />
                {loading && <div className="monitora-loading">Ricerca…</div>}
                {teams.length > 0 && !selTeam && (
                  <div className="monitora-list">
                    {teams.map(t => (
                      <button key={t.team.id} className="monitora-list-item"
                        onClick={() => { setSelTeam(t.team); loadFixtures(t.team.id); }}>
                        {t.team.logo && <img src={t.team.logo} width={18} height={18} alt="" style={{borderRadius:3}}/>}
                        <span className="monitora-team-name">{t.team.name}</span>
                        <span className="monitora-country">{t.team.country}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selTeam && (
                  <>
                    {loading && <div className="monitora-loading">Carico partite…</div>}
                    {fixtures.length === 0 && !loading && <div className="monitora-empty">Nessuna partita trovata nelle prossime 7 giornate.</div>}
                    <div className="monitora-fixtures-list">
                      {fixtures.map(f => (
                        <button key={f.fixture.id} className="monitora-fixture-item" onClick={() => setSelFixture(f)}>
                          <span className="monitora-fixture-date">{fmtFixtureDate(f.fixture.date)}</span>
                          <span className="monitora-fixture-match">{f.teams.home.name} – {f.teams.away.name}</span>
                          <span className="monitora-fixture-league">{f.league.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── GiocataRow ───────────────────────────────────────
function slipIcon(tipo) {
  if (tipo === 'Multipla') return <span className="slip-ico-multi">⚽</span>;
  return <span className="slip-ico-single">⚽</span>;
}

function GiocataRow({ g, onUpdateRisultato, onDelete }) {
  const [expanded,     setExpanded]     = useState(false);
  const [editRis,      setEditRis]      = useState(false);
  const [showMonitora, setShowMonitora] = useState(false);

  const stake  = parseFloat(g.stake) || 0;
  const quota  = parseFloat(g.quota) || 0;
  const profit = giocataProfit(g);
  const incasso = g.risultato === 'won' ? stake * quota : null;

  const barColor =
    g.risultato === 'won'     ? '#22c55e' :
    g.risultato === 'lost'    ? '#f87171' :
    g.risultato === 'pending' ? 'var(--du-accent)' : '#4A5A72';

  const badgeClass =
    g.risultato === 'won'     ? 'slip-badge slip-badge--won' :
    g.risultato === 'lost'    ? 'slip-badge slip-badge--lost' :
    g.risultato === 'pending' ? 'slip-badge slip-badge--pending' :
                                'slip-badge slip-badge--void';

  const badgeLabel =
    g.risultato === 'won'     ? '🏆 Vincente' :
    g.risultato === 'lost'    ? '⊗ Perdente' :
    g.risultato === 'pending' ? '🕐 In attesa' : 'Void';

  const profitColor = g.risultato==='won'?'#22c55e':g.risultato==='lost'?'#f87171':'var(--du-text-muted)';

  const fmtTime = iso => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleTimeString('it-IT', { hour:'2-digit', minute:'2-digit' }); } catch { return ''; }
  };
  const timeStr = g.createdAt?.toDate ? fmtTime(g.createdAt.toDate()) : '';

  return (
    <>
      <div className="slip-card">
        {/* Bordo colorato sinistra */}
        <div className="slip-bar" style={{ background: barColor }}/>

        {/* Icona tipo */}
        <div className={`slip-icon-wrap slip-icon-wrap--${g.tipo?.toLowerCase()}`}>
          {slipIcon(g.tipo)}
        </div>

        {/* Info principale */}
        <div className="slip-info" onClick={() => setExpanded(v => !v)}>
          <div className="slip-tipo-row">
            <span className="slip-tipo-name">{g.tipo || 'Singola'}</span>
            {g.conto && <span className="slip-conto-tag">{g.conto}</span>}
          </div>
          <div className="slip-book-name">{g.bookmaker || <span style={{opacity:0.4}}>—</span>}</div>
          <div className="slip-time-row">
            {fmtDate(g.data)}{timeStr ? ` • ${timeStr}` : ''}
          </div>
        </div>

        {/* Quota */}
        <div className="slip-quota-col" onClick={() => setExpanded(v => !v)}>
          <span className="slip-quota-label">QUOTA</span>
          <span className="slip-quota-val">{quota.toFixed(2)}</span>
        </div>

        {/* Stato + profitto */}
        <div className="slip-result-col">
          {editRis ? (
            <div className="slip-edit-ris">
              {RISULTATI.map(r => (
                <button key={r.value} className="slip-ris-opt" style={{ color: r.color }}
                  onClick={() => { onUpdateRisultato(g.id, r.value); setEditRis(false); }}>
                  {r.label}
                </button>
              ))}
            </div>
          ) : (
            <button className={badgeClass} onClick={() => setEditRis(true)}>{badgeLabel}</button>
          )}
          <div className="slip-profit-val" style={{ color: profitColor }}>
            {g.risultato === 'pending' ? '—' :
             g.risultato === 'lost'    ? `−${stake.toFixed(2)}€` :
             g.risultato === 'won'     ? `+${profit.toFixed(2)}€` : '—'}
          </div>
        </div>

        {/* Chevron espandi */}
        <button className="slip-chevron" onClick={() => setExpanded(v => !v)} aria-label="Espandi">
          {expanded ? <ChevronRight size={15} style={{transform:'rotate(90deg)'}}/> : <ChevronRight size={15}/>}
        </button>
      </div>

      {/* Espanso: descrizione + note + azioni */}
      {expanded && (
        <div className="slip-expanded">
          {g.descrizione && <div className="slip-exp-desc">{g.descrizione}</div>}
          {incasso != null && <div className="slip-exp-row"><span>Incasso</span><span>{incasso.toFixed(2)}€</span></div>}
          {stake > 0 && <div className="slip-exp-row"><span>Stake</span><span>{stake.toFixed(2)}€</span></div>}
          {g.note && <div className="slip-exp-note">{g.note}</div>}
          <div className="slip-exp-actions">
            {g.risultato === 'pending' && (
              <button className="an-monitor-btn" onClick={() => setShowMonitora(true)}>
                <Radio size={12} strokeWidth={2}/> Monitora live
              </button>
            )}
            <button className="an-delete-btn" onClick={() => onDelete(g.id)} aria-label="Elimina">
              <X size={12} strokeWidth={2}/> Elimina
            </button>
          </div>
        </div>
      )}

      {showMonitora && <MonitoraModal giocata={g} onClose={() => setShowMonitora(false)}/>}
    </>
  );
}

// ─── Giocate raggruppate ──────────────────────────────
const CHIP_FILTERS = [
  { label: 'Tutte',    value: 'all' },
  { label: 'Singole',  value: 'Singola' },
  { label: 'Multiple', value: 'Multipla' },
  { label: 'Vincenti', value: 'won' },
  { label: 'Perdenti', value: 'lost' },
];

function GiocateGrouped({ giocate, onUpdateRisultato, onDelete, stats }) {
  const [chip, setChip] = useState('all');
  const [collapsedMonths, setCollapsedMonths] = useState(new Set());

  const filtered = useMemo(() => {
    if (chip === 'all') return giocate;
    if (chip === 'won' || chip === 'lost') return giocate.filter(g => g.risultato === chip);
    return giocate.filter(g => g.tipo === chip);
  }, [giocate, chip]);

  const grouped = useMemo(() => {
    const months = new Map();
    filtered.forEach(g => {
      const date = g.data || '0000-00-00';
      const mk = date.slice(0, 7);
      if (!months.has(mk)) months.set(mk, new Map());
      const days = months.get(mk);
      if (!days.has(date)) days.set(date, []);
      days.get(date).push(g);
    });
    return months;
  }, [filtered]);

  const monthP = days => { let t=0; days.forEach(gs => gs.forEach(g => { t+=giocataProfit(g); })); return t; };
  const dayP   = gs => gs.reduce((s,g) => s+giocataProfit(g), 0);
  const hasPending = gs => gs.some(g => g.risultato==='pending');
  const toggleMonth = mk => setCollapsedMonths(s => { const n = new Set(s); n.has(mk)?n.delete(mk):n.add(mk); return n; });

  return (
    <div className="an-grouped">
      {/* Chip filtro */}
      <div className="slip-chips">
        {CHIP_FILTERS.map(c => (
          <button key={c.value} className={`slip-chip${chip===c.value?' slip-chip--active':''}`}
            onClick={() => setChip(c.value)}>
            {c.value==='won' && <span style={{color:'#22c55e',marginRight:3}}>●</span>}
            {c.value==='lost' && <span style={{color:'#f87171',marginRight:3}}>●</span>}
            {c.label}
          </button>
        ))}
      </div>

      {/* Summary card */}
      <div className="slip-summary-card">
        <div className="slip-summary-left">
          <div className="slip-summary-icon"><TrendingUp size={18} strokeWidth={2}/></div>
          <div>
            <div className="slip-summary-label">PROFITTO TOTALE</div>
            <div className="slip-summary-profit" style={{color: stats.profit>=0?'#22c55e':'#f87171'}}>
              {fmt(stats.profit)}
            </div>
          </div>
        </div>
        <div className="slip-summary-stats">
          <div className="slip-summary-stat"><span className="slip-summary-stat-label">GIOCATE</span><span className="slip-summary-stat-val">{stats.totali}</span></div>
          <div className="slip-summary-stat"><span className="slip-summary-stat-label">VINCENTI</span><span className="slip-summary-stat-val" style={{color:'#22c55e'}}>{stats.vinte}</span></div>
          <div className="slip-summary-stat"><span className="slip-summary-stat-label">PERDENTI</span><span className="slip-summary-stat-val" style={{color:'#f87171'}}>{stats.perse}</span></div>
          <div className="slip-summary-stat"><span className="slip-summary-stat-label">ROI</span><span className="slip-summary-stat-val" style={{color:stats.roi>=0?'#22c55e':'#f87171'}}>{stats.roi}%</span></div>
        </div>
      </div>

      {[...grouped.entries()].map(([mk, days]) => {
        const mp = monthP(days);
        const mpC = mp>0?'#22c55e':mp<0?'#f87171':'var(--du-text-muted)';
        const collapsed = collapsedMonths.has(mk);
        return (
          <div key={mk} className="slip-month-block">
            <button className="slip-month-header" onClick={() => toggleMonth(mk)}>
              <div className="slip-month-left">
                <div className="slip-month-icon"><Calendar size={14} strokeWidth={1.5}/></div>
                <span className="slip-month-label">{fmtMonth(mk)}</span>
              </div>
              <div className="slip-month-right">
                <span className="slip-month-profit" style={{color: mpC}}>{fmt(mp)}</span>
                <ChevronRight size={14} style={{transform: collapsed?'rotate(0deg)':'rotate(90deg)', transition:'transform 0.2s', color:'var(--du-text-muted)'}}/>
              </div>
            </button>

            {!collapsed && [...days.entries()].map(([dk, gs]) => {
              const dp = dayP(gs);
              const dpC = dp>0?'#22c55e':dp<0?'#f87171':'var(--du-text-muted)';
              const pending = hasPending(gs);
              return (
                <div key={dk} className="slip-day-block">
                  <div className="slip-day-header">
                    <span className="slip-day-label">{fmtDay(dk)}</span>
                    <span className="slip-day-badge" style={{
                      background: pending?'rgba(124,196,240,0.1)':dp>0?'rgba(34,197,94,0.12)':dp<0?'rgba(248,113,113,0.12)':'transparent',
                      color: pending?'var(--du-accent)':dpC
                    }}>
                      {pending ? '~' : fmt(dp)}
                    </span>
                  </div>
                  <div className="slip-list">
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

      {filtered.length === 0 && (
        <div className="slip-empty">
          <div className="slip-empty-icon">📋</div>
          <div className="slip-empty-title">Nessuna giocata</div>
          <div className="slip-empty-sub">Le tue prossime giocate appariranno qui.</div>
        </div>
      )}
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

// ─── Calendario Tab ───────────────────────────────────
function CalendarioTab({ giocate }) {
  const today = new Date();
  const [year,  setYear]  = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-based
  const [selDay, setSelDay] = useState(null);

  // P/L per giorno (solo chiuse)
  const dayMap = useMemo(() => {
    const m = {};
    giocate.filter(g => g.data && g.risultato !== 'pending').forEach(g => {
      if (!m[g.data]) m[g.data] = 0;
      const s = parseFloat(g.stake) || 0, q = parseFloat(g.quota) || 0;
      if (g.risultato === 'won')  m[g.data] += s * (q - 1);
      if (g.risultato === 'lost') m[g.data] -= s;
    });
    return m;
  }, [giocate]);

  // Giocate per giorno (tutte)
  const giocateByDay = useMemo(() => {
    const m = {};
    giocate.forEach(g => {
      if (!g.data) return;
      if (!m[g.data]) m[g.data] = [];
      m[g.data].push(g);
    });
    return m;
  }, [giocate]);

  const prevMonth = () => { if (month === 0) { setYear(y => y-1); setMonth(11); } else setMonth(m => m-1); setSelDay(null); };
  const nextMonth = () => { if (month === 11) { setYear(y => y+1); setMonth(0); } else setMonth(m => m+1); setSelDay(null); };

  const firstDay = new Date(year, month, 1).getDay(); // 0=dom
  const startOffset = (firstDay + 6) % 7; // 0=lun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthLabel = new Date(year, month).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  const todayStr   = today.toISOString().split('T')[0];

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selDayStr = selDay ? `${year}-${String(month+1).padStart(2,'0')}-${String(selDay).padStart(2,'0')}` : null;

  return (
    <div className="an-content">
      {/* Header mese */}
      <div className="cal-header">
        <button className="cal-nav" onClick={prevMonth}><ChevronLeft size={16}/></button>
        <span className="cal-month-label">{monthLabel}</span>
        <button className="cal-nav" onClick={nextMonth}><ChevronRight size={16}/></button>
      </div>

      {/* Giorni settimana */}
      <div className="cal-grid">
        {['Lun','Mar','Mer','Gio','Ven','Sab','Dom'].map(d => (
          <div key={d} className="cal-day-name">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="cal-cell cal-cell--empty"/>;
          const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
          const pl   = dayMap[ds];
          const gs   = giocateByDay[ds] || [];
          const isToday = ds === todayStr;
          const isSel   = ds === selDayStr;
          const hasBets = gs.length > 0;
          const dotColor = pl > 0 ? '#22c55e' : pl < 0 ? '#f87171' : hasBets ? '#f59e0b' : null;
          return (
            <div key={ds} className={`cal-cell${isToday?' cal-cell--today':''}${isSel?' cal-cell--sel':''}${hasBets?' cal-cell--has-bets':''}`}
              onClick={() => hasBets && setSelDay(isSel ? null : d)}>
              <span className="cal-day-num">{d}</span>
              {dotColor && <span className="cal-dot" style={{ background: dotColor }}/>}
              {pl != null && <span className="cal-day-pl" style={{ color: dotColor }}>{pl > 0 ? '+' : ''}{pl.toFixed(0)}€</span>}
            </div>
          );
        })}
      </div>

      {/* Dettaglio giorno selezionato */}
      {selDayStr && giocateByDay[selDayStr] && (
        <div className="cal-day-detail">
          {/* Header giorno */}
          <div className="cal-detail-card-header">
            <div className="cal-detail-icon"><Calendar size={16} strokeWidth={1.5}/></div>
            <div className="cal-detail-title-block">
              <span className="cal-detail-title">
                {new Date(selDayStr + 'T12:00:00').toLocaleDateString('it-IT', { weekday:'long', day:'numeric', month:'long' })}
              </span>
              <span className="cal-detail-sub">{giocateByDay[selDayStr].length} giocate</span>
            </div>
            <div className="cal-detail-daypl" style={{color: (dayMap[selDayStr]||0)>=0?'#22c55e':'#f87171'}}>
              {(dayMap[selDayStr]||0)>=0?'+':''}{(dayMap[selDayStr]||0).toFixed(2)}€
            </div>
            <button className="cal-detail-close" onClick={() => setSelDay(null)}><X size={13}/></button>
          </div>

          {/* Slip cards */}
          <div className="slip-list" style={{marginTop:10}}>
            {giocateByDay[selDayStr].map(g => {
              const s = parseFloat(g.stake)||0, q = parseFloat(g.quota)||0;
              const p = g.risultato==='won'?s*(q-1):g.risultato==='lost'?-s:null;
              const barColor = g.risultato==='won'?'#22c55e':g.risultato==='lost'?'#f87171':'var(--du-accent)';
              const badgeClass = g.risultato==='won'?'slip-badge slip-badge--won':g.risultato==='lost'?'slip-badge slip-badge--lost':g.risultato==='pending'?'slip-badge slip-badge--pending':'slip-badge slip-badge--void';
              const badgeLabel = g.risultato==='won'?'🏆 Vinta':g.risultato==='lost'?'⊗ Persa':g.risultato==='pending'?'🕐 In attesa':'Void';
              return (
                <div key={g.id} className="slip-card">
                  <div className="slip-bar" style={{background: barColor}}/>
                  <div className={`slip-icon-wrap slip-icon-wrap--${g.tipo?.toLowerCase()}`}>{slipIcon(g.tipo)}</div>
                  <div className="slip-info" style={{flex:1}}>
                    <div className="slip-tipo-row"><span className="slip-tipo-name">{g.tipo}</span>{g.conto&&<span className="slip-conto-tag">{g.conto}</span>}</div>
                    <div className="slip-book-name">{g.bookmaker||'—'}</div>
                    {g.descrizione && <div className="slip-time-row" style={{opacity:0.7}}>{g.descrizione}</div>}
                  </div>
                  <div className="slip-quota-col">
                    <span className="slip-quota-label">QUOTA</span>
                    <span className="slip-quota-val">{q.toFixed(2)}</span>
                  </div>
                  <div className="slip-result-col">
                    <span className={badgeClass}>{badgeLabel}</span>
                    <div className="slip-profit-val" style={{color:p!=null?(p>=0?'#22c55e':'#f87171'):'var(--du-text-muted)'}}>
                      {p!=null?(p>=0?'+':'')+p.toFixed(2)+'€':'—'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats bar in fondo */}
          <div className="cal-detail-stats">
            {[
              { label:'PROFITTO', val: fmt(dayMap[selDayStr]||0), color:(dayMap[selDayStr]||0)>=0?'#22c55e':'#f87171' },
              { label:'GIOCATE',  val: giocateByDay[selDayStr].length },
              { label:'VINTE',    val: giocateByDay[selDayStr].filter(g=>g.risultato==='won').length, color:'#22c55e' },
              { label:'PERSE',    val: giocateByDay[selDayStr].filter(g=>g.risultato==='lost').length, color:'#f87171' },
            ].map(s => (
              <div key={s.label} className="cal-stat-item">
                <span className="cal-stat-label">{s.label}</span>
                <span className="cal-stat-val" style={{color:s.color||'var(--du-text)'}}>{s.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Conti Tab ────────────────────────────────────────
function ContiTab({ giocate, prelievi }) {
  const [showPrelievForm, setShowPrelievForm] = useState(null); // key persona__book
  const [prelievForm, setPrelievForm] = useState({ importo: '', note: '' });
  const [saving, setSaving] = useState(false);

  const conti = useMemo(() => calcConti(giocate, prelievi), [giocate, prelievi]);

  // Raggruppa per persona
  const perPersona = useMemo(() => {
    const map = {};
    CONTI_PERSONE.forEach(p => { map[p] = []; });
    conti.forEach(c => {
      if (map[c.persona]) map[c.persona].push(c);
    });
    return map;
  }, [conti]);

  async function handlePrelievo(persona, bookmaker) {
    const importo = parseFloat(prelievForm.importo);
    if (!importo || importo <= 0) return;
    setSaving(true);
    await prelievAdd({
      persona, bookmaker, importo,
      note: prelievForm.note,
      data: new Date().toISOString().split('T')[0],
    });
    setPrelievForm({ importo: '', note: '' });
    setShowPrelievForm(null);
    setSaving(false);
  }

  // Prelievi recenti
  const prelieviRecenti = prelievi.slice(0, 10);

  return (
    <div className="an-content">
      {CONTI_PERSONE.map(persona => {
        const contiPersona = perPersona[persona] || [];
        const totalePersona = contiPersona.reduce((s, c) => s + c.profit, 0);
        return (
          <div key={persona} className="conti-persona-block">
            <div className="conti-persona-header">
              <div className="conti-persona-name">{persona}</div>
              <div className="conti-persona-total" style={{ color: totalePersona >= 0 ? '#22c55e' : '#f87171' }}>
                {totalePersona >= 0 ? '+' : ''}{totalePersona.toFixed(2)}€
              </div>
            </div>
            {contiPersona.length === 0 ? (
              <div className="conti-empty">Nessuna giocata registrata</div>
            ) : (
              contiPersona.map(c => {
                const key = `${c.persona}__${c.bookmaker}`;
                return (
                  <div key={key} className="conti-book-row">
                    <div className="conti-book-left">
                      <span className="conti-book-name">{c.bookmaker}</span>
                      <span className="conti-book-stats">{c.totali} tip · {c.vinte}V</span>
                    </div>
                    <div className="conti-book-right">
                      <span className="conti-book-profit" style={{ color: c.profit >= 0 ? '#22c55e' : '#f87171' }}>
                        {c.profit >= 0 ? '+' : ''}{c.profit.toFixed(2)}€
                      </span>
                      <button className="conti-preliev-btn" onClick={() => setShowPrelievForm(key === showPrelievForm ? null : key)}>
                        <ArrowDownToLine size={11}/> Prelevato
                      </button>
                    </div>
                    {showPrelievForm === key && (
                      <div className="conti-preliev-form">
                        <input className="an-input" type="number" step="0.01" min="0.01"
                          placeholder="Importo prelevato (€)"
                          value={prelievForm.importo}
                          onChange={e => setPrelievForm(f => ({ ...f, importo: e.target.value }))}
                        />
                        <input className="an-input" placeholder="Note (opz.)"
                          value={prelievForm.note}
                          onChange={e => setPrelievForm(f => ({ ...f, note: e.target.value }))}
                        />
                        <button className="an-submit-btn" style={{marginTop:0}} disabled={saving}
                          onClick={() => handlePrelievo(c.persona, c.bookmaker)}>
                          {saving ? 'Salvo…' : '✓ Registra prelievo'}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      {prelieviRecenti.length > 0 && (
        <div className="conti-prelievi-list">
          <div className="an-section-label" style={{marginBottom:8}}>Prelievi recenti → conto cointestato</div>
          {prelieviRecenti.map(p => (
            <div key={p.id} className="an-row">
              <div className="an-row-date">{fmtDate(p.data)}</div>
              <div className="an-row-tipo" style={{color:'var(--du-accent)'}}>{p.persona}</div>
              <div className="an-row-book">{p.bookmaker}</div>
              <div className="an-row-desc">{p.note || 'Prelievo'}</div>
              <div className="an-row-importo" style={{color:'#f87171'}}>−{parseFloat(p.importo).toFixed(2)}€</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Bankroll AI Tab ──────────────────────────────────
const RISK_PROFILES = [
  { id: 'conservativo', label: 'Conservativo', desc: '¼ Kelly', mult: 0.25, color: '#22c55e' },
  { id: 'moderato',     label: 'Moderato',     desc: '½ Kelly', mult: 0.5,  color: '#7CC4F0' },
  { id: 'aggressivo',   label: 'Aggressivo',   desc: 'Kelly',   mult: 1.0,  color: '#f87171' },
];

function BankrollTab({ stats, adv }) {
  const [bankroll, setBankroll]           = useState(() => {
    const v = localStorage.getItem('du_bankroll');
    return v ? parseFloat(v) : null;
  });
  const [bankrollInput, setBankrollInput] = useState('');
  const [showBrForm, setShowBrForm]       = useState(false);
  const [riskProfile, setRiskProfile]     = useState('moderato');
  const [aiAdvice, setAiAdvice]           = useState('');
  const [aiLoading, setAiLoading]         = useState(false);
  const [aiError, setAiError]             = useState('');

  function saveBankroll() {
    const v = parseFloat(bankrollInput);
    if (isNaN(v) || v <= 0) return;
    localStorage.setItem('du_bankroll', v);
    setBankroll(v);
    setBankrollInput('');
    setShowBrForm(false);
  }

  // Kelly Criterion
  const kellyData = useMemo(() => {
    const closed = stats.vinte + stats.perse;
    if (closed < 10 || !adv.avgQuota || adv.avgQuota <= 1) return null;
    const p = stats.vinte / closed;
    const q = 1 - p;
    const b = adv.avgQuota - 1;
    const f = (b * p - q) / b;
    const edge = b * p - q;
    return {
      p:       +(p * 100).toFixed(1),
      b:       +b.toFixed(2),
      f:       Math.max(0, +f.toFixed(4)),
      edge:    +(edge * 100).toFixed(1),
      sample:  closed,
      reliable: closed >= 30,
    };
  }, [stats, adv]);

  const profile     = RISK_PROFILES.find(r => r.id === riskProfile);
  const appliedFrac = kellyData ? kellyData.f * (profile?.mult || 0.5) : null;
  const kellyStake  = bankroll && appliedFrac ? bankroll * appliedFrac : null;

  // Flat bet alternative (% bankroll)
  const flatStake1 = bankroll ? bankroll * 0.01 : null;
  const flatStake2 = bankroll ? bankroll * 0.02 : null;
  const flatStake3 = bankroll ? bankroll * 0.03 : null;

  async function fetchAdvice() {
    setAiLoading(true); setAiError(''); setAiAdvice('');
    try {
      const res = await fetch('/api/bankroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stats, adv, bankroll, riskProfile,
          kellyF: kellyData?.f ?? null,
          kellyStake,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setAiAdvice(data.advice);
    } catch (e) { setAiError(e.message); }
    setAiLoading(false);
  }

  const closed = stats.vinte + stats.perse;

  return (
    <div className="an-content">

      {/* ── Bankroll corrente ── */}
      <div className="bk-section">
        <div className="bk-section-header">
          <div className="bk-section-title">Bankroll scommesse</div>
          <button className="an-cap-edit-btn" onClick={() => setShowBrForm(v => !v)}>
            {bankroll != null ? <><Pencil size={12} strokeWidth={1.5}/> Modifica</> : '+ Imposta'}
          </button>
        </div>
        {showBrForm && (
          <div className="an-cap-form">
            <input className="an-input" type="number" step="1" min="1"
              placeholder="Bankroll attuale (€)" value={bankrollInput}
              onChange={e => setBankrollInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveBankroll()} />
            <button className="an-submit-btn" style={{ marginTop:0, flex:'0 0 auto' }} onClick={saveBankroll}>Salva</button>
          </div>
        )}
        <div className="bk-bankroll-display">
          <span className="bk-bankroll-val">{bankroll != null ? bankroll.toFixed(2)+'€' : '—'}</span>
          {bankroll && stats.profit !== 0 && (
            <span className="bk-bankroll-delta" style={{ color: stats.profit >= 0 ? '#22c55e' : '#f87171' }}>
              {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)}€ profit
            </span>
          )}
        </div>
        {/* Flat betting rapido */}
        {bankroll && (
          <div className="bk-flat-row">
            <span className="bk-flat-label">Flat betting suggerito:</span>
            <div className="bk-flat-chips">
              <span className="bk-flat-chip">1% → {flatStake1.toFixed(2)}€</span>
              <span className="bk-flat-chip active">2% → {flatStake2.toFixed(2)}€</span>
              <span className="bk-flat-chip">3% → {flatStake3.toFixed(2)}€</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Kelly Criterion ── */}
      <div className="bk-section">
        <div className="bk-section-title">Kelly Criterion</div>
        {closed < 10 ? (
          <div className="bk-kelly-notice">
            <AlertTriangle size={14} strokeWidth={1.5}/>
            Servono almeno 10 tip chiuse per calcolare il Kelly ({closed} disponibili)
          </div>
        ) : (
          <>
            {!kellyData?.reliable && (
              <div className="bk-kelly-notice warning">
                <AlertTriangle size={14} strokeWidth={1.5}/>
                Campione ridotto ({closed} tip) — Kelly poco affidabile sotto 30 tip. Usa con cautela.
              </div>
            )}
            <div className="bk-kelly-grid">
              <div className="bk-kelly-stat">
                <span className="bk-kelly-label">Strike Rate</span>
                <span className="bk-kelly-val" style={{ color: '#7CC4F0' }}>{kellyData?.p}%</span>
              </div>
              <div className="bk-kelly-stat">
                <span className="bk-kelly-label">Quota media</span>
                <span className="bk-kelly-val">{adv.avgQuota}</span>
              </div>
              <div className="bk-kelly-stat">
                <span className="bk-kelly-label">Edge stimato</span>
                <span className="bk-kelly-val" style={{ color: kellyData?.edge >= 0 ? '#22c55e' : '#f87171' }}>
                  {kellyData?.edge >= 0 ? '+' : ''}{kellyData?.edge}%
                </span>
              </div>
              <div className="bk-kelly-stat">
                <span className="bk-kelly-label">Kelly puro %</span>
                <span className="bk-kelly-val">{((kellyData?.f || 0) * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Tabella Kelly per livello */}
            <div className="bk-kelly-table">
              {RISK_PROFILES.map(rp => {
                const f = (kellyData?.f || 0) * rp.mult;
                const stake = bankroll ? bankroll * f : null;
                return (
                  <div key={rp.id} className={`bk-kelly-row ${riskProfile === rp.id ? 'selected' : ''}`}
                    onClick={() => setRiskProfile(rp.id)}>
                    <div className="bk-kelly-row-left">
                      <div className="bk-kelly-row-name" style={{ color: rp.color }}>{rp.label}</div>
                      <div className="bk-kelly-row-desc">{rp.desc} · {(f*100).toFixed(1)}% del bankroll</div>
                    </div>
                    <div className="bk-kelly-row-stake">
                      {stake != null ? stake.toFixed(2)+'€' : '—'}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Stake consigliato prominente */}
            {kellyStake != null && (
              <div className="bk-recommended">
                <div className="bk-recommended-label">Stake consigliato ({profile?.label})</div>
                <div className="bk-recommended-val" style={{ color: profile?.color }}>
                  {kellyStake.toFixed(2)}€
                </div>
                <div className="bk-recommended-sub">
                  {(appliedFrac * 100).toFixed(1)}% del bankroll · {bankroll?.toFixed(2)}€
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── AI Advisor ── */}
      <div className="bk-section">
        <div className="bk-section-header">
          <div className="bk-section-title">
            <Brain size={15} strokeWidth={1.5}/> AI Bankroll Advisor
          </div>
        </div>
        <p className="bk-ai-desc">
          Claude analizza le tue performance reali e ti dà consigli specifici su puntate, rischio e pattern da correggere.
        </p>

        {closed < 5 ? (
          <div className="bk-kelly-notice">
            <AlertTriangle size={14} strokeWidth={1.5}/>
            Aggiungi almeno 5 tip chiuse per ricevere consigli personalizzati.
          </div>
        ) : (
          <button className="bk-ai-btn" onClick={fetchAdvice} disabled={aiLoading}>
            {aiLoading
              ? <><div className="cs-spinner" style={{width:14,height:14}}/> Analisi in corso...</>
              : <><Sparkles size={14} strokeWidth={1.5}/> Analizza le mie performance</>
            }
          </button>
        )}

        {aiError && <div className="cs-error" style={{marginTop:8}}>{aiError}</div>}

        {aiAdvice && (
          <div className="bk-ai-response">
            {aiAdvice.split('\n').map((line, i) => line.trim()
              ? <p key={i} className="bk-ai-para">{line}</p>
              : null
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGINA PRINCIPALE ────────────────────────────────
export default function AnalyticsPage() {
  const [tab, setTab]               = useState('giocate');
  const [giocate, setGiocate]       = useState([]);
  const [transazioni, setTransazioni] = useState([]);
  const [prelievi, setPrelievi]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [capIniziale, setCapIniziale] = useState(() => {
    const v = localStorage.getItem('du_cap_iniziale');
    return v ? parseFloat(v) : null;
  });
  const [capInput, setCapInput]     = useState('');
  const [showCapForm, setShowCapForm] = useState(false);

  useEffect(() => {
    const unsubG = giocateListen(data => { setGiocate(data); setLoading(false); });
    const unsubT = transazioniListen(data => { setTransazioni(data); });
    const unsubP = prelieviListen(data => { setPrelievi(data); });
    return () => { unsubG(); unsubT(); unsubP(); };
  }, []);

  async function handleAddGiocata(e)          { return await giocataAdd(e); }
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

  const stats = useMemo(() => calcStats(giocate),             [giocate]);
  const adv   = useMemo(() => calcAdvancedStats(giocate),     [giocate]);
  const fin   = useMemo(() => calcFinanze(transazioni),       [transazioni]);

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
          <p className="an-subtitle">Performance tip · Cassa progetto · Bankroll AI</p>
        </div>
      </div>

      {/* ── PANNELLO RIASSUNTIVO ── */}
      <div className="an-top-summary">
        <div
          className={`an-summary-panel ${tab==='giocate'?'active':''}`}
          onClick={() => setTab('giocate')}
        >
          <div className="an-summary-icon"><Target size={18} strokeWidth={1.5} aria-hidden="true"/></div>
          <div className="an-summary-body">
            <div className="an-summary-label">Giocate</div>
            <div className="an-summary-main" style={{ color: profitColor }}>{fmt(stats.profit)}</div>
            <div className="an-summary-subs">ROI {stats.roi}% · SR {stats.strikeRate}% · {stats.totali} tip</div>
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
            <div className="an-summary-subs">Entr {fin.entrate.toFixed(0)}€ · Usc {fin.uscite.toFixed(0)}€ · Inv {fin.investimenti.toFixed(0)}€</div>
          </div>
        </div>
        <div
          className={`an-summary-panel ${tab==='bankroll'?'active':''}`}
          onClick={() => setTab('bankroll')}
        >
          <div className="an-summary-icon"><Brain size={18} strokeWidth={1.5} aria-hidden="true"/></div>
          <div className="an-summary-body">
            <div className="an-summary-label">Bankroll AI</div>
            <div className="an-summary-main" style={{ color: 'var(--du-accent)' }}>Kelly</div>
            <div className="an-summary-subs">Criterion · Risk profile · AI advice</div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="an-tabs">
        <button className={`an-tab ${tab==='giocate'?'active':''}`} onClick={() => setTab('giocate')}>
          <Target size={14} strokeWidth={1.5} aria-hidden="true"/>
          Giocate {stats.totali > 0 && <span className="an-tab-count">{stats.totali}</span>}
        </button>
        <button className={`an-tab ${tab==='calendario'?'active':''}`} onClick={() => setTab('calendario')}>
          <Calendar size={14} strokeWidth={1.5} aria-hidden="true"/>
          Calendario
        </button>
        <button className={`an-tab ${tab==='conti'?'active':''}`} onClick={() => setTab('conti')}>
          <Users size={14} strokeWidth={1.5} aria-hidden="true"/>
          Conti
        </button>
        <button className={`an-tab ${tab==='transazioni'?'active':''}`} onClick={() => setTab('transazioni')}>
          <Briefcase size={14} strokeWidth={1.5} aria-hidden="true"/>
          Cassa {transazioni.length > 0 && <span className="an-tab-count">{transazioni.length}</span>}
        </button>
        <button className={`an-tab ${tab==='bankroll'?'active':''}`} onClick={() => setTab('bankroll')}>
          <Brain size={14} strokeWidth={1.5} aria-hidden="true"/>
          Bankroll AI
        </button>
      </div>

      {loading ? (
        <div className="an-loading"><div className="cs-spinner"/> Caricamento...</div>
      ) : (
        <>
          {/* ═══ TAB GIOCATE ═══ */}
          {tab === 'giocate' && (
            <div className="an-content">
              <LineChart allPoints={profitPoints} title="Curva Profitto" currentLabel={fmt(stats.profit)}/>

              <div className="an-dashboard-section">
                <div className="an-cards-row">
                  <StatCard label="Profitto Netto" value={fmt(stats.profit)}
                    sub={`${stats.chiuse} chiuse su ${stats.totali}`} color={profitColor} big />
                  <StatCard label="ROI" value={stats.roi+'%'}
                    sub={`su ${stats.totalStaked}€ giocati`} color={roiColor} />
                  <StatCard label="Strike Rate" value={stats.strikeRate+'%'}
                    sub={`${stats.vinte}V — ${stats.perse}P — ${stats.void}N`} color="var(--blue)" />
                  <StatCard label="In attesa" value={stats.pending}
                    sub={`${stats.pendingStaked.toFixed(2)}€ impegnati`} color="var(--text-mid)" />
                </div>
              </div>

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

              <BookmakerTable giocate={giocate} />

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
                : <GiocateGrouped giocate={giocate} onUpdateRisultato={handleUpdateRisultato} onDelete={handleDeleteGiocata} stats={stats} />
              }
            </div>
          )}

          {/* ═══ TAB CASSA ═══ */}
          {tab === 'transazioni' && (
            <div className="an-content">
              <LineChart allPoints={cassaPoints} title="Andamento Cassa" currentLabel={fmt(fin.saldo)}/>

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

          {/* ═══ TAB CALENDARIO ═══ */}
          {tab === 'calendario' && (
            <CalendarioTab giocate={giocate} />
          )}

          {/* ═══ TAB CONTI ═══ */}
          {tab === 'conti' && (
            <ContiTab giocate={giocate} prelievi={prelievi} />
          )}

          {/* ═══ TAB BANKROLL AI ═══ */}
          {tab === 'bankroll' && (
            <BankrollTab stats={stats} adv={adv} />
          )}
        </>
      )}
    </div>
  );
}
