function getResult(fixture, teamId) {
  const { home, away } = fixture.goals;
  if (home === null || away === null) return '';
  const isHome = fixture.teams.home.id === teamId;
  const scored = isHome ? home : away;
  const conceded = isHome ? away : home;
  if (scored > conceded) return 'V';
  if (scored < conceded) return 'P';
  return 'N';
}

function resultColor(r) {
  if (r === 'V') return '#22c55e';
  if (r === 'P') return '#ef4444';
  return '#94a3b8';
}

export default function FixtureList({ fixtures, teamId }) {
  if (!fixtures?.length) return <p className="no-data">Nessun dato disponibile</p>;

  return (
    <div className="fixture-list">
      {fixtures.map(f => {
        const result = getResult(f, teamId);
        return (
          <div key={f.fixture.id} className="fixture-row">
            <span className="fixture-date">
              {new Date(f.fixture.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
            </span>
            <img src={f.teams.home.logo} alt="" width={20} />
            <span className="fixture-teams">
              {f.teams.home.name} <strong>{f.goals.home ?? '?'} - {f.goals.away ?? '?'}</strong> {f.teams.away.name}
            </span>
            <img src={f.teams.away.logo} alt="" width={20} />
            <span className="result-badge" style={{ background: resultColor(result) }}>
              {result || '-'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
