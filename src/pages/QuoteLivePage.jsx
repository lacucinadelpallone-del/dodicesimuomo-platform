import { useState, useEffect } from 'react';
import { Key, RefreshCw, Check } from 'lucide-react';
import {
  fetchOdds, fetchAvailableSports, getApiKey, saveApiKey,
  getPreferredBook, extractH2H, extractTotals, extractBtts,
} from '../services/odds';

function fmtTime(iso) {
  return new Date(iso).toLocaleString('it-IT', {
    weekday: 'short', day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function OddBtn({ label, value, sub }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!value) return;
    navigator.clipboard.writeText(String(value.toFixed(2)));
    setCopied(true);
    setTimeout(() => setCopied(false), 1000);
  }
  return (
    <button className={`odd-btn ${!value ? 'empty' : ''} ${copied ? 'copied' : ''}`} onClick={copy} disabled={!value}>
      <span className="odd-btn-label">{label}</span>
      <span className="odd-btn-value">{value ? value.toFixed(2) : '—'}</span>
      {sub && <span className="odd-btn-sub">{sub}</span>}
      {copied && <span className="odd-copied-flash"><Check size={14} strokeWidth={2.5}/></span>}
    </button>
  );
}

function DetailPanel({ match, onClose }) {
  const books   = match.bookmakers || [];
  const isBet365Available = books.some(b => b.key === 'bet365');
  const preferred = getPreferredBook(match);
  const bookName  = preferred?.title || '—';
  const isBet365  = preferred?.key === 'bet365';

  const h2h    = extractH2H(preferred, match);
  const totals = extractTotals(preferred);
  const btts   = extractBtts(preferred);

  // tutti i bookmaker disponibili per confronto 1X2
  const allH2H = books.map(b => ({
    name: b.title,
    key: b.key,
    odds: extractH2H(b, match),
  })).filter(b => b.odds);

  return (
    <div className="ql-detail">
      <div className="ql-detail-header">
        <button className="ql-back-btn" onClick={onClose}>← Torna</button>
        <div className="ql-detail-match">
          <span className="ql-detail-teams">{match.home_team} <span className="ql-vs">vs</span> {match.away_team}</span>
          <span className="ql-detail-time">{fmtTime(match.commence_time)}</span>
        </div>
        <div className={`ql-book-badge ${isBet365 ? 'bet365' : 'other'}`}>
          {isBet365 ? 'Bet365' : `${bookName} ${!isBet365Available ? '(Bet365 non disp.)' : ''}`}
        </div>
      </div>

      {/* 1X2 */}
      {h2h && (
        <div className="ql-market-block">
          <div className="ql-market-title">Risultato Finale (1X2)</div>
          <div className="ql-odds-row">
            <OddBtn label="1" value={h2h.home} sub={match.home_team.split(' ')[0]} />
            <OddBtn label="X" value={h2h.draw} sub="Pareggio" />
            <OddBtn label="2" value={h2h.away} sub={match.away_team.split(' ')[0]} />
          </div>
        </div>
      )}

      {/* Over / Under */}
      {totals.length > 0 && (
        <div className="ql-market-block">
          <div className="ql-market-title">Goal Totali (Over / Under)</div>
          <div className="ql-totals-grid">
            {totals.map(t => (
              <div key={t.point} className="ql-total-row">
                <span className="ql-total-label">{t.point}</span>
                <OddBtn label="Over" value={t.over} />
                <OddBtn label="Under" value={t.under} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GG / NG */}
      {btts && (
        <div className="ql-market-block">
          <div className="ql-market-title">Entrambe Segnano (GG / NG)</div>
          <div className="ql-odds-row">
            <OddBtn label="GG" value={btts.yes} sub="Sì" />
            <OddBtn label="NG" value={btts.no}  sub="No" />
          </div>
        </div>
      )}

      {/* Confronto bookmaker 1X2 */}
      {allH2H.length > 1 && (
        <div className="ql-market-block">
          <div className="ql-market-title">Confronto Bookmaker — 1X2</div>
          <div className="ql-compare-table">
            <div className="ql-compare-header">
              <span>Book</span><span>1</span><span>X</span><span>2</span>
            </div>
            {allH2H.map(b => (
              <div key={b.key} className={`ql-compare-row ${b.key === 'bet365' ? 'is-bet365' : ''}`}>
                <span className="ql-compare-name">{b.name}</span>
                <span className="ql-compare-odd">{b.odds.home?.toFixed(2) ?? '—'}</span>
                <span className="ql-compare-odd">{b.odds.draw?.toFixed(2) ?? '—'}</span>
                <span className="ql-compare-odd">{b.odds.away?.toFixed(2) ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ql-copy-hint">Clicca su una quota per copiarla negli appunti</div>
    </div>
  );
}

export default function QuoteLivePage() {
  const [apiKey, setApiKey]     = useState(getApiKey());
  const [apiInput, setApiInput] = useState(getApiKey());
  const [sports, setSports]     = useState([]);
  const [sport, setSport]       = useState('');
  const [matches, setMatches]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [loadingSports, setLoadingSports] = useState(false);
  const [error, setError]       = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selected, setSelected] = useState(null);

  function handleSaveKey() {
    const k = apiInput.trim();
    saveApiKey(k);
    setApiKey(k);
  }

  // Carica i campionati disponibili adesso dall'API
  async function loadSports(key) {
    setLoadingSports(true);
    try {
      const available = await fetchAvailableSports(key);
      setSports(available);
      if (available.length > 0) setSport(available[0].id);
      else setSport('');
    } catch (e) {
      setError(e.message);
    }
    setLoadingSports(false);
  }

  async function load(key = apiKey, sportId = sport) {
    if (!key || !sportId) return;
    setLoading(true);
    setError(null);
    setSelected(null);
    try {
      const data = await fetchOdds(sportId, key);
      setMatches(data);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e.message);
      setMatches([]);
    }
    setLoading(false);
  }

  // Quando la key cambia → ricarica campionati disponibili
  useEffect(() => {
    if (apiKey) loadSports(apiKey);
  }, [apiKey]);

  // Quando il campionato attivo cambia → carica le partite
  useEffect(() => {
    if (apiKey && sport) load(apiKey, sport);
  }, [sport]);

  const handleSportChange = (id) => { setSport(id); setSelected(null); setMatches([]); };

  return (
    <div className="quote-page">
      {/* Header */}
      <div className="quote-header">
        <div>
          <h1 className="quote-title">Quote Live — Bet365</h1>
          {lastUpdate && <p className="quote-update">Aggiornato: {lastUpdate.toLocaleTimeString('it-IT')}</p>}
        </div>
        <button className="quote-refresh-btn" onClick={() => { loadSports(apiKey); }} disabled={loadingSports || !apiKey}>
          {loadingSports ? <div className="cs-spinner" style={{width:14,height:14}}/> : <RefreshCw size={14} strokeWidth={1.5} aria-hidden="true"/>} Aggiorna
        </button>
      </div>

      {/* API Key */}
      <div className="quote-api-box">
        <div className="quote-api-label"><Key size={12} strokeWidth={1.5} aria-hidden="true"/> TheOddsAPI Key</div>
        <div className="quote-api-row">
          <input
            className="quote-api-input"
            type="password"
            placeholder="Incolla la tua API key — the-odds-api.com"
            value={apiInput}
            onChange={e => setApiInput(e.target.value)}
          />
          <button className="quote-api-save-btn" onClick={handleSaveKey} disabled={!apiInput.trim()}>
            Salva
          </button>
          <a className="quote-api-link" href="https://the-odds-api.com/" target="_blank" rel="noreferrer">
            Ottieni key →
          </a>
        </div>
        {apiKey && <div className="quote-api-ok"><Check size={12} strokeWidth={2.5}/> API key configurata</div>}
      </div>

      {/* Sport tabs — caricate dinamicamente dall'API */}
      <div className="quote-sport-tabs">
        {loadingSports && <span className="quote-sports-loading">Caricamento campionati disponibili...</span>}
        {!loadingSports && sports.length === 0 && apiKey && (
          <span className="quote-sports-loading">Nessun campionato di calcio disponibile al momento</span>
        )}
        {sports.map(s => (
          <button
            key={s.id}
            className={`quote-sport-btn ${sport === s.id ? 'active' : ''}`}
            onClick={() => handleSportChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <div className="cs-error">{error}</div>}

      {/* Layout lista + dettaglio */}
      <div className={`ql-layout ${selected ? 'has-detail' : ''}`}>
        {/* Lista partite */}
        <div className="ql-list">
          {!apiKey && (
            <div className="quote-empty">
              <Key size={32} strokeWidth={1} aria-hidden="true"/>
              <p>Inserisci la tua API key</p>
            </div>
          )}

          {loading && (
            <div className="quote-loading">
              <div className="cs-spinner" />
              <span>Caricamento quote...</span>
            </div>
          )}

          {!loading && apiKey && matches.length === 0 && !error && sport && (
            <div className="quote-empty">
              <p>Nessuna quota disponibile per questa competizione</p>
              <small>Prova un'altra competizione oppure riprova più tardi</small>
            </div>
          )}

          {!loading && matches.map(match => {
            const preferred = getPreferredBook(match);
            const h2h       = extractH2H(preferred, match);
            const isBet365  = preferred?.key === 'bet365';
            const isActive  = selected?.id === match.id;

            return (
              <div
                key={match.id}
                className={`ql-match-row ${isActive ? 'active' : ''}`}
                onClick={() => setSelected(isActive ? null : match)}
              >
                <div className="ql-match-left">
                  <div className="ql-match-time">{fmtTime(match.commence_time)}</div>
                  <div className="ql-match-teams">
                    <span>{match.home_team}</span>
                    <span className="ql-vs-sm">vs</span>
                    <span>{match.away_team}</span>
                  </div>
                </div>
                <div className="ql-match-right">
                  {h2h ? (
                    <div className="ql-preview-odds">
                      <span className="ql-preview-odd">{h2h.home?.toFixed(2) ?? '—'}</span>
                      <span className="ql-preview-odd">{h2h.draw?.toFixed(2) ?? '—'}</span>
                      <span className="ql-preview-odd">{h2h.away?.toFixed(2) ?? '—'}</span>
                    </div>
                  ) : (
                    <span className="ql-no-odds">nessuna quota</span>
                  )}
                  <span className={`ql-book-tag ${isBet365 ? 'bet365' : ''}`}>
                    {isBet365 ? 'Bet365' : preferred?.title || '—'}
                  </span>
                  <span className="ql-arrow">{isActive ? '▲' : '▼'}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pannello dettaglio */}
        {selected && (
          <div className="ql-detail-wrap">
            <DetailPanel match={selected} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
