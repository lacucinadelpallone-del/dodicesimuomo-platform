// API-Football (api-sports.io) — loghi squadre + foto calciatori
// Piano free: 100 richieste/giorno
// Registrazione: https://dashboard.api-football.com/register

const BASE = '/sportsapi';

const SEASON = new Date().getMonth() < 7
  ? new Date().getFullYear() - 1
  : new Date().getFullYear();

export function getSportsKey() {
  return localStorage.getItem('du_sports_key') || import.meta.env.VITE_SPORTS_KEY || '';
}

export function saveSportsKey(key) {
  localStorage.setItem('du_sports_key', key);
}

function makeHeaders(apiKey) {
  return { 'x-apisports-key': apiKey };
}

// API-Football restituisce errors:[] (array vuoto) quando tutto va bene
// → non basta controllare if(data.errors), bisogna controllare se ha elementi
function hasErrors(errors) {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === 'object') return Object.keys(errors).length > 0;
  return false;
}

function extractErrorMessage(errors) {
  if (!errors) return '';
  if (Array.isArray(errors)) return errors.join(', ');
  if (typeof errors === 'object') {
    return Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(' | ');
  }
  return String(errors);
}

// Converte URL media API-Football → URL proxied (stesso dominio → no CORS su Canvas)
export function proxyImgUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname === 'media.api-sports.io') return `/imgproxy${u.pathname}`;
  } catch (_) {}
  return url;
}

// Scarica immagine via proxy → data URL (per Canvas overlay)
export async function imgToDataUrl(originalUrl) {
  const proxied = proxyImgUrl(originalUrl);
  const res = await fetch(proxied);
  if (!res.ok) throw new Error(`Errore immagine: ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Verifica la key chiamando /status
export async function checkApiKey(apiKey) {
  const res = await fetch(`${BASE}/status`, { headers: makeHeaders(apiKey) });
  let data = {};
  try { data = await res.json(); } catch (_) {}

  // errors:[] = nessun errore; errors:{token:"..."} = key non valida
  if (!res.ok || hasErrors(data.errors)) {
    const msg = extractErrorMessage(data.errors) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data.response || {};
}

// Cerca squadre per nome
export async function searchTeams(query, apiKey) {
  if (!query || query.length < 2) return [];
  const res = await fetch(`${BASE}/teams?search=${encodeURIComponent(query)}`, { headers: makeHeaders(apiKey) });
  let data = {};
  try { data = await res.json(); } catch (_) {}

  if (!res.ok || hasErrors(data.errors)) {
    const msg = extractErrorMessage(data.errors) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return (data.response || []).map(r => ({
    id: r.team.id,
    name: r.team.name,
    country: r.team.country || '',
    logo: r.team.logo,
    logoProxy: proxyImgUrl(r.team.logo),
  }));
}

// Cerca calciatori per nome — /players richiede season (piano gratuito)
export async function searchPlayers(query, apiKey) {
  if (!query || query.length < 3) return [];
  const res = await fetch(
    `${BASE}/players?search=${encodeURIComponent(query)}&season=${SEASON}`,
    { headers: makeHeaders(apiKey) }
  );
  let data = {};
  try { data = await res.json(); } catch (_) {}

  if (!res.ok || hasErrors(data.errors)) {
    const msg = extractErrorMessage(data.errors) || `HTTP ${res.status}`;
    throw new Error(msg);
  }

  // Deduplica: stesso giocatore può apparire in più campionati
  const seen = new Set();
  return (data.response || [])
    .filter(r => {
      if (seen.has(r.player.id)) return false;
      seen.add(r.player.id);
      return true;
    })
    .map(r => ({
      id: r.player.id,
      name: r.player.name,
      nationality: r.player.nationality || '',
      photo: r.player.photo,
      photoProxy: proxyImgUrl(r.player.photo),
    }));
}
