'use client';

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextCtor = window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  audioContext ??= new AudioContextCtor();
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

function tone(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.035, delay = 0) {
  const context = getAudioContext();
  if (!context) return;
  const start = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export const soundFX = {
  playClick: () => tone(440, 0.02, 'sine', 0.025),
  playSuccess: () => {
    tone(523, 0.12, 'sine', 0.035);
    tone(659, 0.16, 'sine', 0.03, 0.08);
  },
  playAlert: () => tone(220, 0.12, 'triangle', 0.045),
  playTab: () => tone(600, 0.045, 'square', 0.018),
};

export function playIfEnabled(muted: boolean, effect: keyof typeof soundFX) {
  if (!muted) soundFX[effect]();
}
