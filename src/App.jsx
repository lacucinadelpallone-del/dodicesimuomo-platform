import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Moon, Sun, Monitor } from 'lucide-react';
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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate>
          <BrowserRouter>
            <div className="app-layout">
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
