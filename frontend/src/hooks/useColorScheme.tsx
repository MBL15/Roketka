import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyColorScheme,
  persistColorScheme,
  readColorScheme,
  toggleColorScheme,
  type ColorScheme,
} from '../utils/colorScheme';

type ColorSchemeContextValue = {
  colorScheme: ColorScheme;
  toggleColorScheme: () => void;
  isLight: boolean;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

export function ColorSchemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => readColorScheme());

  useEffect(() => {
    applyColorScheme(colorScheme);
    persistColorScheme(colorScheme);
  }, [colorScheme]);

  const toggle = useCallback(() => {
    setColorScheme((current) => toggleColorScheme(current));
  }, []);

  const value = useMemo(
    () => ({
      colorScheme,
      toggleColorScheme: toggle,
      isLight: colorScheme === 'light',
    }),
    [colorScheme, toggle],
  );

  return <ColorSchemeContext.Provider value={value}>{children}</ColorSchemeContext.Provider>;
}

export function useColorScheme(): ColorSchemeContextValue {
  const context = useContext(ColorSchemeContext);
  if (!context) {
    throw new Error('useColorScheme must be used within ColorSchemeProvider');
  }
  return context;
}
