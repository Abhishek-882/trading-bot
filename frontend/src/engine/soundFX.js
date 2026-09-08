/**
 * SoundFX — Native Web Audio API Synthesizer
 * Provides tactile acoustic micro-feedback with zero external audio assets.
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    // Load persisted mute preference
    if (typeof localStorage !== 'undefined') {
      this.isMuted = localStorage.getItem('gmgn_sound_muted') === 'true';
    }
  }

  _initContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gmgn_sound_muted', this.isMuted.toString());
    }
    if (!this.isMuted) {
      this.playClick();
    }
    return this.isMuted;
  }

  /**
   * Tactile micro-click for UI buttons, tabs, and filter adjustments
   */
  playClick(freq = 1200, duration = 0.03) {
    if (this.isMuted) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch { /* Audio unavailable */ }
  }

  /**
   * Holographic chime when inspecting a coin or discovering high score gems
   */
  playHoloPing() {
    if (this.isMuted) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const freqs = [880, 1320, 1760];
      freqs.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const startTime = this.ctx.currentTime + (idx * 0.04);
        const duration = 0.25;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.03, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);
      });
    } catch { /* Audio unavailable */ }
  }

  playChime() {
    this.playHoloPing();
  }


  /**
   * Deep museum turntable acoustic hum on inspection modal open
   */
  playTurntableHum() {
    if (this.isMuted) return;
    try {
      this._initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const duration = 0.4;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.06, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch { /* Audio unavailable */ }
  }
}

export const sound = new SoundEffects();
export default sound;
