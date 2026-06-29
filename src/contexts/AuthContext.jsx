import { createContext, useContext, useState, useEffect } from 'react';
import {
  onAuthStateChanged, signOut,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signInWithPopup, updateProfile,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../services/firebase';

const AuthCtx = createContext();

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(undefined); // undefined = loading
  const [fbReady, setFbReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) { setFbReady(false); setUser(null); return; }
    setFbReady(true);
    const unsub = onAuthStateChanged(auth, u => setUser(u ?? null));
    return unsub;
  }, []);

  async function register(nome, email, password) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: nome });
    setUser({ ...cred.user, displayName: nome });
  }

  async function login(email, password) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function loginGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    await signOut(auth);
  }

  return (
    <AuthCtx.Provider value={{ user, fbReady, register, login, loginGoogle, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
