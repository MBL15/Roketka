import { useEffect, useRef } from 'react';

/**
 * Анимированное небо: фон всех экранов.
 *
 * По постановке на экране одновременно живут от 1 до 3 птиц и от 1 до 3
 * облаков, движущихся по случайным траекториям, причём птицы быстрее облаков —
 * это и создаёт ощущение глубины. Количество и позиции генерируются заново
 * при каждом входе на экран (проп `seed`).
 *
 * Рисуется одним canvas, а не набором DOM-элементов: это один слой композиции
 * вместо десятка, отсутствие перерасчёта стилей и предсказуемые 60 FPS даже на
 * слабых устройствах. Тяжёлые графические библиотеки не нужны — вся сцена это
 * несколько десятков вызовов 2D-контекста на кадр.
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

interface SkyProps {
  /** Смена значения перегенерирует небо: новые позиции птиц и облаков. */
  seed: number;
  /** Ночное небо со звёздами включается на экранах, где нет ярких панелей. */
  stars?: boolean;
  /** Смещение неба вниз при подъёме шара: параллакс игрового экрана. */
  parallax?: number;
}

const randomBetween = (min: number, max: number): number => min + Math.random() * (max - min);
const randomCount = (): number => 1 + Math.floor(Math.random() * 3);

export function Sky({ seed, stars = true, parallax = 0 }: SkyProps): JSX.Element {
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

    const populate = () => {
      clouds = Array.from({ length: randomCount() }, () => ({
        x: randomBetween(-0.2, 1.2),
        y: randomBetween(0.08, 0.45),
        scale: randomBetween(0.55, 1.35),
        // Облака медленные: 0.006–0.018 экрана в секунду.
        speed: randomBetween(0.006, 0.018) * (Math.random() < 0.5 ? -1 : 1),
        opacity: randomBetween(0.16, 0.36),
      }));

      birds = Array.from({ length: randomCount() }, () => ({
        x: randomBetween(-0.2, 1.2),
        y: randomBetween(0.12, 0.52),
        scale: randomBetween(0.7, 1.25),
        // Птицы в 6–12 раз быстрее облаков — отсюда эффект глубины.
        speed: randomBetween(0.07, 0.16) * (Math.random() < 0.5 ? -1 : 1),
        drift: randomBetween(-0.02, 0.02),
        flapPhase: Math.random() * Math.PI * 2,
        flapSpeed: randomBetween(5.5, 9),
      }));

      starField = Array.from({ length: 70 }, () => ({
        x: Math.random(),
        y: Math.random() * 0.55,
        radius: randomBetween(0.4, 1.5),
        twinklePhase: Math.random() * Math.PI * 2,
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
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      context.fillStyle = gradient;
      // Три перекрывающихся эллипса дают силуэт кучевого облака.
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
      context.strokeStyle = 'rgba(12, 28, 38, 0.55)';
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

    let frame = 0;
    let previous = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      const time = now / 1000;

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
        if (bird.y < 0.08 || bird.y > 0.6) bird.drift *= -1;
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
  }, [seed, stars]);

  return <canvas ref={canvasRef} className="app__sky" aria-hidden="true" />;
}
