import { NavLink } from 'react-router-dom';
import { Layers, Archive, BarChart2, TrendingUp, Search, Bookmark, Wrench, Moon, Sun, Monitor, LogOut } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { isFirebaseConfigured } from '../services/firebase';
import { logout as localLogout } from '../services/auth';

const nav = [
  { path: '/content',    label: 'Content Studio', short: 'Studio',   Icon: Layers },
  { path: '/archivio',   label: 'Archivio',        short: 'Archivio', Icon: Archive },
  { path: '/quote',      label: 'Quote Live',      short: 'Quote',    Icon: BarChart2 },
  { path: '/gestionale', label: 'Gestionale',      short: 'Stats',    Icon: TrendingUp },
  { path: '/scout',      label: 'Scout Partite',   short: 'Scout',    Icon: Search },
  { path: '/strumenti',  label: 'Strumenti',       short: 'Tools',    Icon: Wrench },
];

const ThemeIcons = { notte: Moon, giorno: Sun, auto: Monitor };

function UserAvatar({ user }) {
  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)
    : user?.email?.[0]?.toUpperCase() ?? '?';

  if (user?.photoURL) {
    return <img src={user.photoURL} className="sidebar-avatar-img" alt={user.displayName}/>;
  }
  return <span className="sidebar-avatar-initials">{initials}</span>;
}

export default function Sidebar() {
  const { theme, cycle } = useTheme();
  const { user, logout: fbLogout } = useAuth();
  const ThemeIcon  = ThemeIcons[theme];
  const themeLabel = { notte: 'Notte', giorno: 'Giorno', auto: 'Auto' }[theme];

  function handleLogout() {
    if (isFirebaseConfigured() && fbLogout) fbLogout();
    else localLogout();
  }

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Utente';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logos/du-logo.png" alt="DodicesimoUomo" className="sidebar-logo-img"/>
      </div>

      <nav className="sidebar-nav">
        {nav.map(({ path, label, short, Icon }) => (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon size={16} strokeWidth={1.5} aria-hidden="true"/>
            <span className="nav-label">{label}</span>
            <span className="nav-label-short" aria-hidden="true">{short}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        {/* Utente loggato */}
        {user && (
          <div className="sidebar-user">
            <div className="sidebar-avatar">
              <UserAvatar user={user}/>
            </div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{displayName}</span>
              {user.email && <span className="sidebar-user-email">{user.email}</span>}
            </div>
          </div>
        )}

        <button className="sidebar-theme-btn" onClick={cycle} title={`Tema: ${themeLabel}`}>
          <ThemeIcon size={14} strokeWidth={1.5} aria-hidden="true"/>
          <span>{themeLabel}</span>
        </button>

        <button className="sidebar-logout-btn" onClick={handleLogout} title="Esci">
          <LogOut size={14} strokeWidth={1.5} aria-hidden="true"/>
          <span>Esci</span>
        </button>
      </div>
    </aside>
  );
}
