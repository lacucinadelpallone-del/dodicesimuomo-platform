import { useState, useEffect } from 'react';
import { FolderOpen, X, Download, Trash2, Clock } from 'lucide-react';
import { archiveGetAll, archiveDelete } from '../services/archive';

const SEZIONI = ['Tutte', 'Singola', 'Multipla', 'Listone', 'Chicca', 'Antepost'];

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function ArchivePage() {
  const [items, setItems]       = useState([]);
  const [filter, setFilter]     = useState('Tutte');
  const [search, setSearch]     = useState('');
  const [preview, setPreview]   = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    archiveGetAll().then(data => { setItems(data); setLoading(false); });
  }, []);

  async function handleDelete(id) {
    await archiveDelete(id);
    setItems(prev => prev.filter(i => i.id !== id));
    if (preview?.id === id) setPreview(null);
  }

  const filtered = items.filter(i => {
    if (filter !== 'Tutte' && i.sezione !== filter) return false;
    if (search && !i.label?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="archive-page">
      {/* Header */}
      <div className="archive-header">
        <div>
          <h1 className="archive-title">Archivio Grafiche</h1>
          <p className="archive-subtitle">{items.length} grafica{items.length !== 1 ? 'he' : ''} salvata{items.length !== 1 ? 'e' : ''}</p>
        </div>
        <input
          className="archive-search"
          placeholder="Cerca..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filtri sezione */}
      <div className="archive-filters">
        {SEZIONI.map(s => (
          <button
            key={s}
            className={`archive-filter-btn ${filter === s ? 'active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading && <div className="archive-empty">Caricamento...</div>}

      {!loading && filtered.length === 0 && (
        <div className="archive-empty">
          <FolderOpen size={40} strokeWidth={1} aria-hidden="true"/>
          <p>{items.length === 0 ? 'Nessuna grafica salvata ancora' : 'Nessun risultato'}</p>
          <small>{items.length === 0 ? 'Genera la tua prima grafica nel Content Studio' : 'Prova a cambiare i filtri'}</small>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="archive-grid">
          {filtered.map(item => (
            <div key={item.id} className="archive-card" onClick={() => setPreview(item)}>
              <div className="archive-card-img-wrap">
                <img src={item.url} alt={item.label} />
                {item.scheduledAt && (
                  <div className="archive-badge scheduled">Programmata</div>
                )}
                {item.published && (
                  <div className="archive-badge published">Pubblicata</div>
                )}
              </div>
              <div className="archive-card-info">
                <div className="archive-card-label">{item.label || item.sezione}</div>
                <div className="archive-card-meta">
                  <span className="archive-tag">{item.sezione}</span>
                  <span className="archive-tag">{item.stile}</span>
                </div>
                <div className="archive-card-date">{fmtDate(item.savedAt)}</div>
              </div>
              <button
                className="archive-card-delete"
                onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                aria-label="Elimina"
              ><X size={12} strokeWidth={2}/></button>
            </div>
          ))}
        </div>
      )}

      {/* Modal preview */}
      {preview && (
        <div className="archive-modal-overlay" onClick={() => setPreview(null)}>
          <div className="archive-modal" onClick={e => e.stopPropagation()}>
            <button className="archive-modal-close" onClick={() => setPreview(null)} aria-label="Chiudi"><X size={13} strokeWidth={2}/></button>
            <img src={preview.url} alt={preview.label} className="archive-modal-img" />
            <div className="archive-modal-meta">
              <div className="archive-modal-title">{preview.label || preview.sezione}</div>
              <div className="archive-modal-tags">
                <span className="archive-tag">{preview.sezione}</span>
                <span className="archive-tag">{preview.stile}</span>
                <span className="archive-tag-date">{fmtDate(preview.savedAt)}</span>
              </div>
              {preview.scheduledAt && (
                <div className="archive-scheduled-info">
                  <Clock size={12} strokeWidth={1.5} aria-hidden="true"/> Programmata per: {new Date(preview.scheduledAt).toLocaleString('it-IT')}
                </div>
              )}
            </div>
            <div className="archive-modal-actions">
              <a href={preview.url} download={`${preview.label || 'grafica'}.png`} className="cs-btn-download">
                <Download size={14} strokeWidth={2} aria-hidden="true"/> Scarica
              </a>
              <button className="cs-btn-regen" onClick={() => handleDelete(preview.id)}>
                <Trash2 size={14} strokeWidth={1.5} aria-hidden="true"/> Elimina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
