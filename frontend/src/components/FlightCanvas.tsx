import { useEffect, useRef, type MutableRefObject } from 'react';
import { baseMultiplierAt, type Flight } from '../state/flight';
import type { FlightState } from '../state/useFlight';
import { readCloudPaint, readSkyColors, type CloudPaint } from '../utils/skyColors';

/**
 * Анимация полёта на Canvas 2D.
 *
 * Компонент намеренно отвязан от рендера React: он читает актуальные данные
 * через ref и крутит собственный requestAnimationFrame. Поэтому 60 FPS
 * анимации не зависят ни от частоты серверных тиков, ни от того, как часто
 * перерисовывается остальной интерфейс.
 *
 * Высота считается как ln(коэффициент + 1): коэффициент стартует с нуля и
 * растёт экспоненциально, логарифм делает подъём равномерным по времени. Небо и облака прокручиваются
 * от этой же величины, поэтому скорость подъёма читается визуально, а шар
 * остаётся в центре кадра и не улетает за его пределы.
 *
 * Сторонние графические библиотеки не используются: весь рисунок — примитивы
 * Canvas, это и быстрее, и не тянет зависимостей.
 */

interface FlightCanvasProps {
  flight: Flight;
  stateRef: MutableRefObject<FlightState>;
  theme: 'green' | 'red';
  lightScheme?: boolean;
}

interface Cloud {
  x: number;
  altitude: number;
  scale: number;
  alpha: number;
  drift: number;
}

interface Bird {
  x: number;
  altitude: number;
  scale: number;
  alpha: number;
  drift: number;
  flapPhase: number;
  flapSpeed: number;
  flockOffsetX: number;
  flockOffsetAlt: number;
}

/** Шаг процедурной генерации птиц по высоте (ln-единицы). */
const BIRD_BAND_LN = 0.55;
/** Горизонтальная скорость птиц относительно облаков. */
const BIRD_DRIFT_SCALE = 0.0028;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  hue: number;
}

const PIXELS_PER_LN = 210;
const MAX_DPR = 2;

export function FlightCanvas({ flight, stateRef, theme, lightScheme = false }: FlightCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    let width = 0;
    let height = 0;
    let frame = 0;
    let burstAt = 0;
    let lastBoostFlash = stateRef.current.boostFlash;
    let boostFlashAt = 0;

    const clouds: Cloud[] = Array.from({ length: 14 }, (_, index) => ({
      x: Math.random(),
      altitude: index * 0.45 + Math.random() * 0.3,
      scale: 0.5 + Math.random() * 0.9,
      alpha: 0.12 + Math.random() * 0.22,
      drift: (Math.random() - 0.5) * 0.012,
    }));
    const birdSeed = flight.startedAtMillis % 100_000;
    const particles: Particle[] = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const brightSky = lightScheme || theme === 'red';

    const palette = lightScheme
      ? theme === 'green'
        ? { top: '#c8ddd4', mid: '#dceae4', horizon: '#f4faf7', balloonA: '#a7f3c3', balloonB: '#128c4b' }
        : { top: '#e8d0d8', mid: '#f0e0e6', horizon: '#fbf5f7', balloonA: '#ffc2b4', balloonB: '#c02626' }
      : theme === 'green'
        ? { top: '#052b1e', mid: '#0c5c3a', horizon: '#8ce0b0', balloonA: '#a7f3c3', balloonB: '#0f8f4d' }
        : { top: '#6a3848', mid: '#9a6878', horizon: '#e8c0c8', balloonA: '#ffc2b4', balloonB: '#c02626' };

    const draw = (time: number) => {
      const state = stateRef.current;
      const base = state.crashed
        ? (state.crashMultiplier ?? state.baseMultiplier)
        : baseMultiplierAt(flight, Date.now());
      const altitude = Math.log(base + 1);
      const scroll = altitude * PIXELS_PER_LN;

      if (state.boostFlash !== lastBoostFlash) {
        lastBoostFlash = state.boostFlash;
        boostFlashAt = time;
      }
      if (state.crashed && burstAt === 0) {
        burstAt = time;
        spawnBurst(particles, width / 2, height * 0.44, theme);
      }

      drawSky(context, width, height, palette, altitude, brightSky);
      drawClouds(context, clouds, width, height, scroll, time, lightScheme);
      drawProceduralBirds(context, width, height, scroll, time, birdSeed, brightSky, lightScheme);
      drawLevelMarkers(context, flight, state, width, height, scroll, theme, lightScheme);

      if (!state.crashed) {
        drawBalloon(context, width, height, time, palette, state);
      } else {
        drawParticles(context, particles, time - burstAt);
      }

      if (boostFlashAt > 0 && time - boostFlashAt < 620) {
        drawBoostFlash(context, width, height, (time - boostFlashAt) / 620);
      }

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [flight, stateRef, theme, lightScheme]);

  return <canvas ref={canvasRef} className="flight-canvas" aria-hidden="true" />;
}

// --------------------------------------------------------------------- небо

function drawSky(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: { top: string; mid: string; horizon: string },
  altitude: number,
  brightSky: boolean,
): void {
  const gradient = context.createLinearGradient(0, 0, 0, height);

  if (brightSky) {
    // Светлая схема и красная тема: небо остаётся светлым, без ухода в космос.
    const lift = Math.min(1, altitude / 5);
    gradient.addColorStop(0, palette.top);
    gradient.addColorStop(0.45 - lift * 0.08, palette.mid);
    gradient.addColorStop(1, palette.horizon);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    return;
  }

  // Чем выше шар, тем темнее и «космичнее» небо: это второй, независимый от
  // цифр индикатор прогресса.
  const darkness = Math.min(1, altitude / 4);
  gradient.addColorStop(0, palette.top);
  gradient.addColorStop(0.55 - darkness * 0.2, palette.mid);
  gradient.addColorStop(1, palette.horizon);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  if (darkness > 0.25) {
    context.save();
    context.globalAlpha = (darkness - 0.25) * 0.9;
    for (let i = 0; i < 60; i++) {
      const x = pseudoRandom(i * 7.13) * width;
      const y = pseudoRandom(i * 3.71) * height * 0.6;
      const size = 0.6 + pseudoRandom(i * 1.7) * 1.2;
      context.fillStyle = '#ffffff';
      context.fillRect(x, y, size, size);
    }
    context.restore();
  }
}

function drawClouds(
  context: CanvasRenderingContext2D,
  clouds: Cloud[],
  width: number,
  height: number,
  scroll: number,
  time: number,
  lightScheme: boolean,
): void {
  const span = height * 1.6;
  const paint = lightScheme ? readCloudPaint(readSkyColors()) : undefined;
  context.save();
  clouds.forEach((cloud) => {
    // Облака «уходят вниз» по мере подъёма и зацикливаются по высоте.
    const raw = cloud.altitude * PIXELS_PER_LN * 0.9 - scroll;
    const y = height - (((raw % span) + span) % span);
    const x = (((cloud.x + cloud.drift * time * 0.001) % 1) + 1) % 1;
    context.globalAlpha = cloud.alpha;
    puff(context, x * width, y, 46 * cloud.scale, paint);
  });
  context.restore();
}

function puff(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  paint?: CloudPaint,
): void {
  const puffs: [number, number, number, number][] = [
    [0, 0.04, 1.18, 0.92],
    [-0.82, 0.14, 0.9, 0.74],
    [0.86, 0.12, 0.94, 0.76],
    [-0.42, -0.22, 0.72, 0.58],
    [0.46, -0.24, 0.76, 0.6],
    [0.08, -0.38, 0.64, 0.52],
    [-0.68, -0.08, 0.58, 0.48],
    [0.62, -0.06, 0.56, 0.46],
  ];

  context.save();

  const ambient = context.createRadialGradient(x, y + radius * 0.34, radius * 0.08, x, y + radius * 0.38, radius * 2.6);
  ambient.addColorStop(0, paint?.shadow ?? 'rgba(150, 168, 198, 0.28)');
  ambient.addColorStop(1, paint?.edge ?? 'rgba(150, 168, 198, 0)');
  context.fillStyle = ambient;
  context.beginPath();
  context.ellipse(x, y + radius * 0.3, radius * 1.95, radius * 0.58, 0, 0, Math.PI * 2);
  context.fill();

  puffs.forEach(([dx, dy, rxk, ryk]) => {
    const px = x + dx * radius;
    const py = y + dy * radius;
    const rx = radius * rxk * 0.72;
    const ry = radius * ryk * 0.72;

    const shadowGrad = context.createRadialGradient(px, py + ry * 0.42, rx * 0.04, px, py, Math.max(rx, ry) * 1.25);
    shadowGrad.addColorStop(0, paint?.shadow ?? 'rgba(150, 168, 198, 0.34)');
    shadowGrad.addColorStop(1, paint?.edge ?? 'rgba(150, 168, 198, 0)');
    context.fillStyle = shadowGrad;
    context.beginPath();
    context.ellipse(px + rx * 0.08, py + ry * 0.18, rx * 1.08, ry * 0.96, 0, 0, Math.PI * 2);
    context.fill();

    const bodyGrad = context.createRadialGradient(
      px + rx * 0.34,
      py - ry * 0.28,
      Math.min(rx, ry) * 0.04,
      px,
      py,
      Math.max(rx, ry) * 1.2,
    );
    bodyGrad.addColorStop(0, paint?.highlight ?? 'rgba(255, 255, 255, 0.98)');
    bodyGrad.addColorStop(0.35, paint?.body ?? 'rgba(244, 248, 255, 0.92)');
    bodyGrad.addColorStop(0.75, paint?.body ?? 'rgba(230, 238, 250, 0.84)');
    bodyGrad.addColorStop(1, paint?.edge ?? 'rgba(255, 255, 255, 0)');
    context.fillStyle = bodyGrad;
    context.beginPath();
    context.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
  });

  context.restore();
}

// --------------------------------------------------------------------- птицы

function birdRand(seed: number): number {
  return pseudoRandom(seed);
}

function makeBird(seed: number, band: number): Bird {
  const driftDir = birdRand(seed + 1) > 0.5 ? 1 : -1;
  return {
    x: birdRand(seed + 2),
    altitude: band * BIRD_BAND_LN + birdRand(seed + 3) * BIRD_BAND_LN * 0.82,
    scale: 0.42 + birdRand(seed + 4) * 0.88,
    alpha: 0.24 + birdRand(seed + 5) * 0.42,
    drift: driftDir * (0.04 + birdRand(seed + 6) * 0.06),
    flapPhase: birdRand(seed + 7) * Math.PI * 2,
    flapSpeed: 8 + birdRand(seed + 8) * 6,
    flockOffsetX: 0,
    flockOffsetAlt: 0,
  };
}

function drawProceduralBirds(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  scroll: number,
  time: number,
  roundSeed: number,
  brightSky: boolean,
  lightScheme: boolean,
): void {
  const span = height * 1.6;
  const birdColor = lightScheme || brightSky ? 'rgba(24, 33, 47, 0.92)' : 'rgba(255, 255, 255, 0.88)';
  const birdShadow = lightScheme || brightSky ? 'rgba(24, 33, 47, 0.18)' : 'rgba(0, 0, 0, 0.22)';

  const scrollAlt = scroll / (PIXELS_PER_LN * 0.92);
  const minBand = Math.floor(scrollAlt / BIRD_BAND_LN) - 2;
  const maxBand = Math.ceil((scrollAlt + (height * 1.4) / (PIXELS_PER_LN * 0.92)) / BIRD_BAND_LN) + 2;

  const visible: Bird[] = [];

  for (let band = minBand; band <= maxBand; band += 1) {
    const bandSeed = roundSeed + band * 19.713;

    if (birdRand(bandSeed) > 0.58) {
      visible.push(makeBird(bandSeed, band));
    }

    if (birdRand(bandSeed + 500) > 0.78) {
      const flockSize = 2 + Math.floor(birdRand(bandSeed + 501) * 2);
      const lead = makeBird(bandSeed + 900, band);
      for (let member = 0; member < flockSize; member += 1) {
        visible.push({
          ...lead,
          scale: lead.scale * (1 - member * 0.07),
          alpha: lead.alpha * (1 - member * 0.06),
          flockOffsetX: member === 0 ? 0 : -0.05 * member - birdRand(bandSeed + 902 + member) * 0.025,
          flockOffsetAlt: member === 0 ? 0 : 0.02 * member + birdRand(bandSeed + 910 + member) * 0.014,
          flapPhase: lead.flapPhase + member * 0.35,
        });
      }
    }
  }

  visible.sort((a, b) => a.scale - b.scale);

  visible.forEach((bird) => {
    const raw = (bird.altitude + bird.flockOffsetAlt) * PIXELS_PER_LN * 0.92 - scroll;
    const y = height - (((raw % span) + span) % span);
    if (y < -60 || y > height + 60) {
      return;
    }
    const glide = Math.sin(time * 0.0024 + bird.flapPhase) * 6 * bird.scale;
    const xNorm = (((bird.x + bird.flockOffsetX + bird.drift * time * BIRD_DRIFT_SCALE) % 1) + 1) % 1;
    drawBirdSilhouette(
      context,
      xNorm * width,
      y + glide,
      bird.scale,
      time,
      bird,
      bird.drift >= 0,
      birdColor,
      birdShadow,
      bird.alpha,
    );
  });
}

function drawBirdSilhouette(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  time: number,
  bird: Bird,
  facingRight: boolean,
  color: string,
  shadowColor: string,
  alpha: number,
): void {
  const dir = facingRight ? 1 : -1;
  const flap = Math.sin(time * 0.001 * bird.flapSpeed + bird.flapPhase);
  const wingLift = flap * 8 * scale;
  const span = 16 * scale;
  const bob = Math.sin(time * 0.002 + bird.flapPhase * 1.7) * 1.5 * scale;

  context.save();
  context.translate(x, y + bob);
  context.scale(dir, 1);
  context.globalAlpha = alpha;

  context.strokeStyle = shadowColor;
  context.lineWidth = 2.6 * scale;
  context.lineCap = 'round';
  context.beginPath();
  context.moveTo(-span, -wingLift + 1.5);
  context.quadraticCurveTo(-span * 0.28, span * 0.22, 0, 1.5);
  context.quadraticCurveTo(span * 0.28, span * 0.22, span, -wingLift + 1.5);
  context.stroke();

  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = 1.9 * scale;
  context.beginPath();
  context.moveTo(-span, -wingLift);
  context.quadraticCurveTo(-span * 0.28, span * 0.18, 0, 0);
  context.quadraticCurveTo(span * 0.28, span * 0.18, span, -wingLift);
  context.stroke();

  context.beginPath();
  context.moveTo(-span * 0.12, -wingLift * 0.35);
  context.lineTo(-span * 0.55, -wingLift * 0.85 - 2 * scale);
  context.stroke();

  context.beginPath();
  context.ellipse(span * 0.08, 0.5 * scale, 2.4 * scale, 1.3 * scale, -0.15, 0, Math.PI * 2);
  context.fill();

  context.beginPath();
  context.moveTo(span * 0.18, 0);
  context.lineTo(span * 0.42, -1.2 * scale);
  context.stroke();

  context.restore();
}

// ------------------------------------------------------------------ уровни

function drawLevelMarkers(
  context: CanvasRenderingContext2D,
  flight: Flight,
  state: FlightState,
  width: number,
  height: number,
  scroll: number,
  theme: 'green' | 'red',
  lightScheme: boolean,
): void {
  const markerTone =
    lightScheme && theme === 'green'
      ? { pending: 'rgba(26, 157, 84, 0.55)', passed: 'rgba(46, 204, 113, 0.5)', active: 'rgba(26, 157, 84, 0.88)', text: '#1a9d54' }
      : lightScheme && theme === 'red'
        ? { pending: 'rgba(192, 57, 43, 0.55)', passed: 'rgba(231, 76, 60, 0.5)', active: 'rgba(192, 57, 43, 0.88)', text: '#c0392b' }
        : { pending: 'rgba(255,255,255,0.55)', passed: '#ffffff', active: '#ffffff', text: 'rgba(255,255,255,0.82)' };

  const balloonY = height * 0.44;
  context.save();
  context.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textBaseline = 'middle';

  flight.levelMultipliers.forEach((threshold, index) => {
    const level = index + 1;
    const y = balloonY + scroll - Math.log(threshold + 1) * PIXELS_PER_LN;
    if (y < -40 || y > height + 40) {
      return;
    }
    const passed = state.levelsPassed >= level;
    const isBoostHit = state.boostApplied && state.boostLevel === level;

    context.globalAlpha = passed ? 0.5 : 0.85;
    context.strokeStyle = isBoostHit ? '#b98cff' : passed ? markerTone.passed : markerTone.pending;
    context.lineWidth = isBoostHit ? 2 : 1;
    context.setLineDash(passed ? [] : [6, 8]);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();

    context.setLineDash([]);
    context.globalAlpha = 1;
    context.fillStyle = isBoostHit ? '#d9c2ff' : markerTone.text;
    context.fillText(`${level} · ${threshold.toFixed(2)}x`, 12, y - 10);
  });

  context.restore();
}

// --------------------------------------------------------------------- шар

const BALLOON_ENVELOPE_PATH =
  'M50 3 C76 3 93 24 93 47 C93 68 84 84 70 93 C62 98 55 100 50 100 C45 100 38 98 30 93 C16 84 7 68 7 47 C7 24 24 3 50 3 Z';

function drawBalloon(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  palette: { balloonA: string; balloonB: string },
  state: FlightState,
): void {
  const centerX = width / 2 + Math.sin(time * 0.0007) * width * 0.045;
  const centerY = height * 0.44 + Math.sin(time * 0.0013) * 8;
  const radius = Math.min(width, height) * 0.11;
  const scale = radius / 43;
  const originX = centerX - 50 * scale;
  const originY = centerY - 48 * scale;

  context.save();

  if (state.boostApplied) {
    context.shadowColor = 'rgba(185, 140, 255, 0.85)';
    context.shadowBlur = 34;
  } else if (state.cashedOut) {
    context.shadowColor = 'rgba(53, 224, 143, 0.7)';
    context.shadowBlur = 26;
  } else {
    context.shadowColor = 'rgba(0, 0, 0, 0.28)';
    context.shadowBlur = 14;
    context.shadowOffsetY = 5;
  }

  context.translate(originX, originY);
  context.scale(scale, scale);

  const gradient = context.createRadialGradient(32, 24, 4, 50, 50, 86);
  gradient.addColorStop(0, palette.balloonA);
  gradient.addColorStop(0.48, palette.balloonB);
  gradient.addColorStop(0.88, palette.balloonB);
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.38)');

  const envelope = new Path2D(BALLOON_ENVELOPE_PATH);
  context.fillStyle = gradient;
  context.fill(envelope);

  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  const shine = context.createRadialGradient(28, 22, 2, 30, 24, 38);
  shine.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  shine.addColorStop(0.55, 'rgba(255, 255, 255, 0.12)');
  shine.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = shine;
  context.fill(envelope);

  context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  context.lineWidth = 1.15 / scale;
  context.lineCap = 'round';
  const gores = [
    'M50 4 C38 28 38 72 50 98',
    'M50 4 C62 28 62 72 50 98',
    'M50 4 C28 32 16 52 12 58',
    'M50 4 C72 32 84 52 88 58',
    'M14 48 C36 58 64 58 86 48',
  ];
  gores.forEach((d) => {
    context.beginPath();
    context.stroke(new Path2D(d));
  });

  context.fillStyle = palette.balloonB;
  context.globalAlpha = 0.85;
  context.beginPath();
  context.moveTo(46, 100);
  context.quadraticCurveTo(50, 106, 54, 100);
  context.quadraticCurveTo(50, 103, 46, 100);
  context.fill();
  context.globalAlpha = 1;

  context.strokeStyle = 'rgba(35, 22, 12, 0.55)';
  context.lineWidth = 1.05 / scale;
  const ropes = [
    'M43 98 Q44 104 41 110',
    'M47 99 Q48 105 44 109',
    'M53 99 Q52 105 56 109',
    'M57 98 Q56 104 59 110',
  ];
  ropes.forEach((d) => {
    context.beginPath();
    context.stroke(new Path2D(d));
  });

  const basketGrad = context.createLinearGradient(36, 108, 36, 124);
  basketGrad.addColorStop(0, '#d4a068');
  basketGrad.addColorStop(0.45, '#a87240');
  basketGrad.addColorStop(1, '#5c3a1e');
  context.fillStyle = basketGrad;
  context.beginPath();
  context.moveTo(36, 108);
  context.lineTo(64, 108);
  context.lineTo(60, 124);
  context.lineTo(40, 124);
  context.closePath();
  context.fill();

  context.fillStyle = '#6a4424';
  context.fillRect(36, 108, 28, 2.5);
  context.strokeStyle = 'rgba(0, 0, 0, 0.14)';
  context.lineWidth = 0.8 / scale;
  for (let i = 0; i < 4; i += 1) {
    const y = 112 + i * 3.5;
    context.beginPath();
    context.moveTo(38, y);
    context.lineTo(62, y);
    context.stroke();
  }

  context.restore();

  context.fillStyle = 'rgba(0, 0, 0, 0.12)';
  context.beginPath();
  context.ellipse(centerX, centerY + radius * 1.05, radius * 0.34, radius * 0.07, 0, 0, Math.PI * 2);
  context.fill();
}

// ------------------------------------------------------------------ эффекты

function spawnBurst(particles: Particle[], x: number, y: number, theme: 'green' | 'red'): void {
  const hue = theme === 'green' ? 145 : 4;
  for (let i = 0; i < 90; i++) {
    const angle = (Math.PI * 2 * i) / 90 + Math.random() * 0.2;
    const speed = 90 + Math.random() * 320;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 700 + Math.random() * 700,
      size: 2 + Math.random() * 4,
      hue: hue + Math.random() * 40 - 20,
    });
  }
}

function drawParticles(context: CanvasRenderingContext2D, particles: Particle[], elapsed: number): void {
  context.save();
  particles.forEach((particle) => {
    const t = elapsed / 1000;
    if (elapsed > particle.life) {
      return;
    }
    const x = particle.x + particle.vx * t;
    const y = particle.y + particle.vy * t + 240 * t * t;
    context.globalAlpha = Math.max(0, 1 - elapsed / particle.life);
    context.fillStyle = `hsl(${particle.hue} 85% 62%)`;
    context.beginPath();
    context.arc(x, y, particle.size, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();
}

function drawBoostFlash(context: CanvasRenderingContext2D, width: number, height: number, progress: number): void {
  context.save();
  context.globalAlpha = (1 - progress) * 0.55;
  const gradient = context.createRadialGradient(
    width / 2,
    height * 0.44,
    0,
    width / 2,
    height * 0.44,
    Math.max(width, height) * (0.3 + progress * 0.9),
  );
  gradient.addColorStop(0, 'rgba(185,140,255,0.95)');
  gradient.addColorStop(1, 'rgba(185,140,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
  context.restore();
}

/** Детерминированный «шум» для звёзд: одинаковый рисунок между кадрами. */
function pseudoRandom(seed: number): number {
  const value = Math.sin(seed) * 43758.5453;
  return value - Math.floor(value);
}
