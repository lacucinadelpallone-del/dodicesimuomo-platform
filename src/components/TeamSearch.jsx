import { useState, useEffect, useRef } from 'react';
import { X, Upload } from 'lucide-react';
import { searchTeams, imgToDataUrl } from '../services/sportsapi';

export default function TeamSearch({ apiKey, side, dataUrl, onSelect, onClear }) {
  const [query, setQuery]           = useState('');
  const [results, setResults]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [fetchingLogo, setFetchingLogo] = useState(false);
  const [open, setOpen]             = useState(false);
  const [error, setError]           = useState(null);
  const timer     = useRef(null);
  const inputRef  = useRef(null);
  const uploadRef = useRef(null);

  useEffect(() => {
    setError(null);
    if (!query || query.length < 2) { setResults([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!apiKey) return;
      setLoading(true);
      try {
        const teams = await searchTeams(query, apiKey);
        setResults(teams);
        setOpen(teams.length > 0);
      } catch (e) {
        setError(e.message);
        setResults([]);
      }
      setLoading(false);
    }, 450);
  }, [query, apiKey]);

  async function handleSelect(team) {
    setOpen(false);
    setQuery('');
    setFetchingLogo(true);
    try {
      const url = await imgToDataUrl(team.logo);
      onSelect(url, team.name);
    } catch (_) {
      onSelect(team.logo, team.name);
    }
    setFetchingLogo(false);
  }

  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onSelect(reader.result, '');
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const label = side === 'casa' ? 'Casa' : 'Ospite';

  if (dataUrl) {
    return (
      <div className="ts-selected">
        <img src={dataUrl} className="ts-selected-img" alt={label} />
        <span className="ts-selected-name">{label}</span>
        <button className="ts-clear-btn" onClick={onClear} aria-label="Rimuovi logo">
          <X size={12} strokeWidth={2}/>
        </button>
      </div>
    );
  }

  return (
    <div className="ts-wrap">
      {apiKey ? (
        <>
          <div className="ts-input-wrap">
            <input
              ref={inputRef}
              className="ts-input"
              placeholder={`${label}...`}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
            />
            {(loading || fetchingLogo) && (
              <span className="ts-spinner"><div className="cs-spinner"/></span>
            )}
          </div>
          {error && <div className="ts-error">{error}</div>}
          {open && results.length > 0 && (
            <div className="ts-dropdown">
              {results.slice(0, 7).map(t => (
                <button key={t.id} className="ts-item" onMouseDown={() => handleSelect(t)}>
                  <img src={t.logo} alt={t.name}/>
                  <div>
                    <div className="ts-item-name">{t.name}</div>
                    {t.country && <div className="ts-item-country">{t.country}</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
          <button className="cs-add-btn" onClick={() => uploadRef.current.click()}>
            <Upload size={12} strokeWidth={2} aria-hidden="true"/> Carica logo {label}
          </button>
        </>
      ) : (
        <button className="ts-upload-only" onClick={() => uploadRef.current.click()}>
          <span className="ts-label">Logo {label}</span>
          <Upload size={14} strokeWidth={1.5} aria-hidden="true"/>
        </button>
      )}
      <input ref={uploadRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
    </div>
  );
}
