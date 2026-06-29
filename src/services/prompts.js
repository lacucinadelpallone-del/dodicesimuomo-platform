export const SEZIONI = ['Singola', 'Multipla', 'Listone', 'Chicca', 'Antepost'];

export const STILI = [
  { id: 'aggressiva', label: 'Aggressiva', emoji: '⚡' },
  { id: 'elegante',   label: 'Elegante',   emoji: '✨' },
  { id: 'cinematica', label: 'Cinematica', emoji: '🎬' },
  { id: 'cartoon',    label: 'Cartoon',    emoji: '🎨' },
];

// Istruzione fissa: DALL-E NON deve generare loghi — li aggiunge Canvas in post
const LOGO_RESERVED = `
ZONE RISERVATE — LASCIA COMPLETAMENTE VUOTE (sfondo scuro puro, zero testo/grafica):
  • Angolo alto sinistra 110×110px: riservato logo brand
  • Angolo alto destra 100×100px: riservato badge competizione
  • Angolo basso sinistra 85×85px: riservato logo squadra casa
  • Angolo basso destra 85×85px: riservato logo squadra ospite
Non disegnare MAI loghi, stemmi, badge o watermark in nessuna zona dell'immagine.`;

function styleBlock(stile) {
  switch (stile) {
    case 'aggressiva':
      return `STILE AGGRESSIVO NEON: sfondo notturno futuristico con effetti neon verde brillante, luce elettrica, scintille, fulmini digitali, energia da high-stakes betting. Colori: nero, verde neon, blu elettrico. Testo in verde neon con glow.`;
    case 'elegante':
      return `STILE ELEGANTE PREMIUM: sfondo scuro sofisticato (carbonio o marmo nero), luci dorate calde, pannelli vetro opaco con bordi dorati, bokeh. Atmosfera esclusiva Champions League VIP. Colori: nero profondo, oro #FFD700, bianco crema.`;
    case 'cinematica':
      return `STILE CINEMATICO EPICO: scena da film blockbuster sportivo, illustrazioni ultra-dettagliate in azione drammatica, stadio panoramico con cielo drammatico, luci volumetriche cinematografiche, coriandoli. Colori: rosso, oro, blu profondo.`;
    case 'cartoon':
      return `STILE CARTOON SPORTIVO: personaggi stile fumetto sportivo moderno, proporzioni esagerate, espressioni dinamiche, outline bold neri, colori piatti saturi, sfondo colorato con effetti fumetto. Stile FIFA Street.`;
    default:
      return '';
  }
}

export function buildPrompt(sezione, dati, stile = 'aggressiva') {
  if (sezione === 'Singola')  return buildSingola(dati, stile);
  if (sezione === 'Multipla') return buildMultipla(dati, stile);
  if (sezione === 'Listone')  return buildListone(dati, stile);
  if (sezione === 'Chicca')   return buildChicca(dati, stile);
  if (sezione === 'Antepost') return buildAntepost(dati, stile);
  return '';
}

function buildSingola({ squadraCasa, squadraOspite, competizione, giocatore1, giocatore2, giocatore3, playerDesc1, giocate, quotaTotale }, stile) {
  const giocateText = (giocate || [])
    .filter(g => g.testo)
    .map((g, i) => `  ${i + 1}. "${g.testo}"${g.quota ? ` — @${g.quota}` : ''}`)
    .join('\n');

  const player1Line = giocatore1
    ? `— Calciatore protagonista al centro in primo piano: "${giocatore1}"${playerDesc1 ? `. ASPETTO FISICO DA RIPRODURRE FEDELMENTE: ${playerDesc1}` : ', riproduci il suo aspetto reale il più possibile'}`
    : '— Due calciatori generici in azione ai lati';

  const player23 = [giocatore2, giocatore3].filter(Boolean);

  return `POSTER SPORTIVO PREMIUM Instagram 1:1 (1024×1024px), qualità 8K, tipografia ultra-leggibile.

${styleBlock(stile)}
${LOGO_RESERVED}

LAYOUT:
— Titolo in alto centro: "LA NOSTRA" (piccolo) + "SINGOLA" (ENORME, stile graffiti/brush)
${competizione ? `— Nome competizione nel pannello info: "${competizione}"` : ''}
${player1Line}
${player23.length > 0 ? `— Calciatori secondari ai lati: ${player23.join(', ')}` : ''}
— Panel centrale trasparente con bordi luminosi: "${squadraCasa || 'Squadra Casa'} VS ${squadraOspite || 'Squadra Ospite'}"
— Giocate nel panel:
${giocateText || '  1. [tipo scommessa]'}
${quotaTotale ? `— In basso ENORME con massimo contrasto: "QUOTA TOTALE" + "${quotaTotale}"` : ''}

REGOLE ASSOLUTE: ogni testo perfettamente leggibile, composizione simmetrica.`;
}

function buildMultipla({ giocatori, playerDesc1, giocate, quotaTotale }, stile) {
  const giocateText = (giocate || [])
    .filter(g => g.squadraCasa || g.squadraOspite)
    .map((g, i) => `  ${i + 1}. ${g.squadraCasa} vs ${g.squadraOspite} — ${g.pronostico}${g.quota ? ` @${g.quota}` : ''}`)
    .join('\n');

  const playerLine = giocatori
    ? `— Calciatori protagonisti: "${giocatori}"${playerDesc1 ? `. Aspetto di riferimento: ${playerDesc1}` : ''}`
    : '— Tre calciatori generici in azione';

  return `POSTER SPORTIVO PREMIUM Instagram 1:1 (1024×1024px), qualità 8K.

${styleBlock(stile)}
${LOGO_RESERVED}

LAYOUT:
— Titolo: "LA NOSTRA" (piccolo) + "MULTIPLA" (ENORME)
${playerLine}
— Panel centrale con lista giocate:
${giocateText || '  [lista giocate]'}
${quotaTotale ? `— In basso ENORME: "QUOTA TOTALE" + "${quotaTotale}"` : ''}

REGOLE: tutti i testi leggibili, composizione bilanciata.`;
}

function buildListone({ righe, quotaTotale }, stile) {
  const righeText = (righe || [])
    .filter(r => r.squadraCasa || r.squadraOspite)
    .map((r, i) =>
      `  ${i + 1}. ${r.squadraCasa} vs ${r.squadraOspite}${r.dataOra ? ' (' + r.dataOra + ')' : ''} | ${r.pronostico} | ${r.etichetta}${r.quota ? ` | @${r.quota}` : ''}`
    ).join('\n');

  return `POSTER SPORTIVO PREMIUM Instagram 1:1 (1024×1024px), qualità 8K.

${styleBlock(stile)}
${LOGO_RESERVED}

LAYOUT:
— Titolo ENORME: "IL NOSTRO LISTONE"
— Due calciatori decorativi ai lati (semi-trasparenti)
— TABELLA CENTRALE grande con righe alternate e bordi luminosi:
  Colonne: [Partita] [Tipo scommessa] [Esito] [Quota]
${righeText || '  [righe partite]'}
${quotaTotale ? `— In basso ENORME: "QUOTA TOTALE" + "${quotaTotale}"` : ''}

REGOLE: tabella ordinata, ogni riga leggibile.`;
}

function buildChicca({ squadraCasa, squadraOspite, competizione, giocatore1, playerDesc1, pronostico, quota }, stile) {
  const playerLine = giocatore1
    ? `— Giocatore protagonista in primo piano: "${giocatore1}"${playerDesc1 ? `. Aspetto da riprodurre: ${playerDesc1}` : ''}`
    : '— Calciatore misterioso in primo piano';

  return `POSTER SPORTIVO PREMIUM Instagram 1:1 (1024×1024px), qualità 8K.

${styleBlock(stile)}
${LOGO_RESERVED}

LAYOUT:
— Titolo: "LA" (piccolo) + "CHICCA" (ENORME con icona lucchetto dorato)
${competizione ? `— Competizione nel pannello: "${competizione}"` : ''}
${playerLine}
${squadraCasa && squadraOspite ? `— Partita: "${squadraCasa} VS ${squadraOspite}"` : ''}
— Panel esclusivo/segreto: "${pronostico || '[la chicca]'}"
${quota ? `— In basso ENORME: "QUOTA" + "${quota}"` : ''}

REGOLE: atmosfera esclusiva e misteriosa.`;
}

function buildAntepost({ evento, squadraGiocatore, playerDesc1, giocate, quotaTotale }, stile) {
  const giocateText = (giocate || [])
    .filter(g => g.testo)
    .map((g, i) => `  ${i + 1}. "${g.testo}"${g.quota ? ` @${g.quota}` : ''}`)
    .join('\n');

  const playerLine = squadraGiocatore
    ? `— Protagonista: "${squadraGiocatore}"${playerDesc1 ? `. Aspetto: ${playerDesc1}` : ''}`
    : '— Protagonista generico';

  return `POSTER SPORTIVO PREMIUM Instagram 1:1 (1024×1024px), qualità 8K.

${styleBlock(stile)}
${LOGO_RESERVED}

LAYOUT:
— Titolo: "IL NOSTRO" (piccolo) + "ANTEPOST" (ENORME)
— Trofeo/coppa gigante al centro in primo piano
${playerLine}
— Badge evento: "${evento || '[competizione]'}"
— Panel giocate antepost:
${giocateText || '  [pronostici]'}
${quotaTotale ? `— In basso ENORME: "QUOTA TOTALE" + "${quotaTotale}"` : ''}

REGOLE: atmosfera epica da grande competizione.`;
}
