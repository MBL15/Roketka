import { useEffect, useRef } from 'react';
import { createSeededRandom, randomBetween } from '../utils/random';

/**
 * Анимированное небо: фон всех экранов.
 *
 * На экране одновременно живут от 1 до 3 птиц и от 1 до 3 облаков,
 * движущихся по случайным траекториям; птицы быстрее облаков — эффект глубины.
 * Количество и позиции генерируются заново при каждом входе на экран (проп `seed`).
 */

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  opacity: number;
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
}

interface SkyPalette {
  cloudCore: string;
  cloudEdge: string;
  bird: string;
}

interface SkyProps {
  /** Смена значения перегенерирует небо: новые позиции птиц и облаков. */
  seed: number;
  /** Ночное небо со звёздами включается на экранах, где нет ярких панелей. */
  stars?: boolean;
  /** Смещение неба вниз при подъёме шара: параллакс игрового экрана. */
  parallax?: number;
  /** Облака по всей высоте viewport (фон приложения). */
  fullPage?: boolean;
}

const randomCount = (rng: () => number): number => 1 + Math.floor(rng() * 3);

function readPalette(): SkyPalette {
  const light = document.documentElement.dataset.colorScheme === 'light';
  if (light) {
    return {
      cloudCore: 'rgba(120, 132, 145, 0.82)',
      cloudEdge: 'rgba(120, 132, 145, 0)',
      bird: '#18212f',
    };
  }
  return {
    cloudCore: 'rgba(255, 255, 255, 0.95)',
    cloudEdge: 'rgba(255, 255, 255, 0)',
    bird: '#ffffff',
  };
}

export function Sky({ seed, stars = true, parallax = 0, fullPage = false }: SkyProps): JSX.Element {
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

    let width = 0;
    let height = 0;
    let clouds: Cloud[] = [];
    let birds: Bird[] = [];
    let starField: Star[] = [];
    let palette = readPalette();

    const populate = () => {
      const rng = createSeededRandom(seed);
      const cloudCount = randomCount(rng);
      const birdCount = randomCount(rng);
      const cloudYMin = fullPage ? 0.04 : 0.08;
      const cloudYMax = fullPage ? 0.96 : 0.45;
      const birdYMin = fullPage ? 0.08 : 0.12;
      const birdYMax = fullPage ? 0.88 : 0.52;

      clouds = Array.from({ length: cloudCount }, () => ({
        x: randomBetween(rng, -0.2, 1.2),
        y: randomBetween(rng, cloudYMin, cloudYMax),
        scale: randomBetween(rng, fullPage ? 0.65 : 0.55, fullPage ? 1.55 : 1.35),
        speed: randomBetween(rng, 0.006, 0.018) * (rng() < 0.5 ? -1 : 1),
        opacity: randomBetween(rng, 0.14, fullPage ? 0.32 : 0.36),
      }));

      birds = Array.from({ length: birdCount }, () => ({
        x: randomBetween(rng, -0.2, 1.2),
        y: randomBetween(rng, birdYMin, birdYMax),
        scale: randomBetween(rng, 0.7, 1.25),
        speed: randomBetween(rng, 0.07, 0.16) * (rng() < 0.5 ? -1 : 1),
        drift: randomBetween(rng, -0.02, 0.02),
        flapPhase: rng() * Math.PI * 2,
        flapSpeed: randomBetween(rng, 5.5, 9),
      }));

      starField = Array.from({ length: fullPage ? 110 : 70 }, () => ({
        x: rng(),
        y: rng() * (fullPage ? 0.92 : 0.55),
        radius: randomBetween(rng, 0.4, 1.5),
        twinklePhase: rng() * Math.PI * 2,
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

    const drawCloud = (cloud: Cloud) => {
      const x = cloud.x * width;
      const y = cloud.y * height + parallaxRef.current * 0.4;
      const size = 46 * cloud.scale;

      context.save();
      context.globalAlpha = cloud.opacity;
      const gradient = context.createRadialGradient(x, y, size * 0.1, x, y, size * 2.1);
      gradient.addColorStop(0, palette.cloudCore);
      gradient.addColorStop(1, palette.cloudEdge);
      context.fillStyle = gradient;
      [
        [0, 0, 1],
        [size * 0.85, size * 0.16, 0.78],
        [-size * 0.8, size * 0.2, 0.66],
      ].forEach(([dx, dy, k]) => {
        context.beginPath();
        context.ellipse(x + dx, y + dy, size * k * 1.5, size * k * 0.72, 0, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
    };

    const drawBird = (bird: Bird, time: number) => {
      const x = bird.x * width;
      const y = bird.y * height + Math.sin(time * 1.3 + bird.flapPhase) * 6 + parallaxRef.current * 0.75;
      const span = 9 * bird.scale;
      const flap = Math.sin(time * bird.flapSpeed + bird.flapPhase);

      context.save();
      context.strokeStyle = palette.bird;
      context.lineWidth = 1.7 * bird.scale;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(x - span, y - flap * span * 0.55);
      context.quadraticCurveTo(x - span * 0.35, y + span * 0.28, x, y);
      context.quadraticCurveTo(x + span * 0.35, y + span * 0.28, x + span, y - flap * span * 0.55);
      context.stroke();
      context.restore();
    };

    const drawStars = (time: number) => {
      context.save();
      starField.forEach((star) => {
        const twinkle = 0.35 + 0.4 * Math.abs(Math.sin(time * 0.9 + star.twinklePhase));
        context.globalAlpha = twinkle * (1 - star.y / 0.6);
        context.fillStyle = '#ffffff';
        context.beginPath();
        context.arc(star.x * width, star.y * height + parallaxRef.current * 0.2, star.radius, 0, Math.PI * 2);
        context.fill();
      });
      context.restore();
    };

    const birdClampMin = fullPage ? 0.06 : 0.08;
    const birdClampMax = fullPage ? 0.92 : 0.6;

    let frame = 0;
    let previous = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const time = now / 1000;

      palette = readPalette();
      context.clearRect(0, 0, width, height);
      if (stars) {
        drawStars(time);
      }

      clouds.forEach((cloud) => {
        cloud.x += cloud.speed * dt;
        if (cloud.x > 1.35) cloud.x = -0.35;
        if (cloud.x < -0.35) cloud.x = 1.35;
        drawCloud(cloud);
      });

      birds.forEach((bird) => {
        bird.x += bird.speed * dt;
        bird.y += bird.drift * dt;
        if (bird.x > 1.25) bird.x = -0.25;
        if (bird.x < -0.25) bird.x = 1.25;
        if (bird.y < birdClampMin || bird.y > birdClampMax) {
          bird.drift *= -1;
        }
        drawBird(bird, time);
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
  }, [seed, stars, fullPage]);

  return <canvas ref={canvasRef} className="app__sky" aria-hidden="true" />;
}
