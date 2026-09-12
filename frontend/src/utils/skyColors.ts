/** Чтение и смешивание цветов неба из CSS-переменных темы. */

export type ThemeKey = 'green' | 'red';

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface SkyColors {
  top: Rgb;
  mid: Rgb;
  low: Rgb;
  horizon: Rgb;
  theme: ThemeKey;
  light: boolean;
}

const FALLBACK: SkyColors = {
  top: { r: 11, g: 13, b: 17 },
  mid: { r: 18, g: 24, b: 32 },
  low: { r: 26, g: 36, b: 48 },
  horizon: { r: 36, g: 48, b: 64 },
  theme: 'green',
  light: false,
};

function parseHex(hex: string): Rgb | null {
  const normalized = hex.trim().replace('#', '');
  if (normalized.length === 3) {
    return {
      r: parseInt(normalized[0]! + normalized[0], 16),
      g: parseInt(normalized[1]! + normalized[1], 16),
      b: parseInt(normalized[2]! + normalized[2], 16),
    };
  }
  if (normalized.length === 6) {
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16),
    };
  }
  return null;
}

function parseCssColor(value: string): Rgb | null {
  const hex = parseHex(value);
  if (hex) {
    return hex;
  }
  const rgbMatch = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgbMatch) {
    return {
      r: Math.round(Number(rgbMatch[1])),
      g: Math.round(Number(rgbMatch[2])),
      b: Math.round(Number(rgbMatch[3])),
    };
  }
  return null;
}

function readVar(name: string): Rgb {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return parseCssColor(raw) ?? FALLBACK.top;
}

export function readSkyColors(): SkyColors {
  const root = document.documentElement;
  const theme = root.dataset.theme === 'red' ? 'red' : 'green';
  const light = root.dataset.colorScheme === 'light';

  return {
    top: readVar('--sky-top'),
    mid: readVar('--sky-mid'),
    low: readVar('--sky-low'),
    horizon: readVar('--sky-horizon'),
    theme,
    light,
  };
}

export function rgbToCss({ r, g, b }: Rgb, alpha = 1): string {
  if (alpha >= 1) {
    return `rgb(${r}, ${g}, ${b})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function lerpRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

export function shiftRgb(color: Rgb, dr: number, dg: number, db: number): Rgb {
  return {
    r: Math.max(0, Math.min(255, color.r + dr)),
    g: Math.max(0, Math.min(255, color.g + dg)),
    b: Math.max(0, Math.min(255, color.b + db)),
  };
}

export function lighten(color: Rgb, amount: number): Rgb {
  return lerpRgb(color, { r: 255, g: 255, b: 255 }, amount);
}

export function darken(color: Rgb, amount: number): Rgb {
  return lerpRgb(color, { r: 0, g: 0, b: 0 }, amount);
}

export interface CloudPaint {
  highlight: string;
  body: string;
  shadow: string;
  edge: string;
}

/** Палитра облаков: в светлой схеме — светло-серые с мягкой тенью. */
export function readCloudPaint(colors: SkyColors): CloudPaint {
  if (colors.light) {
    const body =
      colors.theme === 'green'
        ? { r: 196, g: 202, b: 208 }
        : { r: 206, g: 198, b: 204 };
    return {
      highlight: rgbToCss(lighten(body, 0.24), 0.97),
      body: rgbToCss(body, 0.9),
      shadow: rgbToCss(darken(body, 0.16), 0.4),
      edge: rgbToCss(lighten(body, 0.1), 0),
    };
  }

  const body = { r: 238, g: 244, b: 252 };
  return {
    highlight: 'rgba(255, 255, 255, 0.98)',
    body: rgbToCss(body, 0.9),
    shadow: 'rgba(150, 168, 198, 0.48)',
    edge: 'rgba(255, 255, 255, 0)',
  };
}
