// Proxy per football-data.org — chiave gratuita, ~14.000 chiamate/giorno
const FD_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE   = 'https://api.football-data.org/v4';

function fdHeaders() {
  return { 'X-Auth-Token': FD_KEY };
}

// Mappa status football-data.org → formato API-Football usato dal frontend
function normalizeStatus(status, minute) {
  if (status === 'IN_PLAY') return (minute && minute > 45) ? '2H' : '1H';
  const map = {
    SCHEDULED: 'NS', TIMED: 'NS',
    PAUSED:    'HT',
    FINISHED:  'FT',
    POSTPONED: 'PST', SUSPENDED: 'SUSP', CANCELLED: 'CANC',
    EXTRA_TIME: 'ET', PENALTY: 'PEN', AWARDED: 'AW',
  };
  return map[status] || status;
}

// Converte un match football-data.org nel formato fixture API-Football
function normalizeMatch(m) {
  // Punteggio live: conta dai goal se in-play, altrimenti usa score
  let homeGoals = m.score?.fullTime?.home;
  let awayGoals = m.score?.fullTime?.away;
  if (homeGoals == null && Array.isArray(m.goals)) {
    homeGoals = m.goals.filter(g =>
      g.type === 'OWN_GOAL' ? g.team.id === m.awayTeam?.id : g.team.id === m.homeTeam?.id
    ).length;
    awayGoals = m.goals.filter(g =>
      g.type === 'OWN_GOAL' ? g.team.id === m.homeTeam?.id : g.team.id === m.awayTeam?.id
    ).length;
  }

  return {
    fixture: {
      id:     m.id,
      date:   m.utcDate,
      status: { short: normalizeStatus(m.status, m.minute), elapsed: m.minute ?? null },
    },
    league: {
      id:      m.competition?.id,
      name:    m.competition?.name || '',
      country: m.area?.name || '',
      logo:    m.competition?.emblem || '',
    },
    teams: {
      home: { id: m.homeTeam?.id, name: m.homeTeam?.name || '', logo: m.homeTeam?.crest || '' },
      away: { id: m.awayTeam?.id, name: m.awayTeam?.name || '', logo: m.awayTeam?.crest || '' },
    },
    goals: { home: homeGoals ?? null, away: awayGoals ?? null },
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  if (!FD_KEY) {
    return res.status(500).json({ error: 'FOOTBALL_DATA_API_KEY non configurata', response: [] });
  }

  const { date, team, search } = req.query;

  try {
    // ── Ricerca squadre per nome ──────────────────────────
    if (search) {
      const r = await fetch(`${BASE}/teams?name=${encodeURIComponent(search)}&limit=10`, { headers: fdHeaders() });
      const data = await r.json();
      // Normalizza al formato { team: { id, name, logo, country } } atteso dal frontend
      const response = (data.teams || []).map(t => ({
        team: {
          id:      t.id,
          name:    t.name,
          logo:    t.crest || '',
          country: t.area?.name || '',
        },
      }));
      return res.status(200).json({ response });
    }

    // ── Partite di una squadra nei prossimi 10 giorni ─────
    if (team) {
      const todayStr = new Date().toISOString().split('T')[0];
      const plusTen  = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      const r = await fetch(
        `${BASE}/teams/${encodeURIComponent(team)}/matches?dateFrom=${todayStr}&dateTo=${plusTen}&status=SCHEDULED,TIMED,IN_PLAY,PAUSED`,
        { headers: fdHeaders() }
      );
      const data = await r.json();
      return res.status(200).json({ response: (data.matches || []).map(normalizeMatch) });
    }

    // ── Partite per data ──────────────────────────────────
    if (date) {
      // Il generico /matches ignora le competizioni internazionali (WC, EC).
      // Chiamiamo in parallelo: endpoint generico + endpoint WC diretto.
      const FREE_COMPS = ['WC', 'EC', 'CL', 'EL', 'PL', 'BL1', 'SA', 'PD', 'FL1', 'DED', 'PPL', 'ELC', 'BSA', 'CLI'];
      const fetches = FREE_COMPS.map(code =>
        fetch(`${BASE}/competitions/${code}/matches?dateFrom=${date}&dateTo=${date}`, { headers: fdHeaders() })
          .then(r => r.json())
          .then(d => d.matches || [])
          .catch(() => [])
      );
      const results = await Promise.all(fetches);
      const allMatches = results.flat();
      // Deduplicazione per ID
      const seen = new Set();
      const unique = allMatches.filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; });
      return res.status(200).json({ response: unique.map(normalizeMatch) });
    }

    return res.status(400).json({ error: 'Parametro mancante (date, team o search)', response: [] });

  } catch (err) {
    return res.status(500).json({ error: err.message, response: [] });
  }
}
