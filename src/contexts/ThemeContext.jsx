import { createContext, useContext, useState, useEffect } from 'react';

const THEME_KEY = 'du_theme';
const ThemeCtx  = createContext();

export const THEMES = [
  { id: 'notte',  label: 'Notte'  },
  { id: 'giorno', label: 'Giorno' },
  { id: 'auto',   label: 'Auto'   },
];

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem(THEME_KEY) || 'notte'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Apply on mount without waiting for effect
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }

  const cycle = () => {
    setThemeState(t => {
      const idx = THEMES.findIndex(x => x.id === t);
      return THEMES[(idx + 1) % THEMES.length].id;
    });
  };

  return (
    <ThemeCtx.Provider value={{ theme, cycle }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export const useTheme = () => useContext(ThemeCtx);
