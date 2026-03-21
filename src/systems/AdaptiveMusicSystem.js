export class AdaptiveMusicSystem {
    constructor(game) {
        this.game = game;
        this.audioManager = game.audioManager;
        this.playing = false;

        // Intensity tracking
        this.targetIntensity = 0;
        this.intensity = 0;

        // Slow, sparse pulse-based score. Intentional silence is part of the design.
        this.bpm = 76;
        this.beatDuration = 60 / this.bpm;
        this.beatAccumulator = 0;
        this.currentBeat = 0;

        // Phrase state
        this.measureLength = 8;
        this.motifBoost = 0;
        this.lastMotifBeat = -999;
        this.padMode = 0;

        // Curated motifs in scale-degree space relative to D3 (index 5)
        this.motifsLow = [
            [0, 2, 1],
            [0, 1, 3],
            [0, 2, 4]
        ];
        this.motifsMid = [
            [0, 2, 4, 2],
            [0, 1, 3, 1],
            [2, 4, 3, 1]
        ];
        this.motifsHigh = [
            [0, 2, 4, 7],
            [2, 4, 7, 4],
            [0, 3, 4, 7]
        ];

        // Timing
        this.updateTimer = 0;
        this.updateInterval = 0.1;
    }

    start() {
        if (this.playing) return;
        this.playing = true;
        this.intensity = 0;
        this.targetIntensity = 0;
        this.beatAccumulator = 0;
        this.currentBeat = 0;
        this.motifBoost = 0;
        this.lastMotifBeat = -999;
        this.padMode = 0;

        if (this.audioManager) {
            this.audioManager.setGameIntensity(0);
        }
    }

    stop() {
        if (!this.playing) return;
        this.playing = false;
        if (this.audioManager) {
            this.audioManager.setGameIntensity(0);
        }
    }

    update(dt) {
        if (!this.playing || !this.audioManager) return;

        this.updateTimer += dt;
        if (this.updateTimer >= this.updateInterval) {
            this.updateTimer = 0;
            this._recalcIntensity();
        }

        this.beatAccumulator += dt;
        while (this.beatAccumulator >= this.beatDuration) {
            this.beatAccumulator -= this.beatDuration;
            this._onBeat(this.currentBeat);
            this.currentBeat++;
        }
    }

    _recalcIntensity() {
        let calc = 0;

        const flowState = this.game.systems?.flowState;
        if (flowState?.playerPerformance) {
            calc = flowState.playerPerformance.stressLevel || 0;
        }

        const enemySystem = this.game.systems?.enemy;
        if (enemySystem?.getEnemyCount) {
            const count = enemySystem.getEnemyCount();
            calc = calc * 0.45 + Math.min(1, count / 110) * 0.55;
        }

        const player = this.game.player;
        if (player && player.maxHealth > 0) {
            const healthRatio = player.health / player.maxHealth;
            if (healthRatio < 0.45) calc += 0.08;
            if (healthRatio < 0.25) calc += 0.18;
        }

        this.targetIntensity = Math.max(0, Math.min(1, calc));
        this.intensity += (this.targetIntensity - this.intensity) * 0.065;
        this.intensity = Math.round(this.intensity * 10000) / 10000;
        this.audioManager.setGameIntensity(this.intensity);
    }

    _onBeat(beat) {
        if (!this.audioManager?.initialized || this.audioManager.muted) return;

        const am = this.audioManager;
        const vol = am.musicVolume * am.masterVolume * 0.72;
        if (vol <= 0.001) return;

        const slot = beat % this.measureLength;
        const bar = Math.floor(beat / this.measureLength);
        const restBar = this._isRestBar(bar);

        // Very low intensity: mostly silence, with only rare ghost blooms.
        if (this.intensity < 0.16) {
            if (slot === 0 && bar % 8 === 0) {
                this._playPadBloom(vol * 0.28, true);
            }
            return;
        }

        // Composed gaps are intentional. Rest bars keep the score from becoming wallpaper.
        if (restBar) {
            if (slot === 0 && this.intensity >= 0.22 && bar % 4 === 0) {
                this._playPadBloom(vol * 0.34, true);
            }
            return;
        }

        // Foundation: one harmonic bloom per active measure.
        if (slot === 0) {
            this._playPadBloom(vol, false);
        }

        // Bass support arrives late and stays sparse.
        if (this.intensity >= 0.34) {
            const bassBeats = this.intensity >= 0.82 ? [0, 4, 6] : this.intensity >= 0.6 ? [0, 4] : [0];
            if (bassBeats.includes(slot)) {
                this._playBassPulse(vol);
            }
        }

        // Only add answer pulses in truly dense combat.
        if (this.intensity >= 0.74 && (slot === 3 || slot === 7)) {
            this._playEchoPulse(vol * 0.8);
        }

        const shouldMotif =
            (slot === 6 && this.intensity >= 0.5 && bar % 4 === 2) ||
            (slot === 2 && this.intensity >= 0.9 && bar % 2 === 0) ||
            this.motifBoost > 0;

        if (shouldMotif && beat - this.lastMotifBeat >= 8) {
            this._playMotif(vol, this.motifBoost > 0);
            this.lastMotifBeat = beat;
            this.motifBoost = Math.max(0, this.motifBoost - 1);
        }

        // Rare air at peak danger only.
        if (this.intensity >= 0.93 && slot === 7 && bar % 4 === 3) {
            this._playHighAir(vol * 0.8);
        }
    }

    _isRestBar(bar) {
        if (this.intensity < 0.28) return bar % 2 === 1;
        if (this.intensity < 0.55) return bar % 4 === 1 || bar % 4 === 3;
        if (this.intensity < 0.82) return bar % 4 === 3;
        return bar % 8 === 7;
    }

    _playPadBloom(vol, ghost = false) {
        const am = this.audioManager;
        const SCALE = am.scale;
        const PRIO = am.PRIORITY;
        const now = am.currentTime;
        const dur = this.beatDuration * (ghost ? 3.2 : 4.8);
        const rootChoices = [5, 8, 9]; // D3, A3, C4
        const thirdChoices = [7, 10, 11]; // G3, D4, F4-like modal colour

        const rootIdx = rootChoices[this.padMode % rootChoices.length];
        const colorIdx = thirdChoices[this.padMode % thirdChoices.length];
        this.padMode = (this.padMode + 1) % rootChoices.length;

        const voice = am.getMusicVoice(PRIO.ui, dur);
        const root = am.createMusicOsc('triangle', SCALE[rootIdx], voice, dur, now);
        const color = am.createMusicOsc('sine', SCALE[colorIdx], voice, dur, now + 0.02);
        root.detune.value = -3;
        color.detune.value = 2;

        const g = voice.gain.gain;
        const peak = (ghost ? 0.009 : 0.015 + this.intensity * 0.014) * vol;
        g.setValueAtTime(0.0001, now);
        g.linearRampToValueAtTime(peak, now + 0.25);
        g.exponentialRampToValueAtTime(0.0001, now + dur);
        am.connectMusicVoice(voice, ghost ? 0.18 : 0.14);
    }

    _playBassPulse(vol) {
        const am = this.audioManager;
        const SCALE = am.scale;
        const PRIO = am.PRIORITY;
        const dur = this.beatDuration * 1.2;
        const voice = am.getMusicVoice(PRIO.combat, dur);
        const now = am.currentTime;

        const noteIdx = this.currentBeat % 8 < 6 ? 0 : 2; // D2 with occasional G2
        const osc = am.createMusicOsc('sine', SCALE[noteIdx], voice, dur, now);
        const body = am.createMusicOsc('triangle', SCALE[noteIdx] * 0.5, voice, dur, now);
        body.detune.value = -4;
        osc.frequency.setValueAtTime(SCALE[noteIdx] * 1.04, now);
        osc.frequency.exponentialRampToValueAtTime(SCALE[noteIdx] * 0.92, now + dur * 0.7);

        const g = voice.gain.gain;
        const peak = (0.016 + this.intensity * 0.018) * vol;
        g.setValueAtTime(0.0001, now);
        g.linearRampToValueAtTime(peak, now + 0.02);
        g.setValueAtTime(peak * 0.9, now + dur * 0.45);
        g.exponentialRampToValueAtTime(0.0001, now + dur);
        am.connectMusicVoice(voice, 0.08);
    }

    _playEchoPulse(vol) {
        const am = this.audioManager;
        const SCALE = am.scale;
        const PRIO = am.PRIORITY;
        const dur = this.beatDuration * 0.7;
        const voice = am.getMusicVoice(PRIO.ui, dur);
        const now = am.currentTime;

        const idx = this.intensity >= 0.8 ? 14 : 12;
        const osc = am.createMusicOsc('sine', SCALE[idx], voice, dur, now);
        osc.detune.value = 4;

        const g = voice.gain.gain;
        const peak = (0.007 + this.intensity * 0.006) * vol;
        g.setValueAtTime(0.0001, now);
        g.linearRampToValueAtTime(peak, now + 0.01);
        g.exponentialRampToValueAtTime(0.0001, now + dur);
        am.connectMusicVoice(voice, 0.16);
    }

    _playMotif(vol, boosted = false) {
        const am = this.audioManager;
        const SCALE = am.scale;
        const PRIO = am.PRIORITY;
        const now = am.currentTime;
        const beatStep = this.beatDuration * 0.42;

        let motifPool = this.motifsLow;
        if (this.intensity >= 0.75 || boosted) motifPool = this.motifsHigh;
        else if (this.intensity >= 0.5) motifPool = this.motifsMid;

        const motif = motifPool[(Math.floor(this.currentBeat / this.measureLength) + this.padMode) % motifPool.length];
        const octaveBase = boosted || this.intensity >= 0.72 ? 10 : 5;

        for (let i = 0; i < motif.length; i++) {
            const startT = now + i * beatStep;
            const dur = this.beatDuration * 0.6;
            const voice = am.getMusicVoice(boosted ? PRIO.reward : PRIO.ui, dur);
            const idx = Math.min(SCALE.length - 1, octaveBase + motif[i]);
            const lead = am.createMusicOsc(boosted ? 'triangle' : 'sine', SCALE[idx], voice, dur, startT);
            lead.detune.value = boosted ? 5 : 2;

            const g = voice.gain.gain;
            const peak = ((boosted ? 0.022 : 0.013) + this.intensity * 0.008) * vol;
            g.setValueAtTime(0.0001, startT);
            g.linearRampToValueAtTime(peak, startT + 0.012);
            g.exponentialRampToValueAtTime(0.0001, startT + dur);
            voice.endTime = startT + dur;
            am.connectMusicVoice(voice, boosted ? 0.2 : 0.14);
        }
    }

    _playHighAir(vol) {
        const am = this.audioManager;
        const SCALE = am.scale;
        const PRIO = am.PRIORITY;
        const dur = this.beatDuration * 1.2;
        const voice = am.getMusicVoice(PRIO.ui, dur);
        const now = am.currentTime;
        const idx = 15 + (this.currentBeat % 3);

        am.createMusicOsc('sine', SCALE[Math.min(SCALE.length - 1, idx)], voice, dur, now);
        const g = voice.gain.gain;
        const peak = 0.008 * vol;
        g.setValueAtTime(0.0001, now);
        g.linearRampToValueAtTime(peak, now + 0.03);
        g.exponentialRampToValueAtTime(0.0001, now + dur);
        am.connectMusicVoice(voice, 0.22);
    }

    triggerMelodicFragment() {
        if (!this.audioManager?.initialized || this.audioManager.muted) return;

        // Instead of instantly spraying notes, flag the next phrase to bloom brighter.
        this.motifBoost = Math.min(2, this.motifBoost + 1);

        // If the score is currently very sparse, give an immediate soft response.
        if (this.playing && this.intensity < 0.22) {
            this._playMotif(this.audioManager.musicVolume * this.audioManager.masterVolume * 0.5, true);
            this.lastMotifBeat = this.currentBeat;
            this.motifBoost = Math.max(0, this.motifBoost - 1);
        }
    }

    reset() {
        this.stop();
        this.intensity = 0;
        this.targetIntensity = 0;
        this.beatAccumulator = 0;
        this.currentBeat = 0;
        this.motifBoost = 0;
        this.lastMotifBeat = -999;
        this.padMode = 0;
    }

    _cleanup() {}

    getDebugInfo() {
        return {
            playing: this.playing,
            intensity: this.intensity.toFixed(2),
            beat: this.currentBeat,
            bpm: this.bpm,
            motifBoost: this.motifBoost
        };
    }
}
