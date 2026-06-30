const SYSTEM_PROMPT = `Sei un esperto di bankroll management professionale nelle scommesse sportive.
Parla come un consulente diretto e concreto, non un professore. Niente bullet list ridondanti — rispondi in 3-4 paragrafi densi e utili, in italiano.
Non aggiungere disclaimer generici sulla responsabilità del gioco. Vai subito al sodo con dati reali.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { stats, adv, bankroll, riskProfile, kellyF, kellyStake } = req.body;
  const key = process.env.ANTHROPIC_KEY;
  if (!key) return res.status(500).json({ error: 'API key non configurata' });

  const closed   = (stats.vinte || 0) + (stats.perse || 0);
  const profilo  = { conservativo: '¼ Kelly (25%)', moderato: '½ Kelly (50%)', aggressivo: 'Kelly pieno (100%)' };

  const userMsg = `Analizza il mio bankroll e dammi consigli pratici.

DATI PERFORMANCE (${closed} tip chiuse):
- Strike Rate: ${stats.strikeRate}%
- ROI: ${stats.roi}%
- Profitto netto totale: ${stats.profit}€
- Quota media: ${adv.avgQuota}
- Puntata media: ${adv.avgStake}€  |  Puntata max: ${adv.maxStake}€
- Drawdown massimo: -${adv.maxDrawdown}€
- Serie perdite max: ${adv.maxLossStreak} consecutive
- Miglior tip: +${adv.bestProfit}€  |  Peggior perdita: -${adv.worstLoss}€

BANKROLL CORRENTE: ${bankroll ? bankroll + '€' : 'non impostato'}
PROFILO RISCHIO SCELTO: ${profilo[riskProfile] || riskProfile}
KELLY FRACTION: ${kellyF !== null && kellyF !== undefined ? (kellyF * 100).toFixed(1) + '%' : 'non calcolabile (dati insufficienti)'}
STAKE KELLY CONSIGLIATO: ${kellyStake ? kellyStake.toFixed(2) + '€' : 'n.d.'}

Rispondimi su:
1. Il mio profilo di rischio attuale è sostenibile dato il drawdown e le perdite consecutive?
2. La dimensione media delle puntate rispetto al bankroll è corretta?
3. Cosa dovrei cambiare concretamente nella gestione del money management?
4. Vedo segnali di tilt o overbet nei miei dati?`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.status(200).json({ advice: data.content[0].text.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
