const SYSTEM_PROMPT = `Sei un lettore esperto di scontrini di scommesse sportive italiane.
Riconosci e leggi due formati principali:

FORMATO ePlay24 (app scura con header blu):
- "Importo pagato:" = stake (puntata)
- "Vincita potenziale" = ritorno totale
- "Quota totale :" = quota combinata
- Stato: "DA NON PAGARE" → risultato "lost" | "DA PAGARE" → "won" | "VENDUTO" → "pending"
- Data: "Giocata del: GG/MM/AAAA HH:MM"

FORMATO Sisal (scontrino bianco "Il Mio Tip" o condivisione social scura):
- "Puntata" = stake
- "Vincita potenziale" = ritorno totale
- "Quota" (in alto a destra) = quota combinata
- "Tip non vincente!" → risultato "lost" | nessun banner → "pending" | "Tip vincente!" → "won"
- Data: "giocato il GG/MM/AAAA" oppure "Scade il GG/MM/AAAA"

REGOLE GENERALI:
- Se ci sono più selezioni (eventi) nella giocata → tipo "Multipla"
- Se c'è una sola selezione → tipo "Singola"
- quota = possibileRitorno / stake (se non esplicita, calcolala)
- Le virgole nei numeri italiani sono decimali: 35,35 € = 35.35
- Se lo stake non è visibile (es. condivisione social senza puntata), usa null

Restituisci SOLO un oggetto JSON valido, senza markdown, senza testo prima o dopo:
{
  "tipo": "Singola" oppure "Multipla",
  "bookmaker": "ePlay24" oppure "Sisal" oppure altro nome esatto,
  "stake": numero decimale oppure null,
  "possibileRitorno": numero decimale oppure null,
  "quota": numero decimale a 2 cifre oppure null,
  "descrizione": "eventi e mercati, max 200 caratteri",
  "data": "AAAA-MM-GG" (dalla data visibile sullo scontrino, formato ISO) oppure null,
  "risultato": "pending" oppure "won" oppure "lost"
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { imageBase64, mediaType } = req.body || {};
  if (!imageBase64 || !mediaType) {
    return res.status(400).json({ error: 'Immagine mancante' });
  }

  const key = process.env.ANTHROPIC_KEY;
  if (!key) return res.status(500).json({ error: 'API key non configurata' });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(mediaType)) {
    return res.status(400).json({ error: `Formato non supportato: ${mediaType}` });
  }

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
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            {
              type: 'text',
              text: 'Leggi questo scontrino e restituisci il JSON.',
            },
          ],
        }],
      }),
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw   = data.content?.[0]?.text?.trim() || '';
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return res.status(500).json({
        error: 'Risposta AI non interpretabile. Prova con un\'immagine più nitida.',
        raw,
      });
    }

    const stake  = parsed.stake            != null ? parseFloat(parsed.stake)            : null;
    const ret    = parsed.possibileRitorno != null ? parseFloat(parsed.possibileRitorno) : null;
    let   quota  = parsed.quota            != null ? parseFloat(parsed.quota)            : null;

    // Ricalcola quota da stake/ritorno se mancante o incoerente
    if (stake && ret && (quota == null || Math.abs(quota - ret / stake) > 0.05)) {
      quota = +(ret / stake).toFixed(2);
    }

    // Valida e normalizza la data ISO
    let dataISO = null;
    if (parsed.data && /^\d{4}-\d{2}-\d{2}$/.test(parsed.data)) {
      dataISO = parsed.data;
    }

    const risultatoValidi = ['pending', 'won', 'lost'];
    const risultato = risultatoValidi.includes(parsed.risultato) ? parsed.risultato : 'pending';

    return res.status(200).json({
      tipo:             ['Singola','Multipla','Chicca','Antepost'].includes(parsed.tipo) ? parsed.tipo : 'Multipla',
      bookmaker:        parsed.bookmaker   || '',
      stake,
      possibileRitorno: ret,
      quota,
      descrizione:      parsed.descrizione || '',
      data:             dataISO,
      risultato,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
