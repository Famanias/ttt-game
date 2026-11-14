'use client';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.muted) return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
  }

  public isMuted(): boolean {
    return this.muted;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.08,
    delaySec = 0
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public playPlaceMark(mark: 'X' | 'O') {
    if (mark === 'X') {
      this.playTone(540, 0.11, 'triangle', 0.09);
      this.playTone(720, 0.14, 'sine', 0.06, 0.045);
    } else {
      this.playTone(390, 0.11, 'triangle', 0.09);
      this.playTone(510, 0.14, 'sine', 0.06, 0.045);
    }
  }

  public playVictory() {
    this.playTone(523.25, 0.16, 'triangle', 0.09, 0);
    this.playTone(659.25, 0.16, 'triangle', 0.09, 0.09);
    this.playTone(783.99, 0.2, 'triangle', 0.1, 0.18);
    this.playTone(1046.5, 0.36, 'sine', 0.11, 0.27);
  }

  public playDraw() {
    this.playTone(440, 0.16, 'sine', 0.07, 0);
    this.playTone(392, 0.24, 'sine', 0.07, 0.12);
  }

  public playClashStart() {
    this.playTone(330, 0.09, 'square', 0.045, 0);
    this.playTone(495, 0.12, 'triangle', 0.07, 0.07);
  }

  public playTimingHit(score: number) {
    const freq = score >= 800 ? 880 : score >= 600 ? 660 : 320;
    this.playTone(freq, 0.18, 'triangle', 0.1);
  }

  public playMemoryBlip(step: number) {
    const scale = [440, 493.88, 554.37, 659.25, 739.99, 880];
    this.playTone(scale[step % scale.length], 0.1, 'sine', 0.07);
  }

  public playTargetHit(isBonus: boolean) {
    this.playTone(isBonus ? 960 : 680, 0.09, 'triangle', 0.085);
  }

  public playStreakBonus() {
    this.playTone(587.33, 0.12, 'triangle', 0.09, 0);
    this.playTone(739.99, 0.12, 'triangle', 0.09, 0.08);
    this.playTone(880, 0.14, 'triangle', 0.1, 0.16);
    this.playTone(1174.66, 0.28, 'sine', 0.11, 0.24);
  }
}

export const soundEngine = new SoundEngine();
