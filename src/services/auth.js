const PWD_KEY  = 'du_pwd_hash';
const SESS_KEY = 'du_session';

async function sha256(str) {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(str + '::du2025::salt')
  );
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const hasPassword = () => !!localStorage.getItem(PWD_KEY);
export const isAuthed    = () => sessionStorage.getItem(SESS_KEY) === '1';

export async function createPassword(pwd) {
  localStorage.setItem(PWD_KEY, await sha256(pwd));
  sessionStorage.setItem(SESS_KEY, '1');
}

export async function checkPassword(pwd) {
  const hash = await sha256(pwd);
  if (hash !== localStorage.getItem(PWD_KEY)) return false;
  sessionStorage.setItem(SESS_KEY, '1');
  return true;
}

export function logout() {
  sessionStorage.removeItem(SESS_KEY);
  window.location.reload();
}

export function resetPassword() {
  localStorage.removeItem(PWD_KEY);
  logout();
}
