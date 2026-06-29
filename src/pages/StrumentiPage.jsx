import { useState, useRef } from 'react';
import { Languages, Calculator, Plus, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { translateBettingText } from '../services/openai';

// ── Moneyline helpers ────────────────────────────────────
function decToML(decimal) {
  const d = parseFloat(decimal);
  if (!d || d <= 1.01) return null;
  if (d >= 2) return `+${Math.round((d - 1) * 100)}`;
  return `${Math.round(-100 / (d - 1))}`;
}

function decToImplied(decimal) {
  const d = parseFloat(decimal);
  if (!d || d <= 1) return null;
  return (1 / d * 100).toFixed(1);
}

function mlPayout(ml, stake) {
  const n = parseInt(ml);
  if (isNaN(n) || !stake) return null;
  const s = parseFloat(stake);
  if (n > 0) return { profit: (n * s / 100), total: s + (n * s / 100) };
  return { profit: (100 / Math.abs(n)) * s, total: s + (100 / Math.abs(n)) * s };
}

// ── Traduttore ───────────────────────────────────────────
function TraduttorePanel() {
  const [input, setInput]   = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [copied, setCopied] = useState(false);

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
          La quota 2.50 diventa +150, la 1.70 diventa −143.
        </p>
      </div>

      <textarea
        className="tools-textarea"
        placeholder={"Incolla qui la giocata in italiano...\n\nEs: Milan vs Inter, pronostico Multipla: Milan 1 (quota 2.10) + Over 2.5 (quota 1.75), quota totale 3.68. Il Milan è in forma smagliante con 5 vittorie consecutive, l'Inter ha perso 2 delle ultime 3 in casa."}
        value={input}
        onChange={e => setInput(e.target.value)}
        rows={7}
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

// ── Convertitore ─────────────────────────────────────────
function ConvertitorePanel() {
  const [legs, setLegs]   = useState([{ id: 1, decimal: '', label: '' }]);
  const [stake, setStake] = useState('100');
  const counter           = useRef(2);

  function addLeg() {
    setLegs(p => [...p, { id: counter.current++, decimal: '', label: '' }]);
  }
  function removeLeg(id) { setLegs(p => p.filter(l => l.id !== id)); }
  function updateLeg(id, f, v) { setLegs(p => p.map(l => l.id === id ? { ...l, [f]: v } : l)); }

  const valid    = legs.filter(l => parseFloat(l.decimal) > 1.01);
  const combined = valid.reduce((acc, l) => acc * parseFloat(l.decimal), 1);
  const combinedML = valid.length >= 1 ? decToML(combined.toFixed(3)) : null;
  const payout     = combinedML ? mlPayout(combinedML, stake) : null;

  return (
    <div className="tools-card">
      <div className="tools-card-header">
        <div className="tools-card-title">
          <Calculator size={16} strokeWidth={1.5}/>
          Convertitore Quote → Moneyline
        </div>
        <p className="tools-card-sub">
          Inserisci una o più quote europee. Calcola il Moneyline singolo o parlay con payout realistico.
        </p>
      </div>

      {/* Legs */}
      <div className="conv-legs">
        {legs.map((leg, i) => {
          const ml  = leg.decimal ? decToML(leg.decimal) : null;
          const imp = leg.decimal ? decToImplied(leg.decimal) : null;
          const ok  = ml !== null;
          const pos = ok && parseInt(ml) > 0;

          return (
            <div key={leg.id} className="conv-leg-row">
              <span className="conv-leg-num">{i + 1}</span>
              <div className="conv-leg-inputs">
                <input
                  className="conv-decimal-input"
                  type="number" step="0.01" min="1.02"
                  placeholder="Quota EU (es. 1.85)"
                  value={leg.decimal}
                  onChange={e => updateLeg(leg.id, 'decimal', e.target.value)}
                />
                <input
                  className="conv-label-input"
                  type="text"
                  placeholder="Descrizione (opzionale)"
                  value={leg.label}
                  onChange={e => updateLeg(leg.id, 'label', e.target.value)}
                />
              </div>
              <div className="conv-leg-result">
                {ok ? (
                  <>
                    <span className={`conv-ml-badge ${pos ? 'positive' : 'negative'}`}>{ml}</span>
                    <span className="conv-impl">{imp}%</span>
                  </>
                ) : (
                  <span className="conv-ml-badge empty">—</span>
                )}
              </div>
              {legs.length > 1 && (
                <button className="conv-remove-btn" onClick={() => removeLeg(leg.id)} aria-label="Rimuovi">×</button>
              )}
            </div>
          );
        })}
      </div>

      <button className="conv-add-btn" onClick={addLeg}>
        <Plus size={13} strokeWidth={2}/> Aggiungi selezione
      </button>

      {/* Riepilogo */}
      {combinedML && valid.length >= 1 && (
        <div className="conv-summary">
          <div className="conv-summary-grid">
            <div className="conv-summary-item">
              <span className="conv-summary-label">
                {valid.length === 1 ? 'Quota europea' : `Combinata (${valid.length} selezioni)`}
              </span>
              <span className="conv-summary-value mono">{combined.toFixed(2)}</span>
            </div>
            <div className="conv-summary-item">
              <span className="conv-summary-label">Moneyline</span>
              <span className={`conv-summary-value mono ml-big ${parseInt(combinedML) > 0 ? 'positive' : 'negative'}`}>
                {combinedML}
              </span>
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

          {valid.length > 1 && (
            <div className="conv-breakdown">
              <div className="conv-breakdown-title">Dettaglio selezioni</div>
              {valid.map((leg, i) => {
                const ml  = decToML(leg.decimal);
                const imp = decToImplied(leg.decimal);
                const pos = parseInt(ml) > 0;
                return (
                  <div key={leg.id} className="conv-breakdown-row">
                    <span className="conv-breakdown-label">{leg.label || `Selezione ${i + 1}`}</span>
                    <span className="conv-breakdown-dec">{parseFloat(leg.decimal).toFixed(2)}</span>
                    <span className={`conv-breakdown-ml ${pos ? 'positive' : 'negative'}`}>{ml}</span>
                    <span className="conv-breakdown-imp">{imp}%</span>
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

// ── Sezione principale ────────────────────────────────────
export default function StrumentiPage() {
  return (
    <div className="strumenti-page">
      <div className="strumenti-header">
        <h1 className="strumenti-title">Strumenti</h1>
        <p className="strumenti-sub">Traduttore IT→EN con Moneyline · Convertitore quote</p>
      </div>
      <div className="strumenti-body">
        <TraduttorePanel />
        <ConvertitorePanel />
      </div>
    </div>
  );
}
