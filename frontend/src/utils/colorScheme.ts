export type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = 'balloon.colorScheme';

const THEME_COLORS: Record<ColorScheme, string> = {
  dark: '#0b1f2a',
  light: '#e4eaf0',
};

export function readColorScheme(): ColorScheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    /* private mode / blocked storage */
  }
  return 'dark';
}

export function applyColorScheme(scheme: ColorScheme): void {
  document.documentElement.dataset.colorScheme = scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[scheme]);
}

export function persistColorScheme(scheme: ColorScheme): void {
  try {
    localStorage.setItem(STORAGE_KEY, scheme);
  } catch {
    /* ignore */
  }
}

export function toggleColorScheme(current: ColorScheme): ColorScheme {
  return current === 'dark' ? 'light' : 'dark';
}
