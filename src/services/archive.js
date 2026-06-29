import { db } from './firebase';
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, onSnapshot,
} from 'firebase/firestore';

// Collezione condivisa — tutti i collaboratori vedono gli stessi dati
const COL = 'archivio';

export async function archiveSave(entry) {
  const ref = await addDoc(collection(db, COL), {
    ...entry,
    savedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function archiveGetAll() {
  const q = query(collection(db, COL), orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Listener real-time — aggiorna automaticamente quando qualcuno aggiunge qualcosa
export function archiveListen(callback) {
  const q = query(collection(db, COL), orderBy('savedAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function archiveUpdate(id, patch) {
  await updateDoc(doc(db, COL, id), patch);
}

export async function archiveDelete(id) {
  await deleteDoc(doc(db, COL, id));
}
