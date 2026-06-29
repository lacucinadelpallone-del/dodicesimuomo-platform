import { db } from './firebase';
import { auth } from './firebase';
import {
  collection, addDoc, getDocs, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore';

function userCol(sub) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Utente non autenticato');
  return collection(db, 'users', uid, sub);
}

export async function archiveSave(entry) {
  const ref = await addDoc(userCol('archivio'), {
    ...entry,
    savedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function archiveGetAll() {
  const q = query(userCol('archivio'), orderBy('savedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function archiveUpdate(id, patch) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Utente non autenticato');
  await updateDoc(doc(db, 'users', uid, 'archivio', id), patch);
}

export async function archiveDelete(id) {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Utente non autenticato');
  await deleteDoc(doc(db, 'users', uid, 'archivio', id));
}
