/**
 * Audio Engine for "Fist Fight"
 * Procedural retro arcade sound synthesis using Web Audio API.
 * No external sound files required!
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.initialized = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.initialized = true;
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    // Helper: create master gain
    getMasterGain(vol = 1.0) {
        const gain = this.ctx.createGain();
        gain.gain.value = this.muted ? 0 : vol;
        gain.connect(this.ctx.destination);
        return gain;
    }

    // Quick whoosh for a punch thrown
    playWhoosh() {
        if (this.muted) return;
        this.init();
        const t = this.ctx.currentTime;
        const master = this.getMasterGain(0.35);

        // White noise buffer
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.18);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 3.0;
        filter.frequency.setValueAtTime(800, t);
        filter.frequency.exponentialRampToValueAtTime(160, t + 0.16);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.01, t);
        env.gain.linearRampToValueAtTime(0.7, t + 0.04);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.17);

        noise.connect(filter);
        filter.connect(env);
        env.connect(master);

        noise.start(t);
        noise.stop(t + 0.18);
    }

    // Solid punch impact on target
    playHit(heavy = false) {
        if (this.muted) return;
        this.init();
        const t = this.ctx.currentTime;
        const master = this.getMasterGain(heavy ? 0.6 : 0.45);

        // Low thump oscillator
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'triangle';
        const startFreq = heavy ? 220 : 160;
        const endFreq = heavy ? 30 : 45;
        const duration = heavy ? 0.28 : 0.18;

        osc.frequency.setValueAtTime(startFreq, t);
        osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);

        oscGain.gain.setValueAtTime(1.0, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        osc.connect(oscGain);
        oscGain.connect(master);
        osc.start(t);
        osc.stop(t + duration);

        // Crunch noise
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.1);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.value = heavy ? 1200 : 900;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.9, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.09);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(master);
        noise.start(t);
        noise.stop(t + 0.1);
    }

    // Metallic block sound (deflected blow)
    playBlock() {
        if (this.muted) return;
        this.init();
        const t = this.ctx.currentTime;
        const master = this.getMasterGain(0.4);

        // High metallic ping
        [680, 1120, 1750].forEach((freq) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.2, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

            osc.connect(gain);
            gain.connect(master);
            osc.start(t);
            osc.stop(t + 0.15);
        });
    }

    // Boxing match round start bell ("DING DING!")
    playBell() {
        if (this.muted) return;
        this.init();
        const ringBell = (timeOffset) => {
            const t = this.ctx.currentTime + timeOffset;
            const master = this.getMasterGain(0.45);

            [1040, 2080, 3120].forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;

                const amp = 0.35 / (idx + 1);
                gain.gain.setValueAtTime(amp, t);
                gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);

                osc.connect(gain);
                gain.connect(master);
                osc.start(t);
                osc.stop(t + 1.3);
            });
        };

        ringBell(0.0);
        ringBell(0.35);
    }

    // Heavy Knockout gong
    playKO() {
        if (this.muted) return;
        this.init();
        const t = this.ctx.currentTime;
        const master = this.getMasterGain(0.7);

        [120, 178, 260, 410].forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.4 / (idx + 1), t);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);

            osc.connect(gain);
            gain.connect(master);
            osc.start(t);
            osc.stop(t + 2.5);
        });
    }

    // Victory fanfare arpeggio
    playVictory() {
        if (this.muted) return;
        this.init();
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major
        notes.forEach((freq, i) => {
            const t = this.ctx.currentTime + i * 0.11;
            const master = this.getMasterGain(0.35);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1800;

            gain.gain.setValueAtTime(0.25, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + (i === notes.length - 1 ? 0.8 : 0.22));

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(master);

            osc.start(t);
            osc.stop(t + (i === notes.length - 1 ? 0.9 : 0.25));
        });
    }

    // Player lost / Game Over sound
    playDefeat() {
        if (this.muted) return;
        this.init();
        const notes = [392.00, 369.99, 349.23, 311.13]; // Descending chromatic sad tone
        notes.forEach((freq, i) => {
            const t = this.ctx.currentTime + i * 0.25;
            const master = this.getMasterGain(0.35);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0.3, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

            osc.connect(gain);
            gain.connect(master);

            osc.start(t);
            osc.stop(t + 0.45);
        });
    }

    // UI Click
    playBeep(pitch = 800) {
        if (this.muted) return;
        this.init();
        const t = this.ctx.currentTime;
        const master = this.getMasterGain(0.15);
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = pitch;
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        osc.connect(gain);
        gain.connect(master);
        osc.start(t);
        osc.stop(t + 0.07);
    }
}

window.soundEngine = new SoundEngine();
