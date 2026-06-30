import { useState, useRef } from 'react';
import { Languages, Calculator, Plus, Copy, Check } from 'lucide-react';
import { translateBettingText } from '../services/openai';

// ── Conversioni ───────────────────────────────────────────

function fracToDecimal(str) {
  // "5/2" → 3.5  |  "11/4" → 3.75  |  "evs" / "evens" → 2.0
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (s === 'evs' || s === 'evens' || s === '1/1') return 2.0;
  const m = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) return null;
  const d = parseInt(m[1]) / parseInt(m[2]) + 1;
  return d > 1.01 ? d : null;
}

function mlToDecimal(str) {
  // "+150" → 2.5  |  "-143" → 1.699
  if (!str) return null;
  const n = parseInt(str.replace(/\s/g, ''));
  if (isNaN(n) || n === 0) return null;
  if (n > 0) return n / 100 + 1;
  return 100 / Math.abs(n) + 1;
}

function getDecimal(leg) {
  if (leg.oddsType === 'eu')  return parseFloat(leg.value) > 1.01 ? parseFloat(leg.value) : null;
  if (leg.oddsType === 'uk')  return fracToDecimal(leg.value);
  if (leg.oddsType === 'us')  return mlToDecimal(leg.value);
  return null;
}

function decToML(d) {
  if (!d || d <= 1.01) return null;
  if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
  return `${Math.round(-100 / (d - 1))}`;
}

function decToFrac(d) {
  // Approx. conversione a frazionaria UK (le più comuni)
  if (!d || d <= 1) return null;
  const profit = d - 1;
  // Trova denominatore comune fino a 16
  for (let den = 1; den <= 16; den++) {
    const num = Math.round(profit * den);
    if (Math.abs(num / den - profit) < 0.005 && num > 0) {
      if (num === den) return 'EVS';
      return `${num}/${den}`;
    }
  }
  return `${(profit).toFixed(2)}/1`;
}

function decToImplied(d) {
  if (!d || d <= 1) return null;
  return (1 / d * 100).toFixed(1);
}

function mlPayout(ml, stake) {
  const n = parseInt(ml);
  if (isNaN(n) || !stake) return null;
  const s = parseFloat(stake);
  if (n > 0) return { profit: n * s / 100, total: s + n * s / 100 };
  return { profit: 100 / Math.abs(n) * s, total: s + 100 / Math.abs(n) * s };
}

// ── Traduttore ────────────────────────────────────────────
function TraduttorePanel() {
  const [input, setInput]     = useState('');
  const [output, setOutput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [copied, setCopied]   = useState(false);

  async function handleTranslate() {
    if (!input.trim()) return;
    setLoading(true); setError(''); setOutput('');
    try {
      const result = await translateBettingText(input.trim());
      setOutput(result);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="tools-card">
      <div className="tools-card-header">
        <div className="tools-card-title">
          <Languages size={16} strokeWidth={1.5}/>
          Traduttore Giocate IT → EN
        </div>
        <p className="tools-card-sub">
          Converti descrizioni italiane in inglese professionale con quote in Moneyline.
          La 2.50 diventa +150, la 1.70 diventa −143.
        </p>
      </div>

      <textarea
        className="tools-textarea"
        placeholder={"Incolla qui la giocata in italiano...\n\nEs: Milan vs Inter, Multipla: Milan 1 (2.10) + Over 2.5 (1.75) = 3.68. Il Milan ha 5 vittorie consecutive."}
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={6}
      />

      <button
        className="tools-btn-primary"
        onClick={handleTranslate}
        disabled={!input.trim() || loading}
      >
        {loading
          ? <><div className="cs-spinner" style={{width:14,height:14}}/> Traduzione in corso...</>
          : <><Languages size={14} strokeWidth={1.5}/> Traduci in inglese</>
        }
      </button>

      {error && <div className="cs-error" style={{margin:'8px 0 0'}}>{error}</div>}

      {output && (
        <div className="tools-output-box">
          <div className="tools-output-header">
            <span>Risultato</span>
            <button className="tools-copy-btn" onClick={handleCopy}>
              {copied
                ? <><Check size={12} strokeWidth={2}/> Copiato!</>
                : <><Copy size={12} strokeWidth={1.5}/> Copia</>
              }
            </button>
          </div>
          <div className="tools-output-text">{output}</div>
        </div>
      )}
    </div>
  );
}

// ── Convertitore ──────────────────────────────────────────
const ODDS_TYPES = [
  { id: 'eu', label: 'EU',  placeholder: 'Es. 1.85' },
  { id: 'uk', label: 'UK',  placeholder: 'Es. 5/2' },
  { id: 'us', label: 'US',  placeholder: 'Es. +150' },
];

function ConvertitorePanel() {
  const [legs, setLegs]   = useState([{ id: 1, oddsType: 'eu', value: '', label: '' }]);
  const [stake, setStake] = useState('100');
  const counter           = useRef(2);

  function addLeg() {
    setLegs(p => [...p, { id: counter.current++, oddsType: 'eu', value: '', label: '' }]);
  }
  function removeLeg(id)        { setLegs(p => p.filter(l => l.id !== id)); }
  function updateLeg(id, f, v)  { setLegs(p => p.map(l => l.id === id ? { ...l, [f]: v } : l)); }
  function setType(id, t)       { setLegs(p => p.map(l => l.id === id ? { ...l, oddsType: t, value: '' } : l)); }

  const validLegs  = legs.filter(l => getDecimal(l) !== null);
  const combined   = validLegs.reduce((acc, l) => acc * getDecimal(l), 1);
  const combinedML = validLegs.length >= 1 ? decToML(combined) : null;
  const payout     = combinedML ? mlPayout(combinedML, stake) : null;

  return (
    <div className="tools-card">
      <div className="tools-card-header">
        <div className="tools-card-title">
          <Calculator size={16} strokeWidth={1.5}/>
          Convertitore Quote → Moneyline
        </div>
        <p className="tools-card-sub">
          Supporta quote EU decimali, UK frazionarie (5/2, 11/4, EVS) e US Moneyline (+150, −143).
          Singole o parlay multipli con payout realistico.
        </p>
      </div>

      <div className="conv-legs">
        {legs.map((leg, i) => {
          const dec = getDecimal(leg);
          const ml  = dec ? decToML(dec)      : null;
          const imp = dec ? decToImplied(dec) : null;
          const frac = dec ? decToFrac(dec)   : null;
          const ok  = ml !== null;
          const pos = ok && parseInt(ml) > 0;
          const ph  = ODDS_TYPES.find(t => t.id === leg.oddsType)?.placeholder || '';

          return (
            <div key={leg.id} className="conv-leg-row">
              <span className="conv-leg-num">{i + 1}</span>

              <div className="conv-leg-inputs">
                {/* Tipo quota */}
                <div className="conv-type-toggle">
                  {ODDS_TYPES.map(t => (
                    <button
                      key={t.id}
                      className={`conv-type-btn ${leg.oddsType === t.id ? 'active' : ''}`}
                      onClick={() => setType(leg.id, t.id)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <input
                  className="conv-decimal-input"
                  type={leg.oddsType === 'eu' ? 'number' : 'text'}
                  step={leg.oddsType === 'eu' ? '0.01' : undefined}
                  placeholder={ph}
                  value={leg.value}
                  onChange={e => updateLeg(leg.id, 'value', e.target.value)}
                />

                <input
                  className="conv-label-input"
                  type="text"
                  placeholder="Descrizione (opzionale)"
                  value={leg.label}
                  onChange={e => updateLeg(leg.id, 'label', e.target.value)}
                />
              </div>

              {/* Risultati conversione */}
              <div className="conv-leg-result">
                {ok ? (
                  <div className="conv-all-formats">
                    <span className={`conv-ml-badge ${pos ? 'positive' : 'negative'}`}>{ml}</span>
                    <span className="conv-format-row">
                      <span className="conv-format-tag">EU</span>
                      <span className="conv-format-val">{dec.toFixed(2)}</span>
                    </span>
                    <span className="conv-format-row">
                      <span className="conv-format-tag">UK</span>
                      <span className="conv-format-val">{frac}</span>
                    </span>
                    <span className="conv-impl">{imp}%</span>
                  </div>
                ) : (
                  <span className="conv-ml-badge empty">—</span>
                )}
              </div>

              {legs.length > 1 && (
                <button className="conv-remove-btn" onClick={() => removeLeg(leg.id)}>×</button>
              )}
            </div>
          );
        })}
      </div>

      <button className="conv-add-btn" onClick={addLeg}>
        <Plus size={13} strokeWidth={2}/> Aggiungi selezione
      </button>

      {combinedML && validLegs.length >= 1 && (
        <div className="conv-summary">
          <div className="conv-summary-grid">
            <div className="conv-summary-item">
              <span className="conv-summary-label">
                {validLegs.length === 1 ? 'Quota EU decimale' : `Combinata (${validLegs.length} sel.)`}
              </span>
              <span className="conv-summary-value mono">{combined.toFixed(2)}</span>
            </div>
            <div className="conv-summary-item">
              <span className="conv-summary-label">Moneyline (US)</span>
              <span className={`conv-summary-value mono ml-big ${parseInt(combinedML) > 0 ? 'positive' : 'negative'}`}>
                {combinedML}
              </span>
            </div>
            <div className="conv-summary-item">
              <span className="conv-summary-label">Quota UK frazionaria</span>
              <span className="conv-summary-value mono">{decToFrac(combined)}</span>
            </div>
            <div className="conv-summary-item">
              <span className="conv-summary-label">Probabilità implicita</span>
              <span className="conv-summary-value mono">{(1 / combined * 100).toFixed(1)}%</span>
            </div>
            <div className="conv-summary-item full">
              <div className="conv-stake-row">
                <span className="conv-summary-label">Puntata ($)</span>
                <input
                  className="conv-stake-input"
                  type="number" min="1"
                  value={stake}
                  onChange={e => setStake(e.target.value)}
                />
              </div>
              {payout && (
                <div className="conv-payout-row">
                  <div className="conv-payout-item">
                    <span className="conv-payout-label">Profitto</span>
                    <span className="conv-payout-val positive">+${payout.profit.toFixed(2)}</span>
                  </div>
                  <div className="conv-payout-item">
                    <span className="conv-payout-label">Ritorno totale</span>
                    <span className="conv-payout-val">${payout.total.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {validLegs.length > 1 && (
            <div className="conv-breakdown">
              <div className="conv-breakdown-title">Dettaglio selezioni</div>
              {validLegs.map((leg, i) => {
                const d   = getDecimal(leg);
                const ml  = decToML(d);
                const frc = decToFrac(d);
                const pos = parseInt(ml) > 0;
                return (
                  <div key={leg.id} className="conv-breakdown-row">
                    <span className="conv-breakdown-label">{leg.label || `Sel. ${i + 1}`}</span>
                    <span className="conv-breakdown-dec">{d.toFixed(2)}</span>
                    <span className="conv-breakdown-dec">{frc}</span>
                    <span className={`conv-breakdown-ml ${pos ? 'positive' : 'negative'}`}>{ml}</span>
                    <span className="conv-breakdown-imp">{decToImplied(d)}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pagina principale ─────────────────────────────────────
export default function StrumentiPage() {
  return (
    <div className="strumenti-page">
      <div className="strumenti-header">
        <h1 className="strumenti-title">Strumenti</h1>
        <p className="strumenti-sub">Traduttore IT→EN con Moneyline · Convertitore EU / UK / US</p>
      </div>
      <div className="strumenti-body">
        <TraduttorePanel />
        <ConvertitorePanel />
      </div>
    </div>
  );
}
