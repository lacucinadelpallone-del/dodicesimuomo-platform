import { queryDocs, addDoc, updateDoc, arrayUnion } from './_firestore.js';

function normalizeMatchStatus(status, minute) {
  if (status === 'IN_PLAY') return (minute && minute > 45) ? '2H' : '1H';
  const map = { PAUSED: 'HT', FINISHED: 'FT', EXTRA_TIME: 'ET', PENALTY: 'PEN', AWARDED: 'AW' };
  return map[status] || status;
}

function computeGoals(match, side) {
  const teamId = side === 'home' ? match.homeTeam?.id : match.awayTeam?.id;
  const oppId  = side === 'home' ? match.awayTeam?.id : match.homeTeam?.id;
  if (!Array.isArray(match.goals)) return 0;
  return match.goals.filter(g =>
    g.type === 'OWN_GOAL' ? g.team.id === oppId : g.team.id === teamId
  ).length;
}

const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT = process.env.TELEGRAM_ADMIN_CHAT_ID;
const GROUP_CHAT = process.env.TELEGRAM_GROUP_CHAT_ID;
const NOTIFY_CHAT = GROUP_CHAT || ADMIN_CHAT;
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID;
const FD_KEY     = process.env.FOOTBALL_DATA_API_KEY;

// ── Costruttori messaggi ──────────────────────────────

function buildEventMessage(event, fixture, monitoring) {
  const home  = fixture.teams.home.name;
  const away  = fixture.teams.away.name;
  const hGoal = fixture.goals.home ?? 0;
  const aGoal = fixture.goals.away ?? 0;
  const score = `${hGoal} - ${aGoal}`;
  const min   = event.time.elapsed;
  const pick  = monitoring.pick;

  const eventTeamIsHome = event.team.id === fixture.teams.home.id;
  const pickIsHome  = pick === '1';
  const pickIsAway  = pick === '2';
  const pickIsOver  = pick?.toLowerCase().startsWith('over');
  const pickIsGG    = pick?.toLowerCase() === 'gg';

  let isFavorable = false;
  if (event.type === 'Goal') {
    if (pickIsHome && eventTeamIsHome)  isFavorable = true;
    if (pickIsAway && !eventTeamIsHome) isFavorable = true;
    if (pickIsOver) isFavorable = (hGoal + aGoal) > 0;
    if (pickIsGG)   isFavorable = true;
  }
  if (event.type === 'Card' && event.detail === 'Red Card') {
    if (pickIsHome && !eventTeamIsHome) isFavorable = true;
    if (pickIsAway && eventTeamIsHome)  isFavorable = true;
  }

  const scorer = event.player?.name || '';

  if (event.type === 'Goal') {
    return {
      channelMsg: isFavorable
        ? `⚽ GOOOLLL ${event.team.name.toUpperCase()}!!\n${home} ${score} ${away} • ${min}'\n\n🟢 La nostra giocata è IN GREEN!\n${scorer ? `Marcatore: ${scorer} 💪` : '💪💪💪'}`
        : `😤 Gol subito...\n${home} ${score} ${away} • ${min}'\n\nNon molliamo ragazzi, ci siamo ancora! 💪🔥`,
      privateMsg: isFavorable
        ? `⚽ GOAL A FAVORE!\n${home} ${score} ${away} • ${min}'\n${scorer ? `Marcatore: ${scorer}` : ''}\n\n📤 Messaggio pronto per il canale`
        : `⚠️ Goal contro...\n${home} ${score} ${away} • ${min}'\n\n📤 Messaggio pronto per il canale`,
    };
  }

  if (event.type === 'Card' && event.detail === 'Red Card') {
    const cardTeam = event.team.name;
    return {
      channelMsg: isFavorable
        ? `🟥 ROSSO per ${cardTeam}!! In 10!\n${home} ${score} ${away} • ${min}'\n\n🟢 Siamo favoriti adesso! Spingiamo!! 💪🔥`
        : `🟥 Rosso per ${cardTeam}...\n${home} ${score} ${away} • ${min}'\n\nForza ragazzi, teniamo duro!! 💪`,
      privateMsg: `🟥 Espulsione ${cardTeam}\n${home} ${score} ${away} • ${min}'\n\n📤 Messaggio pronto per il canale`,
    };
  }

  if (event.type === 'Penalty') {
    const penTeam  = event.team.name;
    const penScore = event.detail === 'Penalty Missed' ? 'SBAGLIATO ❌' : 'SEGNATO ✅';
    return {
      channelMsg: `⚪ RIGORE ${penScore} — ${penTeam}\n${home} ${score} ${away} • ${min}'\n\nForza!! 🔥`,
      privateMsg: `⚪ Rigore ${penScore} ${penTeam}\n${home} ${score} ${away} • ${min}'\n\n📤 Messaggio pronto per il canale`,
    };
  }

  return null;
}

function buildFinalMessage(fixture, monitoring) {
  const home  = fixture.teams.home.name;
  const away  = fixture.teams.away.name;
  const hGoal = fixture.goals.home ?? 0;
  const aGoal = fixture.goals.away ?? 0;
  const pick  = monitoring.pick;
  const score = `${hGoal} - ${aGoal}`;

  let won = null;
  if (pick === '1') won = hGoal > aGoal;
  if (pick === '2') won = aGoal > hGoal;
  if (pick === 'X') won = hGoal === aGoal;
  if (pick?.toLowerCase().startsWith('over')) {
    const threshold = parseFloat(pick.split(' ')[1] || '2.5');
    won = (hGoal + aGoal) > threshold;
  }
  if (pick?.toLowerCase() === 'gg') won = hGoal > 0 && aGoal > 0;

  const stake = parseFloat(monitoring.stake) || 0;
  const quota = parseFloat(monitoring.quota) || 0;
  const profitStr = won && stake && quota
    ? `+${(stake * (quota - 1)).toFixed(2)}€`
    : won === false ? `-${stake.toFixed(2)}€` : '';

  if (won === true) {
    return {
      channelMsg: `✅ FINITA! ABBIAMOOOO VINTO!!\n${home} ${score} ${away} • FT\n\n🏆 GIOCATA VINTA${profitStr ? ` ${profitStr} @${quota}` : ''}!\n🔥🔥🔥`,
      won: true,
    };
  }
  if (won === false) {
    return {
      channelMsg: `❌ Non è andata...\n${home} ${score} ${away} • FT\n\nCi riprendiamo presto ragazzi ❤️\nBuonanotte a tutti 💪`,
      won: false,
    };
  }
  return {
    channelMsg: `🏁 FINITA!\n${home} ${score} ${away} • FT`,
    won: null,
  };
}

// ── Telegram helpers ──────────────────────────────────

async function tgSend(chatId, text, extra = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
}

async function tgNotifyAdmin(privateMsg, channelMsg, pendingId) {
  const keyboard = {
    inline_keyboard: [[
      { text: '✅ INVIA AL CANALE', callback_data: `send:${pendingId}` },
      { text: '✏️ Modifica',        callback_data: `modify:${pendingId}` },
      { text: '❌ Ignora',          callback_data: `ignore:${pendingId}` },
    ]],
  };
  await tgSend(
    NOTIFY_CHAT,
    `${privateMsg}\n\n<b>Messaggio per il canale:</b>\n<blockquote>${channelMsg}</blockquote>`,
    { reply_markup: keyboard },
  );
}

// ── Main handler ──────────────────────────────────────

export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // 1. Leggi partite monitorate attive da Firestore via REST
  const monitorings = await queryDocs('live_monitoring', 'status', 'EQUAL', 'active');

  if (monitorings.length === 0) {
    return res.status(200).json({ checked: 0 });
  }

  const results = [];

  for (const monitoring of monitorings) {
    try {
      // 2. Dati live da football-data.org
      const r = await fetch(
        `https://api.football-data.org/v4/matches/${monitoring.fixtureId}`,
        { headers: { 'X-Auth-Token': FD_KEY } },
      );
      const match = await r.json();
      if (!match || match.error) continue;

      // Normalizza al formato usato nel resto del handler
      const statusShort = normalizeMatchStatus(match.status, match.minute);
      const homeGoals = computeGoals(match, 'home');
      const awayGoals = computeGoals(match, 'away');
      const fixture = {
        fixture: { status: { short: statusShort } },
        teams:   {
          home: { id: match.homeTeam?.id, name: match.homeTeam?.name },
          away: { id: match.awayTeam?.id, name: match.awayTeam?.name },
        },
        goals: { home: homeGoals, away: awayGoals },
      };

      // Converti goals + bookings in eventi normalizzati
      const events = [
        ...(match.goals || []).map(g => ({
          time:   { elapsed: g.minute },
          type:   'Goal',
          detail: 'Normal Goal',
          team:   g.team,
          player: g.scorer ? { id: g.scorer.id, name: g.scorer.name } : null,
        })),
        ...(match.bookings || []).filter(b => b.card === 'RED_CARD').map(b => ({
          time:   { elapsed: b.minute },
          type:   'Card',
          detail: 'Red Card',
          team:   b.team,
          player: b.player,
        })),
      ];

      const notified = Array.isArray(monitoring.notifiedEvents) ? monitoring.notifiedEvents : [];

      // 3. Nuovi eventi rilevanti
      const newEvents = events.filter(ev => {
        const evId = `${ev.time.elapsed}_${ev.type}_${ev.team.id}_${ev.player?.id || 0}`;
        return !notified.includes(evId);
      });

      // 4. Notifica admin per ogni nuovo evento
      for (const ev of newEvents) {
        const msgs = buildEventMessage(ev, fixture, monitoring);
        if (!msgs) continue;

        const evId = `${ev.time.elapsed}_${ev.type}_${ev.team.id}_${ev.player?.id || 0}`;

        const pendingId = await addDoc('pending_notifications', {
          channelMsg:   msgs.channelMsg,
          monitoringId: monitoring.id,
          eventId:      evId,
          status:       'pending',
          createdAt:    new Date().toISOString(),
        });

        await tgNotifyAdmin(msgs.privateMsg, msgs.channelMsg, pendingId);
        await arrayUnion('live_monitoring', monitoring.id, 'notifiedEvents', evId);

        results.push({ fixture: monitoring.fixtureId, event: evId });
      }

      // 5. Partita finita: messaggio finale e chiudi monitoring
      const finalStatuses = ['FT', 'AET', 'PEN'];
      if (finalStatuses.includes(statusShort) && !monitoring.finalSent) {
        const finalMsgs = buildFinalMessage(fixture, monitoring);

        const pendingId = await addDoc('pending_notifications', {
          channelMsg:   finalMsgs.channelMsg,
          monitoringId: monitoring.id,
          eventId:      'final',
          status:       'pending',
          createdAt:    new Date().toISOString(),
        });

        await tgNotifyAdmin(
          `🏁 PARTITA FINITA\n${fixture.teams.home.name} ${fixture.goals.home} - ${fixture.goals.away} ${fixture.teams.away.name}`,
          finalMsgs.channelMsg,
          pendingId,
        );

        await updateDoc('live_monitoring', monitoring.id, {
          status:    'completed',
          finalSent: true,
        });
      }

    } catch (err) {
      console.error(`Errore fixture ${monitoring.fixtureId}:`, err.message);
    }
  }

  return res.status(200).json({ checked: monitorings.length, events: results });
}
