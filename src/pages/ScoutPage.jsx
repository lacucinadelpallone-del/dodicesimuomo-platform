import { useState, useEffect } from 'react';
import { COMPETITIONS, getFixturesByLeague, getRounds, getTeamFixtures, getHeadToHead } from '../services/footballApi';
import FixtureList from '../components/FixtureList';
import HeadToHead from '../components/HeadToHead';

export default function ScoutPage() {
  const [selectedLeague, setSelectedLeague] = useState(COMPETITIONS[0]);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [selectedFixture, setSelectedFixture] = useState(null);
  const [homeFixtures, setHomeFixtures] = useState([]);
  const [awayFixtures, setAwayFixtures] = useState([]);
  const [h2h, setH2h] = useState([]);
  const [loadingFixtures, setLoadingFixtures] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    loadRounds(selectedLeague.id);
  }, [selectedLeague]);

  async function loadRounds(leagueId) {
    setFixtures([]);
    setSelectedFixture(null);
    setSelectedRound(null);
    const data = await getRounds(leagueId);
    setRounds(data);
    if (data.length > 0) {
      const lastPlayed = data[data.length - 5] || data[data.length - 1];
      setSelectedRound(lastPlayed);
      loadFixtures(leagueId, lastPlayed);
    }
  }

  async function loadFixtures(leagueId, round) {
    setLoadingFixtures(true);
    setSelectedFixture(null);
    const data = await getFixturesByLeague(leagueId, round);
    setFixtures(data);
    setLoadingFixtures(false);
  }

  async function selectFixture(fixture) {
    setSelectedFixture(fixture);
    setHomeFixtures([]);
    setAwayFixtures([]);
    setH2h([]);
    setLoadingDetail(true);
    const homeId = fixture.teams.home.id;
    const awayId = fixture.teams.away.id;
    const [home, away, h2hData] = await Promise.all([
      getTeamFixtures(homeId),
      getTeamFixtures(awayId),
      getHeadToHead(homeId, awayId),
    ]);
    setHomeFixtures(home);
    setAwayFixtures(away);
    setH2h(h2hData);
    setLoadingDetail(false);
  }

  function handleRoundChange(round) {
    setSelectedRound(round);
    loadFixtures(selectedLeague.id, round);
  }

  return (
    <div className="scout-layout">
      {/* Colonna sinistra: competizioni */}
      <aside className="competitions-panel">
        <h3>Competizioni</h3>
        {COMPETITIONS.map(c => (
          <button
            key={c.id}
            className={`comp-btn ${selectedLeague.id === c.id ? 'active' : ''}`}
            onClick={() => setSelectedLeague(c)}
          >
            <span>{c.flag}</span>
            <span>{c.name}</span>
          </button>
        ))}
      </aside>

      {/* Colonna centrale: partite */}
      <div className="fixtures-panel">
        <div className="fixtures-header">
          <h2>{selectedLeague.flag} {selectedLeague.name}</h2>
          {rounds.length > 0 && (
            <select
              value={selectedRound || ''}
              onChange={e => handleRoundChange(e.target.value)}
              className="round-select"
            >
              {rounds.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}
        </div>

        {loadingFixtures ? (
          <div className="loading">Carico partite...</div>
        ) : (
          <div className="fixture-cards">
            {fixtures.map(f => (
              <button
                key={f.fixture.id}
                className={`fixture-card ${selectedFixture?.fixture.id === f.fixture.id ? 'active' : ''}`}
                onClick={() => selectFixture(f)}
              >
                <span className="fc-date">
                  {new Date(f.fixture.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                  {' '}
                  {new Date(f.fixture.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <div className="fc-teams">
                  <span className="fc-team">
                    <img src={f.teams.home.logo} alt="" width={18} />
                    {f.teams.home.name}
                  </span>
                  <span className="fc-score">
                    {f.goals.home !== null ? `${f.goals.home} - ${f.goals.away}` : 'vs'}
                  </span>
                  <span className="fc-team away">
                    {f.teams.away.name}
                    <img src={f.teams.away.logo} alt="" width={18} />
                  </span>
                </div>
                <span className={`fc-status ${f.fixture.status.short === 'FT' ? 'finished' : 'upcoming'}`}>
                  {f.fixture.status.short === 'FT' ? 'Finita' : f.fixture.status.long}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Colonna destra: dettaglio partita */}
      <div className="detail-panel">
        {!selectedFixture && (
          <div className="detail-empty">
            <p>Seleziona una partita per vedere l'analisi</p>
          </div>
        )}

        {selectedFixture && (
          <>
            <div className="detail-header">
              <img src={selectedFixture.teams.home.logo} alt="" width={32} />
              <span>{selectedFixture.teams.home.name}</span>
              <span className="vs">VS</span>
              <span>{selectedFixture.teams.away.name}</span>
              <img src={selectedFixture.teams.away.logo} alt="" width={32} />
            </div>

            {loadingDetail ? (
              <div className="loading">Carico analisi...</div>
            ) : (
              <div className="detail-sections">
                <section>
                  <h4>Ultime 5 — {selectedFixture.teams.home.name}</h4>
                  <FixtureList fixtures={homeFixtures} teamId={selectedFixture.teams.home.id} />
                </section>
                <section>
                  <h4>H2H</h4>
                  <HeadToHead fixtures={h2h} homeId={selectedFixture.teams.home.id} awayId={selectedFixture.teams.away.id} />
                </section>
                <section>
                  <h4>Ultime 5 — {selectedFixture.teams.away.name}</h4>
                  <FixtureList fixtures={awayFixtures} teamId={selectedFixture.teams.away.id} />
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
