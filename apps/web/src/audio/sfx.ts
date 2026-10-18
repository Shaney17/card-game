import { createStore } from '../net/store';

/**
 * Sound manifest: âm thanh được tổng hợp bằng WebAudio (không cần file, không vướng bản quyền).
 * Khoá âm thanh đến từ log của server (trường `sfx`).
 */
const MUTE_KEY = 'chieu-bai.muted';
function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
export const muted = createStore<boolean>(readMuted());
export function setMuted(v: boolean) {
  muted.set(v);
  try {
    localStorage.setItem(MUTE_KEY, v ? '1' : '0');
  } catch {
    /* bỏ qua */
  }
}

let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; at?: number; slide?: number } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + (opts.at ?? 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.18, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, opts: { at?: number; gain?: number; freq?: number; q?: number; type?: BiquadFilterType } = {}) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + (opts.at ?? 0);
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.value = opts.freq ?? 2000;
  f.Q.value = opts.q ?? 0.8;
  const g = a.createGain();
  g.gain.value = opts.gain ?? 0.25;
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

export const SOUNDS: Record<string, () => void> = {
  play: () => {
    noise(0.08, { freq: 1800, gain: 0.35 });
    tone(220, 0.09, { type: 'triangle', gain: 0.12 });
  },
  playStrong: () => {
    noise(0.1, { freq: 1400, gain: 0.4 });
    tone(330, 0.16, { type: 'triangle', gain: 0.16, slide: 1.4 });
  },
  pass: () => tone(300, 0.12, { type: 'sine', gain: 0.08, slide: 0.7 }),
  draw: () => noise(0.16, { freq: 3200, gain: 0.25, q: 0.6 }),
  deal: () => {
    for (let i = 0; i < 6; i++) noise(0.05, { at: i * 0.06, freq: 2600, gain: 0.25 });
  },
  turn: () => {
    tone(880, 0.18, { gain: 0.07 });
    tone(1320, 0.22, { gain: 0.05, at: 0.06 });
  },
  alert: () => {
    tone(740, 0.12, { type: 'square', gain: 0.05 });
    tone(740, 0.12, { type: 'square', gain: 0.05, at: 0.16 });
  },
  cut: () => {
    noise(0.12, { freq: 900, gain: 0.45, type: 'lowpass' });
    tone(160, 0.3, { type: 'sawtooth', gain: 0.12, slide: 0.5 });
    tone(1200, 0.15, { type: 'square', gain: 0.05, at: 0.05 });
  },
  sam: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, { type: 'triangle', gain: 0.1, at: i * 0.09 })),
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.12, at: i * 0.1 })),
  lose: () => [440, 370, 311, 262].forEach((f, i) => tone(f, 0.28, { type: 'sine', gain: 0.1, at: i * 0.14 })),
  roundEnd: () => tone(660, 0.4, { type: 'triangle', gain: 0.08 }),
  start: () => [392, 523].forEach((f, i) => tone(f, 0.2, { type: 'triangle', gain: 0.1, at: i * 0.1 })),
  join: () => tone(660, 0.12, { gain: 0.07, slide: 1.3 }),
  leave: () => tone(500, 0.14, { gain: 0.06, slide: 0.7 }),
  explode: () => {
    noise(0.9, { freq: 300, gain: 0.8, type: 'lowpass', q: 0.3 });
    tone(90, 0.8, { type: 'sawtooth', gain: 0.2, slide: 0.3 });
  },
  defuse: () => {
    tone(1200, 0.08, { type: 'square', gain: 0.05 });
    tone(1600, 0.08, { type: 'square', gain: 0.05, at: 0.1 });
    tone(2000, 0.2, { type: 'triangle', gain: 0.08, at: 0.2 });
  },
  nope: () => {
    tone(180, 0.25, { type: 'square', gain: 0.09 });
    tone(150, 0.3, { type: 'square', gain: 0.08, at: 0.1 });
  },
  attack: () => {
    noise(0.2, { freq: 600, gain: 0.5, type: 'lowpass' });
    tone(260, 0.2, { type: 'sawtooth', gain: 0.1, slide: 0.6 });
  },
  steal: () => tone(500, 0.25, { type: 'triangle', gain: 0.1, slide: 2 }),
  shuffle: () => {
    for (let i = 0; i < 8; i++) noise(0.04, { at: i * 0.035, freq: 2200 + i * 150, gain: 0.2 });
  },
  magic: () => [988, 1319, 1568, 1976].forEach((f, i) => tone(f, 0.25, { gain: 0.05, at: i * 0.07 })),
  place: () => tone(200, 0.2, { type: 'triangle', gain: 0.12, slide: 0.8 }),
  click: () => tone(1000, 0.04, { type: 'square', gain: 0.03 }),
};

export function playSfx(key: string | undefined) {
  if (!key || muted.get()) return;
  try {
    SOUNDS[key]?.();
  } catch {
    /* trình duyệt chặn âm thanh — bỏ qua */
  }
}
