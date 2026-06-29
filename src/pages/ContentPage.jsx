import { useState, useRef } from 'react';
import {
  Camera, X, Paperclip, Search, SearchCheck, Key, Check, CheckCircle,
  XCircle, Sparkles, Palette, Pencil, RotateCcw, RefreshCw, Download,
  Upload, Music, Clock, Loader2,
} from 'lucide-react';
import { SEZIONI, STILI, buildPrompt } from '../services/prompts';
import { generateImage, extractFromImage, describePlayer } from '../services/openai';
import { overlayLogos } from '../services/imageProcessor';
import { COMPETITIONS } from '../assets/competitions';
import { archiveSave, archiveUpdate } from '../services/archive';
import { getSportsKey, saveSportsKey, checkApiKey } from '../services/sportsapi';
import TeamSearch from '../components/TeamSearch';
import PlayerSearch from '../components/PlayerSearch';

// ─── Tipologie di giocata ────────────────────────────
const BET_CATEGORIES = [
  { label: 'Risultato Finale', options: ['1 — Vittoria Casa','X — Pareggio','2 — Vittoria Ospite','1X — Doppia Chance (Casa/Pareggio)','X2 — Doppia Chance (Pareggio/Ospite)','12 — Doppia Chance (Casa/Ospite)'] },
  { label: 'Goal Totali', options: ['Over 0.5 Goal','Under 0.5 Goal','Over 1.5 Goal','Under 1.5 Goal','Over 2.5 Goal','Under 2.5 Goal','Over 3.5 Goal','Under 3.5 Goal','Over 4.5 Goal','Under 4.5 Goal','GG — Entrambe Segnano','NG — Nessuna Squadra Segna'] },
  { label: 'Goal Squadra Casa', options: ['Over 0.5 Goal Squadra Casa','Over 1.5 Goal Squadra Casa','Over 2.5 Goal Squadra Casa','Under 0.5 Goal Squadra Casa','Under 1.5 Goal Squadra Casa'] },
  { label: 'Goal Squadra Ospite', options: ['Over 0.5 Goal Squadra Ospite','Over 1.5 Goal Squadra Ospite','Over 2.5 Goal Squadra Ospite','Under 0.5 Goal Squadra Ospite','Under 1.5 Goal Squadra Ospite'] },
  { label: 'Multigoal', options: ['Multigoal Casa 0-1','Multigoal Casa 1-2','Multigoal Casa 0-3','Multigoal Casa 1-3','Multigoal Casa 2-4','Multigoal Ospite 0-1','Multigoal Ospite 1-2','Multigoal Ospite 0-3','Multigoal Ospite 1-3'] },
  { label: 'Primo Tempo', options: ['1T — 1 (Casa vince 1° Tempo)','1T — X (Pareggio 1° Tempo)','1T — 2 (Ospite vince 1° Tempo)','Over 0.5 Goal 1° Tempo','Over 1.5 Goal 1° Tempo','Under 0.5 Goal 1° Tempo','GG 1° Tempo'] },
  { label: 'Cartellini', options: ['Over 1.5 Cartellini Totali','Over 2.5 Cartellini Totali','Over 3.5 Cartellini Totali','Over 4.5 Cartellini Totali','Over 5.5 Cartellini Totali','Over 6.5 Cartellini Totali','Over 0.5 Cartellini Casa','Over 1.5 Cartellini Casa','Over 2.5 Cartellini Casa','Over 0.5 Cartellini Ospite','Over 1.5 Cartellini Ospite','Over 2.5 Cartellini Ospite','1X2 Cartellini Totali'] },
  { label: 'Corner', options: ['Over 4.5 Corner Totali','Over 5.5 Corner Totali','Over 6.5 Corner Totali','Over 7.5 Corner Totali','Over 8.5 Corner Totali','Over 9.5 Corner Totali','Over 10.5 Corner Totali','Under 9.5 Corner Totali','Over 2.5 Corner Casa','Over 3.5 Corner Casa','Over 4.5 Corner Casa','Over 2.5 Corner Ospite','Over 3.5 Corner Ospite','1X2 Corner Totali'] },
  { label: 'Tiri', options: ['Over 10.5 Tiri Totali','Over 12.5 Tiri Totali','Over 14.5 Tiri Totali','Over 16.5 Tiri Totali','Over 18.5 Tiri Totali','Over 20.5 Tiri Totali','Over 23.5 Tiri Totali','Over 4.5 Tiri in Porta','Over 5.5 Tiri in Porta','Over 6.5 Tiri in Porta','Over 7.5 Tiri in Porta','1X2 Tiri Totali','1X2 Tiri in Porta'] },
  { label: 'Falli', options: ['Over 14.5 Falli Totali','Over 16.5 Falli Totali','Over 18.5 Falli Totali','Over 20.5 Falli Totali','Over 22.5 Falli Totali','1X2 Falli Commessi'] },
  { label: 'Marcatori', options: ['Primo Marcatore — [nome giocatore]','Ultimo Marcatore — [nome giocatore]','Anytime Scorer — [nome giocatore]','Segna nel 1° Tempo — [nome giocatore]'] },
];

function CompetitionSelect({ value, onChange }) {
  const selected = COMPETITIONS.find(c => c.id === value);
  return (
    <div className="cs-comp-select-wrap">
      {selected && <img src={selected.logo} alt={selected.label} className="cs-comp-logo-preview" />}
      <select className="cs-comp-select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Nessuna competizione</option>
        {COMPETITIONS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
    </div>
  );
}

function PresetSelect({ onSelect }) {
  return (
    <select className="cs-preset-select" value="" onChange={e => { if (e.target.value) onSelect(e.target.value); }}>
      <option value="" disabled>▾ Preset</option>
      {BET_CATEGORIES.map(cat => (
        <optgroup key={cat.label} label={cat.label}>
          {cat.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function QuotaBox({ label, value }) {
  return (
    <div className="cs-quota-box">
      <span className="cs-quota-box-label">{label}</span>
      <span className="cs-quota-box-value">{value}</span>
    </div>
  );
}

// ─── State iniziali ──────────────────────────────────
const mkSingola  = () => ({ squadraCasa:'', squadraOspite:'', competizioneId:'', competizioneLabel:'', giocatore1:'', giocatore2:'', giocatore3:'', giocate:[{ testo:'', quota:'' }] });
const mkMultipla = () => ({ giocatori:'', giocate:[{ squadraCasa:'', squadraOspite:'', pronostico:'', quota:'' },{ squadraCasa:'', squadraOspite:'', pronostico:'', quota:'' }] });
const mkListone  = () => ({ righe:[{ squadraCasa:'', squadraOspite:'', dataOra:'', pronostico:'', etichetta:'OVER', quota:'' },{ squadraCasa:'', squadraOspite:'', dataOra:'', pronostico:'', etichetta:'OVER', quota:'' }] });
const mkChicca   = () => ({ squadraCasa:'', squadraOspite:'', competizioneId:'', competizioneLabel:'', giocatore1:'', pronostico:'', quota:'' });
const mkAntepost = () => ({ evento:'', squadraGiocatore:'', giocate:[{ testo:'', quota:'' }] });

function calcQuota(list, key = 'quota') {
  const valide = list.map(i => parseFloat(i[key])).filter(q => !isNaN(q) && q > 1);
  if (!valide.length) return null;
  return valide.reduce((acc, q) => +(acc * q).toFixed(10), 1).toFixed(2);
}

function buildLabel(sezione, data) {
  if (sezione === 'Singola' || sezione === 'Chicca') {
    if (data.squadraCasa || data.squadraOspite) return `${data.squadraCasa} vs ${data.squadraOspite}`;
  }
  if (sezione === 'Multipla') return `Multipla ${data.giocate?.length} eventi`;
  if (sezione === 'Listone')  return `Listone ${data.righe?.length} partite`;
  if (sezione === 'Antepost') return data.evento || 'Antepost';
  return sezione;
}

function readFileBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function ContentPage() {
  const [sezione, setSezione] = useState('Singola');
  const [stile, setStile]     = useState('aggressiva');

  const [singola, setSingola]   = useState(mkSingola());
  const [multipla, setMultipla] = useState(mkMultipla());
  const [listone, setListone]   = useState(mkListone());
  const [chicca, setChicca]     = useState(mkChicca());
  const [antepost, setAntepost] = useState(mkAntepost());

  const [imageUrl, setImageUrl]           = useState(null);
  const [loading, setLoading]             = useState(false);
  const [loadingVision, setLoadingVision] = useState(false);
  const [error, setError]                 = useState(null);

  // Post-generazione
  const [feedback, setFeedback]         = useState('');
  const [savedId, setSavedId]           = useState(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduled, setScheduled]       = useState(false);

  // Foto giocatore + loghi squadre
  const [playerPhoto, setPlayerPhoto]   = useState(null);
  const [playerDesc, setPlayerDesc]     = useState('');
  const [descLoading, setDescLoading]   = useState(false);
  const [logoSqCasa, setLogoSqCasa]     = useState(null);
  const [logoSqOspite, setLogoSqOspite] = useState(null);

  // Sports API key
  const [sportsKey, setSportsKey]           = useState(getSportsKey());
  const [sportsKeyInput, setSportsKeyInput] = useState(getSportsKey());
  const [showSportsKey, setShowSportsKey]   = useState(false);
  const [sportsKeyStatus, setSportsKeyStatus] = useState(null); // null | 'ok' | 'error'
  const [sportsKeyError, setSportsKeyError]   = useState('');

  const fileRef        = useRef();
  const playerPhotoRef = useRef();

  // ─── Updater ────────────────────────────────────────
  const upd    = setter => (key, val) => setter(s => ({ ...s, [key]: val }));
  const updRow = (setter, arr) => (idx, key, val) => setter(s => { const a=[...s[arr]]; a[idx]={...a[idx],[key]:val}; return {...s,[arr]:a}; });
  const addRow = (setter, arr, tmpl) => setter(s => ({ ...s, [arr]: [...s[arr], { ...tmpl }] }));
  const rmRow  = (setter, arr) => idx => setter(s => ({ ...s, [arr]: s[arr].filter((_,i)=>i!==idx) }));

  const updS=upd(setSingola), updSRow=updRow(setSingola,'giocate'), addSRow=()=>addRow(setSingola,'giocate',{testo:'',quota:''}), rmSRow=rmRow(setSingola,'giocate');
  const updM=upd(setMultipla), updMRow=updRow(setMultipla,'giocate'), addMRow=()=>addRow(setMultipla,'giocate',{squadraCasa:'',squadraOspite:'',pronostico:'',quota:''}), rmMRow=rmRow(setMultipla,'giocate');
  const updLRow=updRow(setListone,'righe'), addLRow=()=>addRow(setListone,'righe',{squadraCasa:'',squadraOspite:'',dataOra:'',pronostico:'',etichetta:'OVER',quota:''}), rmLRow=rmRow(setListone,'righe');
  const updC=upd(setChicca);
  const updA=upd(setAntepost), updARow=updRow(setAntepost,'giocate'), addARow=()=>addRow(setAntepost,'giocate',{testo:'',quota:''}), rmARow=rmRow(setAntepost,'giocate');

  const qtSingola  = calcQuota(singola.giocate);
  const qtMultipla = calcQuota(multipla.giocate);
  const qtListone  = calcQuota(listone.righe);
  const qtAntepost = calcQuota(antepost.giocate);

  // ─── Salva Sports API key ────────────────────────────
  async function handleSaveSportsKey() {
    const k = sportsKeyInput.trim();
    saveSportsKey(k);
    setSportsKey(k);
    setSportsKeyStatus(null);
    setSportsKeyError('');
  }

  async function handleVerifySportsKey() {
    const k = sportsKeyInput.trim();
    if (!k) return;
    setSportsKeyStatus('checking');
    setSportsKeyError('');
    try {
      await checkApiKey(k);
      saveSportsKey(k);
      setSportsKey(k);
      setSportsKeyStatus('ok');
    } catch (e) {
      setSportsKeyStatus('error');
      setSportsKeyError(e.message);
    }
  }

  // ─── Upload schedina (GPT-4o legge la schedina) ─────
  async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoadingVision(true); setError(null);
    try {
      const b64 = await readFileBase64(file);
      const ext = await extractFromImage(b64);
      if (ext.eventi?.length > 1) {
        setSezione('Multipla');
        setMultipla(m => ({ ...m, giocate: ext.eventi.map(ev => ({ squadraCasa: ev.squadraCasa||'', squadraOspite: ev.squadraOspite||'', pronostico: ev.pronostico||'', quota: ev.quota||'' })) }));
      } else {
        setSingola(s => ({ ...s, squadraCasa: ext.squadraCasa||s.squadraCasa, squadraOspite: ext.squadraOspite||s.squadraOspite, giocate: ext.quota ? [{ testo: ext.pronostico1||'', quota: ext.quota }] : s.giocate }));
      }
    } catch (err) { setError('Errore lettura immagine: ' + err.message); }
    setLoadingVision(false);
    e.target.value = '';
  }

  // ─── Foto giocatore pronta (da upload o da ricerca) ──
  async function handlePlayerPhotoReady(dataUrl) {
    setPlayerPhoto(dataUrl);
    setDescLoading(true);
    try {
      const b64 = dataUrl.split(',')[1];
      const desc = await describePlayer(b64);
      setPlayerDesc(desc);
    } catch (_) { setPlayerDesc(''); }
    setDescLoading(false);
  }

  // ─── Upload manuale foto giocatore ──────────────────
  async function handlePlayerPhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await readFileBase64(file);
    await handlePlayerPhotoReady(`data:image/jpeg;base64,${b64}`);
    e.target.value = '';
  }

  // ─── Genera grafica ──────────────────────────────────
  async function genera(useFeedback = false) {
    setLoading(true); setError(null); setImageUrl(null);
    setSavedId(null); setScheduled(false);
    try {
      let dati, competizioneId = '';
      if (sezione === 'Singola')  { dati = { ...singola,  competizione: singola.competizioneLabel,  quotaTotale: qtSingola,  playerDesc1: playerDesc }; competizioneId = singola.competizioneId; }
      if (sezione === 'Multipla') { dati = { ...multipla, quotaTotale: qtMultipla, playerDesc1: playerDesc }; }
      if (sezione === 'Listone')  { dati = { ...listone,  quotaTotale: qtListone  }; }
      if (sezione === 'Chicca')   { dati = { ...chicca,   competizione: chicca.competizioneLabel, playerDesc1: playerDesc }; competizioneId = chicca.competizioneId; }
      if (sezione === 'Antepost') { dati = { ...antepost, quotaTotale: qtAntepost, playerDesc1: playerDesc }; }

      let prompt = buildPrompt(sezione, dati, stile);
      if (useFeedback && feedback.trim()) {
        prompt = `Modifica richiesta: "${feedback.trim()}". Mantieni struttura e composizione originale, applica solo questa modifica.\n\n${prompt}`;
      }

      const rawUrl   = await generateImage(prompt);
      const compLogo = COMPETITIONS.find(c => c.id === competizioneId)?.logo || null;
      const finalUrl = await overlayLogos(rawUrl, { compLogo, homeLogo: logoSqCasa, awayLogo: logoSqOspite });
      setImageUrl(finalUrl);

      const id = await archiveSave({
        sezione, stile,
        url: finalUrl,
        label: buildLabel(sezione, dati),
        prompt,
        scheduledAt: null,
        published: false,
      });
      setSavedId(id);
      setFeedback('');
    } catch (err) { setError(err.message); }
    setLoading(false);
  }

  async function handleSchedule() {
    if (!savedId || !scheduleDate || !scheduleTime) return;
    const scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    await archiveUpdate(savedId, { scheduledAt });
    setScheduled(true);
  }

  // ─── Blocco loghi squadre (Singola + Chicca) ─────────
  const teamLogosUI = (
    <div className="cs-team-logos-row">
      <TeamSearch
        apiKey={sportsKey}
        side="casa"
        dataUrl={logoSqCasa}
        onSelect={(dataUrl) => setLogoSqCasa(dataUrl)}
        onClear={() => setLogoSqCasa(null)}
      />
      <span className="cs-team-logos-sep">
        Loghi squadre <span className="cs-optional">— opz.</span>
      </span>
      <TeamSearch
        apiKey={sportsKey}
        side="ospite"
        dataUrl={logoSqOspite}
        onSelect={(dataUrl) => setLogoSqOspite(dataUrl)}
        onClear={() => setLogoSqOspite(null)}
      />
    </div>
  );

  // ─── Pulsante foto giocatore ─────────────────────────
  function PhotoBtn() {
    return (
      <>
        <button
          className={`cs-photo-btn ${playerPhoto ? 'has-photo' : ''}`}
          onClick={() => playerPhotoRef.current.click()}
          title="Carica foto manualmente per migliorare la somiglianza"
          disabled={descLoading}
        >
          {descLoading
            ? <Loader2 size={16} strokeWidth={1.5} className="cs-spin" aria-hidden="true"/>
            : playerPhoto
              ? <img src={playerPhoto} className="cs-photo-thumb" alt=""/>
              : <Camera size={16} strokeWidth={1.5} aria-hidden="true"/>
          }
        </button>
        {playerPhoto && (
          <button className="cs-photo-remove" onClick={() => { setPlayerPhoto(null); setPlayerDesc(''); }}>
            <X size={12} strokeWidth={2} aria-hidden="true"/>
          </button>
        )}
      </>
    );
  }

  // ─── Input giocatore con foto e ricerca ──────────────
  function playerInputUI(nameValue, onNameChange) {
    return (
      <>
        <div className="cs-player-photo-row">
          {sportsKey ? (
            <PlayerSearch
              apiKey={sportsKey}
              value={nameValue}
              onChange={onNameChange}
              placeholder="Protagonista — cerca o scrivi nome"
              onPhotoReady={handlePlayerPhotoReady}
            />
          ) : (
            <input
              className="cs-input-flex"
              placeholder="Protagonista (centro)"
              value={nameValue}
              onChange={e => onNameChange(e.target.value)}
            />
          )}
          <PhotoBtn />
        </div>
        {descLoading && <div className="cs-desc-loading">GPT-4o analizza l'aspetto...</div>}
        {playerDesc && !descLoading && <div className="cs-desc-preview" title={playerDesc}>{playerDesc}</div>}
      </>
    );
  }

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="content-studio">
      {/* ── Colonna sinistra ── */}
      <div className="cs-left">
        <div className="cs-header-row">
          <h1>Content Studio</h1>
          <div style={{ display:'flex', gap: 8 }}>
            <button className="cs-vision-btn" onClick={() => fileRef.current.click()} disabled={loadingVision}>
              {loadingVision
                ? <Loader2 size={14} strokeWidth={1.5} className="cs-spin" aria-hidden="true"/>
                : <Paperclip size={14} strokeWidth={1.5} aria-hidden="true"/>
              } Allega
            </button>
            <button
              className={`cs-vision-btn ${sportsKey ? 'active' : ''}`}
              onClick={() => setShowSportsKey(v => !v)}
              title={sportsKey ? 'Sports API configurata' : 'Configura ricerca calciatori/squadre'}
            >
              {sportsKey
                ? <SearchCheck size={14} strokeWidth={1.5} aria-hidden="true"/>
                : <Search size={14} strokeWidth={1.5} aria-hidden="true"/>
              }
            </button>
          </div>
        </div>

        {loadingVision && <div className="cs-vision-notice">GPT-4o sta leggendo la schedina...</div>}

        {/* Sports API key inline */}
        {showSportsKey && (
          <div className="cs-sports-key-panel">
            <div className="cs-sports-key-label">
              <Key size={12} strokeWidth={1.5} aria-hidden="true"/> API-Football key
              {!sportsKey && (
                <a
                  className="cs-sports-key-link"
                  href="https://dashboard.api-football.com/register"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ottieni gratis →
                </a>
              )}
            </div>
            <div className="cs-sports-key-row">
              <input
                className="cs-sports-key-input"
                type="password"
                placeholder="Incolla la tua API key"
                value={sportsKeyInput}
                onChange={e => { setSportsKeyInput(e.target.value); setSportsKeyStatus(null); setSportsKeyError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleVerifySportsKey()}
              />
              <button
                className="cs-sports-key-save"
                onClick={handleVerifySportsKey}
                disabled={!sportsKeyInput.trim() || sportsKeyStatus === 'checking'}
              >
                {sportsKeyStatus === 'checking'
                  ? <Loader2 size={12} strokeWidth={1.5} className="cs-spin" aria-hidden="true"/>
                  : 'Verifica'
                }
              </button>
              <button
                className="cs-sports-key-save"
                onClick={handleSaveSportsKey}
                disabled={!sportsKeyInput.trim()}
                style={{ opacity: 0.7 }}
              >
                Salva
              </button>
              {sportsKey && (
                <button
                  className="cs-sports-key-clear"
                  onClick={() => { saveSportsKey(''); setSportsKey(''); setSportsKeyInput(''); setSportsKeyStatus(null); setSportsKeyError(''); }}
                >
                  Rimuovi
                </button>
              )}
            </div>
            {sportsKeyStatus === 'ok' && (
              <div className="cs-sports-key-ok">
                <Check size={12} strokeWidth={2.5}/> Key valida — ricerca attiva (100 req/giorno)
              </div>
            )}
            {sportsKeyStatus === 'error' && (
              <div className="cs-sports-key-err">
                <XCircle size={12} strokeWidth={1.5}/> {sportsKeyError}
              </div>
            )}
            {sportsKeyStatus === null && sportsKey && (
              <div className="cs-sports-key-ok">
                <Check size={12} strokeWidth={2.5}/> Ricerca attiva (100 req/giorno)
              </div>
            )}
          </div>
        )}

        <div className="cs-section-tabs">
          {SEZIONI.map(s => <button key={s} className={`cs-tab ${sezione===s?'active':''}`} onClick={() => setSezione(s)}>{s}</button>)}
        </div>

        <div className="cs-stile-row">
          <span className="cs-stile-label">Stile</span>
          <div className="cs-stile-options">
            {STILI.map(s => (
              <button key={s.id} className={`cs-stile-btn ${stile===s.id?'active':''}`} onClick={() => setStile(s.id)}>
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── SINGOLA ── */}
        {sezione === 'Singola' && (
          <div className="cs-form">
            <div className="cs-card">
              <div className="cs-card-label">Partita</div>
              <div className="cs-vs-row">
                <input placeholder="Squadra Casa" value={singola.squadraCasa} onChange={e=>updS('squadraCasa',e.target.value)} />
                <span className="cs-vs-badge">VS</span>
                <input placeholder="Squadra Ospite" value={singola.squadraOspite} onChange={e=>updS('squadraOspite',e.target.value)} />
              </div>
              <CompetitionSelect value={singola.competizioneId} onChange={id => { const f=COMPETITIONS.find(c=>c.id===id); updS('competizioneId',id); updS('competizioneLabel',f?.label||''); }} />
              {teamLogosUI}
            </div>
            <div className="cs-card">
              <div className="cs-card-label">Calciatori <span className="cs-optional">— opzionale</span></div>
              {playerInputUI(singola.giocatore1, v => updS('giocatore1', v))}
              <div className="cs-vs-row mt8">
                <input placeholder="Giocatore sinistra" value={singola.giocatore2} onChange={e=>updS('giocatore2',e.target.value)} />
                <input placeholder="Giocatore destra"   value={singola.giocatore3} onChange={e=>updS('giocatore3',e.target.value)} />
              </div>
            </div>
            <div className="cs-card">
              <div className="cs-card-label">Giocate</div>
              {singola.giocate.map((g,idx) => (
                <div key={idx} className="cs-giocata-row">
                  <span className="cs-row-num">{idx+1}</span>
                  <input placeholder="Tipo scommessa..." value={g.testo} onChange={e=>updSRow(idx,'testo',e.target.value)} className="cs-input-flex" />
                  <PresetSelect onSelect={val=>updSRow(idx,'testo',val)} />
                  <input placeholder="Quota" value={g.quota} onChange={e=>updSRow(idx,'quota',e.target.value)} className="cs-input-quota" type="number" step="0.01" min="1" />
                  {singola.giocate.length>1 && (
                    <button className="cs-remove-btn" onClick={()=>rmSRow(idx)}>
                      <X size={12} strokeWidth={2} aria-hidden="true"/>
                    </button>
                  )}
                </div>
              ))}
              <button className="cs-add-btn" onClick={addSRow}>+ Aggiungi giocata</button>
            </div>
            {singola.giocate.length>=2 && qtSingola && <QuotaBox label="QUOTA TOTALE" value={qtSingola} />}
          </div>
        )}

        {/* ── MULTIPLA ── */}
        {sezione === 'Multipla' && (
          <div className="cs-form">
            <div className="cs-card">
              <div className="cs-card-label">Calciatori protagonisti <span className="cs-optional">— opzionale</span></div>
              {sportsKey ? (
                <div className="cs-player-photo-row">
                  <PlayerSearch
                    apiKey={sportsKey}
                    value={multipla.giocatori}
                    onChange={v => updM('giocatori', v)}
                    placeholder="Cerca calciatore protagonista..."
                    onPhotoReady={handlePlayerPhotoReady}
                  />
                  <PhotoBtn />
                </div>
              ) : (
                <div className="cs-player-photo-row">
                  <input className="cs-input-flex" placeholder="Es. Lautaro, Vlahovic, Vinicius" value={multipla.giocatori} onChange={e=>updM('giocatori',e.target.value)} />
                  <PhotoBtn />
                </div>
              )}
              {descLoading && <div className="cs-desc-loading">GPT-4o analizza l'aspetto...</div>}
              {playerDesc && !descLoading && <div className="cs-desc-preview" title={playerDesc}>{playerDesc}</div>}
            </div>
            <div className="cs-card">
              <div className="cs-card-label">Giocate</div>
              {multipla.giocate.map((g,idx) => (
                <div key={idx} className="cs-giocata-block">
                  <div className="cs-giocata-block-top">
                    <span className="cs-row-num">{idx+1}</span>
                    {multipla.giocate.length>2 && (
                      <button className="cs-remove-btn" onClick={()=>rmMRow(idx)}>
                        <X size={12} strokeWidth={2} aria-hidden="true"/>
                      </button>
                    )}
                  </div>
                  <div className="cs-vs-row">
                    <input placeholder="Squadra Casa" value={g.squadraCasa} onChange={e=>updMRow(idx,'squadraCasa',e.target.value)} />
                    <span className="cs-vs-badge">VS</span>
                    <input placeholder="Ospite" value={g.squadraOspite} onChange={e=>updMRow(idx,'squadraOspite',e.target.value)} />
                  </div>
                  <div className="cs-vs-row mt8">
                    <input placeholder="Tipo scommessa..." value={g.pronostico} onChange={e=>updMRow(idx,'pronostico',e.target.value)} className="cs-input-flex" />
                    <PresetSelect onSelect={val=>updMRow(idx,'pronostico',val)} />
                    <input placeholder="Quota" value={g.quota} onChange={e=>updMRow(idx,'quota',e.target.value)} className="cs-input-quota" type="number" step="0.01" min="1" />
                  </div>
                </div>
              ))}
              <button className="cs-add-btn" onClick={addMRow}>+ Aggiungi giocata</button>
            </div>
            {qtMultipla && <QuotaBox label="QUOTA TOTALE" value={qtMultipla} />}
          </div>
        )}

        {/* ── LISTONE ── */}
        {sezione === 'Listone' && (
          <div className="cs-form">
            <div className="cs-card">
              <div className="cs-card-label">Partite</div>
              {listone.righe.map((r,idx) => (
                <div key={idx} className="cs-giocata-block">
                  <div className="cs-giocata-block-top">
                    <span className="cs-row-num">{idx+1}</span>
                    {listone.righe.length>2 && (
                      <button className="cs-remove-btn" onClick={()=>rmLRow(idx)}>
                        <X size={12} strokeWidth={2} aria-hidden="true"/>
                      </button>
                    )}
                  </div>
                  <div className="cs-vs-row">
                    <input placeholder="Squadra Casa" value={r.squadraCasa} onChange={e=>updLRow(idx,'squadraCasa',e.target.value)} />
                    <span className="cs-vs-badge">VS</span>
                    <input placeholder="Ospite" value={r.squadraOspite} onChange={e=>updLRow(idx,'squadraOspite',e.target.value)} />
                  </div>
                  <input className="cs-input-full mt8" placeholder="Data/Ora (es. 24/05 — 17:00)" value={r.dataOra} onChange={e=>updLRow(idx,'dataOra',e.target.value)} />
                  <div className="cs-vs-row mt8">
                    <input placeholder="Tipo scommessa..." value={r.pronostico} onChange={e=>updLRow(idx,'pronostico',e.target.value)} className="cs-input-flex" />
                    <PresetSelect onSelect={val=>updLRow(idx,'pronostico',val)} />
                    <select className="cs-select" value={r.etichetta} onChange={e=>updLRow(idx,'etichetta',e.target.value)}>
                      <option>OVER</option><option>UNDER</option><option>1</option><option>X</option><option>2</option><option>GG</option><option>NG</option>
                    </select>
                    <input placeholder="Quota" value={r.quota} onChange={e=>updLRow(idx,'quota',e.target.value)} className="cs-input-quota" type="number" step="0.01" min="1" />
                  </div>
                </div>
              ))}
              <button className="cs-add-btn" onClick={addLRow}>+ Aggiungi partita</button>
            </div>
            {qtListone && <QuotaBox label="QUOTA TOTALE" value={qtListone} />}
          </div>
        )}

        {/* ── CHICCA ── */}
        {sezione === 'Chicca' && (
          <div className="cs-form">
            <div className="cs-card">
              <div className="cs-card-label">Partita</div>
              <div className="cs-vs-row">
                <input placeholder="Squadra Casa" value={chicca.squadraCasa} onChange={e=>updC('squadraCasa',e.target.value)} />
                <span className="cs-vs-badge">VS</span>
                <input placeholder="Ospite" value={chicca.squadraOspite} onChange={e=>updC('squadraOspite',e.target.value)} />
              </div>
              <CompetitionSelect value={chicca.competizioneId} onChange={id => { const f=COMPETITIONS.find(c=>c.id===id); updC('competizioneId',id); updC('competizioneLabel',f?.label||''); }} />
              {teamLogosUI}
            </div>
            <div className="cs-card">
              <div className="cs-card-label">Giocatore protagonista <span className="cs-optional">— opzionale</span></div>
              {playerInputUI(chicca.giocatore1, v => updC('giocatore1', v))}
            </div>
            <div className="cs-card">
              <div className="cs-card-label">La Chicca</div>
              <div className="cs-giocata-row">
                <input placeholder="Es. Mbappé segna nel primo tempo" value={chicca.pronostico} onChange={e=>updC('pronostico',e.target.value)} className="cs-input-flex" />
                <input placeholder="Quota" value={chicca.quota} onChange={e=>updC('quota',e.target.value)} className="cs-input-quota" type="number" step="0.01" min="1" />
              </div>
            </div>
            {chicca.quota && parseFloat(chicca.quota)>1 && <QuotaBox label="QUOTA" value={parseFloat(chicca.quota).toFixed(2)} />}
          </div>
        )}

        {/* ── ANTEPOST ── */}
        {sezione === 'Antepost' && (
          <div className="cs-form">
            <div className="cs-card">
              <div className="cs-card-label">Competizione / Evento</div>
              <input className="cs-input-full" placeholder="Es. Champions League 2025/26, Mondiale 2026..." value={antepost.evento} onChange={e=>updA('evento',e.target.value)} />
            </div>
            <div className="cs-card">
              <div className="cs-card-label">Squadra / Giocatore protagonista</div>
              {playerInputUI(antepost.squadraGiocatore, v => updA('squadraGiocatore', v))}
            </div>
            <div className="cs-card">
              <div className="cs-card-label">Giocate Antepost</div>
              {antepost.giocate.map((g,idx) => (
                <div key={idx} className="cs-giocata-row">
                  <span className="cs-row-num">{idx+1}</span>
                  <input placeholder="Es. Portogallo raggiunge i Quarti" value={g.testo} onChange={e=>updARow(idx,'testo',e.target.value)} className="cs-input-flex" />
                  <input placeholder="Quota" value={g.quota} onChange={e=>updARow(idx,'quota',e.target.value)} className="cs-input-quota" type="number" step="0.01" min="1" />
                  {antepost.giocate.length>1 && (
                    <button className="cs-remove-btn" onClick={()=>rmARow(idx)}>
                      <X size={12} strokeWidth={2} aria-hidden="true"/>
                    </button>
                  )}
                </div>
              ))}
              <button className="cs-add-btn" onClick={addARow}>+ Aggiungi giocata</button>
            </div>
            {qtAntepost && <QuotaBox label="QUOTA TOTALE" value={qtAntepost} />}
          </div>
        )}

        <button className="cs-genera-btn" onClick={() => genera(false)} disabled={loading}>
          {loading
            ? <><Loader2 size={14} strokeWidth={1.5} className="cs-spin" aria-hidden="true"/> Generazione in corso (~20 sec)...</>
            : <><Sparkles size={14} strokeWidth={1.5} aria-hidden="true"/> Genera Grafica</>
          }
        </button>

        {error && <div className="cs-error">{error}</div>}
      </div>

      {/* ── Colonna destra (preview + post-gen) ── */}
      <div className={`cs-right ${imageUrl ? 'has-image' : ''}`}>
        {!imageUrl && !loading && (
          <div className="cs-preview-empty">
            <div className="cs-preview-placeholder">
              <Palette size={32} strokeWidth={1} aria-hidden="true"/>
              <p>La tua grafica apparirà qui</p>
              <small>Compila il form e clicca "Genera Grafica"</small>
            </div>
          </div>
        )}

        {loading && (
          <div className="cs-preview-empty">
            <div className="cs-preview-placeholder">
              <div className="cs-spinner" />
              <p>DALL-E sta generando la grafica...</p>
              <small>Circa 15–20 secondi</small>
            </div>
          </div>
        )}

        {imageUrl && (
          <div className="cs-preview-result">
            <img src={imageUrl} alt="Grafica generata" />
            {savedId && (
              <div className="cs-saved-notice">
                <Check size={12} strokeWidth={2.5} aria-hidden="true"/> Salvata automaticamente in archivio
              </div>
            )}

            <div className="cs-post-panel">
              <div className="cs-post-panel-title">
                <Pencil size={13} strokeWidth={1.5} aria-hidden="true"/> Modifica grafica
              </div>
              <textarea
                className="cs-feedback-textarea"
                placeholder="Es: rendi lo sfondo più scuro, aggiungi più contrasto nel testo..."
                value={feedback}
                onChange={e => setFeedback(e.target.value)}
                rows={3}
              />
              <div className="cs-post-actions-row">
                <button className="cs-btn-regen-feedback" onClick={() => genera(true)} disabled={loading || !feedback.trim()}>
                  <RotateCcw size={13} strokeWidth={1.5} aria-hidden="true"/> Rigenera con feedback
                </button>
                <button className="cs-btn-regen" onClick={() => genera(false)} disabled={loading}>
                  <RefreshCw size={13} strokeWidth={1.5} aria-hidden="true"/> Rigenera
                </button>
                <a href={imageUrl} download="grafica-du.png" className="cs-btn-download">
                  <Download size={13} strokeWidth={1.5} aria-hidden="true"/> Scarica
                </a>
              </div>
            </div>

            <div className="cs-post-panel">
              <div className="cs-post-panel-title">
                <Upload size={13} strokeWidth={1.5} aria-hidden="true"/> Pubblica
              </div>
              <div className="cs-publish-btns">
                <button className="cs-btn-platform" disabled>
                  <Camera size={14} strokeWidth={1.5}/><span>Instagram</span><span className="cs-platform-note">API non configurata</span>
                </button>
                <button className="cs-btn-platform" disabled>
                  <Music size={14} strokeWidth={1.5}/><span>TikTok</span><span className="cs-platform-note">API non configurata</span>
                </button>
              </div>
              <div className="cs-schedule-section">
                <div className="cs-post-panel-subtitle">
                  <Clock size={12} strokeWidth={1.5} aria-hidden="true"/> Programma pubblicazione
                </div>
                <div className="cs-schedule-row">
                  <input type="date" className="cs-schedule-input" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                  <input type="time" className="cs-schedule-input" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} />
                  <button className="cs-btn-schedule" onClick={handleSchedule} disabled={!scheduleDate || !scheduleTime || scheduled}>
                    {scheduled ? <><Check size={12} strokeWidth={2.5}/> Programmata</> : 'Programma'}
                  </button>
                </div>
                {scheduled && (
                  <div className="cs-scheduled-notice">
                    <Clock size={12} strokeWidth={1.5} aria-hidden="true"/> {new Date(`${scheduleDate}T${scheduleTime}`).toLocaleString('it-IT', { weekday:'short', day:'2-digit', month:'long', hour:'2-digit', minute:'2-digit' })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Input file nascosti ── */}
      <input ref={fileRef}        type="file" accept="image/*" style={{display:'none'}} onChange={handleImageUpload} />
      <input ref={playerPhotoRef} type="file" accept="image/*" style={{display:'none'}} onChange={handlePlayerPhotoUpload} />
    </div>
  );
}
