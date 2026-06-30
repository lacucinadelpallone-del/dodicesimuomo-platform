import { db } from './firebase';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, onSnapshot,
} from 'firebase/firestore';

// Collezioni condivise su Firestore — tutti i collaboratori vedono gli stessi dati
const GIOCATE_COL     = 'giocate';
const TRANSAZIONI_COL = 'transazioni';

// ─── GIOCATE ─────────────────────────────────────────

export async function giocataAdd(entry) {
  const ref = await addDoc(collection(db, GIOCATE_COL), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function giocataUpdate(id, patch) {
  await updateDoc(doc(db, GIOCATE_COL, id), patch);
}

export async function giocataDelete(id) {
  await deleteDoc(doc(db, GIOCATE_COL, id));
}

export function giocateListen(callback) {
  const q = query(collection(db, GIOCATE_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── TRANSAZIONI ─────────────────────────────────────

export async function transazioneAdd(entry) {
  const ref = await addDoc(collection(db, TRANSAZIONI_COL), {
    ...entry,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function transazioneDelete(id) {
  await deleteDoc(doc(db, TRANSAZIONI_COL, id));
}

export function transazioniListen(callback) {
  const q = query(collection(db, TRANSAZIONI_COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── CALCOLI (invariati — funzioni pure sui dati) ─────

export function calcAdvancedStats(giocate) {
  const sorted = [...giocate]
    .filter(g => g.risultato !== 'pending')
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
  let peak = 0, maxDrawdown = 0, cum = 0;
  let totalQuota = 0, quotaCount = 0;
  let totalStake = 0, maxStake = 0, stakeCount = 0;
  let bestProfit = 0, worstLoss = 0;

  sorted.forEach(g => {
    const stake = parseFloat(g.stake) || 0;
    const quota = parseFloat(g.quota) || 0;

    if (g.risultato !== 'void') {
      if (quota > 0) { totalQuota += quota; quotaCount++; }
      totalStake += stake; stakeCount++;
      if (stake > maxStake) maxStake = stake;
    }

    let p = 0;
    if (g.risultato === 'won') {
      p = stake * (quota - 1);
      curWin++; curLoss = 0;
      if (curWin > maxWinStreak) maxWinStreak = curWin;
      if (p > bestProfit) bestProfit = p;
    } else if (g.risultato === 'lost') {
      p = -stake;
      curLoss++; curWin = 0;
      if (curLoss > maxLossStreak) maxLossStreak = curLoss;
      if (p < worstLoss) worstLoss = p;
    } else {
      curWin = 0; curLoss = 0;
    }

    cum += p;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  return {
    maxWinStreak, maxLossStreak,
    maxDrawdown: +maxDrawdown.toFixed(2),
    avgStake: stakeCount > 0 ? +(totalStake / stakeCount).toFixed(2) : 0,
    maxStake: +maxStake.toFixed(2),
    avgQuota: quotaCount > 0 ? +(totalQuota / quotaCount).toFixed(3) : 0,
    bestProfit: +bestProfit.toFixed(2),
    worstLoss: +Math.abs(worstLoss).toFixed(2),
  };
}

export function calcDailyCumulative(giocate) {
  const closed = giocate
    .filter(g => g.risultato !== 'pending')
    .sort((a, b) => (a.data || '').localeCompare(b.data || ''));

  const byDay = {};
  closed.forEach(g => {
    const date = g.data || '';
    if (!byDay[date]) byDay[date] = 0;
    const stake = parseFloat(g.stake) || 0;
    const quota = parseFloat(g.quota) || 0;
    if (g.risultato === 'won') byDay[date] += stake * (quota - 1);
    else if (g.risultato === 'lost') byDay[date] -= stake;
  });

  let cum = 0;
  return Object.entries(byDay).sort().map(([date, p]) => {
    cum += p;
    return { date, value: +cum.toFixed(2) };
  });
}

export function calcStats(giocate) {
  const chiuse = giocate.filter(g => g.risultato !== 'pending');
  const vinte  = giocate.filter(g => g.risultato === 'won');
  const perse  = giocate.filter(g => g.risultato === 'lost');
  const void_  = giocate.filter(g => g.risultato === 'void');

  const totalStaked = chiuse
    .filter(g => g.risultato !== 'void')
    .reduce((s, g) => s + (parseFloat(g.stake) || 0), 0);

  const profit = chiuse.reduce((s, g) => {
    const stake = parseFloat(g.stake) || 0;
    const quota = parseFloat(g.quota) || 0;
    if (g.risultato === 'won')  return s + stake * (quota - 1);
    if (g.risultato === 'lost') return s - stake;
    return s;
  }, 0);

  const roi = totalStaked > 0 ? (profit / totalStaked) * 100 : 0;
  const strikeRate = (vinte.length + perse.length) > 0
    ? (vinte.length / (vinte.length + perse.length)) * 100 : 0;

  const pendingStaked = giocate
    .filter(g => g.risultato === 'pending')
    .reduce((s, g) => s + (parseFloat(g.stake) || 0), 0);

  return {
    totali: giocate.length, chiuse: chiuse.length,
    vinte: vinte.length, perse: perse.length,
    void: void_.length, pending: giocate.filter(g => g.risultato === 'pending').length,
    profit: +profit.toFixed(2),
    pendingStaked: +pendingStaked.toFixed(2),
    roi: +roi.toFixed(1),
    strikeRate: +strikeRate.toFixed(1),
    totalStaked: +totalStaked.toFixed(2),
  };
}

export function calcDailyCassa(transazioni) {
  const sorted = [...transazioni].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  const byDay = {};
  sorted.forEach(t => {
    const date = t.data || '';
    if (!byDay[date]) byDay[date] = 0;
    const importo = parseFloat(t.importo) || 0;
    if (t.tipo === 'entrata') byDay[date] += importo;
    else byDay[date] -= importo;
  });
  let cum = 0;
  return Object.entries(byDay).sort().map(([date, p]) => {
    cum += p;
    return { date, value: +cum.toFixed(2) };
  });
}

export function calcByBookmaker(giocate) {
  const map = {};
  giocate.filter(g => g.bookmaker && g.risultato !== 'pending').forEach(g => {
    const bk = g.bookmaker;
    if (!map[bk]) map[bk] = { totali: 0, vinte: 0, profit: 0, staked: 0 };
    const stake = parseFloat(g.stake) || 0;
    const quota = parseFloat(g.quota) || 0;
    map[bk].totali++;
    if (g.risultato !== 'void') map[bk].staked += stake;
    if (g.risultato === 'won')       { map[bk].vinte++; map[bk].profit += stake * (quota - 1); }
    else if (g.risultato === 'lost') { map[bk].profit -= stake; }
  });
  return Object.entries(map).map(([name, s]) => ({
    name, totali: s.totali, vinte: s.vinte,
    profit: +s.profit.toFixed(2),
    roi: s.staked > 0 ? +((s.profit / s.staked) * 100).toFixed(1) : 0,
    sr: s.totali > 0 ? +((s.vinte / s.totali) * 100).toFixed(1) : 0,
  })).sort((a, b) => b.profit - a.profit);
}

export function calcFinanze(transazioni) {
  const entrate      = transazioni.filter(t => t.tipo === 'entrata').reduce((s, t) => s + (parseFloat(t.importo) || 0), 0);
  const uscite       = transazioni.filter(t => t.tipo === 'uscita').reduce((s, t) => s + (parseFloat(t.importo) || 0), 0);
  const investimenti = transazioni.filter(t => t.tipo === 'investimento').reduce((s, t) => s + (parseFloat(t.importo) || 0), 0);
  const saldo = entrate - uscite - investimenti;
  return {
    entrate: +entrate.toFixed(2), uscite: +uscite.toFixed(2),
    investimenti: +investimenti.toFixed(2), saldo: +saldo.toFixed(2),
  };
}
