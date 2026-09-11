import { useEffect, useRef, type MutableRefObject } from 'react';
import { baseMultiplierAt, type Flight } from '../state/flight';
import type { FlightState } from '../state/useFlight';

/**
 * Анимация полёта на Canvas 2D.
 *
 * Компонент намеренно отвязан от рендера React: он читает актуальные данные
 * через ref и крутит собственный requestAnimationFrame. Поэтому 60 FPS
 * анимации не зависят ни от частоты серверных тиков, ни от того, как часто
 * перерисовывается остальной интерфейс.
 *
 * Высота считается как ln(коэффициент): коэффициент растёт экспоненциально,
 * логарифм делает подъём равномерным по времени. Небо и облака прокручиваются
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
}

interface Cloud {
  x: number;
  altitude: number;
  scale: number;
  alpha: number;
  drift: number;
}

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

export function FlightCanvas({ flight, stateRef, theme }: FlightCanvasProps): JSX.Element {
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

    const palette =
      theme === 'green'
        ? { top: '#052b1e', mid: '#0c5c3a', horizon: '#8ce0b0', balloonA: '#a7f3c3', balloonB: '#0f8f4d' }
        : { top: '#2c0710', mid: '#7a1224', horizon: '#ffb59f', balloonA: '#ffc2b4', balloonB: '#c02626' };

    const draw = (time: number) => {
      const state = stateRef.current;
      const base = state.crashed
        ? (state.crashMultiplier ?? state.baseMultiplier)
        : baseMultiplierAt(flight, Date.now());
      const altitude = Math.log(Math.max(1, base));
      const scroll = altitude * PIXELS_PER_LN;

      if (state.boostFlash !== lastBoostFlash) {
        lastBoostFlash = state.boostFlash;
        boostFlashAt = time;
      }
      if (state.crashed && burstAt === 0) {
        burstAt = time;
        spawnBurst(particles, width / 2, height * 0.44, theme);
      }

      drawSky(context, width, height, palette, altitude);
      drawClouds(context, clouds, width, height, scroll, time);
      drawLevelMarkers(context, flight, state, width, height, scroll);

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
  }, [flight, stateRef, theme]);

  return <canvas ref={canvasRef} className="flight-canvas" aria-hidden="true" />;
}

// --------------------------------------------------------------------- небо

function drawSky(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: { top: string; mid: string; horizon: string },
  altitude: number,
): void {
  // Чем выше шар, тем темнее и «космичнее» небо: это второй, независимый от
  // цифр индикатор прогресса.
  const darkness = Math.min(1, altitude / 4);
  const gradient = context.createLinearGradient(0, 0, 0, height);
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
): void {
  const span = height * 1.6;
  context.save();
  clouds.forEach((cloud) => {
    // Облака «уходят вниз» по мере подъёма и зацикливаются по высоте.
    const raw = cloud.altitude * PIXELS_PER_LN * 0.9 - scroll;
    const y = height - (((raw % span) + span) % span);
    const x = (((cloud.x + cloud.drift * time * 0.001) % 1) + 1) % 1;
    context.globalAlpha = cloud.alpha;
    context.fillStyle = '#ffffff';
    puff(context, x * width, y, 46 * cloud.scale);
  });
  context.restore();
}

function puff(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  context.beginPath();
  context.arc(x, y, radius * 0.6, 0, Math.PI * 2);
  context.arc(x + radius * 0.55, y + radius * 0.12, radius * 0.45, 0, Math.PI * 2);
  context.arc(x - radius * 0.55, y + radius * 0.16, radius * 0.4, 0, Math.PI * 2);
  context.arc(x + radius * 0.12, y - radius * 0.28, radius * 0.42, 0, Math.PI * 2);
  context.fill();
}

// ------------------------------------------------------------------ уровни

function drawLevelMarkers(
  context: CanvasRenderingContext2D,
  flight: Flight,
  state: FlightState,
  width: number,
  height: number,
  scroll: number,
): void {
  const balloonY = height * 0.44;
  context.save();
  context.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textBaseline = 'middle';

  flight.levelMultipliers.forEach((threshold, index) => {
    const level = index + 1;
    const y = balloonY + scroll - Math.log(threshold) * PIXELS_PER_LN;
    if (y < -40 || y > height + 40) {
      return;
    }
    const passed = state.levelsPassed >= level;
    const isBoostHit = state.boostApplied && state.boostLevel === level;

    context.globalAlpha = passed ? 0.5 : 0.85;
    context.strokeStyle = isBoostHit ? '#b98cff' : passed ? '#ffffff' : 'rgba(255,255,255,0.55)';
    context.lineWidth = isBoostHit ? 2 : 1;
    context.setLineDash(passed ? [] : [6, 8]);
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();

    context.setLineDash([]);
    context.globalAlpha = 1;
    context.fillStyle = isBoostHit ? '#d9c2ff' : 'rgba(255,255,255,0.82)';
    context.fillText(`${level} · ${threshold.toFixed(2)}x`, 12, y - 10);
  });

  context.restore();
}

// --------------------------------------------------------------------- шар

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

  context.save();

  if (state.boostApplied) {
    context.shadowColor = 'rgba(185, 140, 255, 0.85)';
    context.shadowBlur = 34;
  } else if (state.cashedOut) {
    context.shadowColor = 'rgba(53, 224, 143, 0.7)';
    context.shadowBlur = 26;
  }

  const gradient = context.createRadialGradient(
    centerX - radius * 0.35,
    centerY - radius * 0.45,
    radius * 0.15,
    centerX,
    centerY,
    radius * 1.25,
  );
  gradient.addColorStop(0, palette.balloonA);
  gradient.addColorStop(1, palette.balloonB);

  context.beginPath();
  context.ellipse(centerX, centerY, radius, radius * 1.15, 0, 0, Math.PI * 2);
  context.fillStyle = gradient;
  context.fill();

  context.shadowBlur = 0;
  context.globalAlpha = 0.22;
  context.strokeStyle = '#ffffff';
  context.lineWidth = 1.2;
  [-0.55, 0, 0.55].forEach((offset) => {
    context.beginPath();
    context.ellipse(centerX, centerY, Math.abs(radius * offset) || 2, radius * 1.15, 0, 0, Math.PI * 2);
    context.stroke();
  });
  context.globalAlpha = 1;

  const basketY = centerY + radius * 1.15;
  context.strokeStyle = 'rgba(255,255,255,0.55)';
  context.lineWidth = 1.4;
  [-0.45, 0.45].forEach((offset) => {
    context.beginPath();
    context.moveTo(centerX + radius * offset, basketY - radius * 0.12);
    context.lineTo(centerX + radius * offset * 0.4, basketY + radius * 0.4);
    context.stroke();
  });

  context.fillStyle = '#7a5230';
  context.beginPath();
  context.roundRect(centerX - radius * 0.26, basketY + radius * 0.38, radius * 0.52, radius * 0.34, 4);
  context.fill();

  context.restore();
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
