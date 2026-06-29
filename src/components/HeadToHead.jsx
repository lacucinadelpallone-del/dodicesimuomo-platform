export default function HeadToHead({ fixtures, homeId, awayId }) {
  if (!fixtures?.length) return <p className="no-data">Nessun precedente disponibile</p>;

  let homeWins = 0, awayWins = 0, draws = 0;
  fixtures.forEach(f => {
    const { home, away } = f.goals;
    if (home === null || away === null) return;
    if (home > away) {
      if (f.teams.home.id === homeId) homeWins++;
      else awayWins++;
    } else if (away > home) {
      if (f.teams.away.id === homeId) homeWins++;
      else awayWins++;
    } else {
      draws++;
    }
  });

  const home = fixtures[0]?.teams.home.id === homeId ? fixtures[0]?.teams.home : fixtures[0]?.teams.away;
  const away = fixtures[0]?.teams.home.id === awayId ? fixtures[0]?.teams.home : fixtures[0]?.teams.away;

  return (
    <div className="h2h">
      <div className="h2h-summary">
        <div className="h2h-stat">
          <span className="h2h-num" style={{ color: '#22c55e' }}>{homeWins}</span>
          <span>Vittorie {home?.name}</span>
        </div>
        <div className="h2h-stat">
          <span className="h2h-num" style={{ color: '#94a3b8' }}>{draws}</span>
          <span>Pareggi</span>
        </div>
        <div className="h2h-stat">
          <span className="h2h-num" style={{ color: '#ef4444' }}>{awayWins}</span>
          <span>Vittorie {away?.name}</span>
        </div>
      </div>

      <div className="fixture-list">
        {fixtures.map(f => (
          <div key={f.fixture.id} className="fixture-row">
            <span className="fixture-date">
              {new Date(f.fixture.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            </span>
            <img src={f.teams.home.logo} alt="" width={20} />
            <span className="fixture-teams">
              {f.teams.home.name} <strong>{f.goals.home ?? '?'} - {f.goals.away ?? '?'}</strong> {f.teams.away.name}
            </span>
            <img src={f.teams.away.logo} alt="" width={20} />
          </div>
        ))}
      </div>
    </div>
  );
}
