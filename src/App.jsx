import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Moon, Sun, Monitor, Layers, Archive, BarChart2, TrendingUp, Search, Bookmark } from 'lucide-react';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import AuthGate from './components/AuthGate';
import Sidebar from './components/Sidebar';
import ScoutPage from './pages/ScoutPage';
import ContentPage from './pages/ContentPage';
import ArchivePage from './pages/ArchivePage';
import QuoteLivePage from './pages/QuoteLivePage';
import AnalyticsPage from './pages/AnalyticsPage';
import './App.css';

const ThemeIcons = { notte: Moon, giorno: Sun, auto: Monitor };

function ThemeFab() {
  const { theme, cycle } = useTheme();
  const Icon = ThemeIcons[theme];
  return (
    <button className="theme-fab" onClick={cycle} aria-label="Cambia tema">
      <Icon size={16} strokeWidth={1.5}/>
    </button>
  );
}

function Placeholder({ title }) {
  return (
    <div className="placeholder-page">
      <h1>{title}</h1>
      <p>Modulo in costruzione...</p>
    </div>
  );
}

const mobileNavItems = [
  { path: '/content',    short: 'Studio',   Icon: Layers },
  { path: '/archivio',   short: 'Archivio', Icon: Archive },
  { path: '/quote',      short: 'Quote',    Icon: BarChart2 },
  { path: '/gestionale', short: 'Stats',    Icon: TrendingUp },
  { path: '/scout',      short: 'Scout',    Icon: Search },
  { path: '/trend',      short: 'Trend',    Icon: Bookmark },
];

function MobileTopbar() {
  return (
    <div className="mobile-topbar">
      <div className="mobile-topbar-inner">
        <img src="/logos/du-logo.png" alt="DodicesimoUomo" className="mobile-topbar-logo"/>
        <span className="mobile-topbar-name">Dodicesimo<b>Uomo</b></span>
      </div>
    </div>
  );
}

function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav">
      {mobileNavItems.map(({ path, short, Icon }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
        >
          <Icon size={20} strokeWidth={1.5}/>
          <span>{short}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <BrowserRouter>
            <div className="app-layout">
              <MobileTopbar />
              <MobileBottomNav />
              <Sidebar />
              <ThemeFab />
              <main className="main-content">
                <Routes>
                  <Route path="/"           element={<Navigate to="/content" replace />} />
                  <Route path="/scout"      element={<ScoutPage />} />
                  <Route path="/trend"      element={<Placeholder title="Memoria Trend" />} />
                  <Route path="/quote"      element={<QuoteLivePage />} />
                  <Route path="/content"    element={<ContentPage />} />
                  <Route path="/archivio"   element={<ArchivePage />} />
                  <Route path="/gestionale" element={<AnalyticsPage />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </AuthGate>
      </AuthProvider>
    </ThemeProvider>
  );
}
