const API_KEY = import.meta.env.VITE_API_FOOTBALL_KEY;
const BASE_URL = 'https://v3.football.api-sports.io';
const SEASON = 2024; // aggiornare a 2025 quando si upgrada il piano

const headers = { 'x-apisports-key': API_KEY };

export const COMPETITIONS = [
  { id: 135, name: 'Serie A',           flag: '🇮🇹' },
  { id: 39,  name: 'Premier League',    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 140, name: 'La Liga',           flag: '🇪🇸' },
  { id: 78,  name: 'Bundesliga',        flag: '🇩🇪' },
  { id: 61,  name: 'Ligue 1',           flag: '🇫🇷' },
  { id: 2,   name: 'Champions League',  flag: '⭐' },
  { id: 3,   name: 'Europa League',     flag: '🟠' },
];

export async function getFixturesByLeague(leagueId, round = null) {
  let url = `${BASE_URL}/fixtures?league=${leagueId}&season=${SEASON}`;
  if (round) url += `&round=${encodeURIComponent(round)}`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  return data.response || [];
}

export async function getRounds(leagueId) {
  const res = await fetch(`${BASE_URL}/fixtures/rounds?league=${leagueId}&season=${SEASON}`, { headers });
  const data = await res.json();
  return data.response || [];
}

export async function getFixtureDetails(fixtureId) {
  const [stats, lineups, events] = await Promise.all([
    fetch(`${BASE_URL}/fixtures/statistics?fixture=${fixtureId}`, { headers }).then(r => r.json()),
    fetch(`${BASE_URL}/fixtures/lineups?fixture=${fixtureId}`, { headers }).then(r => r.json()),
    fetch(`${BASE_URL}/fixtures/events?fixture=${fixtureId}`, { headers }).then(r => r.json()),
  ]);
  return {
    stats: stats.response || [],
    lineups: lineups.response || [],
    events: events.response || [],
  };
}

export async function getTeamFixtures(teamId, count = 5) {
  const res = await fetch(
    `${BASE_URL}/fixtures?team=${teamId}&season=${SEASON}&from=2024-08-01&to=2025-06-30`,
    { headers }
  );
  const data = await res.json();
  const finished = (data.response || []).filter(f => f.fixture.status.short === 'FT');
  return finished.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date)).slice(0, count);
}

export async function getHeadToHead(team1Id, team2Id, count = 5) {
  const res = await fetch(
    `${BASE_URL}/fixtures/headtohead?h2h=${team1Id}-${team2Id}&from=2020-01-01&to=2025-06-30`,
    { headers }
  );
  const data = await res.json();
  const finished = (data.response || []).filter(f => f.fixture.status.short === 'FT');
  return finished.sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date)).slice(0, count);
}
