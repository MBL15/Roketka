/**
 * Звуковое оформление на Web Audio API.
 *
 * Все эффекты синтезируются в браузере, а не загружаются файлами. Причины:
 * в репозитории нет бинарных ассетов, звук не тратит трафик и не задерживает
 * первый кадр, а тембр каждого события можно связать с игровым смыслом —
 * например, звук прохождения уровня поднимается по высоте вместе с номером
 * уровня, а активация бустера звучит тем выше, чем сильнее множитель.
 *
 * Браузеры запрещают автозапуск звука до первого действия пользователя,
 * поэтому контекст создаётся лениво, при первом же клике.
 */

type Envelope = { attack: number; decay: number; peak: number };

const BIRD_MIN_DELAY_MS = 1800;
const BIRD_MAX_DELAY_MS = 5000;

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private enabled = true;
  private birdTimer: number | null = null;
  /** Метка последнего звука птицы: не перекрываем другие эффекты. */
  private lastEffectAt = 0;

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.master) {
      this.master.gain.value = enabled ? 0.5 : 0;
    }
    if (!enabled) {
      this.stopAmbient();
    }
  }

  /** Вызывается из обработчика пользовательского действия. */
  unlock(): void {
    this.ensureContext();
    if (this.context?.state === 'suspended') {
      void this.context.resume();
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.context) {
      return this.context;
    }
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      return null;
    }
    this.context = new Ctor();
    this.master = this.context.createGain();
    this.master.gain.value = this.enabled ? 0.5 : 0;
    this.master.connect(this.context.destination);
    return this.context;
  }

  // ------------------------------------------------------------- примитивы

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    envelope: Envelope,
    detuneTo?: number,
  ): void {
    const context = this.ensureContext();
    if (!context || !this.master || !this.enabled) {
      return;
    }
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (detuneTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, detuneTo), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(envelope.peak, now + envelope.attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + envelope.attack + envelope.decay);

    oscillator.connect(gain).connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.05);
  }

  private noise(duration: number, peak: number, filterFrom: number, filterTo: number): void {
    const context = this.ensureContext();
    if (!context || !this.master || !this.enabled) {
      return;
    }
    const now = context.currentTime;
    const frames = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, frames, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      // Затухающий белый шум: основа для взрыва и шелеста.
      channel[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const source = context.createBufferSource();
    source.buffer = buffer;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFrom, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, filterTo), now + duration);

    const gain = context.createGain();
    gain.gain.setValueAtTime(peak, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter).connect(gain).connect(this.master);
    source.start(now);
  }

  private markEffect(): void {
    this.lastEffectAt = Date.now();
  }

  // ------------------------------------------------------- игровые события

  click(): void {
    this.markEffect();
    this.tone(520, 0.06, 'triangle', { attack: 0.004, decay: 0.05, peak: 0.12 }, 380);
  }

  error(): void {
    this.markEffect();
    this.tone(190, 0.22, 'square', { attack: 0.01, decay: 0.2, peak: 0.1 }, 120);
  }

  /** Короткий «щелчок капли»: звучит при выборе темы игры. */
  waterDrop(): void {
    this.markEffect();
    this.tone(1250, 0.2, 'sine', { attack: 0.004, decay: 0.18, peak: 0.22 }, 260);
    window.setTimeout(() => this.tone(680, 0.12, 'sine', { attack: 0.004, decay: 0.1, peak: 0.1 }, 320), 60);
  }

  /** Ставка подтверждена: восходящая триоль, «шар отрывается от земли». */
  launch(): void {
    this.markEffect();
    [392, 523, 659].forEach((frequency, index) => {
      window.setTimeout(
        () => this.tone(frequency, 0.16, 'triangle', { attack: 0.008, decay: 0.15, peak: 0.14 }),
        index * 70,
      );
    });
  }

  /** Пересечён уровень: высота тона растёт вместе с номером уровня. */
  levelUp(level: number, levelCount: number): void {
    this.markEffect();
    const progress = levelCount > 1 ? (level - 1) / (levelCount - 1) : 0;
    const frequency = 520 + progress * 620;
    this.tone(frequency, 0.12, 'triangle', { attack: 0.004, decay: 0.11, peak: 0.13 });
  }

  /** Активация бустера: аккорд, тем выше и плотнее, чем больше множитель. */
  boost(tier: number): void {
    this.markEffect();
    const base = 440 + tier * 70;
    [1, 1.25, 1.5, 2].forEach((ratio, index) => {
      window.setTimeout(
        () => this.tone(base * ratio, 0.3, 'sawtooth', { attack: 0.01, decay: 0.28, peak: 0.08 }),
        index * 45,
      );
    });
  }

  /** Успешная фиксация выигрыша. */
  cashout(): void {
    this.markEffect();
    [659, 880, 1175].forEach((frequency, index) => {
      window.setTimeout(
        () => this.tone(frequency, 0.28, 'sine', { attack: 0.006, decay: 0.26, peak: 0.16 }),
        index * 80,
      );
    });
  }

  /** Шар лопнул: хлопок и падающий свист. */
  crash(): void {
    this.markEffect();
    this.noise(0.5, 0.34, 4200, 120);
    this.tone(420, 0.55, 'sawtooth', { attack: 0.006, decay: 0.5, peak: 0.12 }, 70);
  }

  /** Коллекция собрана. */
  reward(): void {
    this.markEffect();
    [523, 659, 784, 1046].forEach((frequency, index) => {
      window.setTimeout(
        () => this.tone(frequency, 0.34, 'triangle', { attack: 0.008, decay: 0.32, peak: 0.13 }),
        index * 90,
      );
    });
  }

  // ------------------------------------------------------------- атмосфера

  /**
   * Случайные голоса птиц каждые 1.8–5 секунд.
   * Если только что прозвучал игровой эффект, птица пропускает свою очередь,
   * чтобы не перекрывать важную обратную связь.
   */
  startAmbient(): void {
    if (this.birdTimer !== null) {
      return;
    }
    const schedule = () => {
      const delay = BIRD_MIN_DELAY_MS + Math.random() * (BIRD_MAX_DELAY_MS - BIRD_MIN_DELAY_MS);
      this.birdTimer = window.setTimeout(() => {
        if (Date.now() - this.lastEffectAt > 700) {
          this.birdChirp();
        }
        schedule();
      }, delay);
    };
    schedule();
  }

  stopAmbient(): void {
    if (this.birdTimer !== null) {
      window.clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
  }

  private birdChirp(): void {
    const base = 1700 + Math.random() * 1100;
    const chirps = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < chirps; i += 1) {
      window.setTimeout(() => {
        const from = base * (0.9 + Math.random() * 0.25);
        this.tone(from, 0.09, 'sine', { attack: 0.006, decay: 0.08, peak: 0.045 }, from * 1.5);
      }, i * (60 + Math.random() * 70));
    }
  }
}

export const audio = new AudioEngine();
