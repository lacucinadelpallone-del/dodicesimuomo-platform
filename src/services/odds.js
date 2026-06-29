// TheOddsAPI — l'unica via legale per ottenere quote Bet365
// Registrati su https://the-odds-api.com/ (free: 500 req/mese)
// Poi incolla la tua API key nella pagina Quote Live

const BASE = 'https://api.the-odds-api.com/v4';

export const SPORT_OPTIONS = [
  { id: 'soccer_fifa_world_cup',      label: '🏆 Mondiale FIFA 2026' },
  { id: 'soccer_italy_serie_a',       label: 'Serie A' },
  { id: 'soccer_epl',                 label: 'Premier League' },
  { id: 'soccer_spain_la_liga',       label: 'LaLiga' },
  { id: 'soccer_france_ligue_one',    label: 'Ligue 1' },
  { id: 'soccer_germany_bundesliga',  label: 'Bundesliga' },
  { id: 'soccer_uefa_champs_league',  label: 'Champions League' },
  { id: 'soccer_uefa_europa_league',  label: 'Europa League' },
  { id: 'soccer_italy_coppa_italia',  label: 'Coppa Italia' },
];

// Carica i campionati di calcio con partite attive in questo momento
export async function fetchAvailableSports(apiKey) {
  const url = `${BASE}/sports?apiKey=${apiKey}&all=false`;
  const res = await fetch(url);
  if (res.status === 401) throw new Error('API key non valida');
  if (!res.ok) throw new Error(`Errore API: ${res.status}`);
  const data = await res.json();
  return data
    .filter(s => s.group === 'Soccer' && s.active && !s.has_outrights)
    .map(s => ({ id: s.key, label: s.title }));
}

// Fallback automatico: prova mercati completi → ridotti → solo 1X2
// Non tutti i campionati supportano btts/totals (es. fasi eliminatorie)
export async function fetchOdds(sportKey, apiKey) {
  const attempts = [
    'h2h,totals,btts',
    'h2h,totals',
    'h2h',
  ];

  for (const markets of attempts) {
    const url = `${BASE}/sports/${sportKey}/odds/?apiKey=${apiKey}&regions=uk,eu&markets=${markets}&dateFormat=iso`;
    const res = await fetch(url);
    if (res.status === 401) throw new Error('API key non valida');
    if (res.status === 422) continue; // mercato non supportato → prova il prossimo
    if (!res.ok) throw new Error(`Errore API: ${res.status}`);
    const data = await res.json();
    if (data.length > 0) return data;
    // risposta vuota → prova con mercati ridotti (a volte l'API risponde vuoto invece di 422)
  }

  return []; // nessuna quota disponibile per questa competizione
}

export function getApiKey() {
  return localStorage.getItem('du_odds_api_key')
    || import.meta.env.VITE_ODDS_KEY
    || '';
}

export function saveApiKey(key) {
  localStorage.setItem('du_odds_api_key', key);
}

// Bookmaker preferito: prima Bet365, poi il primo disponibile
export function getPreferredBook(match) {
  const books = match.bookmakers || [];
  return books.find(b => b.key === 'bet365') || books[0] || null;
}

// Estrae quote 1X2 da un bookmaker
export function extractH2H(book, match) {
  if (!book) return null;
  const market = book.markets?.find(m => m.key === 'h2h');
  if (!market) return null;
  const outcomes = market.outcomes || [];
  return {
    home: outcomes.find(o => o.name === match.home_team)?.price ?? null,
    draw: outcomes.find(o => o.name === 'Draw')?.price ?? null,
    away: outcomes.find(o => o.name === match.away_team)?.price ?? null,
  };
}

// Estrae Over/Under da un bookmaker
export function extractTotals(book) {
  if (!book) return [];
  const market = book.markets?.find(m => m.key === 'totals');
  if (!market) return [];
  // Raggruppa per punto (1.5, 2.5, 3.5...)
  const byPoint = {};
  for (const o of market.outcomes || []) {
    const pt = o.point;
    if (!byPoint[pt]) byPoint[pt] = {};
    byPoint[pt][o.name === 'Over' ? 'over' : 'under'] = o.price;
  }
  return Object.entries(byPoint)
    .sort(([a], [b]) => parseFloat(a) - parseFloat(b))
    .map(([point, odds]) => ({ point: parseFloat(point), ...odds }));
}

// Estrae GG/NG da un bookmaker
export function extractBtts(book) {
  if (!book) return null;
  const market = book.markets?.find(m => m.key === 'btts' || m.key === 'both_teams_to_score');
  if (!market) return null;
  const yes = market.outcomes?.find(o => o.name === 'Yes')?.price ?? null;
  const no  = market.outcomes?.find(o => o.name === 'No')?.price ?? null;
  return { yes, no };
}
