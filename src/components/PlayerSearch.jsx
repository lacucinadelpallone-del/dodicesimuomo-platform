import { useState, useEffect, useRef } from 'react';
import { searchPlayers, imgToDataUrl } from '../services/sportsapi';

export default function PlayerSearch({ apiKey, value, onChange, placeholder, onPhotoReady }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen]       = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!apiKey || !value || value.length < 3) { setResults([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const players = await searchPlayers(value, apiKey);
        setResults(players);
        setOpen(players.length > 0);
      } catch (_) {
        setResults([]);
      }
      setLoading(false);
    }, 550);
  }, [value, apiKey]);

  async function handleSelect(player) {
    setOpen(false);
    onChange(player.name);
    if (player.photo && onPhotoReady) {
      try {
        const dataUrl = await imgToDataUrl(player.photo);
        onPhotoReady(dataUrl);
      } catch (_) {}
    }
  }

  return (
    <div className="ps-wrap">
      <div className="ps-input-wrap">
        <input
          className="ps-input"
          placeholder={placeholder}
          value={value}
          onChange={e => { onChange(e.target.value); if (e.target.value.length >= 3) setOpen(true); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {loading && <span className="ps-spinner"><div className="cs-spinner"/></span>}
      </div>
      {open && results.length > 0 && (
        <div className="ps-dropdown">
          {results.slice(0, 8).map(p => (
            <button key={p.id} className="ps-item" onMouseDown={() => handleSelect(p)}>
              {p.photo && <img src={p.photo} alt={p.name}/>}
              <div>
                <div className="ps-item-name">{p.name}</div>
                {p.nationality && <div className="ps-item-meta">{p.nationality}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
