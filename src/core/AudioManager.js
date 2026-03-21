// D minor pentatonic across multiple octaves (Hz)
const SCALE = [
    73.42, 87.31, 98.00, 110.00, 130.81,   // D2 F2 G2 A2 C3
    146.83, 174.61, 196.00, 220.00, 261.63, // D3 F3 G3 A3 C4
    293.66, 349.23, 392.00, 440.00, 523.25, // D4 F4 G4 A4 C5
    587.33, 698.46, 783.99, 880.00, 1046.50 // D5 F5 G5 A5 C6
];

const PRIORITY = { ui: 1, combat: 2, death: 3, reward: 4, milestone: 5 };
const MAX_VOICES = 16;

const SOUND_ALIASES = {
    projectile: 'magicMissile',
    magic: 'magicMissile',
    melee: 'whipCrack',
    bladeHit: 'whipCrack',
    whipHit: 'whipCrack',
    throwing: 'knifeThrowing',
    knife: 'knifeThrowing',
    fireball: 'fireballLaunch',
    lightning: 'lightningStrike',
    aura: 'garlicPulse',
    orbital: 'orbiterWhoosh',
    boomerang: 'boomerangThrow',
    ice_shard: 'iceShardCast',
    orbiterHit: 'orbiterWhoosh',
    powerUpCollect: 'experienceGain',
    weaponUpgrade: 'levelUp',
    levelUpFanfare: 'levelUp',
    criticalBoom: 'criticalHit',
    massiveImpact: 'criticalHit',
    boneBreak: 'enemyDeath',
    fleshTear: 'enemyDeath',
    vampireScream: 'enemyDeath',
    menuHover: 'uiHover',
    menuSelect: 'uiSelect',
    achievementUnlock: 'victoryFanfare',
    weaponEvolution: 'victoryFanfare',
    bossDefeat: 'victoryFanfare'
};

const SOUND_THROTTLES = {
    uiHover: 70,
    uiSelect: 90,
    magicMissile: 34,
    whipCrack: 45,
    knifeThrowing: 40,
    fireballLaunch: 48,
    fireballExplosion: 72,
    lightningStrike: 55,
    lightningChain: 42,
    garlicPulse: 85,
    orbiterWhoosh: 60,
    boomerangThrow: 56,
    iceShardCast: 46,
    enemyDeath: 38,
    experienceGain: 28,
    levelUp: 180,
    criticalHit: 75,
    bloodSplash: 65,
    bossWarning: 220,
    bossSpawn: 320,
    heartbeat: 280,
    victoryFanfare: 260,
    demonRoar: 240,
    gameOver: 400,
    challengeBell: 220,
    challengeComplete: 260,
    challengeFail: 260
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class AudioManager {
    constructor() {
        this.masterVolume = 0.8;
        this.soundVolume = 0.5;
        this.musicVolume = 0.4;
        this.muted = false;

        this.audioContext = null;
        this.gameIntensity = 0;
        this.initialized = false;

        this.masterGain = null;
        this.mixBus = null;
        this.sfxBus = null;
        this.musicBus = null;
        this.musicDuckGain = null;
        this.sfxToneFilter = null;
        this.sfxPresenceDip = null;
        this.musicToneFilter = null;
        this.compressor = null;
        this.reverbConvolver = null;
        this.reverbReturn = null;

        this.voices = [];
        this.soundThrottle = new Map();
        this.throttleInterval = 50;
        this.gemNoteIndex = 0;
        this.noiseBuffer = null;
        this.mixTelemetry = {
            activeVoices: 0,
            activeSfxVoices: 0,
            activeMusicVoices: 0,
            densityFactor: 0,
            compressorReductionDb: 0,
            compressorStress: 0,
            fatigue: 0,
            harshnessGovernor: 0,
            sfxCutoffHz: 0,
            sfxPresenceDipDb: 0,
            musicCutoffHz: 0,
            reverbSendLevel: 0,
            musicDuckGain: 1,
            musicDuckTarget: 1,
            musicDuckAmount: 0,
            lastDuckHold: 0
        };

        // Compatibility stubs for legacy callers
        this.sounds = {};
        this.music = {};
        this.loadSound = () => {};
        this.loadMusic = () => {};
        this.play = () => {};
        this.playLoop = () => {};
        this.playMusic = () => {};
        this.stopMusic = () => {};
        this.stop = () => {};
        this.stopAll = () => {};

        this.initializeAudioContext();
    }

    // --- Volume controls (public API) ---
    setMasterVolume(v) {
        this.masterVolume = clamp(v, 0, 1);
        this._applyBusVolumes();
    }

    setSoundVolume(v) {
        this.soundVolume = clamp(v, 0, 1);
        this._applyBusVolumes();
    }

    setMusicVolume(v) {
        this.musicVolume = clamp(v, 0, 1);
        this._applyBusVolumes();
    }

    updateVolumes() {
        this._applyBusVolumes();
    }

    mute() {
        this.muted = true;
        this._applyBusVolumes();
    }

    unmute() {
        this.muted = false;
        this._applyBusVolumes();
    }

    toggleMute() {
        this.muted ? this.unmute() : this.mute();
    }

    _applyBusVolumes() {
        if (!this.audioContext || !this.masterGain || !this.sfxBus || !this.musicBus) return;

        const master = this.muted ? 0 : this.masterVolume;
        const sfx = this.muted ? 0 : this.soundVolume;
        const music = this.muted ? 0 : this.musicVolume;

        try {
            this.masterGain.gain.setTargetAtTime(master, this.audioContext.currentTime, 0.03);
            this.sfxBus.gain.setTargetAtTime(sfx, this.audioContext.currentTime, 0.03);
            this.musicBus.gain.setTargetAtTime(music, this.audioContext.currentTime, 0.08);
        } catch (e) {
            // noop
        }
    }

    // --- Init ---
    initializeAudioContext() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) throw new Error('AudioContext unavailable');

            this.audioContext = new AudioCtx();

            this.masterGain = this.audioContext.createGain();
            this.mixBus = this.audioContext.createGain();
            this.sfxBus = this.audioContext.createGain();
            this.musicBus = this.audioContext.createGain();
            this.musicDuckGain = this.audioContext.createGain();
            this.sfxToneFilter = this.audioContext.createBiquadFilter();
            this.sfxPresenceDip = this.audioContext.createBiquadFilter();
            this.musicToneFilter = this.audioContext.createBiquadFilter();

            this.sfxToneFilter.type = 'lowpass';
            this.sfxToneFilter.frequency.value = 6200;
            this.sfxToneFilter.Q.value = 0.65;

            this.sfxPresenceDip.type = 'peaking';
            this.sfxPresenceDip.frequency.value = 3200;
            this.sfxPresenceDip.Q.value = 0.85;
            this.sfxPresenceDip.gain.value = -1.5;

            this.musicToneFilter.type = 'lowpass';
            this.musicToneFilter.frequency.value = 2400;
            this.musicToneFilter.Q.value = 0.45;

            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.value = -22;
            this.compressor.knee.value = 20;
            this.compressor.ratio.value = 4.5;
            this.compressor.attack.value = 0.008;
            this.compressor.release.value = 0.24;

            this.sfxBus.connect(this.sfxToneFilter).connect(this.sfxPresenceDip).connect(this.mixBus);
            this.musicBus.connect(this.musicToneFilter).connect(this.musicDuckGain).connect(this.mixBus);
            this.mixBus.connect(this.compressor).connect(this.masterGain).connect(this.audioContext.destination);

            this.musicDuckGain.gain.value = 1;

            this._createReverb();
            this._createNoiseBuffer();
            this._applyBusVolumes();
            this._updateMixState();
            this.initialized = true;
        } catch (error) {
            console.warn('Web Audio API not supported:', error);
            this.audioContext = null;
            this.initialized = false;
        }
    }

    _createReverb() {
        if (!this.audioContext || !this.mixBus) return;

        const sr = this.audioContext.sampleRate;
        const len = Math.floor(sr * 1.4);
        const impulse = this.audioContext.createBuffer(2, len, sr);

        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            let last = 0;
            for (let i = 0; i < len; i++) {
                const t = i / len;
                const white = Math.random() * 2 - 1;
                last = last * 0.82 + white * 0.18;
                const early = i < sr * 0.045 ? Math.sin(i * 0.17 + ch) * 0.18 : 0;
                data[i] = (last * Math.pow(1 - t, 3.2) + early) * 0.5;
            }
        }

        this.reverbConvolver = this.audioContext.createConvolver();
        this.reverbConvolver.buffer = impulse;
        this.reverbReturn = this.audioContext.createGain();
        this.reverbReturn.gain.value = 0.18;
        this.reverbConvolver.connect(this.reverbReturn).connect(this.mixBus);
    }

    _createNoiseBuffer() {
        if (!this.audioContext) return;

        const len = this.audioContext.sampleRate * 2;
        const buf = this.audioContext.createBuffer(1, len, this.audioContext.sampleRate);
        const data = buf.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < len; i++) {
            brown = (brown + (Math.random() * 2 - 1) * 0.18) * 0.985;
            data[i] = clamp(brown, -1, 1);
        }
        this.noiseBuffer = buf;
    }

    // --- Voice Pool ---
    _reapVoices(now = this.audioContext?.currentTime || 0) {
        let removed = false;
        for (let i = this.voices.length - 1; i >= 0; i--) {
            if (this.voices[i].endTime <= now) {
                this.voices.splice(i, 1);
                removed = true;
            }
        }
        if (removed) this._updateMixState();
    }

    _allocVoice(priority, duration, kind = 'sfx') {
        this._reapVoices();
        const now = this.audioContext.currentTime;

        if (this.voices.length >= MAX_VOICES) {
            let stealIdx = 0;
            let stealScore = Infinity;
            for (let i = 0; i < this.voices.length; i++) {
                const v = this.voices[i];
                const timeLeft = Math.max(0, v.endTime - now);
                const score = v.priority * 1000 + timeLeft * 100 + (v.kind === 'music' ? 50 : 0);
                if (score < stealScore) {
                    stealScore = score;
                    stealIdx = i;
                }
            }

            const stolen = this.voices[stealIdx];
            try {
                stolen.gain.gain.cancelScheduledValues(now);
                stolen.gain.gain.setValueAtTime(0, now);
            } catch (e) {
                // noop
            }
            this.voices.splice(stealIdx, 1);
        }

        const input = this.audioContext.createGain();
        const toneFilter = this.audioContext.createBiquadFilter();
        toneFilter.type = 'lowpass';
        toneFilter.frequency.value = kind === 'music' ? 2800 : 4800;
        toneFilter.Q.value = 0.7;

        const gain = this.audioContext.createGain();
        gain.gain.value = 0;

        let panNode = null;
        if (typeof this.audioContext.createStereoPanner === 'function') {
            panNode = this.audioContext.createStereoPanner();
            panNode.pan.value = 0;
            input.connect(toneFilter).connect(panNode).connect(gain);
        } else {
            input.connect(toneFilter).connect(gain);
        }

        const endTime = now + duration;
        const voice = { input, filter: toneFilter, panNode, gain, priority, kind, startTime: now, endTime, nodes: [] };
        this.voices.push(voice);
        this._updateMixState();
        return voice;
    }

    _connectVoice(voice, wetAmount = 0.12) {
        const bus = voice.kind === 'music' ? this.musicBus : this.sfxBus;
        voice.gain.connect(bus);

        if (this.reverbConvolver && wetAmount > 0) {
            const wet = this.audioContext.createGain();
            wet.gain.value = wetAmount;
            voice.gain.connect(wet);
            wet.connect(this.reverbConvolver);
            voice.nodes.push(wet);
        }
    }

    _setVoicePan(voice, pan = 0) {
        if (!voice?.panNode) return;
        voice.panNode.pan.setValueAtTime(clamp(pan, -0.65, 0.65), this.audioContext.currentTime);
    }

    _updateMixState() {
        const activeVoices = this.voices.length;
        const activeMusicVoices = this.voices.filter((voice) => voice.kind === 'music').length;
        const activeSfxVoices = activeVoices - activeMusicVoices;
        const density = clamp(activeVoices / MAX_VOICES, 0, 1);
        const compReduction = this.compressor ? Math.abs(Math.min(0, this.compressor.reduction || 0)) : 0;
        const compStress = clamp(compReduction / 18, 0, 1);
        const fatigue = clamp(density * 0.65 + this.gameIntensity * 0.2 + compStress * 0.4, 0, 1);

        const sfxCutoff = clamp(7600 - fatigue * 3600, 2200, 8200);
        const presenceDip = clamp(-1.5 - fatigue * 4.5, -7, -1);
        const musicCutoff = clamp(2200 - density * 500 + this.gameIntensity * 350, 1300, 2800);
        const reverbLevel = clamp(0.18 - density * 0.05, 0.1, 0.2);
        const duckGainValue = this.musicDuckGain?.gain?.value ?? this.mixTelemetry.musicDuckTarget ?? 1;

        this.mixTelemetry = {
            activeVoices,
            activeSfxVoices,
            activeMusicVoices,
            densityFactor: Number(density.toFixed(3)),
            compressorReductionDb: Number(compReduction.toFixed(2)),
            compressorStress: Number(compStress.toFixed(3)),
            fatigue: Number(fatigue.toFixed(3)),
            harshnessGovernor: Number(fatigue.toFixed(3)),
            sfxCutoffHz: Math.round(sfxCutoff),
            sfxPresenceDipDb: Number(presenceDip.toFixed(2)),
            musicCutoffHz: Math.round(musicCutoff),
            reverbSendLevel: Number(reverbLevel.toFixed(3)),
            musicDuckGain: Number(duckGainValue.toFixed(3)),
            musicDuckTarget: Number((this.mixTelemetry.musicDuckTarget ?? 1).toFixed(3)),
            musicDuckAmount: Number((this.mixTelemetry.musicDuckAmount ?? 0).toFixed(3)),
            lastDuckHold: Number((this.mixTelemetry.lastDuckHold ?? 0).toFixed(3))
        };

        if (!this.audioContext || !this.sfxToneFilter || !this.sfxPresenceDip || !this.musicToneFilter) return;

        const now = this.audioContext.currentTime;
        this.sfxToneFilter.frequency.setTargetAtTime(sfxCutoff, now, 0.05);
        this.sfxPresenceDip.gain.setTargetAtTime(presenceDip, now, 0.06);
        this.musicToneFilter.frequency.setTargetAtTime(musicCutoff, now, 0.08);
        if (this.reverbReturn) {
            this.reverbReturn.gain.setTargetAtTime(reverbLevel, now, 0.08);
        }
    }

    _shapeVoice(voice, {
        brightness = 1,
        resonance = 0.8,
        filterType = 'lowpass'
    } = {}) {
        const density = this._getDensityFactor();
        const intensityBias = 0.9 + this.gameIntensity * 0.12;
        const antiFatigue = 1 - density * 0.35;
        const cutoff = clamp(700 + brightness * 5200 * intensityBias * antiFatigue, 450, 9000);

        voice.filter.type = filterType;
        voice.filter.frequency.setValueAtTime(cutoff, this.audioContext.currentTime);
        voice.filter.Q.setValueAtTime(clamp(resonance, 0.2, 8), this.audioContext.currentTime);
    }

    _duckMusic(amount = 0.18, hold = 0.16) {
        const target = clamp(1 - amount, 0.45, 1);
        this.mixTelemetry.musicDuckTarget = target;
        this.mixTelemetry.musicDuckAmount = clamp(1 - target, 0, 1);
        this.mixTelemetry.lastDuckHold = hold;

        if (!this.musicDuckGain || !this.audioContext) {
            this._updateMixState();
            return;
        }

        const now = this.audioContext.currentTime;
        const gain = this.musicDuckGain.gain;

        gain.cancelScheduledValues(now);
        gain.setTargetAtTime(target, now, 0.015);
        gain.setTargetAtTime(1, now + hold, 0.22);
        this._updateMixState();
    }

    _getDensityFactor() {
        this._reapVoices();
        return clamp(this.voices.length / MAX_VOICES, 0, 1);
    }

    // --- Synthesis primitives ---
    _osc(type, freq, voice, duration, when = this.audioContext.currentTime) {
        const osc = this.audioContext.createOscillator();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(voice.input);
        osc.start(when);
        osc.stop(when + duration + 0.05);
        voice.nodes.push(osc);
        return osc;
    }

    _noiseSource(voice, duration, {
        type = 'bandpass',
        frequency = 2500,
        q = 1,
        when = this.audioContext.currentTime,
        playbackRate = 1
    } = {}) {
        const src = this.audioContext.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        src.playbackRate.value = playbackRate;

        const filter = this.audioContext.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = frequency;
        filter.Q.value = q;

        src.connect(filter).connect(voice.input);
        src.start(when);
        src.stop(when + duration + 0.05);
        voice.nodes.push(src, filter);
        return { src, filter };
    }

    _env(voice, {
        attack = 0.005,
        decay = 0.12,
        peak = 0.1,
        sustain = 0.001,
        hold = 0,
        startTime = this.audioContext.currentTime
    } = {}) {
        const g = voice.gain.gain;
        g.setValueAtTime(0.0001, startTime);
        g.linearRampToValueAtTime(Math.max(0.0001, peak), startTime + attack);
        if (hold > 0) {
            g.setValueAtTime(Math.max(0.0001, peak), startTime + attack + hold);
        }
        g.exponentialRampToValueAtTime(
            Math.max(0.0001, sustain),
            startTime + attack + hold + decay
        );
    }

    _scaleNote(octaveOffset, degreeOffset) {
        const base = 5 + octaveOffset * 5;
        const idx = clamp(base + degreeOffset, 0, SCALE.length - 1);
        return SCALE[idx];
    }

    _softPeak(vol, base = 0.14) {
        const density = this._getDensityFactor();
        return base * vol * (1 - density * 0.2);
    }

    _randomRange(min, max) {
        return min + Math.random() * (max - min);
    }

    // --- Sound recipes ---
    _synthMagicMissile(vol, pitch = 1) {
        const dur = 0.16;
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const freq = this._scaleNote(1, 1 + Math.floor(Math.random() * 3)) * pitch;
        const now = this.audioContext.currentTime;

        this._shapeVoice(voice, { brightness: 0.92, resonance: 0.9 });
        const osc = this._osc('triangle', freq * 1.5, voice, dur);
        const shimmer = this._osc('sine', freq * 2.01, voice, dur);
        osc.frequency.setValueAtTime(freq * 2.6, now);
        osc.frequency.exponentialRampToValueAtTime(freq, now + 0.09);
        shimmer.frequency.setValueAtTime(freq * 2.9, now);
        shimmer.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.08);

        this._env(voice, { attack: 0.003, decay: 0.13, peak: this._softPeak(vol, 0.15) });
        this._connectVoice(voice, 0.12);
        this._duckMusic(0.12, 0.1);
    }

    _synthWhipCrack(vol, pitch = 1) {
        const dur = 0.1 + this._randomRange(0.015, 0.04);
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const now = this.audioContext.currentTime;
        const snapBright = Math.random() < 0.45;

        this._setVoicePan(voice, this._randomRange(-0.12, 0.12));
        this._shapeVoice(voice, { brightness: snapBright ? 0.78 : 0.68, resonance: snapBright ? 1.1 : 0.85 });
        const { filter } = this._noiseSource(voice, dur, {
            type: 'bandpass',
            frequency: this._randomRange(2200, 3200) * pitch,
            q: snapBright ? 1.7 : 1.1
        });
        filter.frequency.setValueAtTime(this._randomRange(3600, 5000) * pitch, now);
        filter.frequency.exponentialRampToValueAtTime(this._randomRange(900, 1500), now + dur * 0.72);

        const bodyWave = snapBright ? 'triangle' : 'sine';
        const body = this._osc(bodyWave, this._randomRange(78, 96) * pitch, voice, dur);
        body.frequency.setValueAtTime(this._randomRange(150, 190) * pitch, now);
        body.frequency.exponentialRampToValueAtTime(this._randomRange(48, 62), now + dur * 0.62);

        this._env(voice, { attack: 0.0015, decay: dur * 0.78, peak: this._softPeak(vol, 0.16) });
        this._connectVoice(voice, 0.06);
        this._duckMusic(0.14, 0.11);
    }

    _synthKnifeThrow(vol, pitch = 1) {
        const dur = 0.1;
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const freq = SCALE[12] * pitch;
        const now = this.audioContext.currentTime;

        this._shapeVoice(voice, { brightness: 0.72, resonance: 0.6 });
        const osc = this._osc('triangle', freq, voice, dur);
        osc.frequency.setValueAtTime(freq * 0.7, now);
        osc.frequency.linearRampToValueAtTime(freq * 1.6, now + 0.018);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.85, now + 0.08);

        const snap = this._noiseSource(voice, 0.06, { type: 'highpass', frequency: 2600, q: 0.7 });
        snap.filter.frequency.setValueAtTime(3200, now);

        this._env(voice, { attack: 0.002, decay: 0.075, peak: this._softPeak(vol, 0.13) });
        this._connectVoice(voice, 0.06);
        this._duckMusic(0.1, 0.08);
    }

    _synthIceShard(vol, pitch = 1) {
        const dur = 0.15;
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const freq = SCALE[14] * pitch;
        const now = this.audioContext.currentTime;

        this._shapeVoice(voice, { brightness: 0.95, resonance: 1.1 });
        const osc = this._osc('sine', freq, voice, dur);
        const glass = this._osc('triangle', freq * 2, voice, dur);
        glass.detune.value = -4;
        osc.frequency.setValueAtTime(freq * 1.25, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.92, now + 0.1);

        this._env(voice, { attack: 0.004, decay: 0.12, peak: this._softPeak(vol, 0.13) });
        this._connectVoice(voice, 0.18);
        this._duckMusic(0.09, 0.09);
    }

    _synthEnemyDeath(vol, pitch = 1) {
        const variant = Math.floor(Math.random() * 3);
        const dur = variant === 2 ? 0.12 : variant === 1 ? 0.18 : 0.15;
        const voice = this._allocVoice(PRIORITY.death, dur);
        const degree = Math.floor(Math.random() * 5);
        const freq = this._scaleNote(-1, degree) * pitch;
        const now = this.audioContext.currentTime;

        this._setVoicePan(voice, this._randomRange(-0.18, 0.18));
        this._shapeVoice(voice, {
            brightness: variant === 2 ? 0.4 : variant === 1 ? 0.52 : 0.46,
            resonance: variant === 1 ? 0.9 : 0.65
        });

        const bodyWave = variant === 1 ? 'triangle' : 'sine';
        const body = this._osc(bodyWave, freq, voice, dur);
        body.frequency.setValueAtTime(freq * (variant === 1 ? 1.55 : 1.8), now);
        body.frequency.exponentialRampToValueAtTime(Math.max(32, freq * (variant === 2 ? 0.78 : 0.62)), now + dur * 0.68);

        const { filter } = this._noiseSource(voice, dur, {
            type: 'lowpass',
            frequency: variant === 2 ? 1200 : 1700,
            q: variant === 1 ? 1 : 0.7,
            playbackRate: 0.72 + Math.random() * 0.18
        });
        filter.frequency.setValueAtTime(this._randomRange(1700, 2500), now);
        filter.frequency.exponentialRampToValueAtTime(this._randomRange(280, 460), now + dur * 0.72);

        this._env(voice, { attack: 0.002, decay: dur * 0.82, peak: this._softPeak(vol, 0.12) });
        this._connectVoice(voice, 0.04);
        this._duckMusic(0.05, 0.07);
    }

    _synthGemPickup(vol, pitch = 1) {
        const variant = this.gemNoteIndex % 3;
        const dur = variant === 2 ? 0.28 : 0.22;
        const voice = this._allocVoice(PRIORITY.reward, dur);
        const noteIdx = 5 + (this.gemNoteIndex % 5);
        const freq = SCALE[noteIdx] * pitch;
        this.gemNoteIndex = (this.gemNoteIndex + 1) % 5;

        this._setVoicePan(voice, this._randomRange(-0.08, 0.08));
        this._shapeVoice(voice, { brightness: variant === 1 ? 0.92 : 1.0, resonance: 0.65 });
        const main = this._osc('sine', freq, voice, dur);
        const bloom = this._osc(variant === 0 ? 'triangle' : 'sine', freq * (variant === 2 ? 1.5 : 2), voice, dur);
        bloom.detune.value = variant === 2 ? -4 : 3;
        main.detune.value = this.gemNoteIndex % 2 === 0 ? -2 : 2;

        if (variant === 2) {
            const sub = this._osc('sine', freq * 0.5, voice, dur);
            sub.detune.value = -5;
        }

        this._env(voice, { attack: 0.008, decay: dur * 0.78, peak: this._softPeak(vol, 0.115) });
        this._connectVoice(voice, variant === 2 ? 0.2 : 0.18);
        this._duckMusic(0.05, 0.05);
    }

    _synthLevelUp(vol, pitch = 1) {
        const notes = [SCALE[10], SCALE[11], SCALE[13], SCALE[15]].map((n) => n * pitch);
        const now = this.audioContext.currentTime;

        for (let i = 0; i < notes.length; i++) {
            const dur = 0.72 - i * 0.07;
            const voice = this._allocVoice(PRIORITY.milestone, dur);
            this._shapeVoice(voice, { brightness: 0.88, resonance: 0.7 });

            const lead = this._osc('triangle', notes[i], voice, dur, now + i * 0.09);
            const warmth = this._osc('sine', notes[i] * 0.5, voice, dur, now + i * 0.09);
            warmth.detune.value = -2;
            lead.detune.value = 3;

            this._env(voice, {
                attack: 0.01,
                decay: dur - 0.05,
                peak: this._softPeak(vol, 0.18),
                startTime: now + i * 0.09
            });
            voice.endTime = now + i * 0.09 + dur;
            this._connectVoice(voice, 0.32);
        }

        this._duckMusic(0.22, 0.28);
    }

    _synthFireballLaunch(vol, pitch = 1) {
        const dur = 0.18;
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const now = this.audioContext.currentTime;
        const freq = SCALE[8] * pitch;

        this._shapeVoice(voice, { brightness: 0.72, resonance: 0.65 });
        const whoosh = this._noiseSource(voice, dur, { type: 'bandpass', frequency: 1200, q: 1.1, playbackRate: 0.9 });
        whoosh.filter.frequency.setValueAtTime(900, now);
        whoosh.filter.frequency.linearRampToValueAtTime(1800, now + 0.1);

        const orb = this._osc('triangle', freq, voice, dur);
        orb.frequency.setValueAtTime(freq * 0.7, now);
        orb.frequency.linearRampToValueAtTime(freq * 1.15, now + 0.05);

        this._env(voice, { attack: 0.004, decay: 0.15, peak: this._softPeak(vol, 0.14) });
        this._connectVoice(voice, 0.14);
        this._duckMusic(0.12, 0.1);
    }

    _synthFireballExplosion(vol, pitch = 1) {
        const dur = 0.3;
        const voice = this._allocVoice(PRIORITY.milestone, dur);
        const now = this.audioContext.currentTime;

        this._shapeVoice(voice, { brightness: 0.45, resonance: 0.9 });
        const boom = this._osc('sine', 58 * pitch, voice, dur);
        boom.frequency.setValueAtTime(110 * pitch, now);
        boom.frequency.exponentialRampToValueAtTime(40, now + 0.2);

        const blast = this._noiseSource(voice, dur, { type: 'lowpass', frequency: 1800, q: 0.7 });
        blast.filter.frequency.setValueAtTime(2200, now);
        blast.filter.frequency.exponentialRampToValueAtTime(500, now + 0.18);

        this._env(voice, { attack: 0.002, decay: 0.24, peak: this._softPeak(vol, 0.2) });
        this._connectVoice(voice, 0.12);
        this._duckMusic(0.18, 0.16);
    }

    _synthLightning(vol, pitch = 1, chain = false) {
        const dur = chain ? 0.13 : 0.17;
        const voice = this._allocVoice(chain ? PRIORITY.combat : PRIORITY.reward, dur);
        const freq = SCALE[12] * pitch * (chain ? 1.05 : 1);
        const now = this.audioContext.currentTime;
        const variant = Math.random() < 0.5;

        this._setVoicePan(voice, this._randomRange(-0.16, 0.16));
        this._shapeVoice(voice, {
            brightness: chain ? 0.8 : 0.92,
            resonance: variant ? 1.15 : 0.95,
            filterType: 'bandpass'
        });
        const carrier = this._osc('sine', freq, voice, dur);
        const mod = this.audioContext.createOscillator();
        const modGain = this.audioContext.createGain();
        mod.type = variant ? 'sine' : 'triangle';
        mod.frequency.value = chain ? this._randomRange(260, 360) : this._randomRange(380, 520);
        modGain.gain.value = chain ? 45 : 80;
        modGain.gain.exponentialRampToValueAtTime(6, now + dur * 0.8);
        mod.connect(modGain).connect(carrier.frequency);
        mod.start(now);
        mod.stop(now + dur + 0.05);
        voice.nodes.push(mod, modGain);

        const air = this._noiseSource(voice, 0.08, {
            type: 'highpass',
            frequency: chain ? 1700 : 2200,
            q: 0.65,
            playbackRate: variant ? 1.05 : 1.15
        });
        air.filter.frequency.setValueAtTime(chain ? 2200 : 2600, now);

        this._env(voice, { attack: 0.001, decay: dur * 0.88, peak: this._softPeak(vol, chain ? 0.09 : 0.13) });
        this._connectVoice(voice, chain ? 0.12 : 0.16);
        this._duckMusic(chain ? 0.1 : 0.15, 0.11);
    }

    _synthGarlicPulse(vol, pitch = 1) {
        const dur = 0.22 + this._randomRange(0, 0.04);
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const now = this.audioContext.currentTime;
        const base = this._randomRange(105, 125) * pitch;

        this._setVoicePan(voice, this._randomRange(-0.05, 0.05));
        this._shapeVoice(voice, { brightness: 0.34, resonance: 0.45 });
        const hum = this._osc(Math.random() < 0.5 ? 'sine' : 'triangle', base, voice, dur);
        hum.frequency.setValueAtTime(base * 1.08, now);
        hum.frequency.exponentialRampToValueAtTime(base * 0.82, now + dur * 0.78);

        const breath = this._noiseSource(voice, dur, { type: 'bandpass', frequency: 760, q: 0.55, playbackRate: 0.84 });
        breath.filter.frequency.setValueAtTime(980, now);
        breath.filter.frequency.exponentialRampToValueAtTime(420, now + dur * 0.72);

        this._env(voice, { attack: 0.02, decay: dur * 0.72, peak: this._softPeak(vol, 0.095) });
        this._connectVoice(voice, 0.08);
        this._duckMusic(0.04, 0.06);
    }

    _synthOrbiterWhoosh(vol, pitch = 1) {
        const dur = 0.13 + this._randomRange(0, 0.03);
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const freq = SCALE[11] * pitch * this._randomRange(0.96, 1.03);
        const now = this.audioContext.currentTime;

        this._setVoicePan(voice, this._randomRange(-0.25, 0.25));
        this._shapeVoice(voice, { brightness: 0.64, resonance: 0.5 });
        const whoosh = this._osc(Math.random() < 0.5 ? 'triangle' : 'sine', freq, voice, dur);
        whoosh.frequency.setValueAtTime(freq * 0.84, now);
        whoosh.frequency.linearRampToValueAtTime(freq * 1.16, now + 0.03);
        whoosh.frequency.exponentialRampToValueAtTime(freq * 0.94, now + dur * 0.82);

        this._env(voice, { attack: 0.004, decay: dur * 0.8, peak: this._softPeak(vol, 0.09) });
        this._connectVoice(voice, 0.1);
        this._duckMusic(0.05, 0.06);
    }

    _synthBoomerang(vol, pitch = 1) {
        const dur = 0.16;
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const freq = SCALE[8] * pitch;
        const now = this.audioContext.currentTime;

        this._shapeVoice(voice, { brightness: 0.64, resonance: 0.6 });
        const tone = this._osc('triangle', freq, voice, dur);
        tone.frequency.setValueAtTime(freq * 0.9, now);
        tone.frequency.linearRampToValueAtTime(freq * 1.18, now + 0.03);
        tone.frequency.exponentialRampToValueAtTime(freq * 0.75, now + 0.12);

        const air = this._noiseSource(voice, 0.09, { type: 'bandpass', frequency: 1600, q: 0.9 });
        air.filter.frequency.setValueAtTime(1800, now);

        this._env(voice, { attack: 0.003, decay: 0.12, peak: this._softPeak(vol, 0.12) });
        this._connectVoice(voice, 0.08);
        this._duckMusic(0.08, 0.08);
    }

    _synthCriticalHit(vol, pitch = 1) {
        const dur = 0.32;
        const voice = this._allocVoice(PRIORITY.milestone, dur);
        const now = this.audioContext.currentTime;
        const freq = SCALE[10] * pitch;

        this._shapeVoice(voice, { brightness: 0.9, resonance: 1.3 });
        const carrier = this._osc('sine', freq, voice, dur);
        const sub = this._osc('sine', 60 * Math.max(0.8, pitch), voice, dur);
        sub.frequency.setValueAtTime(110, now);
        sub.frequency.exponentialRampToValueAtTime(42, now + 0.22);

        const mod = this.audioContext.createOscillator();
        const modGain = this.audioContext.createGain();
        mod.type = 'sine';
        mod.frequency.value = freq * 2.4;
        modGain.gain.value = 110;
        modGain.gain.exponentialRampToValueAtTime(10, now + 0.25);
        mod.connect(modGain).connect(carrier.frequency);
        mod.start(now);
        mod.stop(now + dur + 0.05);
        voice.nodes.push(mod, modGain);

        this._env(voice, { attack: 0.003, decay: 0.28, peak: this._softPeak(vol, 0.19) });
        this._connectVoice(voice, 0.24);
        this._duckMusic(0.22, 0.18);
    }

    _synthBloodSplash(vol, pitch = 1) {
        const dur = 0.12;
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const now = this.audioContext.currentTime;

        this._shapeVoice(voice, { brightness: 0.38, resonance: 0.45 });
        const spray = this._noiseSource(voice, dur, { type: 'lowpass', frequency: 1100 * pitch, q: 0.8, playbackRate: 0.92 });
        spray.filter.frequency.setValueAtTime(1700, now);
        spray.filter.frequency.exponentialRampToValueAtTime(260, now + 0.1);

        const body = this._osc('sine', 70 * pitch, voice, dur);
        body.frequency.setValueAtTime(120 * pitch, now);
        body.frequency.exponentialRampToValueAtTime(50, now + 0.08);

        this._env(voice, { attack: 0.002, decay: 0.1, peak: this._softPeak(vol, 0.1) });
        this._connectVoice(voice, 0.06);
        this._duckMusic(0.07, 0.07);
    }

    _synthBossWarning(vol, pitch = 1) {
        const now = this.audioContext.currentTime;
        for (let i = 0; i < 4; i++) {
            const dur = 0.22;
            const startT = now + i * (0.24 - i * 0.025);
            const voice = this._allocVoice(PRIORITY.milestone, dur);
            this._shapeVoice(voice, { brightness: 0.45, resonance: 1.1 });

            const low = this._osc('triangle', SCALE[0] * pitch, voice, dur, startT);
            low.frequency.setValueAtTime(SCALE[0] * 1.05 * pitch, startT);
            low.frequency.exponentialRampToValueAtTime(SCALE[0] * 0.8, startT + 0.16);

            this._env(voice, {
                attack: 0.01,
                decay: 0.16,
                peak: this._softPeak(vol, 0.16),
                startTime: startT
            });
            voice.endTime = startT + dur;
            this._connectVoice(voice, 0.24);
        }
        this._duckMusic(0.24, 0.4);
    }

    _synthBossSpawn(vol, pitch = 1) {
        const notes = [SCALE[5], SCALE[8], SCALE[10]].map((n) => n * pitch);
        const now = this.audioContext.currentTime;
        for (let i = 0; i < notes.length; i++) {
            const dur = 0.8;
            const startT = now + i * 0.06;
            const voice = this._allocVoice(PRIORITY.milestone, dur);
            this._shapeVoice(voice, { brightness: 0.58, resonance: 0.9 });
            this._osc('triangle', notes[i], voice, dur, startT);
            this._osc('sine', notes[i] * 0.5, voice, dur, startT);
            this._env(voice, {
                attack: 0.03,
                decay: 0.68,
                peak: this._softPeak(vol, 0.16),
                startTime: startT
            });
            voice.endTime = startT + dur;
            this._connectVoice(voice, 0.3);
        }
        this._duckMusic(0.26, 0.45);
    }

    _synthHeartbeat(vol, pitch = 1) {
        const dur = 0.34;
        const voice = this._allocVoice(PRIORITY.combat, dur);
        const now = this.audioContext.currentTime;
        const osc = this._osc('sine', 52 * pitch, voice, dur);
        osc.frequency.setValueAtTime(54 * pitch, now);

        const g = voice.gain.gain;
        const peakA = this._softPeak(vol, 0.12);
        const peakB = this._softPeak(vol, 0.1);
        g.setValueAtTime(0.0001, now);
        g.linearRampToValueAtTime(peakA, now + 0.02);
        g.exponentialRampToValueAtTime(0.02, now + 0.08);
        g.linearRampToValueAtTime(peakB, now + 0.13);
        g.exponentialRampToValueAtTime(0.0001, now + 0.3);

        this._shapeVoice(voice, { brightness: 0.32, resonance: 0.6 });
        this._connectVoice(voice, 0.04);
        this._duckMusic(0.08, 0.12);
    }

    _synthVictoryFanfare(vol, pitch = 1) {
        const phrase = [SCALE[10], SCALE[11], SCALE[13], SCALE[14]].map((n) => n * pitch);
        const now = this.audioContext.currentTime;

        for (let i = 0; i < phrase.length; i++) {
            const dur = 0.55;
            const startT = now + i * 0.12;
            const voice = this._allocVoice(PRIORITY.milestone, dur);
            this._shapeVoice(voice, { brightness: 0.9, resonance: 0.85 });
            this._osc('triangle', phrase[i], voice, dur, startT);
            this._osc('sine', phrase[i] * 2, voice, dur, startT);
            this._env(voice, {
                attack: 0.008,
                decay: 0.42,
                peak: this._softPeak(vol, 0.15),
                startTime: startT
            });
            voice.endTime = startT + dur;
            this._connectVoice(voice, 0.28);
        }
        this._duckMusic(0.18, 0.3);
    }

    _synthDemonRoar(vol, pitch = 1) {
        const dur = 0.5;
        const voice = this._allocVoice(PRIORITY.milestone, dur);
        const now = this.audioContext.currentTime;

        this._shapeVoice(voice, { brightness: 0.28, resonance: 1.4, filterType: 'bandpass' });
        const carrier = this._osc('triangle', 70 * pitch, voice, dur);
        const wobble = this.audioContext.createOscillator();
        const wobbleGain = this.audioContext.createGain();
        wobble.type = 'sine';
        wobble.frequency.value = 23;
        wobbleGain.gain.value = 16;
        wobble.connect(wobbleGain).connect(carrier.frequency);
        wobble.start(now);
        wobble.stop(now + dur + 0.05);
        voice.nodes.push(wobble, wobbleGain);

        this._noiseSource(voice, dur, { type: 'lowpass', frequency: 500, q: 1.2, playbackRate: 0.6 });
        this._env(voice, { attack: 0.02, decay: 0.42, peak: this._softPeak(vol, 0.16) });
        this._connectVoice(voice, 0.16);
        this._duckMusic(0.2, 0.28);
    }

    _synthGameOver(vol, pitch = 1) {
        const notes = [SCALE[15], SCALE[13], SCALE[11], SCALE[10]].map((n) => n * pitch);
        const now = this.audioContext.currentTime;
        for (let i = 0; i < notes.length; i++) {
            const dur = 0.85 - i * 0.1;
            const startT = now + i * 0.16;
            const voice = this._allocVoice(PRIORITY.milestone, dur);
            this._shapeVoice(voice, { brightness: 0.44, resonance: 0.75 });
            this._osc('triangle', notes[i], voice, dur, startT);
            this._osc('sine', notes[i] * 0.5, voice, dur, startT);
            this._env(voice, {
                attack: 0.02,
                decay: dur - 0.08,
                peak: this._softPeak(vol, 0.18),
                startTime: startT
            });
            voice.endTime = startT + dur;
            this._connectVoice(voice, 0.26);
        }
        this._duckMusic(0.34, 0.7);
    }

    _synthUIHover(vol, pitch = 1) {
        const dur = 0.045;
        const voice = this._allocVoice(PRIORITY.ui, dur);
        this._shapeVoice(voice, { brightness: 1, resonance: 0.6 });
        this._osc('sine', SCALE[14] * pitch, voice, dur);
        this._env(voice, { attack: 0.002, decay: 0.038, peak: this._softPeak(vol, 0.08) });
        this._connectVoice(voice, 0.04);
    }

    _synthUISelect(vol, pitch = 1) {
        const dur = 0.08;
        const voice = this._allocVoice(PRIORITY.ui, dur);
        const now = this.audioContext.currentTime;
        this._shapeVoice(voice, { brightness: 0.92, resonance: 0.55 });
        const osc = this._osc('triangle', SCALE[12] * pitch, voice, dur);
        osc.frequency.setValueAtTime(SCALE[12] * pitch, now);
        osc.frequency.setValueAtTime(SCALE[14] * pitch, now + 0.034);
        this._env(voice, { attack: 0.003, decay: 0.06, peak: this._softPeak(vol, 0.1) });
        this._connectVoice(voice, 0.05);
    }

    _synthDefault(vol, pitch = 1) {
        const dur = 0.07;
        const voice = this._allocVoice(PRIORITY.combat, dur);
        this._shapeVoice(voice, { brightness: 0.55, resonance: 0.4 });
        this._osc('triangle', this._scaleNote(1, Math.floor(Math.random() * 5)) * pitch, voice, dur);
        this._env(voice, { attack: 0.003, decay: 0.05, peak: this._softPeak(vol, 0.08) });
        this._connectVoice(voice, 0.04);
    }

    _playNormalizedSound(name, volume = 1, pitch = 1) {
        const v = clamp(volume, 0.05, 2);
        const p = clamp(pitch, 0.55, 1.75);

        switch (name) {
            case 'magicMissile':
                this._synthMagicMissile(v, p);
                break;
            case 'whipCrack':
                this._synthWhipCrack(v, p);
                break;
            case 'knifeThrowing':
                this._synthKnifeThrow(v, p);
                break;
            case 'iceShardCast':
                this._synthIceShard(v, p);
                break;
            case 'enemyDeath':
                this._synthEnemyDeath(v, p);
                break;
            case 'experienceGain':
                this._synthGemPickup(v, p);
                break;
            case 'levelUp':
                this._synthLevelUp(v, p);
                break;
            case 'fireballLaunch':
                this._synthFireballLaunch(v, p);
                break;
            case 'fireballExplosion':
                this._synthFireballExplosion(v, p);
                break;
            case 'lightningStrike':
                this._synthLightning(v, p, false);
                break;
            case 'lightningChain':
                this._synthLightning(v, p, true);
                break;
            case 'garlicPulse':
                this._synthGarlicPulse(v, p);
                break;
            case 'orbiterWhoosh':
                this._synthOrbiterWhoosh(v, p);
                break;
            case 'boomerangThrow':
                this._synthBoomerang(v, p);
                break;
            case 'bloodSplash':
            case 'vampireBite':
                this._synthBloodSplash(v, p);
                break;
            case 'criticalHit':
                this._synthCriticalHit(v, p);
                break;
            case 'bossWarning':
                this._synthBossWarning(v, p);
                break;
            case 'bossSpawn':
                this._synthBossSpawn(v, p);
                break;
            case 'heartbeat':
                this._synthHeartbeat(v, p);
                break;
            case 'victoryFanfare':
                this._synthVictoryFanfare(v, p);
                break;
            case 'demonRoar':
                this._synthDemonRoar(v, p);
                break;
            case 'gameOver':
                this._synthGameOver(v, p);
                break;
            case 'uiHover':
                this._synthUIHover(v, p);
                break;
            case 'uiSelect':
                this._synthUISelect(v, p);
                break;
            case 'challengeBell':
                this._synthBossWarning(v * 0.7, p * 1.1);
                break;
            case 'challengeComplete':
                this._synthVictoryFanfare(v * 0.85, p);
                break;
            case 'challengeFail':
                this._synthGameOver(v * 0.6, p * 0.95);
                break;
            default:
                this._synthDefault(v, p);
                break;
        }
    }

    _normalizeSoundName(name) {
        return SOUND_ALIASES[name] || name;
    }

    _getThrottle(name) {
        return SOUND_THROTTLES[name] || this.throttleInterval;
    }

    // --- Core ECS Interface ---
    playVampireSound(name, volume = 1, pitch = 1) {
        if (!this.initialized || this.muted || !this.audioContext) return;
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }

        const normalized = this._normalizeSoundName(name);
        const now = performance.now();
        const lastPlayed = this.soundThrottle.get(normalized) || 0;
        const throttle = this._getThrottle(normalized);
        if (now - lastPlayed < throttle) return;
        this.soundThrottle.set(normalized, now);

        const scaledVolume = clamp(volume * (0.92 + pitch * 0.08), 0.05, 2);
        this._playNormalizedSound(normalized, scaledVolume, pitch);
    }

    // --- ECS interface implementations ---
    playLayeredHitSound(damage, weaponType, critical = false, combo = 1) {
        const intensity = Math.min(1.8, 0.45 + damage * 0.007 + combo * 0.025);
        this.playWeaponHitSound(weaponType, intensity);
        if (critical) this.playVampireSound('criticalHit', intensity * 0.9);
    }

    playWeaponHitSound(weaponType, intensity) {
        this.playVampireSound(weaponType, intensity);
    }

    playEnhancedWeaponFire(weaponType, level = 1, rapid = false) {
        const volume = rapid ? 0.58 : Math.min(1.1, 0.72 + level * 0.03);
        this.playVampireSound(weaponType, volume, 0.97 + level * 0.015);
    }

    playEnemyDeathSound(enemyType, overkill = false) {
        this.playVampireSound('enemyDeath', overkill ? 1.15 : 0.95, overkill ? 0.92 : 1);
    }

    playEnhancedUISound(action, context = 'normal') {
        this.playVampireSound(action === 'hover' ? 'uiHover' : 'uiSelect', context === 'important' ? 1.1 : 1);
    }

    playVampireBite() { this.playVampireSound('vampireBite'); }
    playBloodSplash() { this.playVampireSound('bloodSplash'); }
    playMagicMissile() { this.playVampireSound('magicMissile'); }
    playWhipCrack() { this.playVampireSound('whipCrack'); }
    playKnifeThrow() { this.playVampireSound('knifeThrowing'); }
    playCriticalHit() { this.playVampireSound('criticalHit'); }
    playEnemyDeath() { this.playVampireSound('enemyDeath'); }
    playLevelUp() { this.playVampireSound('levelUp'); }
    playExperienceGain() { this.playVampireSound('experienceGain'); }
    playWeaponUpgrade() { this.playVampireSound('weaponUpgrade'); }
    playMenuHover() { this.playVampireSound('menuHover'); }
    playMenuSelect() { this.playVampireSound('menuSelect'); }
    playGameOver() { this.playVampireSound('gameOver'); }
    startVampireAmbient() { this.setGameIntensity(0.1); }
    stopVampireAmbient() { this.setGameIntensity(0); }
    playWeaponEvolution() { this.playVampireSound('weaponEvolution', 1.05); }
    playAchievementUnlock(intensity = 1) { this.playVampireSound('achievementUnlock', intensity); }
    playPowerUpCollect() { this.playVampireSound('powerUpCollect'); }
    playLastStandActivation() { this.playVampireSound('bossWarning', 0.8); }

    setGameIntensity(intensity) {
        this.gameIntensity = clamp(intensity, 0, 1);
        this._updateMixState();
    }

    // Expose for AdaptiveMusicSystem to create music voices
    getMusicVoice(priority, duration) {
        return this._allocVoice(priority, duration, 'music');
    }

    connectMusicVoice(voice, wet = 0.18) {
        this._connectVoice(voice, wet);
    }

    createMusicOsc(type, freq, voice, duration, when = this.audioContext?.currentTime || 0) {
        return this._osc(type, freq, voice, duration, when);
    }

    getDebugInfo() {
        this._updateMixState();
        return {
            initialized: this.initialized,
            muted: this.muted,
            maxVoices: MAX_VOICES,
            gameIntensity: Number(this.gameIntensity.toFixed(3)),
            volumes: {
                master: Number(this.masterVolume.toFixed(3)),
                sound: Number(this.soundVolume.toFixed(3)),
                music: Number(this.musicVolume.toFixed(3))
            },
            mix: { ...this.mixTelemetry }
        };
    }

    get currentTime() {
        return this.audioContext ? this.audioContext.currentTime : 0;
    }

    get scale() {
        return SCALE;
    }

    get PRIORITY() {
        return PRIORITY;
    }
}
