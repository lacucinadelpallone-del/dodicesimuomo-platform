import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, User, Mail, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasPassword, isAuthed, createPassword, checkPassword } from '../services/auth';
import { isFirebaseConfigured } from '../services/firebase';

/* ── Gate principale ─────────────────────────────────── */
export default function AuthGate({ children }) {
  const { user, fbReady } = useAuth();

  // Firebase configurato → usa Firebase auth
  if (isFirebaseConfigured()) {
    if (user === undefined) return <LoadingScreen />;
    if (!user)              return <FirebaseAuthScreen />;
    return children;
  }

  // Firebase non configurato → fallback password locale
  return <LocalAuthGate>{children}</LocalAuthGate>;
}

/* ── Loading ─────────────────────────────────────────── */
function LoadingScreen() {
  return (
    <div className="auth-screen">
      <div className="auth-loading">
        <div className="cs-spinner" style={{ width: 28, height: 28 }}/>
      </div>
    </div>
  );
}

/* ── Firebase Auth Screen ─────────────────────────────── */
function FirebaseAuthScreen() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="/logos/du-logo.png" alt="DodicesimoUomo" className="auth-logo"/>
        <div className="auth-brand">
          <h1 className="auth-title">DodicesimoUomo</h1>
          <p className="auth-sub">La tua piattaforma tipster</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            Accedi
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            Registrati
          </button>
        </div>

        {mode === 'login'    && <LoginForm    onSwitch={() => setMode('register')}/>}
        {mode === 'register' && <RegisterForm onSwitch={() => setMode('login')}/>}
      </div>
    </div>
  );
}

/* ── Form Login ──────────────────────────────────────── */
function LoginForm({ onSwitch }) {
  const { login, loginGoogle } = useAuth();
  const [email,   setEmail]   = useState('');
  const [pwd,     setPwd]     = useState('');
  const [show,    setShow]    = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  async function handleEmail(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, pwd);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setGLoading(true);
    try {
      await loginGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(friendlyError(err.code));
    } finally { setGLoading(false); }
  }

  return (
    <>
      <GoogleBtn onClick={handleGoogle} loading={gLoading}/>
      <Divider/>
      <form className="auth-form" onSubmit={handleEmail}>
        <InputField icon={Mail} type="email" placeholder="Email" value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }} required/>
        <PasswordField placeholder="Password" value={pwd}
          onChange={e => { setPwd(e.target.value); setError(''); }}
          show={show} onToggle={() => setShow(v => !v)}/>
        {error && <AuthError msg={error}/>}
        <AuthBtn loading={loading} disabled={!email || !pwd}>Accedi</AuthBtn>
      </form>
    </>
  );
}

/* ── Form Registrazione ──────────────────────────────── */
function RegisterForm({ onSwitch }) {
  const { register, loginGoogle } = useAuth();
  const [nome,    setNome]    = useState('');
  const [email,   setEmail]   = useState('');
  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [show,    setShow]    = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [gLoading, setGLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    if (pwd.length < 6)    { setError('Password minimo 6 caratteri'); return; }
    if (pwd !== confirm)   { setError('Le password non coincidono');   return; }
    setLoading(true);
    try {
      await register(nome.trim(), email, pwd);
    } catch (err) {
      setError(friendlyError(err.code));
    } finally { setLoading(false); }
  }

  async function handleGoogle() {
    setError(''); setGLoading(true);
    try {
      await loginGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') setError(friendlyError(err.code));
    } finally { setGLoading(false); }
  }

  return (
    <>
      <GoogleBtn onClick={handleGoogle} loading={gLoading}/>
      <Divider/>
      <form className="auth-form" onSubmit={handleRegister}>
        <InputField icon={User} type="text" placeholder="Nome e cognome" value={nome}
          onChange={e => { setNome(e.target.value); setError(''); }} required/>
        <InputField icon={Mail} type="email" placeholder="Email" value={email}
          onChange={e => { setEmail(e.target.value); setError(''); }} required/>
        <PasswordField placeholder="Password (min 6 caratteri)" value={pwd}
          onChange={e => { setPwd(e.target.value); setError(''); }}
          show={show} onToggle={() => setShow(v => !v)}/>
        <PasswordField placeholder="Conferma password" value={confirm}
          onChange={e => { setConfirm(e.target.value); setError(''); }}
          show={show} onToggle={() => setShow(v => !v)}/>
        {error && <AuthError msg={error}/>}
        <AuthBtn loading={loading} disabled={!nome || !email || !pwd || !confirm}>
          Crea account
        </AuthBtn>
      </form>
    </>
  );
}

/* ── Fallback auth locale (Firebase non configurato) ─── */
function LocalAuthGate({ children }) {
  const [authed, setAuthed] = useState(isAuthed);
  if (authed) return children;
  return <LocalLoginScreen onSuccess={() => setAuthed(true)}/>;
}

function LocalLoginScreen({ onSuccess }) {
  const setup = !hasPassword();
  const [pwd,     setPwd]     = useState('');
  const [confirm, setConfirm] = useState('');
  const [show,    setShow]    = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      if (setup) {
        if (pwd.length < 4) { setError('Minimo 4 caratteri'); return; }
        if (pwd !== confirm) { setError('Le password non coincidono'); return; }
        await createPassword(pwd);
        onSuccess();
      } else {
        const ok = await checkPassword(pwd);
        if (ok) onSuccess();
        else    setError('Password errata');
      }
    } finally { setLoading(false); }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="/logos/du-logo.png" alt="DodicesimoUomo" className="auth-logo"/>
        <div className="auth-brand">
          <h1 className="auth-title">DodicesimoUomo</h1>
          <p className="auth-sub">
            {setup ? 'Crea una password per proteggere la piattaforma' : 'Inserisci la password per accedere'}
          </p>
        </div>
        <form className="auth-form" onSubmit={handleSubmit} style={{ width:'100%' }}>
          <PasswordField placeholder={setup ? 'Crea password' : 'Password'} value={pwd}
            onChange={e => { setPwd(e.target.value); setError(''); }}
            show={show} onToggle={() => setShow(v => !v)}/>
          {setup && (
            <PasswordField placeholder="Conferma password" value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(''); }}
              show={show} onToggle={() => setShow(v => !v)}/>
          )}
          {error && <AuthError msg={error}/>}
          <AuthBtn loading={loading} disabled={!pwd || (setup && !confirm)}>
            {setup ? 'Crea accesso' : 'Accedi'}
          </AuthBtn>
        </form>
        {!isFirebaseConfigured() && (
          <p className="auth-hint">
            <AlertCircle size={11}/> Firebase non configurato — accesso locale attivo
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Sub-componenti riutilizzabili ───────────────────── */

function GoogleBtn({ onClick, loading }) {
  return (
    <button type="button" className="auth-google-btn" onClick={onClick} disabled={loading}>
      {loading ? (
        <div className="cs-spinner" style={{ width:16, height:16 }}/>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      )}
      Continua con Google
    </button>
  );
}

function Divider() {
  return (
    <div className="auth-divider">
      <span/>
      <span className="auth-divider-text">oppure</span>
      <span/>
    </div>
  );
}

function InputField({ icon: Icon, type, placeholder, value, onChange, required }) {
  return (
    <div className="auth-input-wrap">
      <Icon size={14} strokeWidth={1.5} className="auth-icon-left" aria-hidden="true"/>
      <input
        className="auth-input"
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
      />
    </div>
  );
}

function PasswordField({ placeholder, value, onChange, show, onToggle }) {
  return (
    <div className="auth-input-wrap">
      <Lock size={14} strokeWidth={1.5} className="auth-icon-left" aria-hidden="true"/>
      <input
        className="auth-input"
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
      <button type="button" className="auth-eye-btn" onClick={onToggle} aria-label="Mostra/nascondi">
        {show ? <EyeOff size={14}/> : <Eye size={14}/>}
      </button>
    </div>
  );
}

function AuthBtn({ children, loading, disabled }) {
  return (
    <button className="auth-btn" type="submit" disabled={loading || disabled}>
      {loading
        ? <div className="cs-spinner" style={{ width:16, height:16 }}/>
        : <><ArrowRight size={16} strokeWidth={2}/> {children}</>
      }
    </button>
  );
}

function AuthError({ msg }) {
  return <div className="auth-error"><AlertCircle size={12}/> {msg}</div>;
}

function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':  'Email già registrata. Prova ad accedere.',
    'auth/invalid-email':         'Email non valida.',
    'auth/weak-password':         'Password troppo debole (min 6 caratteri).',
    'auth/user-not-found':        'Nessun account con questa email.',
    'auth/wrong-password':        'Password errata.',
    'auth/invalid-credential':    'Email o password errati.',
    'auth/too-many-requests':     'Troppi tentativi. Riprova più tardi.',
    'auth/network-request-failed':'Errore di rete. Controlla la connessione.',
    'auth/popup-blocked':         'Popup bloccato. Abilita i popup per questo sito.',
  };
  return map[code] || 'Si è verificato un errore. Riprova.';
}
