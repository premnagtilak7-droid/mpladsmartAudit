'use client';

class SoundFX {
  private ctx: AudioContext | null = null;
  public isMuted = false;

  private init() {
    if (typeof window === 'undefined' || this.ctx) return;
    const AudioCtx = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) this.ctx = new AudioCtx();
  }

  private tone(frequency: number, duration: number, type: OscillatorType, volume: number, delay = 0) {
    if (this.isMuted) return;
    this.init();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    const start = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  playClick() {
    this.tone(440, 0.05, 'sine', 0.05);
  }

  playAlert() {
    this.tone(220, 0.15, 'triangle', 0.1);
  }

  playSuccess() {
    this.tone(523, 0.12, 'sine', 0.05);
    this.tone(659, 0.16, 'sine', 0.045, 0.08);
  }

  playTab() {
    this.tone(600, 0.045, 'square', 0.025);
  }
}

export const soundFX = new SoundFX();

export function playIfEnabled(muted: boolean, effect: keyof SoundFX) {
  soundFX.isMuted = muted;
  const play = soundFX[effect];
  if (typeof play === 'function') (play as () => void).call(soundFX);
}
