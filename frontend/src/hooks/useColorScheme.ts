import { useCallback, useEffect, useState } from 'react';
import {
  applyColorScheme,
  persistColorScheme,
  readColorScheme,
  toggleColorScheme,
  type ColorScheme,
} from '../utils/colorScheme';

export function useColorScheme(): {
  colorScheme: ColorScheme;
  toggleColorScheme: () => void;
  isLight: boolean;
} {
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => readColorScheme());

  useEffect(() => {
    applyColorScheme(colorScheme);
    persistColorScheme(colorScheme);
  }, [colorScheme]);

  const toggle = useCallback(() => {
    setColorScheme((current) => toggleColorScheme(current));
  }, []);

  return {
    colorScheme,
    toggleColorScheme: toggle,
    isLight: colorScheme === 'light',
  };
}
