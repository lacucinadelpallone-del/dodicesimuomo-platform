const SYSTEM_PROMPT = `You are a professional sports betting translator and analyst. Convert Italian betting picks/descriptions to English for the US/UK market.

Rules:
1. Translate naturally and professionally
2. Convert ALL European decimal odds to American Moneyline:
   - Decimal >= 2.0: positive → +((decimal-1)*100), e.g. 2.50 → +150
   - Decimal < 2.0: negative → -(100/(decimal-1)), e.g. 1.70 → -143
   Always show both: e.g. "Arsenal Win +150 (2.50)"
3. Use correct English betting terms:
   - Singola → Single | Multipla/Combo → Parlay | Giocata/Pronostico → Pick/Play
   - Quota → Odds | Gol → Goal | 1X2 → Match Result | GG/NG → BTTS Yes/No
   - Handicap asiatico → Asian Handicap | Antepost → Futures | Listone → Multi Card
   - Chicca → Value Pick | Over/Under stays as Over/Under
4. Keep team/player names unchanged
5. Output ONLY the translated English text`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Testo mancante' });

  const key = process.env.VITE_OPENAI_KEY || process.env.OPENAI_KEY;
  if (!key) return res.status(500).json({ error: 'API key non configurata' });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    return res.status(200).json({ result: data.choices[0].message.content.trim() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
