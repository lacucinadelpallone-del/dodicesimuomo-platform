const KEY = import.meta.env.VITE_OPENAI_KEY;

export async function generateImage(prompt) {
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'high',
    }),
  });
  const data = await res.json();
  console.log('OpenAI response:', JSON.stringify(data).slice(0, 500));
  if (data.error) throw new Error(data.error.message);
  if (data.data[0].url) return data.data[0].url;
  if (data.data[0].b64_json) return `data:image/png;base64,${data.data[0].b64_json}`;
}

export async function describePlayer(base64Image) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Descrivi in dettaglio l\'aspetto fisico del calciatore in questa foto per un prompt DALL-E. Includi: carnagione, capelli (colore, lunghezza, stile), corporatura, tratti distintivi del viso. Massimo 60 parole, in italiano, senza citare il nome.',
          },
          {
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
        ],
      }],
      max_tokens: 150,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content.trim();
}

const TRANSLATION_PROMPT = `You are a professional sports betting translator and analyst. Convert Italian betting picks/descriptions to English for the US/UK market.

Rules:
1. Translate naturally and professionally
2. Convert ALL European decimal odds to American Moneyline:
   - Decimal ≥ 2.0 → positive: +((decimal−1)×100), e.g. 2.50 → +150
   - Decimal < 2.0 → negative: −(100÷(decimal−1)), e.g. 1.70 → −143
   Always show both: "Arsenal Win +150 (2.50)"
3. Use correct English betting terms:
   - Singola → Single | Multipla/Combo → Parlay | Giocata/Pronostico → Pick/Play
   - Quota → Odds | Gol → Goal | 1X2 → Match Result | GG/NG → BTTS Yes/No
   - Handicap asiatico → Asian Handicap | Antepost → Futures | Listone → Multi Card
   - Chicca → Value Pick | Over/Under stays as Over/Under
4. Keep team/player names unchanged
5. Output ONLY the translated English text`;

export async function translateBettingText(text) {
  if (!KEY) throw new Error('OpenAI key non configurata');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: TRANSLATION_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.choices[0].message.content.trim();
}

export async function extractFromImage(base64Image) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analizza questa immagine di una schedina o di un pronostico sportivo ed estrai le informazioni.
Rispondi SOLO con un JSON con questi campi (lascia vuoto "" se non trovi l'info):
{
  "squadraCasa": "",
  "squadraOspite": "",
  "pronostico1": "",
  "esito1": "✅",
  "pronostico2": "",
  "esito2": "✅",
  "quota": "",
  "eventi": [
    { "squadraCasa": "", "squadraOspite": "", "pronostico": "", "quota": "" }
  ]
}
Il campo "eventi" serve se ci sono più partite (multipla). Il campo "quota" è la quota totale finale.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 500,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const text = data.choices[0].message.content;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Impossibile leggere i dati dall\'immagine');
  return JSON.parse(jsonMatch[0]);
}
