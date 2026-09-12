import { useEffect, useRef } from 'react';
import type { ThemeKey } from '../api/types';
import { createSeededRandom, randomBetween } from '../utils/random';
import {
  darken,
  lighten,
  lerpRgb,
  readCloudPaint,
  readSkyColors,
  rgbToCss,
  shiftRgb,
  type Rgb,
  type SkyColors,
} from '../utils/skyColors';

/**
 * Процедурное анимированное небо — фон всех экранов кроме админки.
 *
 * Рисует градиент неба, атмосферу, солнце/луну, звёзды, облака и птиц
 * на canvas с учётом темы (green/red) и цветовой схемы (light/dark).
 */

interface CloudPuff {
  dx: number;
  dy: number;
  rx: number;
  ry: number;
}

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  opacity: number;
  depth: number;
  wobblePhase: number;
  puffs: CloudPuff[];
}

interface Bird {
  x: number;
  y: number;
  scale: number;
  speed: number;
  drift: number;
  flapPhase: number;
  flapSpeed: number;
}

interface Star {
  x: number;
  y: number;
  radius: number;
  twinklePhase: number;
  depth: number;
}

interface Wisp {
  x: number;
  y: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
}

interface SkyPalette {
  cloudHighlight: string;
  cloudBody: string;
  cloudShadow: string;
  cloudEdge: string;
  bird: string;
  birdShadow: string;
}

interface SkyProps {
  theme: ThemeKey;
  /** Смена значения перегенерирует облака и птиц. */
  seed: number;
  stars?: boolean;
  parallax?: number;
  fullPage?: boolean;
}

const randomCount = (rng: () => number, min: number, max: number): number =>
  min + Math.floor(rng() * (max - min + 1));

function readPalette(colors: SkyColors): SkyPalette {
  const clouds = readCloudPaint(colors);
  if (colors.light) {
    return {
      cloudHighlight: clouds.highlight,
      cloudBody: clouds.body,
      cloudShadow: clouds.shadow,
      cloudEdge: clouds.edge,
      bird: rgbToCss(darken(colors.top, 0.55)),
      birdShadow: rgbToCss(darken(colors.top, 0.55), 0.18),
    };
  }
  return {
    cloudHighlight: clouds.highlight,
    cloudBody: clouds.body,
    cloudShadow: clouds.shadow,
    cloudEdge: clouds.edge,
    bird: 'rgba(255, 255, 255, 0.9)',
    birdShadow: 'rgba(0, 0, 0, 0.22)',
  };
}

function generateCloudPuffs(rng: () => number): CloudPuff[] {
  const count = 8 + Math.floor(rng() * 4);
  const puffs: CloudPuff[] = [
    { dx: 0, dy: 0.04, rx: 1.22, ry: 0.96 },
    { dx: -0.82, dy: 0.14, rx: 0.92, ry: 0.76 },
    { dx: 0.86, dy: 0.12, rx: 0.96, ry: 0.78 },
    { dx: -0.42, dy: -0.22, rx: 0.72, ry: 0.58 },
    { dx: 0.46, dy: -0.24, rx: 0.76, ry: 0.6 },
    { dx: 0.08, dy: -0.38, rx: 0.64, ry: 0.52 },
    { dx: -0.68, dy: -0.08, rx: 0.58, ry: 0.48 },
    { dx: 0.62, dy: -0.06, rx: 0.56, ry: 0.46 },
  ];

  for (let index = puffs.length; index < count; index += 1) {
    const side = rng() < 0.5 ? -1 : 1;
    puffs.push({
      dx: side * randomBetween(rng, 0.28, 1.08),
      dy: randomBetween(rng, -0.34, 0.24),
      rx: randomBetween(rng, 0.46, 0.86),
      ry: randomBetween(rng, 0.36, 0.68),
    });
  }

  return puffs.sort((a, b) => a.dy - b.dy);
}

function cloudLightDirection(colors: SkyColors): { x: number; y: number } {
  return colors.theme === 'green' ? { x: 0.34, y: -0.3 } : { x: -0.34, y: -0.3 };
}

function drawCloudPuff(
  context: CanvasRenderingContext2D,
  px: number,
  py: number,
  rx: number,
  ry: number,
  palette: SkyPalette,
  lightX: number,
  lightY: number,
  alphaMul: number,
): void {
  context.save();
  context.globalAlpha *= alphaMul;

  const shadowGrad = context.createRadialGradient(
    px - lightX * rx * 0.15,
    py + ry * 0.48,
    rx * 0.04,
    px,
    py + ry * 0.12,
    Math.max(rx, ry) * 1.4,
  );
  shadowGrad.addColorStop(0, palette.cloudShadow);
  shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = shadowGrad;
  context.beginPath();
  context.ellipse(px + lightX * rx * 0.1, py + ry * 0.2, rx * 1.12, ry * 0.98, 0, 0, Math.PI * 2);
  context.fill();

  const highlightX = px + lightX * rx * 0.46;
  const highlightY = py + lightY * ry * 0.46;
  const bodyGrad = context.createRadialGradient(
    highlightX,
    highlightY,
    Math.min(rx, ry) * 0.04,
    px,
    py,
    Math.max(rx, ry) * 1.28,
  );
  bodyGrad.addColorStop(0, palette.cloudHighlight);
  bodyGrad.addColorStop(0.32, palette.cloudBody);
  bodyGrad.addColorStop(0.72, palette.cloudBody);
  bodyGrad.addColorStop(1, palette.cloudEdge);
  context.fillStyle = bodyGrad;
  context.beginPath();
  context.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha *= 0.7;
  const specGrad = context.createRadialGradient(
    highlightX - rx * 0.06,
    highlightY - ry * 0.08,
    0,
    highlightX,
    highlightY,
    Math.min(rx, ry) * 0.62,
  );
  specGrad.addColorStop(0, palette.cloudHighlight);
  specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = specGrad;
  context.beginPath();
  context.ellipse(highlightX, highlightY, rx * 0.42, ry * 0.34, 0, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

function animatedSkyStops(colors: SkyColors, time: number, motion: number): Rgb[] {
  const breathe = Math.sin(time * 0.09) * motion;
  const drift = Math.sin(time * 0.05 + 1.2) * motion * 0.6;
  const themeTint =
    colors.theme === 'green'
      ? { r: 8 * motion, g: 14 * motion, b: 6 * motion }
      : { r: 16 * motion, g: 4 * motion, b: 8 * motion };

  return [
    shiftRgb(colors.top, themeTint.r * breathe, themeTint.g * breathe, themeTint.b * breathe),
    lerpRgb(
      colors.top,
      colors.mid,
      0.45 + breathe * 0.04,
    ),
    shiftRgb(colors.mid, themeTint.r * drift, themeTint.g * drift, themeTint.b * drift),
    lerpRgb(colors.mid, colors.low, 0.55 + breathe * 0.03),
    shiftRgb(colors.low, themeTint.r * breathe * 0.5, themeTint.g * breathe * 0.5, themeTint.b * breathe * 0.5),
    lerpRgb(colors.low, colors.horizon, 0.65 + drift * 0.05),
    shiftRgb(colors.horizon, themeTint.r * drift * 0.8, themeTint.g * drift * 0.8, themeTint.b * drift * 0.8),
  ];
}

function drawSkyGradient(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: SkyColors,
  time: number,
  motion: number,
  parallax: number,
): void {
  const stops = animatedSkyStops(colors, time, motion);
  const gradient = context.createLinearGradient(0, 0, 0, height);
  const positions = [0, 0.18, 0.34, 0.52, 0.68, 0.84, 1];
  stops.forEach((stop, index) => {
    gradient.addColorStop(positions[index]!, rgbToCss(stop));
  });

  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const horizonY = height * 0.78 + parallax * 0.15;
  const haze = context.createLinearGradient(0, horizonY - height * 0.18, 0, height);
  const hazeColor = colors.light ? lighten(colors.horizon, 0.2) : lighten(colors.horizon, 0.08);
  haze.addColorStop(0, rgbToCss(hazeColor, 0));
  haze.addColorStop(0.45, rgbToCss(hazeColor, colors.light ? 0.22 : 0.14));
  haze.addColorStop(1, rgbToCss(lighten(colors.horizon, colors.light ? 0.35 : 0.12), colors.light ? 0.55 : 0.28));
  context.fillStyle = haze;
  context.fillRect(0, horizonY - height * 0.18, width, height * 0.28);

  if (!colors.light) {
    const auroraStrength = colors.theme === 'green' ? 0.16 : 0.12;
    const aurora = context.createLinearGradient(0, height * 0.55, width, height * 0.72);
    const auroraA = colors.theme === 'green' ? { r: 40, g: 120, b: 90 } : { r: 140, g: 60, b: 80 };
    aurora.addColorStop(0, rgbToCss(auroraA, 0));
    aurora.addColorStop(
      0.35 + Math.sin(time * 0.07) * 0.08 * motion,
      rgbToCss(auroraA, auroraStrength * (0.55 + Math.sin(time * 0.11) * 0.25 * motion)),
    );
    aurora.addColorStop(1, rgbToCss(auroraA, 0));
    context.fillStyle = aurora;
    context.fillRect(0, height * 0.48, width, height * 0.28);
  }
}

function drawCelestialBody(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  colors: SkyColors,
  time: number,
  motion: number,
  parallax: number,
): void {
  const cx = width * (colors.theme === 'green' ? 0.78 : 0.22);
  const baseY = colors.light ? 0.16 : 0.12;
  const cy = height * baseY + Math.sin(time * 0.08) * 6 * motion + parallax * 0.1;

  if (colors.light) {
    const sunCore = colors.theme === 'green' ? { r: 255, g: 236, b: 170 } : { r: 255, g: 220, b: 200 };
    const sunGlow = colors.theme === 'green' ? { r: 255, g: 248, b: 210 } : { r: 255, g: 235, b: 225 };
    const radius = Math.min(width, height) * 0.055;

    const glow = context.createRadialGradient(cx, cy, radius * 0.2, cx, cy, radius * 5.5);
    glow.addColorStop(0, rgbToCss(sunGlow, 0.55));
    glow.addColorStop(0.35, rgbToCss(sunCore, 0.18));
    glow.addColorStop(1, rgbToCss(sunCore, 0));
    context.fillStyle = glow;
    context.beginPath();
    context.arc(cx, cy, radius * 5.5, 0, Math.PI * 2);
    context.fill();

    const core = context.createRadialGradient(cx, cy, 0, cx, cy, radius);
    core.addColorStop(0, rgbToCss({ r: 255, g: 255, b: 245 }));
    core.addColorStop(0.65, rgbToCss(sunCore));
    core.addColorStop(1, rgbToCss(sunCore, 0.85));
    context.fillStyle = core;
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fill();
    return;
  }

  const moonRadius = Math.min(width, height) * 0.028;
  const moonGlow = context.createRadialGradient(cx, cy, moonRadius * 0.3, cx, cy, moonRadius * 4.5);
  moonGlow.addColorStop(0, 'rgba(230, 238, 255, 0.28)');
  moonGlow.addColorStop(0.4, 'rgba(200, 210, 240, 0.08)');
  moonGlow.addColorStop(1, 'rgba(200, 210, 240, 0)');
  context.fillStyle = moonGlow;
  context.beginPath();
  context.arc(cx, cy, moonRadius * 4.5, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(236, 242, 255, 0.92)';
  context.beginPath();
  context.arc(cx, cy, moonRadius, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = 'rgba(180, 190, 220, 0.22)';
  context.beginPath();
  context.arc(cx - moonRadius * 0.25, cy - moonRadius * 0.15, moonRadius * 0.22, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.arc(cx + moonRadius * 0.18, cy + moonRadius * 0.2, moonRadius * 0.16, 0, Math.PI * 2);
  context.fill();
}

function drawCloud(
  context: CanvasRenderingContext2D,
  cloud: Cloud,
  width: number,
  height: number,
  colors: SkyColors,
  palette: SkyPalette,
  time: number,
  parallax: number,
): void {
  const depthShift = cloud.depth * 0.55;
  const x = cloud.x * width;
  const y =
    cloud.y * height +
    parallax * depthShift +
    Math.sin(time * 0.35 + cloud.wobblePhase) * (4 + cloud.depth * 3);
  const size = (52 + cloud.depth * 24) * cloud.scale;
  const light = cloudLightDirection(colors);
  const baseAlpha = cloud.opacity * (0.92 - cloud.depth * 0.14);

  context.save();
  context.globalAlpha = baseAlpha;

  const ambientShadow = context.createRadialGradient(
    x,
    y + size * 0.34,
    size * 0.08,
    x,
    y + size * 0.38,
    size * 2.8,
  );
  ambientShadow.addColorStop(0, palette.cloudShadow);
  ambientShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.globalAlpha = baseAlpha * 0.34;
  context.fillStyle = ambientShadow;
  context.beginPath();
  context.ellipse(x, y + size * 0.3, size * 2.05, size * 0.62, 0, 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = baseAlpha;
  cloud.puffs.forEach((puff, index) => {
    const depthFactor = 0.82 + (index / Math.max(cloud.puffs.length, 1)) * 0.22;
    drawCloudPuff(
      context,
      x + puff.dx * size,
      y + puff.dy * size,
      size * puff.rx * depthFactor,
      size * puff.ry * depthFactor,
      palette,
      light.x,
      light.y,
      0.88 + puff.ry * 0.08,
    );
  });

  const crown = cloud.puffs.reduce((best, puff) => (puff.dy < best.dy ? puff : best), cloud.puffs[0]!);
  context.globalAlpha = baseAlpha * 0.75;
  drawCloudPuff(
    context,
    x + crown.dx * size - size * 0.04,
    y + crown.dy * size - size * 0.06,
    size * crown.rx * 0.52,
    size * crown.ry * 0.42,
    palette,
    light.x,
    light.y,
    0.95,
  );

  context.restore();
}

function drawWisp(
  context: CanvasRenderingContext2D,
  wisp: Wisp,
  width: number,
  height: number,
  colors: SkyColors,
  parallax: number,
): void {
  const x = wisp.x * width;
  const y = wisp.y * height + parallax * 0.25;
  const len = wisp.length * width * 0.08;

  context.save();
  context.globalAlpha = wisp.opacity;
  context.strokeStyle = rgbToCss(lighten(colors.horizon, colors.light ? 0.45 : 0.25), 0.55);
  context.lineWidth = 1.2;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x, y);
  context.lineTo(x + Math.cos(wisp.angle) * len, y + Math.sin(wisp.angle) * len * 0.15);
  context.stroke();
  context.restore();
}

function drawBird(
  context: CanvasRenderingContext2D,
  bird: Bird,
  width: number,
  height: number,
  palette: SkyPalette,
  time: number,
  parallax: number,
): void {
  const x = bird.x * width;
  const y = bird.y * height + Math.sin(time * 1.3 + bird.flapPhase) * 6 + parallax * 0.75;
  const span = 9 * bird.scale;
  const flap = Math.sin(time * bird.flapSpeed + bird.flapPhase);

  context.save();
  context.strokeStyle = palette.birdShadow;
  context.lineWidth = 2.1 * bird.scale;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(x - span, y - flap * span * 0.55 + 1);
  context.quadraticCurveTo(x - span * 0.35, y + span * 0.28 + 1, x, y + 1);
  context.quadraticCurveTo(x + span * 0.35, y + span * 0.28 + 1, x + span, y - flap * span * 0.55 + 1);
  context.stroke();

  context.strokeStyle = palette.bird;
  context.lineWidth = 1.7 * bird.scale;
  context.beginPath();
  context.moveTo(x - span, y - flap * span * 0.55);
  context.quadraticCurveTo(x - span * 0.35, y + span * 0.28, x, y);
  context.quadraticCurveTo(x + span * 0.35, y + span * 0.28, x + span, y - flap * span * 0.55);
  context.stroke();
  context.restore();
}

function drawStars(
  context: CanvasRenderingContext2D,
  stars: Star[],
  width: number,
  height: number,
  time: number,
  motion: number,
  parallax: number,
): void {
  context.save();
  stars.forEach((star) => {
    const twinkle = 0.28 + 0.55 * Math.abs(Math.sin(time * (0.7 + star.depth * 0.4) + star.twinklePhase));
    const alpha = twinkle * (1 - star.y * 0.55) * (0.55 + star.depth * 0.35) * motion;
    context.globalAlpha = alpha;
    context.fillStyle = star.depth > 0.55 ? '#dfe8ff' : '#ffffff';
    context.beginPath();
    context.arc(
      star.x * width,
      star.y * height + parallax * (0.12 + star.depth * 0.08),
      star.radius * (0.75 + star.depth * 0.35),
      0,
      Math.PI * 2,
    );
    context.fill();
  });
  context.restore();
}

export function Sky({
  theme,
  seed,
  stars = true,
  parallax = 0,
  fullPage = false,
}: SkyProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const parallaxRef = useRef(parallax);
  parallaxRef.current = parallax;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const motion = reducedMotion ? 0.15 : 1;

    let width = 0;
    let height = 0;
    let clouds: Cloud[] = [];
    let birds: Bird[] = [];
    let starField: Star[] = [];
    let wisps: Wisp[] = [];

    const populate = () => {
      const rng = createSeededRandom(seed);
      const cloudCount = fullPage ? randomCount(rng, 6, 10) : randomCount(rng, 3, 5);
      const birdCount = fullPage ? randomCount(rng, 2, 4) : randomCount(rng, 1, 3);
      const wispCount = fullPage ? randomCount(rng, 4, 7) : randomCount(rng, 2, 4);
      const cloudYMin = fullPage ? 0.06 : 0.08;
      const cloudYMax = fullPage ? 0.82 : 0.48;
      const birdYMin = fullPage ? 0.1 : 0.12;
      const birdYMax = fullPage ? 0.78 : 0.52;

      clouds = Array.from({ length: cloudCount }, () => {
        const depth = randomBetween(rng, 0, 1);
        return {
          x: randomBetween(rng, -0.25, 1.25),
          y: randomBetween(rng, cloudYMin, cloudYMax),
          scale: randomBetween(rng, fullPage ? 0.62 : 0.52, fullPage ? 1.72 : 1.32),
          speed: randomBetween(rng, 0.004, 0.016) * (0.35 + depth * 0.65) * (rng() < 0.5 ? -1 : 1),
          opacity: randomBetween(rng, 0.16, fullPage ? 0.48 : 0.4),
          depth,
          wobblePhase: rng() * Math.PI * 2,
          puffs: generateCloudPuffs(rng),
        };
      });

      birds = Array.from({ length: birdCount }, () => ({
        x: randomBetween(rng, -0.2, 1.2),
        y: randomBetween(rng, birdYMin, birdYMax),
        scale: randomBetween(rng, 0.65, 1.2),
        speed: randomBetween(rng, 0.06, 0.14) * (rng() < 0.5 ? -1 : 1),
        drift: randomBetween(rng, -0.018, 0.018),
        flapPhase: rng() * Math.PI * 2,
        flapSpeed: randomBetween(rng, 5, 8.5),
      }));

      starField = Array.from({ length: fullPage ? 140 : 80 }, () => ({
        x: rng(),
        y: rng() * (fullPage ? 0.72 : 0.58),
        radius: randomBetween(rng, 0.35, 1.6),
        twinklePhase: rng() * Math.PI * 2,
        depth: rng(),
      }));

      wisps = Array.from({ length: wispCount }, () => ({
        x: randomBetween(rng, -0.1, 1.1),
        y: randomBetween(rng, 0.08, fullPage ? 0.55 : 0.42),
        length: randomBetween(rng, 2.5, 6),
        angle: randomBetween(rng, -0.08, 0.08),
        speed: randomBetween(rng, 0.012, 0.028) * (rng() < 0.5 ? -1 : 1),
        opacity: randomBetween(rng, 0.08, 0.2),
      }));
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * ratio));
      canvas.height = Math.max(1, Math.floor(height * ratio));
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const birdClampMin = fullPage ? 0.06 : 0.08;
    const birdClampMax = fullPage ? 0.88 : 0.6;

    let frame = 0;
    let previous = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const time = now / 1000;
      const colors = readSkyColors();
      const palette = readPalette(colors);
      const px = parallaxRef.current;

      context.clearRect(0, 0, width, height);
      drawSkyGradient(context, width, height, colors, time, motion, px);
      drawCelestialBody(context, width, height, colors, time, motion, px);

      if (stars && !colors.light) {
        drawStars(context, starField, width, height, time, motion, px);
      }

      wisps.forEach((wisp) => {
        wisp.x += wisp.speed * dt * motion;
        if (wisp.x > 1.2) wisp.x = -0.2;
        if (wisp.x < -0.2) wisp.x = 1.2;
        drawWisp(context, wisp, width, height, colors, px);
      });

      clouds
        .slice()
        .sort((a, b) => a.depth - b.depth)
        .forEach((cloud) => {
          cloud.x += cloud.speed * dt * motion;
          if (cloud.x > 1.4) cloud.x = -0.4;
          if (cloud.x < -0.4) cloud.x = 1.4;
          drawCloud(context, cloud, width, height, colors, palette, time, px);
        });

      birds.forEach((bird) => {
        bird.x += bird.speed * dt * motion;
        bird.y += bird.drift * dt * motion;
        if (bird.x > 1.25) bird.x = -0.25;
        if (bird.x < -0.25) bird.x = 1.25;
        if (bird.y < birdClampMin || bird.y > birdClampMax) {
          bird.drift *= -1;
        }
        drawBird(context, bird, width, height, palette, time, px);
      });

      frame = window.requestAnimationFrame(loop);
    };

    populate();
    resize();
    frame = window.requestAnimationFrame(loop);

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [seed, stars, fullPage, theme]);

  return <canvas ref={canvasRef} className="app__sky" aria-hidden="true" />;
}
