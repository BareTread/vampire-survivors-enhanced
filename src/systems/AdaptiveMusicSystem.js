/**
 * AdaptiveMusicSystem — Procedural Layered Soundtrack
 *
 * Generates a dynamic, evolving soundtrack using Web Audio API oscillators.
 * Four independent layers respond to game intensity (derived from FlowState
 * stress level and enemy density):
 *
 *   1. Bass Drone    — Always present, low sine/triangle, slowly modulating
 *   2. Rhythmic Pulse — Staccato square pulses, BPM scales with enemy density
 *   3. Melodic Fragments — C-minor arpeggios triggered by kill events
 *   4. Intensity Sweep — High-pass filter that opens as threat increases
 *
 * Creative direction: eerie at low intensity, driving at medium, overwhelming
 * at high. Uses the AudioManager's shared audioContext — no new context needed.
 */

export class AdaptiveMusicSystem {
    constructor(game) {
        this.game = game;
        this.audioManager = game.audioManager;
        this.audioContext = null;

        // Master output
        this.masterGain = null;
        this.masterVolume = 0.25; // Keep music under SFX

        // State
        this.playing = false;
        this.intensity = 0;         // 0-1, smoothed
        this.targetIntensity = 0;
        this.smoothingFactor = 0.02; // Slow crossfade

        // ── Layer nodes ──
        // Layer 1: Bass Drone
        this.bassOsc1 = null;
        this.bassOsc2 = null;
        this.bassGain = null;
        this.bassLFO = null;
        this.bassLFOGain = null;

        // Layer 2: Rhythmic Pulse
        this.pulseGain = null;
        this.pulseInterval = null;
        this.pulseBPM = 80;
        this.pulseActive = false;

        // Layer 3: Melodic Fragments
        this.melodicGain = null;
        this.melodicCooldown = 0;
        this.lastMelodicTime = 0;

        // Layer 4: Intensity Filter
        this.filterNode = null;
        this.filteredGain = null;
        this.filteredOsc = null;

        // C-minor scale frequencies for melodies (C3 to C5)
        this.cMinorScale = [
            130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08, // C3-Bb3
            261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, // C4-Bb4
            523.25  // C5
        ];

        // Arpeggio patterns (scale degree indices)
        this.arpeggioPatterns = [
            [0, 2, 4, 7],      // Cm: C Eb G C
            [0, 3, 5, 7],      // Cm7: C Eb G Bb → C
            [5, 7, 9, 12],     // Ab: Ab C Eb Ab
            [3, 5, 7, 10],     // Fm: F Ab C F
            [7, 9, 11, 14],    // C octave higher
            [2, 4, 7, 9],      // Eb→G→C→Eb
        ];

        // Timing
        this.updateTimer = 0;
        this.updateInterval = 0.1; // Update 10x per second
    }

    // ── PUBLIC API ──────────────────────────────────────────────

    start() {
        if (this.playing) return;
        if (!this.audioManager) return;

        // Ensure audio context exists (may need user gesture)
        if (!this.audioManager.audioContext) {
            this.audioManager.initializeAudioContext();
        }
        this.audioContext = this.audioManager.audioContext;
        if (!this.audioContext) return;

        // Resume context if suspended (browser autoplay policy)
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => { });
        }

        this.playing = true;
        this.intensity = 0;
        this.targetIntensity = 0;

        this._createMasterChain();
        this._startBassDrone();
        this._startRhythmicPulse();
        this._startIntensityFilter();

        // Fade in master over 2 seconds
        const now = this.audioContext.currentTime;
        this.masterGain.gain.setValueAtTime(0.0001, now);
        this.masterGain.gain.exponentialRampToValueAtTime(
            this.masterVolume * (this.audioManager.musicVolume || 0.4) * (this.audioManager.masterVolume || 1),
            now + 2
        );
    }

    stop() {
        if (!this.playing) return;
        this.playing = false;

        // Fade out over 1 second, then disconnect
        if (this.masterGain && this.audioContext) {
            const now = this.audioContext.currentTime;
            try {
                this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
                this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 1);
            } catch (e) { /* ignore */ }

            // Schedule cleanup
            setTimeout(() => this._cleanup(), 1200);
        } else {
            this._cleanup();
        }

        // Stop pulse scheduler
        if (this.pulseInterval) {
            clearInterval(this.pulseInterval);
            this.pulseInterval = null;
        }
    }

    /**
     * Called every frame from the game loop.
     * @param {number} dt — delta time in seconds
     */
    update(dt) {
        if (!this.playing || !this.audioContext) return;
        if (this.audioManager && this.audioManager.muted) return;

        this.updateTimer += dt;
        if (this.updateTimer < this.updateInterval) return;
        this.updateTimer = 0;

        // Derive target intensity from FlowState + enemy density
        this._updateIntensity();

        // Smooth towards target
        this.intensity += (this.targetIntensity - this.intensity) * this.smoothingFactor;
        this.intensity = Math.max(0, Math.min(1, this.intensity));

        // Update layers based on intensity
        this._updateBassDrone();
        this._updateRhythmicPulse();
        this._updateIntensityFilter();
        this._updateMelodicCooldown(dt * (this.updateInterval > 0 ? 1 : 10));
    }

    /**
     * Trigger a melodic fragment (e.g., on combo milestone or kill streak).
     * Called externally by other systems.
     */
    triggerMelodicFragment() {
        if (!this.playing || !this.audioContext) return;
        if (this.melodicCooldown > 0) return;

        this._playArpeggio();
        this.melodicCooldown = 3.0 + Math.random() * 2; // 3-5s cooldown
    }

    reset() {
        this.stop();
        this.intensity = 0;
        this.targetIntensity = 0;
        this.melodicCooldown = 0;
    }

    // ── PRIVATE — Master Chain ─────────────────────────────────

    _createMasterChain() {
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.0001;
        this.masterGain.connect(this.audioContext.destination);
    }

    // ── PRIVATE — Layer 1: Bass Drone ──────────────────────────

    _startBassDrone() {
        const now = this.audioContext.currentTime;

        this.bassGain = this.audioContext.createGain();
        this.bassGain.gain.value = 0.25;
        this.bassGain.connect(this.masterGain);

        // Primary bass: A1 (55Hz) sine
        this.bassOsc1 = this.audioContext.createOscillator();
        this.bassOsc1.type = 'sine';
        this.bassOsc1.frequency.value = 55;
        this.bassOsc1.connect(this.bassGain);
        this.bassOsc1.start(now);

        // Secondary bass: E2 (82Hz) triangle, softer — power fifth
        this.bassOsc2 = this.audioContext.createOscillator();
        this.bassOsc2.type = 'triangle';
        this.bassOsc2.frequency.value = 82.41;
        const bassOsc2Gain = this.audioContext.createGain();
        bassOsc2Gain.gain.value = 0.15;
        this.bassOsc2.connect(bassOsc2Gain);
        bassOsc2Gain.connect(this.bassGain);
        this.bassOsc2.start(now);

        // LFO for slow frequency modulation (eerie drift)
        this.bassLFO = this.audioContext.createOscillator();
        this.bassLFO.type = 'sine';
        this.bassLFO.frequency.value = 0.15; // Very slow
        this.bassLFOGain = this.audioContext.createGain();
        this.bassLFOGain.gain.value = 3; // ±3Hz modulation
        this.bassLFO.connect(this.bassLFOGain);
        this.bassLFOGain.connect(this.bassOsc1.frequency);
        this.bassLFO.start(now);
    }

    _updateBassDrone() {
        if (!this.bassGain) return;

        // Bass gets slightly louder and the LFO faster at high intensity
        const bassVol = 0.25 + this.intensity * 0.2;
        try {
            this.bassGain.gain.setTargetAtTime(bassVol, this.audioContext.currentTime, 0.5);
        } catch (e) { /* ignore */ }

        // LFO speed increases with intensity (eerie → unsettling)
        if (this.bassLFO) {
            const lfoSpeed = 0.1 + this.intensity * 0.4;
            try {
                this.bassLFO.frequency.setTargetAtTime(lfoSpeed, this.audioContext.currentTime, 0.3);
            } catch (e) { /* ignore */ }
        }

        // Modulation depth increases
        if (this.bassLFOGain) {
            const modDepth = 2 + this.intensity * 8;
            try {
                this.bassLFOGain.gain.setTargetAtTime(modDepth, this.audioContext.currentTime, 0.3);
            } catch (e) { /* ignore */ }
        }
    }

    // ── PRIVATE — Layer 2: Rhythmic Pulse ──────────────────────

    _startRhythmicPulse() {
        this.pulseGain = this.audioContext.createGain();
        this.pulseGain.gain.value = 0; // Starts silent, fades in with intensity
        this.pulseGain.connect(this.masterGain);

        this.pulseActive = true;
        this._schedulePulse();
    }

    _schedulePulse() {
        if (!this.pulseActive || !this.playing) return;

        // BPM scales: 70 at low intensity → 140 at high
        this.pulseBPM = 70 + this.intensity * 70;
        const intervalMs = (60 / this.pulseBPM) * 1000;

        this.pulseInterval = setTimeout(() => {
            if (!this.playing || !this.audioContext) return;
            this._playPulseBeat();
            this._schedulePulse(); // Reschedule
        }, intervalMs);
    }

    _playPulseBeat() {
        if (!this.audioContext || !this.pulseGain) return;
        if (this.intensity < 0.15) return; // Don't pulse at very low intensity

        const now = this.audioContext.currentTime;

        // Staccato triangle wave beat (softer than square)
        const osc = this.audioContext.createOscillator();
        osc.type = 'triangle';

        // Pitch follows a simple pattern: root and fifth alternating
        const beatPitch = Math.random() > 0.5 ? 55 : 82.41;
        osc.frequency.value = beatPitch;

        const env = this.audioContext.createGain();
        const vol = Math.min(0.12, this.intensity * 0.15);
        env.gain.setValueAtTime(0.0001, now);
        env.gain.exponentialRampToValueAtTime(vol, now + 0.01);
        env.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

        osc.connect(env);
        env.connect(this.pulseGain);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    _updateRhythmicPulse() {
        if (!this.pulseGain) return;

        // Fade pulse layer in/out based on intensity
        const pulseVol = this.intensity > 0.15 ? (0.2 + this.intensity * 0.3) : 0;
        try {
            this.pulseGain.gain.setTargetAtTime(pulseVol, this.audioContext.currentTime, 0.3);
        } catch (e) { /* ignore */ }
    }

    // ── PRIVATE — Layer 3: Melodic Fragments ───────────────────

    _updateMelodicCooldown(dt) {
        if (this.melodicCooldown > 0) {
            this.melodicCooldown -= dt;
        }

        // Auto-trigger melodic fragments at high intensity
        if (this.intensity > 0.6 && this.melodicCooldown <= 0 && Math.random() < 0.03) {
            this._playArpeggio();
            this.melodicCooldown = 4.0 + Math.random() * 3;
        }
    }

    _playArpeggio() {
        if (!this.audioContext || !this.masterGain) return;

        const now = this.audioContext.currentTime;
        const pattern = this.arpeggioPatterns[Math.floor(Math.random() * this.arpeggioPatterns.length)];

        // Create a melodic gain node for this fragment
        const fragGain = this.audioContext.createGain();
        const vol = 0.08 + this.intensity * 0.06;
        fragGain.gain.value = vol;
        fragGain.connect(this.masterGain);

        // Play arpeggio notes with stagger
        const noteSpacing = 0.12 - this.intensity * 0.04; // Faster at high intensity
        const noteDuration = 0.3 + (1 - this.intensity) * 0.2;

        pattern.forEach((degreeIdx, i) => {
            const freq = this.cMinorScale[Math.min(degreeIdx, this.cMinorScale.length - 1)];
            const noteTime = now + i * noteSpacing;

            // Sine tone
            const osc = this.audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;

            // Second oscillator: triangle an octave up (shimmer)
            const osc2 = this.audioContext.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.value = freq * 2;

            const noteGain = this.audioContext.createGain();
            const noteVol = 0.1 * (1 - i * 0.15); // Slight decay per note
            noteGain.gain.setValueAtTime(0.0001, noteTime);
            noteGain.gain.exponentialRampToValueAtTime(Math.max(0.001, noteVol), noteTime + 0.02);
            noteGain.gain.setValueAtTime(noteVol * 0.7, noteTime + noteDuration * 0.5);
            noteGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + noteDuration);

            const shimmerGain = this.audioContext.createGain();
            shimmerGain.gain.value = 0.03;

            osc.connect(noteGain);
            osc2.connect(shimmerGain);
            shimmerGain.connect(noteGain);
            noteGain.connect(fragGain);

            osc.start(noteTime);
            osc.stop(noteTime + noteDuration + 0.01);
            osc2.start(noteTime);
            osc2.stop(noteTime + noteDuration + 0.01);
        });

        // Fade out fragment gain after full arpeggio
        const totalDur = pattern.length * noteSpacing + noteDuration;
        setTimeout(() => {
            try {
                fragGain.disconnect();
            } catch (e) { /* ignore */ }
        }, (totalDur + 0.5) * 1000);
    }

    // ── PRIVATE — Layer 4: Intensity Filter ────────────────────

    _startIntensityFilter() {
        const now = this.audioContext.currentTime;

        // Create a broadband noise/tone source that gets filtered
        this.filteredGain = this.audioContext.createGain();
        this.filteredGain.gain.value = 0;
        this.filteredGain.connect(this.masterGain);

        // High-pass filter — starts closed (high cutoff), opens up
        this.filterNode = this.audioContext.createBiquadFilter();
        this.filterNode.type = 'highpass';
        this.filterNode.frequency.value = 4000; // Start closed
        this.filterNode.Q.value = 2;
        this.filterNode.connect(this.filteredGain);

        // Triangle oscillator through the filter (softer than sawtooth, still creates tension)
        this.filteredOsc = this.audioContext.createOscillator();
        this.filteredOsc.type = 'triangle';
        this.filteredOsc.frequency.value = 110; // A2
        this.filteredOsc.connect(this.filterNode);
        this.filteredOsc.start(now);
    }

    _updateIntensityFilter() {
        if (!this.filterNode || !this.filteredGain) return;

        // Filter opens (lower cutoff) as intensity rises
        // At intensity 0: cutoff 4000Hz (barely audible), volume 0
        // At intensity 1: cutoff 200Hz (full roar), volume 0.2
        const cutoff = 4000 - this.intensity * 3800;
        const filterVol = this.intensity > 0.3 ? (this.intensity - 0.3) * 0.3 : 0;

        try {
            this.filterNode.frequency.setTargetAtTime(
                Math.max(50, cutoff),
                this.audioContext.currentTime,
                0.5
            );
            this.filteredGain.gain.setTargetAtTime(filterVol, this.audioContext.currentTime, 0.3);
        } catch (e) { /* ignore */ }
    }

    // ── PRIVATE — Intensity Calculation ────────────────────────

    _updateIntensity() {
        let intensity = 0;

        // Primary source: FlowState stress level (0-1)
        const flowState = this.game.systems?.flowState;
        if (flowState && flowState.playerPerformance) {
            intensity = flowState.playerPerformance.stressLevel || 0;
        }

        // Secondary source: raw enemy density
        const enemySystem = this.game.systems?.enemy;
        if (enemySystem) {
            const enemyCount = enemySystem.getEnemyCount ? enemySystem.getEnemyCount() : 0;
            const densityFactor = Math.min(1, enemyCount / 80); // Normalize to 80 enemies = max
            // Blend: 60% FlowState, 40% enemy density
            intensity = intensity * 0.6 + densityFactor * 0.4;
        }

        // Tertiary: player health urgency
        const player = this.game.player;
        if (player) {
            const healthRatio = player.health / player.maxHealth;
            if (healthRatio < 0.3) {
                intensity = Math.min(1, intensity + (0.3 - healthRatio) * 0.5);
            }
        }

        this.targetIntensity = Math.max(0, Math.min(1, intensity));
    }

    // ── PRIVATE — Cleanup ──────────────────────────────────────

    _cleanup() {
        const nodes = [
            this.bassOsc1, this.bassOsc2, this.bassLFO,
            this.filteredOsc
        ];

        for (const node of nodes) {
            if (node) {
                try { node.stop(); } catch (e) { /* already stopped */ }
                try { node.disconnect(); } catch (e) { /* ignore */ }
            }
        }

        const gains = [
            this.bassGain, this.bassLFOGain, this.pulseGain,
            this.filteredGain, this.masterGain
        ];

        for (const gain of gains) {
            if (gain) {
                try { gain.disconnect(); } catch (e) { /* ignore */ }
            }
        }

        if (this.filterNode) {
            try { this.filterNode.disconnect(); } catch (e) { /* ignore */ }
        }

        if (this.pulseInterval) {
            clearTimeout(this.pulseInterval);
            this.pulseInterval = null;
        }

        // Reset references
        this.bassOsc1 = null;
        this.bassOsc2 = null;
        this.bassLFO = null;
        this.bassLFOGain = null;
        this.bassGain = null;
        this.pulseGain = null;
        this.filteredOsc = null;
        this.filteredGain = null;
        this.filterNode = null;
        this.masterGain = null;
        this.pulseActive = false;
    }

    // ── Debug ──────────────────────────────────────────────────

    getDebugInfo() {
        return {
            playing: this.playing,
            intensity: this.intensity.toFixed(2),
            targetIntensity: this.targetIntensity.toFixed(2),
            pulseBPM: Math.round(this.pulseBPM),
            melodicCooldown: this.melodicCooldown.toFixed(1)
        };
    }
}
