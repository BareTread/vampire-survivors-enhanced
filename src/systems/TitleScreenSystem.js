import { CHARACTERS } from '../data/characters.js';


/**
 * TitleScreenSystem - Canvas-rendered title screen with menu navigation, upgrade shop,
 * and character selection.
 *
 * Visual direction: an authored procedural gothic threshold — the player stands in a
 * dark colonnade looking across a graveyard at a cathedral silhouette under a pale
 * moon. Charcoal/slate stone, bone lettering, ember/brass accents; blood is reserved
 * for danger. The static scene (sky, moon, cathedral, graves, columns, vignette) is
 * rendered once into an offscreen canvas and blitted each frame; only embers, fog,
 * window flicker and drips animate.
 *
 * Handles game states:
 *   - 'menu'       : Main title screen
 *   - 'characters' : Character selection overlay
 *   - 'upgrades'   : Upgrade shop overlay
 *   - 'challenges' : Challenge modifier selection overlay
 *   - 'statistics' : Lifetime records overlay
 *   - 'codex'      : Bestiary / discovery overlay
 *   - 'settings'   : Canvas settings overlay
 *   - 'paused'     : In-game pause menu (renderPauseMenu)
 */
export class TitleScreenSystem {
    constructor(game) {
        this.game = game;

        // Menu state
        this.selectedIndex = 0;
        this.menuItems = ['PLAY', 'ENDLESS', 'CHARACTERS', 'UPGRADES', 'CHALLENGES', 'STATISTICS', 'CODEX', 'SETTINGS'];
        this.hoveredIndex = -1;

        // Upgrade shop state
        this.upgradeSelectedIndex = 0;
        this.upgradeHoveredIndex = -1;
        this.upgradeList = [];

        // Character select state
        this.characterSelectedIndex = 0;
        this.characterHoveredIndex = -1;
        this._characterRects = [];
        this._characterBackRect = null;
        this._characterEquipRect = null;

        // Challenge select state
        this.challengeSelectedIndex = 0;
        this.challengeHoveredIndex = -1;
        this._challengeRects = [];
        this._challengeBackRect = null;

        // Codex state
        this.codexTabIndex = 0;
        this._codexBackRect = null;
        this._codexTabRects = [];

        // Settings state
        this.settingsSelectedIndex = 0;
        this._settingsBackRect = null;
        this._settingsItemRects = [];
        this._settingsResetRect = null;

        // Pause menu state
        this.pauseSelectedIndex = 0;
        this.pauseHoveredIndex = -1;
        this._pauseMenuRects = [];

        // Animation
        this.time = 0;
        this.titleGlow = 0;
        this.particles = [];
        this.initParticles();

        // Layout cache (recomputed on render)
        this._menuRects = [];
        this._upgradeRects = [];
        this._backButtonRect = null;
        this._statsBackRect = null;

        // Cached static scenery (rebuilt on resize)
        this._scene = null;          // { canvas, w, h }
        this._windows = [];          // cathedral window glows (normalized coords)
        this._emberSprites = null;   // pre-rendered ember glow sprites

        this.theme = {
            // Accent — aged brass / ember
            accentFill: 'rgba(196, 148, 62, 0.16)',
            accentStroke: 'rgba(216, 180, 106, 0.75)',
            accentMuted: '#C9B489',
            brass: '#D8B45A',
            ember: '#E08A3C',
            // Panel — charcoal slate stone
            panelFill: 'rgba(16, 15, 20, 0.96)',
            panelStroke: 'rgba(198, 160, 92, 0.45)',
            panelGradTop: '#1a191f',
            panelGradBottom: '#0c0b10',
            // Back button
            backFill: 'rgba(52, 40, 30, 0.75)',
            backStroke: 'rgba(216, 180, 106, 0.5)',
            // Typography
            sectionLabel: '#C9A86A',
            headerGold: '#E8DCC0',
            titleRed: '#B8321F',
            textPrimary: '#E8E2D2',
            textMuted: 'rgba(190, 180, 160, 0.55)',
            // Gothic accents
            bloodRed: '#8B1A12',
            boneWhite: '#EDE3C8',
            shadowPurple: '#16121f',
            fogColor: 'rgba(148, 132, 118, 0.05)',
            // Stone tablet buttons
            stoneGradTop: 'rgba(52, 48, 54, 0.92)',
            stoneGradBottom: 'rgba(24, 22, 27, 0.95)',
            stoneBorder: 'rgba(150, 128, 92, 0.45)',
            stoneHighlight: 'rgba(230, 210, 170, 0.10)',
            // Status
            successGreen: '#4CAF7D',
            dangerRed: '#D94A3A'
        };

        // Fog layers — 4 sine-wave bands rendered behind menu content
        this.fogLayers = [];
        for (let i = 0; i < 4; i++) {
            this.fogLayers.push({
                y: 0.55 + i * 0.12, // Low bands hugging the graveyard
                amplitude: 12 + i * 7,
                frequency: 0.003 + i * 0.001,
                speed: 0.15 + i * 0.08,
                alpha: 0.035 + i * 0.012,
                phase: Math.random() * Math.PI * 2,
                thickness: 34 + i * 16
            });
        }

        // Blood drip state — procedural bezier drips generated for panel borders
        this.bloodDrips = [];
        this._bloodDripTimer = 0;

        // Animated silhouettes — faint character shapes at screen edges
        this.silhouettes = [
            { x: 0.07, y: 0.52, scale: 1.0, alpha: 0, targetAlpha: 0.07, type: 'vampire', sway: 0 },
            { x: 0.93, y: 0.56, scale: 0.9, alpha: 0, targetAlpha: 0.06, type: 'werewolf', sway: 0 },
            { x: 0.05, y: 0.72, scale: 0.7, alpha: 0, targetAlpha: 0.05, type: 'skeleton', sway: 0 }
        ];

        // Screen transition state
        this.transition = {
            active: false,
            alpha: 0,
            speed: 3.0, // Transitions take ~0.35 seconds
            targetState: null,
            phase: 'none' // 'fadeOut', 'fadeIn', 'none'
        };
    }

    // ---- Particles ----

    initParticles() {
        this.particles = [];
        // Embers drifting up from the graveyard
        for (let i = 0; i < 70; i++) {
            this.particles.push({
                x: Math.random(),
                y: Math.random(),
                vx: (Math.random() - 0.5) * 0.015,
                vy: -(Math.random() * 0.02 + 0.005), // Float upwards like embers
                size: 0.6 + Math.random() * 2.0,
                alpha: 0.10 + Math.random() * 0.30,
                phase: Math.random() * Math.PI * 2,
                warm: Math.random() > 0.22 // most embers are orange; a few burn pale gold
            });
        }
    }

    // ---- Update ----

    update(dt) {
        this.time += dt;
        this.titleGlow = 0.5 + 0.5 * Math.sin(this.time * 1.8);

        // Update particles
        for (const p of this.particles) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            // Wrap around
            if (p.x < -0.05) p.x = 1.05;
            if (p.x > 1.05) p.x = -0.05;
            if (p.y < -0.05) p.y = 1.05;
            if (p.y > 1.05) p.y = -0.05;
        }

        // Update fog layer phases
        for (const fog of this.fogLayers) {
            fog.phase += fog.speed * dt;
        }

        // Update silhouettes — slow fade-in and sway
        for (const sil of this.silhouettes) {
            sil.alpha += (sil.targetAlpha - sil.alpha) * 0.3 * dt;
            sil.sway = Math.sin(this.time * 0.5 + sil.x * 10) * 5;
        }

        // Generate blood drips periodically
        this._bloodDripTimer -= dt;
        if (this._bloodDripTimer <= 0) {
            this._bloodDripTimer = 2 + Math.random() * 3;
            if (this.bloodDrips.length < 12) {
                this.bloodDrips.push({
                    x: 0.1 + Math.random() * 0.8,
                    length: 15 + Math.random() * 30,
                    width: 1.5 + Math.random() * 2,
                    alpha: 0.15 + Math.random() * 0.2,
                    speed: 8 + Math.random() * 12,
                    y: 0
                });
            }
        }
        // Update drip positions
        for (let i = this.bloodDrips.length - 1; i >= 0; i--) {
            this.bloodDrips[i].y += this.bloodDrips[i].speed * dt;
            this.bloodDrips[i].alpha *= 0.995;
            if (this.bloodDrips[i].y > this.bloodDrips[i].length || this.bloodDrips[i].alpha < 0.01) {
                this.bloodDrips.splice(i, 1);
            }
        }

        // Update screen transitions
        if (this.transition.active) {
            if (this.transition.phase === 'fadeOut') {
                this.transition.alpha += this.transition.speed * dt;
                if (this.transition.alpha >= 1.0) {
                    this.transition.alpha = 1.0;
                    // Switch to target state and start fade-in
                    if (this.transition.targetState) {
                        this.game.gameState = this.transition.targetState;
                        this.transition.targetState = null;
                    }
                    this.transition.phase = 'fadeIn';
                }
            } else if (this.transition.phase === 'fadeIn') {
                this.transition.alpha -= this.transition.speed * dt;
                if (this.transition.alpha <= 0) {
                    this.transition.alpha = 0;
                    this.transition.active = false;
                    this.transition.phase = 'none';
                }
            }
        }

        // Refresh upgrade list when in upgrades view
        if (this.game.gameState === 'upgrades') {
            const persistence = this.game.systems.persistence;
            if (persistence) {
                this.upgradeList = persistence.getUpgradeInfo();
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════
    //  AUTHORED SCENE — static backdrop cached to an offscreen canvas
    // ════════════════════════════════════════════════════════════════════

    _ensureScene(w, h) {
        if (this._scene && this._scene.w === w && this._scene.h === h) {
            return this._scene.canvas;
        }
        if (typeof document === 'undefined') return null;
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const g = c.getContext('2d');
        if (!g) return null;
        this._buildScene(g, w, h);
        this._scene = { canvas: c, w, h };
        return c;
    }

    _buildScene(g, w, h) {
        const horizon = h * 0.60;
        const cx = w / 2;

        // Deterministic RNG so the cached scene is stable
        let seed = 20260923;
        const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

        // ── Sky: cold charcoal zenith warming to ember haze at the horizon ──
        const sky = g.createLinearGradient(0, 0, 0, horizon);
        sky.addColorStop(0, '#06070c');
        sky.addColorStop(0.55, '#0d0c15');
        sky.addColorStop(0.85, '#161019');
        sky.addColorStop(1, '#1d1214');
        g.fillStyle = sky;
        g.fillRect(0, 0, w, horizon + 1);

        // ── Stars ──
        for (let i = 0; i < 150; i++) {
            const sx = rnd() * w;
            const sy = rnd() * horizon * 0.8;
            const a = 0.10 + rnd() * 0.45;
            const s = rnd() < 0.92 ? 1 : 1.7;
            g.fillStyle = `rgba(224, 218, 200, ${a})`;
            g.fillRect(sx, sy, s, s);
        }

        // ── Moon: pale bone disc with soft halo, centered above the spire ──
        const moonX = cx;
        const moonY = h * 0.175;
        const moonR = Math.min(w, h) * 0.088;

        const halo = g.createRadialGradient(moonX, moonY, moonR * 0.6, moonX, moonY, moonR * 3.4);
        halo.addColorStop(0, 'rgba(232, 220, 190, 0.20)');
        halo.addColorStop(0.5, 'rgba(210, 190, 160, 0.07)');
        halo.addColorStop(1, 'rgba(210, 190, 160, 0)');
        g.fillStyle = halo;
        g.fillRect(moonX - moonR * 3.4, moonY - moonR * 3.4, moonR * 6.8, moonR * 6.8);

        const disc = g.createRadialGradient(moonX - moonR * 0.25, moonY - moonR * 0.3, moonR * 0.2, moonX, moonY, moonR);
        disc.addColorStop(0, '#F0E7CE');
        disc.addColorStop(0.75, '#DCCFAF');
        disc.addColorStop(1, '#B9A888');
        g.fillStyle = disc;
        g.beginPath();
        g.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        g.fill();

        // Crater blotches
        g.fillStyle = 'rgba(160, 145, 115, 0.25)';
        for (let i = 0; i < 5; i++) {
            const a = rnd() * Math.PI * 2;
            const d = rnd() * moonR * 0.55;
            g.beginPath();
            g.arc(moonX + Math.cos(a) * d, moonY + Math.sin(a) * d, moonR * (0.08 + rnd() * 0.12), 0, Math.PI * 2);
            g.fill();
        }

        // ── Distant ridge lines ──
        this._ridge(g, w, horizon, h * 0.045, '#0a0912', rnd);
        this._ridge(g, w, horizon, h * 0.02, '#070610', rnd);

        // ── Cathedral silhouette (centered, base on the horizon) ──
        const baseY = horizon + 2;
        const bodyW = Math.min(w * 0.30, 430);
        const bodyH = h * 0.26;
        const towerW = bodyW * 0.17;
        const towerH = bodyH * 1.22;
        const spireH = bodyH * 0.62;
        const silhouette = '#050409';

        g.fillStyle = silhouette;

        // Nave
        g.fillRect(cx - bodyW / 2, baseY - bodyH, bodyW, bodyH);
        // Central gable
        g.beginPath();
        g.moveTo(cx - bodyW * 0.28, baseY - bodyH);
        g.lineTo(cx, baseY - bodyH - bodyH * 0.28);
        g.lineTo(cx + bodyW * 0.28, baseY - bodyH);
        g.closePath();
        g.fill();
        // Central spire
        const spireW = bodyW * 0.10;
        g.beginPath();
        g.moveTo(cx - spireW, baseY - bodyH - bodyH * 0.20);
        g.lineTo(cx, baseY - bodyH - bodyH * 0.20 - spireH);
        g.lineTo(cx + spireW, baseY - bodyH - bodyH * 0.20);
        g.closePath();
        g.fill();
        // Flanking towers + spires
        for (const side of [-1, 1]) {
            const tx = cx + side * (bodyW / 2 - towerW / 2);
            g.fillRect(tx - towerW / 2, baseY - towerH, towerW, towerH);
            g.beginPath();
            g.moveTo(tx - towerW * 0.62, baseY - towerH);
            g.lineTo(tx, baseY - towerH - spireH * 0.7);
            g.lineTo(tx + towerW * 0.62, baseY - towerH);
            g.closePath();
            g.fill();
        }

        // Faint moonlit rim on the left edges of the silhouette
        g.strokeStyle = 'rgba(214, 196, 158, 0.10)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx - bodyW / 2, baseY);
        g.lineTo(cx - bodyW / 2, baseY - bodyH);
        g.lineTo(cx - bodyW * 0.28, baseY - bodyH);
        g.lineTo(cx, baseY - bodyH - bodyH * 0.28);
        g.stroke();

        // ── Cathedral windows (positions stored; glow animated per frame) ──
        this._windows = [];
        const winW = Math.max(5, bodyW * 0.045);
        const winH = bodyH * 0.42;
        // Three lancets on the nave
        for (const off of [-0.22, 0, 0.22]) {
            this._windows.push({
                x: cx + off * bodyW - winW / 2,
                y: baseY - bodyH * 0.72,
                w: winW,
                h: winH,
                phase: rnd() * Math.PI * 2
            });
        }
        // One narrow slit per tower
        for (const side of [-1, 1]) {
            const tx = cx + side * (bodyW / 2 - towerW / 2);
            this._windows.push({
                x: tx - winW * 0.35,
                y: baseY - towerH * 0.62,
                w: winW * 0.7,
                h: winH * 0.55,
                phase: rnd() * Math.PI * 2
            });
        }
        // Rose window — a dim ring on the gable
        this._windows.push({
            x: cx - winW * 1.4,
            y: baseY - bodyH - bodyH * 0.16 - winW * 1.4,
            w: winW * 2.8,
            h: winW * 2.8,
            round: true,
            phase: rnd() * Math.PI * 2
        });

        // ── Graveyard: slabs and crosses along the horizon edges ──
        g.fillStyle = '#08070d';
        for (let i = 0; i < 26; i++) {
            const gx = rnd() * w;
            // Keep the center clear for the cathedral
            if (gx > cx - bodyW * 0.7 && gx < cx + bodyW * 0.7) continue;
            const gy = baseY + rnd() * (h - baseY) * 0.35;
            const gs = 4 + rnd() * 9;
            if (rnd() < 0.4) {
                // Cross marker
                g.fillRect(gx - gs * 0.12, gy - gs, gs * 0.24, gs);
                g.fillRect(gx - gs * 0.45, gy - gs * 0.72, gs * 0.9, gs * 0.22);
            } else {
                // Slab
                g.fillRect(gx - gs * 0.4, gy - gs * 0.8, gs * 0.8, gs * 0.8);
                g.beginPath();
                g.arc(gx, gy - gs * 0.8, gs * 0.4, Math.PI, 0);
                g.fill();
            }
        }

        // ── Ground ──
        const ground = g.createLinearGradient(0, horizon, 0, h);
        ground.addColorStop(0, 'rgba(10, 8, 13, 0.0)');
        ground.addColorStop(0.25, '#0b0910');
        ground.addColorStop(1, '#050407');
        g.fillStyle = ground;
        g.fillRect(0, horizon, w, h - horizon);

        // ── Threshold columns: dark pillars framing the view ──
        const colW = Math.max(18, w * 0.045);
        for (const side of [0, 1]) {
            const colX = side === 0 ? 0 : w - colW;
            const colGrad = g.createLinearGradient(colX, 0, colX + colW, 0);
            if (side === 0) {
                colGrad.addColorStop(0, '#030307');
                colGrad.addColorStop(1, '#0a0910');
            } else {
                colGrad.addColorStop(0, '#0a0910');
                colGrad.addColorStop(1, '#030307');
            }
            g.fillStyle = colGrad;
            g.fillRect(colX, 0, colW, h);
            // Inner edge highlight — faint stone catching moonlight
            g.fillStyle = 'rgba(206, 186, 148, 0.07)';
            g.fillRect(side === 0 ? colX + colW - 2 : colX, 0, 2, h);
            // Capital block
            g.fillStyle = '#040308';
            g.fillRect(colX - (side === 0 ? 0 : 4), 0, colW + 4, h * 0.05);
        }

        // ── Vignette ──
        const vig = g.createRadialGradient(cx, h * 0.45, Math.min(w, h) * 0.35, cx, h * 0.5, Math.max(w, h) * 0.75);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.5)');
        g.fillStyle = vig;
        g.fillRect(0, 0, w, h);
    }

    _ridge(g, w, baseY, amp, color, rnd) {
        g.fillStyle = color;
        g.beginPath();
        g.moveTo(0, baseY);
        let y = baseY - rnd() * amp;
        for (let x = 0; x <= w; x += w / 24) {
            y = baseY - rnd() * amp;
            g.lineTo(x, y);
        }
        g.lineTo(w, baseY);
        g.closePath();
        g.fill();
    }

    // Pre-rendered ember glow sprites (avoids per-particle shadowBlur)
    _getEmberSprites() {
        if (this._emberSprites) return this._emberSprites;
        if (typeof document === 'undefined') return null;
        const make = (r, g, b) => {
            const c = document.createElement('canvas');
            c.width = c.height = 24;
            const x = c.getContext('2d');
            if (!x) return null;
            const grad = x.createRadialGradient(12, 12, 0, 12, 12, 12);
            grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
            grad.addColorStop(0.35, `rgba(${r},${g},${b},0.55)`);
            grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
            x.fillStyle = grad;
            x.fillRect(0, 0, 24, 24);
            return c;
        };
        this._emberSprites = {
            warm: make(255, 132, 44),
            pale: make(255, 208, 130)
        };
        return this._emberSprites;
    }

    // ---- Render: Main Menu ----

    render(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // 1. Cached gothic scene (cathedral, moon, graveyard, threshold columns)
        const scene = this._ensureScene(w, h);
        if (scene) {
            ctx.drawImage(scene, 0, 0);
        } else {
            // Fallback for environments without canvas2d on offscreen
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, '#0a0a10');
            grad.addColorStop(1, '#050408');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }

        // 2. Animated atmosphere: moon veil, window candlelight, fog, silhouettes
        this._renderMoonVeil(ctx, w, h);
        this._renderWindows(ctx);
        this.renderFog(ctx, w, h);
        this.renderSilhouettes(ctx, w, h);

        // 3. Ember particles (sprite-based, no per-particle shadowBlur)
        const sprites = this._getEmberSprites();
        for (const p of this.particles) {
            const px = p.x * w;
            const py = p.y * h;
            const flicker = Math.max(0, p.alpha + 0.25 * Math.sin(this.time * 5.0 + p.phase));
            const sprite = sprites ? (p.warm ? sprites.warm : sprites.pale) : null;
            if (sprite) {
                const s = p.size * 5;
                ctx.globalAlpha = flicker;
                ctx.drawImage(sprite, px - s / 2, py - s / 2, s, s);
            } else {
                ctx.globalAlpha = flicker;
                ctx.fillStyle = p.warm ? '#FF842C' : '#FFD082';
                ctx.beginPath();
                ctx.arc(px, py, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;

        // 4. Title lettering over the moon
        this._renderTitleBlock(ctx, w, h);

        // 5. Menu — PLAY slab, ENDLESS slab, secondary chips
        this._renderMenu(ctx, w, h);

        // 6. Personal records — compact, pinned above controls hint
        this.renderRecords(ctx, w, h);

        // 7. Controls hint
        ctx.font = '12px Georgia, serif';
        ctx.fillStyle = 'rgba(190, 180, 160, 0.42)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Arrow Keys / Mouse to navigate   ·   Enter / Click to select', w / 2, h - 14);

        // 8. Overlays
        if (this.game.gameState === 'upgrades') this.renderUpgrades(ctx);
        if (this.game.gameState === 'characters') this.renderCharacters(ctx);
        if (this.game.gameState === 'statistics') this.renderStatistics(ctx);
        if (this.game.gameState === 'challenges') this.renderChallenges(ctx);
        if (this.game.gameState === 'codex') this.renderCodex(ctx);
        if (this.game.gameState === 'settings') this.renderSettings(ctx);

        // 9. Drips (drawn over menus but under transition)
        this.renderBloodDrips(ctx, w, h);

        // 10. Screen Transition Overlay
        this.renderTransition(ctx, w, h);
    }

    // Slow breathing halo over the moon
    _renderMoonVeil(ctx, w, h) {
        const moonX = w / 2;
        const moonY = h * 0.175;
        const moonR = Math.min(w, h) * 0.088;
        const a = 0.05 + 0.035 * Math.sin(this.time * 0.7);
        const veil = ctx.createRadialGradient(moonX, moonY, moonR, moonX, moonY, moonR * 4.2);
        veil.addColorStop(0, `rgba(232, 220, 190, ${a})`);
        veil.addColorStop(1, 'rgba(232, 220, 190, 0)');
        ctx.fillStyle = veil;
        ctx.fillRect(moonX - moonR * 4.2, moonY - moonR * 4.2, moonR * 8.4, moonR * 8.4);
    }

    // Candle-lit lancet windows, flickering gently
    _renderWindows(ctx) {
        if (!this._windows || this._windows.length === 0) return;
        ctx.save();
        for (const win of this._windows) {
            const a = 0.10 + 0.09 * (0.5 + 0.5 * Math.sin(this.time * 2.1 + win.phase));
            ctx.fillStyle = `rgba(255, 158, 64, ${a})`;
            if (win.round) {
                ctx.beginPath();
                ctx.arc(win.x + win.w / 2, win.y + win.h / 2, win.w / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Lancet: rect with pointed arch top
                ctx.beginPath();
                ctx.moveTo(win.x, win.y + win.h);
                ctx.lineTo(win.x, win.y + win.w * 0.6);
                ctx.quadraticCurveTo(win.x, win.y, win.x + win.w / 2, win.y);
                ctx.quadraticCurveTo(win.x + win.w, win.y, win.x + win.w, win.y + win.w * 0.6);
                ctx.lineTo(win.x + win.w, win.y + win.h);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.restore();
    }

    _renderTitleBlock(ctx, w, h) {
        const cy = h * 0.175;
        const size = Math.min(64, Math.max(30, w * 0.058));

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.06)}px`;

        ctx.font = `bold ${size}px 'Cinzel', 'Georgia', 'Times New Roman', serif`;

        // Carved shadow — letters cut into the night
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillText('VAMPIRE SURVIVORS', w / 2 + 2, cy + size * 0.06);

        // Ember rim glow behind bone lettering
        ctx.shadowColor = `rgba(224, 138, 60, ${0.22 + 0.14 * this.titleGlow})`;
        ctx.shadowBlur = 16 + 10 * this.titleGlow;

        const tg = ctx.createLinearGradient(0, cy - size * 0.5, 0, cy + size * 0.55);
        tg.addColorStop(0, '#F4EBD2');
        tg.addColorStop(0.55, '#D9C9A3');
        tg.addColorStop(1, '#93835F');
        ctx.fillStyle = tg;
        ctx.fillText('VAMPIRE SURVIVORS', w / 2, cy);

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Subtitle with flanking engraved rules
        const subSize = Math.max(12, size * 0.28);
        ctx.font = `bold ${subSize}px 'Cinzel', 'Georgia', serif`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(subSize * 0.5)}px`;
        const subY = cy + size * 0.72;
        const subW = ctx.measureText('ENHANCED').width;
        ctx.fillStyle = '#C9A86A';
        ctx.fillText('ENHANCED', w / 2, subY);
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

        // Rules + end diamonds
        const ruleY = subY;
        const inner = w / 2 - subW / 2 - 16;
        const outer = w / 2 - subW / 2 - Math.min(90, w * 0.08);
        ctx.strokeStyle = 'rgba(201, 168, 106, 0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(outer, ruleY);
        ctx.lineTo(inner, ruleY);
        ctx.moveTo(w - inner, ruleY);
        ctx.lineTo(w - outer, ruleY);
        ctx.stroke();
        ctx.fillStyle = 'rgba(201, 168, 106, 0.7)';
        for (const dx of [outer - 6, w - outer + 6]) {
            ctx.beginPath();
            ctx.moveTo(dx, ruleY - 3.5);
            ctx.lineTo(dx + 3.5, ruleY);
            ctx.lineTo(dx, ruleY + 3.5);
            ctx.lineTo(dx - 3.5, ruleY);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    _renderMenu(ctx, w, h) {
        const cx = w / 2;
        this._menuRects = new Array(this.menuItems.length).fill(null);

        const isSelected = (i) => i === this.selectedIndex;
        const isHovered = (i) => i === this.hoveredIndex;

        // ── Run intent line: hunter, gold, pending hexes ──
        const persistence = this.game.systems.persistence;
        const charId = persistence ? persistence.getSelectedCharacter() : 'antonio';
        const character = CHARACTERS.find((c) => c.id === charId);
        const gold = persistence ? persistence.getGold() : 0;
        const challenge = this.game.systems.challenge;
        const pendingHexes = challenge && challenge.pendingModifiers ? challenge.pendingModifiers.size : 0;

        const intentY = h * 0.335;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '13px Georgia, serif';
        let intent = character ? `Hunter: ${character.name}` : '';
        if (gold > 0) intent += `   ·   ${gold} gold`;
        if (pendingHexes > 0) intent += `   ·   ${pendingHexes} hex${pendingHexes > 1 ? 'es' : ''} bound`;
        if (intent) {
            ctx.fillStyle = 'rgba(201, 168, 106, 0.75)';
            ctx.fillText(intent, cx, intentY);
        }
        ctx.restore();

        // ── PLAY slab ──
        const playW = Math.min(340, w * 0.55);
        const playH = Math.min(56, h * 0.075);
        const playY = h * 0.375;
        const playRect = { x: cx - playW / 2, y: playY, w: playW, h: playH };
        this._menuRects[0] = playRect;
        this._stoneButton(ctx, playRect, 'PLAY', {
            active: isSelected(0) || isHovered(0),
            primary: true,
            fontSize: Math.min(26, playH * 0.46)
        });

        // ── ENDLESS slab ──
        const endW = playW * 0.72;
        const endH = Math.min(40, h * 0.055);
        const endY = playY + playH + Math.max(8, h * 0.012);
        const endRect = { x: cx - endW / 2, y: endY, w: endW, h: endH };
        this._menuRects[1] = endRect;
        this._stoneButton(ctx, endRect, 'ENDLESS MODE', {
            active: isSelected(1) || isHovered(1),
            fontSize: Math.min(16, endH * 0.42)
        });

        // ── Secondary chips: two columns, column-major ──
        //   CHARACTERS   STATISTICS
        //   UPGRADES     CODEX
        //   CHALLENGES   SETTINGS
        const chipTop = endY + endH + Math.max(18, h * 0.03);
        const chipBottom = h - 58;
        const narrow = w < 560;
        const cols = narrow ? 1 : 2;
        const rows = narrow ? 6 : 3;
        this._menuCols = cols;
        this._menuRows = rows;
        const gapX = 14;
        const gapY = Math.max(6, Math.min(10, (chipBottom - chipTop) * 0.04));
        const chipW = narrow
            ? Math.min(240, w * 0.7)
            : Math.min(240, (Math.min(w * 0.62, 560) - gapX) / 2);
        const chipH = Math.min(40, (chipBottom - chipTop - (rows - 1) * gapY) / rows);
        const gridW = cols * chipW + (cols - 1) * gapX;
        const startX = cx - gridW / 2;

        for (let i = 2; i < this.menuItems.length; i++) {
            const idx = i - 2;
            const col = Math.floor(idx / rows);
            const row = idx % rows;
            const rect = {
                x: startX + col * (chipW + gapX),
                y: chipTop + row * (chipH + gapY),
                w: chipW,
                h: chipH
            };
            this._menuRects[i] = rect;
            this._stoneButton(ctx, rect, this.menuItems[i], {
                active: isSelected(i) || isHovered(i),
                fontSize: Math.min(14, chipH * 0.38)
            });
        }

        // ── Selection marker: small diamond left of the active item ──
        const selRect = this._menuRects[this.selectedIndex];
        if (selRect) {
            const bounce = Math.sin(this.time * 4) * 3;
            const dx = selRect.x - 16 + bounce;
            const dy = selRect.y + selRect.h / 2;
            ctx.save();
            ctx.fillStyle = this.theme.brass;
            ctx.shadowColor = 'rgba(216, 180, 90, 0.6)';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.moveTo(dx, dy - 5);
            ctx.lineTo(dx + 5, dy);
            ctx.lineTo(dx, dy + 5);
            ctx.lineTo(dx - 5, dy);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }

    /**
     * Shared stone-slab button: charcoal gradient, brass border when active,
     * bone lettering, subtle inner top highlight.
     */
    _stoneButton(ctx, rect, label, opts = {}) {
        const { active = false, primary = false, fontSize = 16 } = opts;
        const r = primary ? 6 : 5;

        ctx.save();

        // Drop shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
        ctx.shadowBlur = primary ? 14 : 8;
        ctx.shadowOffsetY = 3;

        const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
        if (active) {
            grad.addColorStop(0, 'rgba(74, 62, 48, 0.95)');
            grad.addColorStop(1, 'rgba(36, 30, 26, 0.95)');
        } else {
            grad.addColorStop(0, this.theme.stoneGradTop);
            grad.addColorStop(1, this.theme.stoneGradBottom);
        }
        this.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, r);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowColor = 'transparent';

        // Border
        ctx.strokeStyle = active ? this.theme.accentStroke : this.theme.stoneBorder;
        ctx.lineWidth = active ? 1.6 : 1;
        this.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, r);
        ctx.stroke();

        // Inner top highlight
        ctx.strokeStyle = active ? 'rgba(240, 220, 180, 0.22)' : this.theme.stoneHighlight;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rect.x + r, rect.y + 1);
        ctx.lineTo(rect.x + rect.w - r, rect.y + 1);
        ctx.stroke();

        // Label
        ctx.font = `bold ${fontSize}px 'Cinzel', 'Georgia', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (active) {
            ctx.shadowColor = 'rgba(255, 200, 110, 0.45)';
            ctx.shadowBlur = 10;
        }
        ctx.fillStyle = active ? '#F0E2BC' : this.theme.accentMuted;
        ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);

        ctx.restore();
    }

    renderRecords(ctx, w, h) {
        const persistence = this.game.systems.persistence;
        if (!persistence) return;

        const records = persistence.data.records;
        if (records.totalRuns === 0) return;

        // Pinned near bottom, single compact line
        const y = h - 38;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '11px Georgia, serif';
        ctx.fillStyle = 'rgba(170, 158, 132, 0.5)';

        const timeStr = this.formatTime(records.longestSurvival);
        const line = `Best ${timeStr}   ·   ${records.highestKillCount} kills   ·   Lv ${records.maxLevel}   ·   ${records.totalRuns} runs`;
        ctx.fillText(line, w / 2, y);
        ctx.restore();
    }

    renderFog(ctx, w, h) {
        ctx.save();
        ctx.fillStyle = this.theme.fogColor;

        for (const fog of this.fogLayers) {
            ctx.beginPath();
            ctx.moveTo(0, h);

            // Draw sine wave across the screen width
            const segments = 20;
            for (let i = 0; i <= segments; i++) {
                const x = (i / segments) * w;
                const normalizedX = x / w;
                const wave = Math.sin(fog.phase + normalizedX * 5) * fog.amplitude;
                const y = h * fog.y + wave;
                ctx.lineTo(x, y);
            }

            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();

            // Draw a second pass with slight offset for thicker fog
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let i = 0; i <= segments; i++) {
                const x = (i / segments) * w;
                const normalizedX = x / w;
                const wave = Math.sin(fog.phase + Math.PI + normalizedX * 4) * (fog.amplitude * 0.8);
                const y = h * fog.y + fog.thickness + wave;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.closePath();
            ctx.fill();
        }

        ctx.restore();
    }

    renderSilhouettes(ctx, w, h) {
        ctx.save();
        for (const sil of this.silhouettes) {
            if (sil.alpha <= 0) continue;

            ctx.fillStyle = `rgba(8, 6, 12, ${sil.alpha})`;

            const x = w * sil.x + sil.sway;
            const y = h * sil.y;
            const s = 60 * sil.scale;

            ctx.beginPath();
            if (sil.type === 'vampire') {
                // Tall, cloaked figure
                ctx.moveTo(x, y - s);
                ctx.lineTo(x + s * 0.4, y - s * 0.8);
                ctx.lineTo(x + s * 0.6, y + s);
                ctx.lineTo(x - s * 0.6, y + s);
                ctx.lineTo(x - s * 0.4, y - s * 0.8);
            } else if (sil.type === 'werewolf') {
                // Hulking, hunched figure
                ctx.moveTo(x - s * 0.2, y - s * 0.8); // Snout
                ctx.lineTo(x + s * 0.5, y - s * 0.6); // Hunch
                ctx.lineTo(x + s * 0.7, y + s);       // Leg
                ctx.lineTo(x - s * 0.3, y + s);       // Leg
                ctx.lineTo(x - s * 0.6, y);           // Arm
            } else { // skeleton
                // Thin, jagged figure
                ctx.arc(x, y - s * 0.8, s * 0.2, 0, Math.PI * 2); // Skull
                ctx.moveTo(x, y - s * 0.6);
                ctx.lineTo(x, y + s); // Spine/Legs
                ctx.moveTo(x - s * 0.3, y - s * 0.4);
                ctx.lineTo(x + s * 0.3, y - s * 0.4); // Shoulders
            }
            ctx.fill();
        }
        ctx.restore();
    }

    renderBloodDrips(ctx, w, h) {
        if (this.bloodDrips.length === 0) return;

        ctx.save();
        for (const drip of this.bloodDrips) {
            ctx.fillStyle = `rgba(139, 26, 18, ${drip.alpha})`; // bloodRed

            const x = w * drip.x;
            const y = drip.y;
            const width = drip.width;

            ctx.beginPath();
            ctx.arc(x, y, width, 0, Math.PI);
            ctx.lineTo(x - width * 0.8, 0);
            ctx.lineTo(x + width * 0.8, 0);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    renderTransition(ctx, w, h) {
        if (!this.transition.active || this.transition.alpha <= 0) return;

        ctx.save();
        ctx.fillStyle = `rgba(0, 0, 0, ${this.transition.alpha})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════════
    //  SHARED OVERLAY CHROME — stone panel, header, back button, icons
    // ════════════════════════════════════════════════════════════════════

    _stonePanel(ctx, x, y, w, h, r = 10) {
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, this.theme.panelGradTop);
        grad.addColorStop(1, this.theme.panelGradBottom);
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 28;
        ctx.shadowOffsetY = 6;
        this.roundRect(ctx, x, y, w, h, r);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // Brass edge
        ctx.strokeStyle = this.theme.panelStroke;
        ctx.lineWidth = 1.5;
        this.roundRect(ctx, x, y, w, h, r);
        ctx.stroke();

        // Inner top highlight
        ctx.strokeStyle = 'rgba(230, 210, 170, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + r, y + 1.5);
        ctx.lineTo(x + w - r, y + 1.5);
        ctx.stroke();
    }

    _panelHeader(ctx, w, panelX, panelW, panelY, title) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.min(30, panelW * 0.055)}px 'Cinzel', 'Georgia', serif`;
        if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
        ctx.fillStyle = this.theme.boneWhite;
        ctx.shadowColor = 'rgba(216, 180, 106, 0.25)';
        ctx.shadowBlur = 12;
        ctx.fillText(title, w / 2, panelY + 40);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';

        // Engraved divider with center diamond
        const dy = panelY + 66;
        const cx = w / 2;
        ctx.strokeStyle = 'rgba(198, 160, 92, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(panelX + 40, dy);
        ctx.lineTo(cx - 12, dy);
        ctx.moveTo(cx + 12, dy);
        ctx.lineTo(panelX + panelW - 40, dy);
        ctx.stroke();
        ctx.fillStyle = 'rgba(198, 160, 92, 0.6)';
        ctx.beginPath();
        ctx.moveTo(cx, dy - 4);
        ctx.lineTo(cx + 4, dy);
        ctx.lineTo(cx, dy + 4);
        ctx.lineTo(cx - 4, dy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    _backButton(ctx, w, rect, label = 'ESC  ·  BACK') {
        ctx.save();
        const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
        grad.addColorStop(0, 'rgba(56, 44, 34, 0.85)');
        grad.addColorStop(1, 'rgba(30, 24, 20, 0.9)');
        this.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = this.theme.backStroke;
        ctx.lineWidth = 1;
        this.roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${Math.min(14, rect.h * 0.38)}px 'Cinzel', 'Georgia', serif`;
        ctx.fillStyle = this.theme.accentMuted;
        ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 + 1);
        ctx.restore();
    }

    /**
     * Small authored icon glyphs — one consistent stroke weight, no emoji.
     * (x, y) is the center; s is roughly the half-size.
     */
    _icon(ctx, name, x, y, s, color) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = Math.max(1, s * 0.16);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        switch (name) {
            case 'lock': {
                // Padlock: shackle arc + body
                ctx.beginPath();
                ctx.arc(x, y - s * 0.25, s * 0.45, Math.PI, 0);
                ctx.stroke();
                this.roundRect(ctx, x - s * 0.6, y - s * 0.2, s * 1.2, s * 0.9, s * 0.15);
                ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.beginPath();
                ctx.arc(x, y + s * 0.22, s * 0.14, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'skull': {
                ctx.beginPath();
                ctx.arc(x, y - s * 0.15, s * 0.62, Math.PI * 0.85, Math.PI * 2.15);
                ctx.lineTo(x + s * 0.4, y + s * 0.55);
                ctx.lineTo(x - s * 0.4, y + s * 0.55);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.beginPath();
                ctx.arc(x - s * 0.24, y - s * 0.18, s * 0.15, 0, Math.PI * 2);
                ctx.arc(x + s * 0.24, y - s * 0.18, s * 0.15, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'swords': {
                // Two crossed blades
                for (const dir of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(x - dir * s * 0.7, y + s * 0.7);
                    ctx.lineTo(x + dir * s * 0.7, y - s * 0.7);
                    ctx.stroke();
                    // Guard
                    ctx.beginPath();
                    ctx.moveTo(x - dir * s * 0.52 - s * 0.18, y + s * 0.52 - dir * s * 0.05);
                    ctx.lineTo(x - dir * s * 0.52 + s * 0.18, y + s * 0.52 + dir * s * 0.05);
                    ctx.stroke();
                }
                break;
            }
            case 'star': {
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const a = -Math.PI / 2 + (i * Math.PI * 4) / 5;
                    const px = x + Math.cos(a) * s * 0.75;
                    const py = y + Math.sin(a) * s * 0.75;
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'link': {
                // Chain link: two overlapping rounded rects
                ctx.beginPath();
                ctx.ellipse(x - s * 0.28, y, s * 0.45, s * 0.3, -Math.PI / 4, 0, Math.PI * 2);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(x + s * 0.28, y, s * 0.45, s * 0.3, -Math.PI / 4, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'bolt': {
                ctx.beginPath();
                ctx.moveTo(x + s * 0.15, y - s * 0.8);
                ctx.lineTo(x - s * 0.4, y + s * 0.1);
                ctx.lineTo(x + s * 0.02, y + s * 0.1);
                ctx.lineTo(x - s * 0.15, y + s * 0.8);
                ctx.lineTo(x + s * 0.4, y - s * 0.1);
                ctx.lineTo(x - s * 0.02, y - s * 0.1);
                ctx.closePath();
                ctx.fill();
                break;
            }
            case 'shield': {
                ctx.beginPath();
                ctx.moveTo(x, y - s * 0.75);
                ctx.lineTo(x + s * 0.6, y - s * 0.45);
                ctx.lineTo(x + s * 0.6, y + s * 0.1);
                ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.6, x, y + s * 0.85);
                ctx.quadraticCurveTo(x - s * 0.6, y + s * 0.6, x - s * 0.6, y + s * 0.1);
                ctx.lineTo(x - s * 0.6, y - s * 0.45);
                ctx.closePath();
                ctx.stroke();
                break;
            }
            case 'paw': {
                // Three claw marks
                for (const off of [-0.45, 0, 0.45]) {
                    ctx.beginPath();
                    ctx.moveTo(x + off * s - s * 0.12, y + s * 0.6);
                    ctx.quadraticCurveTo(x + off * s, y, x + off * s + s * 0.12, y - s * 0.6);
                    ctx.stroke();
                }
                break;
            }
            case 'noheal': {
                // Heart with strike-through
                this._iconHeartPath(ctx, x, y, s * 0.8);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x - s * 0.7, y + s * 0.7);
                ctx.lineTo(x + s * 0.7, y - s * 0.7);
                ctx.stroke();
                break;
            }
            case 'bowl': {
                // Empty bowl / famine
                ctx.beginPath();
                ctx.arc(x, y - s * 0.1, s * 0.65, 0.15, Math.PI - 0.15);
                ctx.closePath();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x - s * 0.3, y + s * 0.62);
                ctx.lineTo(x + s * 0.3, y + s * 0.62);
                ctx.stroke();
                break;
            }
            case 'heart': {
                this._iconHeartPath(ctx, x, y, s);
                ctx.fill();
                break;
            }
            case 'coin': {
                ctx.beginPath();
                ctx.arc(x, y, s * 0.7, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.arc(x, y, s * 0.42, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            case 'hourglass': {
                ctx.beginPath();
                ctx.moveTo(x - s * 0.55, y - s * 0.75);
                ctx.lineTo(x + s * 0.55, y - s * 0.75);
                ctx.lineTo(x + s * 0.15, y);
                ctx.lineTo(x + s * 0.55, y + s * 0.75);
                ctx.lineTo(x - s * 0.55, y + s * 0.75);
                ctx.lineTo(x - s * 0.15, y);
                ctx.closePath();
                ctx.stroke();
                break;
            }
            case 'speaker': {
                ctx.beginPath();
                ctx.moveTo(x - s * 0.7, y - s * 0.25);
                ctx.lineTo(x - s * 0.2, y - s * 0.25);
                ctx.lineTo(x + s * 0.25, y - s * 0.65);
                ctx.lineTo(x + s * 0.25, y + s * 0.65);
                ctx.lineTo(x - s * 0.2, y + s * 0.25);
                ctx.lineTo(x - s * 0.7, y + s * 0.25);
                ctx.closePath();
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x + s * 0.35, y, s * 0.45, -Math.PI / 3, Math.PI / 3);
                ctx.stroke();
                break;
            }
            case 'note': {
                ctx.beginPath();
                ctx.ellipse(x - s * 0.3, y + s * 0.45, s * 0.3, s * 0.22, -0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.moveTo(x - s * 0.02, y + s * 0.4);
                ctx.lineTo(x - s * 0.02, y - s * 0.6);
                ctx.lineTo(x + s * 0.6, y - s * 0.4);
                ctx.stroke();
                break;
            }
            case 'spark': {
                ctx.beginPath();
                for (let i = 0; i < 4; i++) {
                    const a = (i * Math.PI) / 2;
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + Math.cos(a) * s * 0.8, y + Math.sin(a) * s * 0.8);
                }
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x, y, s * 0.18, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'shake': {
                // Vibration marks around a dot
                ctx.beginPath();
                ctx.arc(x, y, s * 0.2, 0, Math.PI * 2);
                ctx.fill();
                for (const d of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(x + d * s * 0.45, y - s * 0.5);
                    ctx.quadraticCurveTo(x + d * s * 0.7, y, x + d * s * 0.45, y + s * 0.5);
                    ctx.stroke();
                }
                break;
            }
            case 'burst': {
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = (i * Math.PI) / 4;
                    const r1 = s * 0.3;
                    const r2 = i % 2 === 0 ? s * 0.8 : s * 0.5;
                    ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
                    ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2);
                }
                ctx.stroke();
                break;
            }
            case 'gauge': {
                ctx.beginPath();
                ctx.arc(x, y + s * 0.3, s * 0.65, Math.PI, 0);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, y + s * 0.3);
                ctx.lineTo(x + s * 0.4, y - s * 0.15);
                ctx.stroke();
                break;
            }
            case 'gear': {
                ctx.beginPath();
                ctx.arc(x, y, s * 0.45, 0, Math.PI * 2);
                ctx.stroke();
                for (let i = 0; i < 6; i++) {
                    const a = (i * Math.PI) / 3;
                    ctx.beginPath();
                    ctx.moveTo(x + Math.cos(a) * s * 0.45, y + Math.sin(a) * s * 0.45);
                    ctx.lineTo(x + Math.cos(a) * s * 0.72, y + Math.sin(a) * s * 0.72);
                    ctx.stroke();
                }
                break;
            }
            case 'eye': {
                ctx.beginPath();
                ctx.moveTo(x - s * 0.75, y);
                ctx.quadraticCurveTo(x, y - s * 0.7, x + s * 0.75, y);
                ctx.quadraticCurveTo(x, y + s * 0.7, x - s * 0.75, y);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(x, y, s * 0.22, 0, Math.PI * 2);
                ctx.fill();
                break;
            }
            case 'pause': {
                ctx.fillRect(x - s * 0.42, y - s * 0.6, s * 0.28, s * 1.2);
                ctx.fillRect(x + s * 0.14, y - s * 0.6, s * 0.28, s * 1.2);
                break;
            }
            case 'magnet': {
                ctx.beginPath();
                ctx.arc(x, y - s * 0.05, s * 0.55, Math.PI, 0);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x - s * 0.55, y - s * 0.05);
                ctx.lineTo(x - s * 0.55, y + s * 0.55);
                ctx.moveTo(x + s * 0.55, y - s * 0.05);
                ctx.lineTo(x + s * 0.55, y + s * 0.55);
                ctx.stroke();
                break;
            }
            case 'check': {
                ctx.beginPath();
                ctx.moveTo(x - s * 0.55, y + s * 0.05);
                ctx.lineTo(x - s * 0.12, y + s * 0.5);
                ctx.lineTo(x + s * 0.6, y - s * 0.5);
                ctx.stroke();
                break;
            }
            case 'circle': {
                ctx.beginPath();
                ctx.arc(x, y, s * 0.5, 0, Math.PI * 2);
                ctx.stroke();
                break;
            }
            default: {
                // Diamond rune fallback
                ctx.beginPath();
                ctx.moveTo(x, y - s * 0.6);
                ctx.lineTo(x + s * 0.6, y);
                ctx.lineTo(x, y + s * 0.6);
                ctx.lineTo(x - s * 0.6, y);
                ctx.closePath();
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    _iconHeartPath(ctx, x, y, s) {
        ctx.beginPath();
        ctx.moveTo(x, y + s * 0.65);
        ctx.bezierCurveTo(x - s * 1.0, y - s * 0.05, x - s * 0.55, y - s * 0.8, x, y - s * 0.25);
        ctx.bezierCurveTo(x + s * 0.55, y - s * 0.8, x + s * 1.0, y - s * 0.05, x, y + s * 0.65);
        ctx.closePath();
    }

    // ---- Render: Upgrade Shop ----

    renderUpgrades(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(4, 3, 7, 0.82)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(600, w - 60);
        const panelH = Math.min(550, h - 80);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        this._stonePanel(ctx, panelX, panelY, panelW, panelH, 12);
        this._panelHeader(ctx, w, panelX, panelW, panelY, 'UPGRADE SHOP');

        // Gold balance
        const gold = this.game.systems.persistence ? this.game.systems.persistence.getGold() : 0;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        this._icon(ctx, 'coin', w / 2 - 34, panelY + 82, 7, this.theme.brass);
        ctx.font = 'bold 15px Georgia, serif';
        ctx.fillStyle = this.theme.brass;
        ctx.fillText(`${gold} gold`, w / 2 + 10, panelY + 83);
        ctx.restore();

        // Upgrade list
        this._upgradeRects = [];
        const listY = panelY + 100;
        const itemH = 50;
        const listX = panelX + 20;
        const listW = panelW - 40;

        const upgrades = this.upgradeList;
        for (let i = 0; i < upgrades.length; i++) {
            const u = upgrades[i];
            const iy = listY + i * itemH;
            const isSelected = i === this.upgradeSelectedIndex;
            const isHovered = i === this.upgradeHoveredIndex;

            this._upgradeRects.push({ x: listX, y: iy, w: listW, h: itemH - 4 });

            // Row background
            if (isSelected || isHovered) {
                ctx.fillStyle = this.theme.accentFill;
                ctx.strokeStyle = this.theme.accentStroke;
                ctx.lineWidth = 1;
                this.roundRect(ctx, listX, iy, listW, itemH - 4, 6);
                ctx.fill();
                ctx.stroke();
            }

            // Icon tile — engraved letter on a stone chip
            ctx.fillStyle = 'rgba(198, 160, 92, 0.14)';
            this.roundRect(ctx, listX + 8, iy + (itemH - 4) / 2 - 11, 22, 22, 4);
            ctx.fill();
            ctx.strokeStyle = 'rgba(198, 160, 92, 0.35)';
            ctx.lineWidth = 1;
            this.roundRect(ctx, listX + 8, iy + (itemH - 4) / 2 - 11, 22, 22, 4);
            ctx.stroke();
            ctx.font = 'bold 12px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this.theme.accentMuted;
            ctx.fillText(u.icon, listX + 19, iy + (itemH - 4) / 2 + 1);

            // Name
            ctx.textAlign = 'left';
            ctx.font = 'bold 15px Georgia, serif';
            ctx.fillStyle = isSelected || isHovered ? '#F0E2BC' : this.theme.textPrimary;
            ctx.fillText(u.name, listX + 40, iy + 16);

            // Description
            ctx.font = '12px Georgia, serif';
            ctx.fillStyle = this.theme.textMuted;
            ctx.fillText(u.desc, listX + 40, iy + 34);

            // Level pips
            const pipsX = listX + listW - 160;
            for (let l = 0; l < u.maxLevel; l++) {
                const px = pipsX + l * 12;
                ctx.fillStyle = l < u.level ? this.theme.brass : 'rgba(120, 110, 95, 0.35)';
                ctx.beginPath();
                ctx.arc(px, iy + (itemH - 4) / 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Cost
            ctx.textAlign = 'right';
            ctx.font = 'bold 14px Georgia, serif';
            if (u.cost === null) {
                ctx.fillStyle = this.theme.successGreen;
                ctx.fillText('MAX', listX + listW - 10, iy + (itemH - 4) / 2);
            } else {
                ctx.fillStyle = u.canAfford ? this.theme.brass : this.theme.dangerRed;
                ctx.fillText(`${u.cost}g`, listX + listW - 10, iy + (itemH - 4) / 2);
            }
        }

        // Back button
        const backW = 140;
        const backH = 36;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 50;
        this._backButtonRect = { x: backX, y: backY, w: backW, h: backH };
        this._backButton(ctx, w, this._backButtonRect);
    }

    // ---- Render: Character Select ----

    renderCharacters(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const persistence = this.game.systems.persistence;
        const currentCharId = persistence ? persistence.getSelectedCharacter() : 'antonio';

        // Dark overlay
        ctx.fillStyle = 'rgba(4, 3, 7, 0.90)';
        ctx.fillRect(0, 0, w, h);

        // Responsive Panel Size
        const panelW = Math.min(960, w - 40);
        const panelH = Math.min(640, h - 40);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        this._stonePanel(ctx, panelX, panelY, panelW, panelH, 12);
        this._panelHeader(ctx, w, panelX, panelW, panelY, 'CHOOSE YOUR CHAMPION');

        // Two-pane Layout
        const leftPaneW = panelW * 0.36;
        const rightPaneW = panelW * 0.64;
        const paneY = panelY + 92;
        const paneH = panelH - 182;

        // List properties
        this._characterRects = [];
        const itemH = 46;
        const listMargin = 25;
        const listW = leftPaneW - listMargin * 2;
        const listX = panelX + listMargin;

        // We use either hovered or selected for right pane
        const activeIdx = this.characterHoveredIndex !== -1 ? this.characterHoveredIndex : this.characterSelectedIndex;

        // --- LEFT PANE (Character List) ---
        for (let i = 0; i < CHARACTERS.length; i++) {
            const char = CHARACTERS[i];
            const iy = paneY + i * (itemH + 5);
            const isSelected = i === this.characterSelectedIndex;
            const isHovered = i === this.characterHoveredIndex;
            const isActive = i === activeIdx;
            const isCurrentChar = char.id === currentCharId;
            const isUnlocked = char.unlocked || (persistence && persistence.isCharacterUnlocked(char.id));

            this._characterRects.push({ x: listX, y: iy, w: listW, h: itemH });

            // Row background
            if (isActive) {
                const rowGrad = ctx.createLinearGradient(listX, iy, listX + listW, iy);
                rowGrad.addColorStop(0, 'rgba(216, 180, 106, 0.22)');
                rowGrad.addColorStop(1, 'rgba(216, 180, 106, 0.04)');
                ctx.fillStyle = rowGrad;
                ctx.strokeStyle = this.theme.brass;
                ctx.lineWidth = 1.5;
            } else if (isHovered) {
                ctx.fillStyle = 'rgba(230, 210, 170, 0.08)';
                ctx.strokeStyle = 'rgba(230, 210, 170, 0.25)';
                ctx.lineWidth = 1;
            } else {
                ctx.fillStyle = isUnlocked ? 'rgba(24, 22, 28, 0.6)' : 'rgba(12, 11, 15, 0.4)';
                ctx.strokeStyle = isUnlocked ? 'rgba(90, 80, 70, 0.4)' : 'rgba(50, 45, 55, 0.4)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, listX, iy, listW, itemH, 6);
            ctx.fill();
            ctx.stroke();

            // Equipped indicator (left edge accent)
            if (isCurrentChar) {
                ctx.fillStyle = this.theme.brass;
                ctx.shadowColor = 'rgba(216, 180, 106, 0.6)';
                ctx.shadowBlur = 8;
                this.roundRect(ctx, listX, iy, 5, itemH, { tl: 6, bl: 6, tr: 0, br: 0 });
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            const iconX = listX + 28;
            const textX = listX + 54;
            const midY = iy + itemH / 2;

            if (!isUnlocked) {
                // Locked icon — drawn padlock
                this._icon(ctx, 'lock', iconX, midY, 9, 'rgba(140, 130, 115, 0.55)');

                // Locked Name
                ctx.textAlign = 'left';
                ctx.font = 'bold 16px Georgia, serif';
                ctx.fillStyle = 'rgba(120, 112, 100, 0.55)';
                ctx.fillText('???', textX, midY + 1);
            } else {
                // Character color medallion with glow if active
                if (isActive) {
                    ctx.shadowColor = char.color;
                    ctx.shadowBlur = 8;
                }
                ctx.beginPath();
                ctx.arc(iconX, midY, 12, 0, Math.PI * 2);
                ctx.fillStyle = char.color;
                ctx.fill();
                ctx.shadowBlur = 0;

                ctx.strokeStyle = 'rgba(240, 230, 205, 0.75)';
                ctx.lineWidth = 1.5;
                ctx.stroke();

                if (isCurrentChar) {
                    ctx.beginPath();
                    ctx.arc(iconX, midY, 4, 0, Math.PI * 2);
                    ctx.fillStyle = '#FFF';
                    ctx.fill();
                }

                // Name
                ctx.textAlign = 'left';
                ctx.font = 'bold 16px "Cinzel", "Georgia", serif';
                ctx.fillStyle = isActive ? '#F0E2BC' : '#E4DCC8';
                ctx.fillText(char.name, textX, midY + 1);
            }
        }

        // --- RIGHT PANE (Character Details) ---
        const rightX = panelX + leftPaneW;
        const detailsX = rightX + 40;
        const detailsW = rightPaneW - 80;
        const activeChar = CHARACTERS[activeIdx];
        const isUnlocked = activeChar.unlocked || (persistence && persistence.isCharacterUnlocked(activeChar.id));
        const isCurrentChar = activeChar.id === currentCharId;

        // Inner pane styling
        const rightPaneGrad = ctx.createLinearGradient(rightX, paneY, rightX, paneY + paneH);
        rightPaneGrad.addColorStop(0, 'rgba(28, 26, 32, 0.6)');
        rightPaneGrad.addColorStop(1, 'rgba(14, 13, 17, 0.8)');
        ctx.fillStyle = rightPaneGrad;
        ctx.strokeStyle = 'rgba(120, 105, 85, 0.35)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, rightX, paneY, rightPaneW - 25, paneH, 10);
        ctx.fill();
        ctx.stroke();

        this._characterEquipRect = { x: rightX, y: paneY, w: rightPaneW - 25, h: paneH };

        if (!isUnlocked) {
            // Locked View
            this._icon(ctx, 'lock', rightX + (rightPaneW - 25) / 2, paneY + paneH * 0.32, 30, 'rgba(140, 130, 115, 0.35)');

            ctx.textAlign = 'center';
            ctx.font = 'bold 24px "Cinzel", "Georgia", serif';
            ctx.fillStyle = 'rgba(160, 150, 130, 0.7)';
            ctx.fillText('CHAMPION LOCKED', rightX + (rightPaneW - 25) / 2, paneY + paneH * 0.55);

            ctx.font = '15px Georgia, serif';
            ctx.fillStyle = 'rgba(201, 168, 106, 0.9)';
            this.wrapText(ctx, activeChar.unlockDesc || 'Defeat more enemies to unlock.', rightX + (rightPaneW - 25) / 2, paneY + paneH * 0.65, detailsW - 40, 22);

        } else {
            // Unlocked View

            // Large Portrait background aura
            const portraitX = detailsX + 50;
            const portraitY = paneY + 65;

            const auraGrad = ctx.createRadialGradient(portraitX, portraitY, 10, portraitX, portraitY, 60);
            auraGrad.addColorStop(0, activeChar.color);
            auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = auraGrad;
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.arc(portraitX, portraitY, 70, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;

            // Character medallion
            ctx.beginPath();
            ctx.arc(portraitX, portraitY, 45, 0, Math.PI * 2);
            ctx.fillStyle = activeChar.color;
            ctx.fill();

            ctx.strokeStyle = 'rgba(240, 230, 205, 0.85)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Inner styling for portrait
            ctx.beginPath();
            ctx.arc(portraitX - 12, portraitY - 12, 18, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
            ctx.fill();

            // Title and Name
            ctx.textAlign = 'left';
            ctx.font = 'bold 34px "Cinzel", "Georgia", serif';
            ctx.fillStyle = '#F0E2BC';
            ctx.shadowColor = 'rgba(216, 180, 106, 0.35)';
            ctx.shadowBlur = 8;
            ctx.fillText(activeChar.name, portraitX + 75, portraitY - 5);
            ctx.shadowBlur = 0;

            ctx.font = 'italic 17px Georgia, serif';
            ctx.fillStyle = activeChar.color;
            ctx.fillText(activeChar.title, portraitX + 78, portraitY + 22);

            // Separator line
            ctx.beginPath();
            ctx.moveTo(detailsX, portraitY + 65);
            ctx.lineTo(detailsX + detailsW, portraitY + 65);
            ctx.strokeStyle = 'rgba(230, 210, 170, 0.12)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Description
            ctx.font = '15px Georgia, serif';
            ctx.fillStyle = 'rgba(226, 218, 198, 0.92)';
            const descY = portraitY + 95;

            const words = activeChar.description.split(' ');
            let line = '';
            let lineY = descY;
            for (const word of words) {
                const test = line + (line ? ' ' : '') + word;
                if (ctx.measureText(test).width > detailsW && line) {
                    ctx.fillText(line, detailsX, lineY);
                    line = word;
                    lineY += 24;
                } else {
                    line = test;
                }
            }
            if (line) ctx.fillText(line, detailsX, lineY);

            // Flex layout for Stats and Weapon
            const flexY = lineY + 45;

            // Left column: Weapon
            ctx.font = 'bold 12px Georgia, serif';
            ctx.fillStyle = 'rgba(170, 158, 132, 0.85)';
            ctx.fillText('STARTING WEAPON', detailsX, flexY);

            ctx.font = 'bold 18px Georgia, serif';
            ctx.fillStyle = '#9CC4D8'; // Cold steel blue
            const weaponName = activeChar.startingWeapon.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            ctx.fillText(weaponName, detailsX, flexY + 25);

            // Right column: Stats
            const statsX = detailsX + detailsW * 0.45;
            ctx.font = 'bold 12px Georgia, serif';
            ctx.fillStyle = 'rgba(170, 158, 132, 0.85)';
            ctx.fillText('PASSIVE BONUSES', statsX, flexY);

            const modY = flexY + 25;
            ctx.font = '15px Georgia, serif';
            let modLine = 0;
            const entries = Object.entries(activeChar.statModifiers);

            if (entries.length === 0) {
                ctx.fillStyle = 'rgba(170, 158, 132, 0.6)';
                ctx.fillText('None', statsX, modY);
            } else {
                for (const [stat, val] of entries) {
                    const isPositive = val >= 1 || stat === 'projectiles';
                    const display = stat === 'projectiles'
                        ? `+${val} Projectile${val > 1 ? 's' : ''}`
                        : `${val > 1 ? '+' : ''}${Math.round((val - 1) * 100)}% ${stat.charAt(0).toUpperCase() + stat.slice(1)}`;

                    ctx.fillStyle = isPositive ? this.theme.successGreen : this.theme.dangerRed;
                    // Two-column grid inside the stats section
                    const col = modLine % 2;
                    const row = Math.floor(modLine / 2);
                    ctx.fillText(display, statsX + col * (detailsW * 0.25), modY + row * 24);
                    modLine++;
                }
            }

            // Status Badge
            const badgeY = paneY + paneH - 35;
            if (isCurrentChar) {
                ctx.font = 'bold 16px Georgia, serif';
                ctx.fillStyle = this.theme.brass;
                ctx.textAlign = 'right';
                ctx.shadowColor = 'rgba(216, 180, 106, 0.5)';
                ctx.shadowBlur = 10;
                this._icon(ctx, 'check', rightX + rightPaneW - 45 - ctx.measureText('EQUIPPED').width - 16, badgeY - 6, 8, this.theme.brass);
                ctx.fillText('EQUIPPED', rightX + rightPaneW - 45, badgeY);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            } else {
                // Equip hint button
                const btnW = 210;
                const btnH = 38;
                const btnX = rightX + rightPaneW - 45 - btnW;
                const btnY = badgeY - 26;

                ctx.fillStyle = 'rgba(216, 180, 106, 0.10)';
                ctx.strokeStyle = 'rgba(216, 180, 106, 0.35)';
                ctx.lineWidth = 1;
                this.roundRect(ctx, btnX, btnY, btnW, btnH, 6);
                ctx.fill();
                ctx.stroke();

                ctx.font = '14px Georgia, serif';
                ctx.fillStyle = this.theme.brass;
                ctx.textAlign = 'center';
                ctx.fillText('Press ENTER to Equip', btnX + btnW / 2, badgeY - 6);
            }
        }

        // Divider above back button
        ctx.beginPath();
        ctx.moveTo(panelX + 40, panelY + panelH - 80);
        ctx.lineTo(panelX + panelW - 40, panelY + panelH - 80);
        ctx.strokeStyle = 'rgba(198, 160, 92, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Back button
        const backW = 220;
        const backH = 42;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 62;
        this._characterBackRect = { x: backX, y: backY, w: backW, h: backH };
        this._backButton(ctx, w, this._characterBackRect, 'ESC  ·  RETURN TO MENU');
    }

    /**
     * Simple word-wrap for centered text.
     */
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        let lineY = y;
        for (const word of words) {
            const test = line + (line ? ' ' : '') + word;
            if (ctx.measureText(test).width > maxWidth && line) {
                ctx.fillText(line, x, lineY);
                line = word;
                lineY += lineHeight;
            } else {
                line = test;
            }
        }
        if (line) ctx.fillText(line, x, lineY);
    }

    // ---- Input ----

    handleInput(key) {
        const k = key.toLowerCase();

        if (this.game.gameState === 'upgrades') {
            this.handleUpgradeInput(k);
            return;
        }

        if (this.game.gameState === 'challenges') {
            this.handleChallengeInput(k);
            return;
        }

        if (this.game.gameState === 'characters') {
            this.handleCharacterInput(k);
            return;
        }

        if (this.game.gameState === 'statistics') {
            if (k === 'escape') {
                this.triggerTransition('menu');
            }
            return;
        }

        if (this.game.gameState === 'codex') {
            this.handleCodexInput(k);
            return;
        }

        if (this.game.gameState === 'settings') {
            this.handleSettingsInput(k);
            return;
        }

        // Main menu
        if (k === 'arrowup') {
            this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
            this.playHoverSound();
        } else if (k === 'arrowleft' || k === 'arrowright') {
            // Hop between chip columns (column-major grid; single column when narrow)
            const cols = this._menuCols || 2;
            const rows = this._menuRows || 3;
            if (this.selectedIndex >= 2 && cols > 1) {
                const idx = this.selectedIndex - 2;
                const col = Math.floor(idx / rows);
                const row = idx % rows;
                const targetCol = k === 'arrowleft' ? 0 : 1;
                if (targetCol !== col) {
                    this.selectedIndex = 2 + targetCol * rows + row;
                    this.playHoverSound();
                }
            }
        } else if (k === 'enter' || k === ' ') {
            this.selectMenuItem(this.selectedIndex);
        }
    }

    handleUpgradeInput(k) {
        const len = this.upgradeList.length;
        if (len === 0) return;

        if (k === 'arrowup') {
            this.upgradeSelectedIndex = (this.upgradeSelectedIndex - 1 + len) % len;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.upgradeSelectedIndex = (this.upgradeSelectedIndex + 1) % len;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            this.tryPurchaseUpgrade(this.upgradeSelectedIndex);
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        }
    }

    handleCharacterInput(k) {
        if (k === 'arrowleft') {
            this.characterSelectedIndex = (this.characterSelectedIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
            this.playHoverSound();
        } else if (k === 'arrowright') {
            this.characterSelectedIndex = (this.characterSelectedIndex + 1) % CHARACTERS.length;
            this.playHoverSound();
        } else if (k === 'arrowup') {
            this.characterSelectedIndex = (this.characterSelectedIndex - 1 + CHARACTERS.length) % CHARACTERS.length;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.characterSelectedIndex = (this.characterSelectedIndex + 1) % CHARACTERS.length;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            this.trySelectCharacter(this.characterSelectedIndex);
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        }
    }

    handleClick(x, y) {
        if (this.game.gameState === 'upgrades') {
            this.handleUpgradeClick(x, y);
            return;
        }

        if (this.game.gameState === 'challenges') {
            this.handleChallengeClick(x, y);
            return;
        }

        if (this.game.gameState === 'characters') {
            this.handleCharacterClick(x, y);
            return;
        }

        if (this.game.gameState === 'statistics') {
            // Back button
            const b = this._statsBackRect;
            if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
                this.triggerTransition('menu');
            }
            return;
        }

        if (this.game.gameState === 'codex') {
            this.handleCodexClick(x, y);
            return;
        }

        if (this.game.gameState === 'settings') {
            this.handleSettingsClick(x, y);
            return;
        }

        // Main menu
        for (let i = 0; i < this._menuRects.length; i++) {
            const r = this._menuRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.selectedIndex = i;
                this.selectMenuItem(i);
                return;
            }
        }
    }

    handleUpgradeClick(x, y) {
        // Back button
        const b = this._backButtonRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Upgrade rows
        for (let i = 0; i < this._upgradeRects.length; i++) {
            const r = this._upgradeRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.upgradeSelectedIndex = i;
                this.tryPurchaseUpgrade(i);
                return;
            }
        }
    }

    handleCharacterClick(x, y) {
        // Back button
        const b = this._characterBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Equip rect
        const e = this._characterEquipRect;
        if (e && x >= e.x && x <= e.x + e.w && y >= e.y && y <= e.y + e.h) {
            const activeIdx = this.characterHoveredIndex !== -1 ? this.characterHoveredIndex : this.characterSelectedIndex;
            this.trySelectCharacter(activeIdx);
            return;
        }

        // Character cards / list rows
        for (let i = 0; i < this._characterRects.length; i++) {
            const r = this._characterRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.characterSelectedIndex = i;
                this.trySelectCharacter(i);
                return;
            }
        }
    }

    handleMouseMove(x, y) {
        if (this.game.gameState === 'statistics') {
            return; // No hover state needed for statistics
        }

        if (this.game.gameState === 'codex') {
            return; // Tab navigation only
        }

        if (this.game.gameState === 'settings') {
            return; // Settings uses own navigation
        }

        if (this.game.gameState === 'challenges') {
            this.challengeHoveredIndex = -1;
            for (let i = 0; i < this._challengeRects.length; i++) {
                const r = this._challengeRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.challengeHoveredIndex = i;
                    break;
                }
            }
            return;
        }

        if (this.game.gameState === 'characters') {
            this.characterHoveredIndex = -1;
            for (let i = 0; i < this._characterRects.length; i++) {
                const r = this._characterRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.characterHoveredIndex = i;
                    break;
                }
            }
            return;
        }

        if (this.game.gameState === 'upgrades') {
            this.upgradeHoveredIndex = -1;
            for (let i = 0; i < this._upgradeRects.length; i++) {
                const r = this._upgradeRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.upgradeHoveredIndex = i;
                    break;
                }
            }
            return;
        }

        // Main menu
        this.hoveredIndex = -1;
        for (let i = 0; i < this._menuRects.length; i++) {
            const r = this._menuRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.hoveredIndex = i;
                break;
            }
        }
    }

    // ---- Actions ----

    triggerTransition(targetState) {
        if (this.transition.active) return;
        this.transition.targetState = targetState;
        this.transition.active = true;
        this.transition.phase = 'fadeOut';
        this.transition.alpha = 0;
    }

    selectMenuItem(index) {
        if (this.transition.active) return;
        const item = this.menuItems[index];
        this.playSelectSound();

        switch (item) {
            case 'PLAY':
                this.game.startGame();
                break;
            case 'ENDLESS':
                this.game.startGame();
                if (this.game.systems.runTimer) {
                    this.game.systems.runTimer.endlessMode = true;
                }
                break;
            case 'CHARACTERS':
                this.characterSelectedIndex = 0;
                this.characterHoveredIndex = -1;
                this.triggerTransition('characters');
                break;
            case 'UPGRADES':
                this.upgradeSelectedIndex = 0;
                this.upgradeList = this.game.systems.persistence ? this.game.systems.persistence.getUpgradeInfo() : [];
                this.triggerTransition('upgrades');
                break;
            case 'CHALLENGES':
                this.challengeSelectedIndex = 0;
                this.challengeHoveredIndex = -1;
                this.triggerTransition('challenges');
                break;
            case 'STATISTICS':
                this.triggerTransition('statistics');
                break;
            case 'CODEX':
                this.codexTabIndex = 0;
                this.triggerTransition('codex');
                break;
            case 'SETTINGS':
                this.settingsSelectedIndex = 0;
                this.triggerTransition('settings');
                break;
        }
    }

    tryPurchaseUpgrade(index) {
        const u = this.upgradeList[index];
        if (!u || u.cost === null || !u.canAfford) return;

        const persistence = this.game.systems.persistence;
        if (!persistence) return;

        const success = persistence.purchaseUpgrade(u.id);
        if (success) {
            this.upgradeList = persistence.getUpgradeInfo();
            this.playSelectSound();
            this.game.showToast(`Upgraded ${u.name}!`, '#4ade80', 1200);
        }
    }

    trySelectCharacter(index) {
        const char = CHARACTERS[index];
        if (!char) return;

        const persistence = this.game.systems.persistence;
        if (!persistence) return;

        const isUnlocked = char.unlocked || persistence.isCharacterUnlocked(char.id);
        if (!isUnlocked) return;

        persistence.setSelectedCharacter(char.id);
        this.playSelectSound();
        this.game.showToast(`Selected ${char.name}!`, char.color, 1200);
    }

    // ---- Render: Statistics Dashboard ----

    renderStatistics(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(4, 3, 7, 0.82)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(620, w - 60);
        const panelH = Math.min(520, h - 80);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        this._stonePanel(ctx, panelX, panelY, panelW, panelH, 12);
        this._panelHeader(ctx, w, panelX, panelW, panelY, 'STATISTICS');

        const persistence = this.game.systems.persistence;
        if (!persistence) {
            ctx.font = '16px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = this.theme.accentMuted;
            ctx.fillText('No data available', w / 2, h / 2);
            return;
        }

        const records = persistence.data.records;
        const colLeft = panelX + 40;
        const colRight = panelX + panelW / 2 + 20;
        const startY = panelY + 86;
        const lineH = 32;

        ctx.textBaseline = 'middle';

        // Left column header
        ctx.textAlign = 'left';
        ctx.font = 'bold 13px Georgia, serif';
        ctx.fillStyle = this.theme.sectionLabel;
        ctx.fillText('RUN TOTALS', colLeft, startY);

        // Left column stats
        ctx.font = '14px Georgia, serif';
        const leftStats = [
            ['Total Runs', records.totalRuns],
            ['Total Playtime', this.formatPlaytime(records.totalPlayTime || 0)],
            ['Total Kills', this.formatNumber(records.totalKills || 0)],
            ['Total Gold Earned', this.formatNumber(records.totalGoldEarned || 0)],
            ['Total Damage Dealt', this.formatNumber(records.totalDamageDealt || 0)]
        ];

        for (let i = 0; i < leftStats.length; i++) {
            const y = startY + (i + 1) * lineH;
            ctx.fillStyle = this.theme.textMuted;
            ctx.fillText(leftStats[i][0], colLeft, y);
            ctx.fillStyle = this.theme.textPrimary;
            ctx.textAlign = 'right';
            ctx.fillText(String(leftStats[i][1]), colLeft + panelW / 2 - 60, y);
            ctx.textAlign = 'left';
        }

        // Right column header
        ctx.font = 'bold 13px Georgia, serif';
        ctx.fillStyle = this.theme.sectionLabel;
        ctx.fillText('PERSONAL BESTS', colRight, startY);

        // Right column stats
        ctx.font = '14px Georgia, serif';
        const rightStats = [
            ['Best Survival', this.formatTime(records.longestSurvival || 0)],
            ['Most Kills', this.formatNumber(records.highestKillCount || 0)],
            ['Highest Level', records.maxLevel || 0],
            ['Highest Combo', records.highestCombo || 0],
            ['Most Gold (run)', this.formatNumber(records.mostGoldSingleRun || 0)]
        ];

        for (let i = 0; i < rightStats.length; i++) {
            const y = startY + (i + 1) * lineH;
            ctx.fillStyle = this.theme.textMuted;
            ctx.fillText(rightStats[i][0], colRight, y);
            ctx.fillStyle = this.theme.textPrimary;
            ctx.textAlign = 'right';
            ctx.fillText(String(rightStats[i][1]), colRight + panelW / 2 - 60, y);
            ctx.textAlign = 'left';
        }

        // Favorite weapon section
        const weaponY = startY + 7 * lineH;
        ctx.font = 'bold 13px Georgia, serif';
        ctx.fillStyle = this.theme.sectionLabel;
        ctx.textAlign = 'center';
        ctx.fillText('FAVORITE WEAPON', w / 2, weaponY);

        const usage = records.weaponUsage || {};
        let favWeapon = null;
        let favCount = 0;
        for (const [weapon, count] of Object.entries(usage)) {
            if (count > favCount) {
                favCount = count;
                favWeapon = weapon;
            }
        }

        ctx.font = '14px Georgia, serif';
        if (favWeapon) {
            const weaponName = favWeapon.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
            ctx.fillStyle = this.theme.brass;
            ctx.fillText(
                `${weaponName}  (picked ${favCount} time${favCount !== 1 ? 's' : ''})`,
                w / 2,
                weaponY + lineH
            );
        } else {
            ctx.fillStyle = this.theme.textMuted;
            ctx.fillText('No weapons used yet', w / 2, weaponY + lineH);
        }

        // Back button
        const backW = 140;
        const backH = 36;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 50;
        this._statsBackRect = { x: backX, y: backY, w: backW, h: backH };
        this._backButton(ctx, w, this._statsBackRect);
    }

    // ---- Render: Challenge Modifiers ----

    renderChallenges(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const challenge = this.game.systems.challenge;
        if (!challenge) return;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(4, 3, 7, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(620, w - 60);
        const panelH = Math.min(560, h - 60);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        this._stonePanel(ctx, panelX, panelY, panelW, panelH, 12);
        this._panelHeader(ctx, w, panelX, panelW, panelY, 'CHALLENGE HEXES');

        // Unlock check
        const unlocked = challenge.isUnlocked();
        if (!unlocked) {
            this._icon(ctx, 'lock', w / 2, h / 2 - 40, 18, 'rgba(201, 168, 106, 0.5)');
            ctx.font = '16px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'rgba(201, 168, 106, 0.85)';
            ctx.fillText('Survive 15 minutes to unlock challenges', w / 2, h / 2);
            ctx.font = '13px Georgia, serif';
            ctx.fillStyle = this.theme.textMuted;
            ctx.fillText('Hexes add difficulty modifiers in exchange for bonus gold', w / 2, h / 2 + 28);
        } else {
            // Subheader
            ctx.font = '13px Georgia, serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = this.theme.textMuted;
            ctx.fillText('Bind up to 3 hexes for bonus gold   ·   Click / Enter to toggle', w / 2, panelY + 78);

            // Modifier list
            this._challengeRects = [];
            const listY = panelY + 96;
            const itemH = 58;
            const listX = panelX + 24;
            const listW = panelW - 48;

            for (let i = 0; i < challenge.modifiers.length; i++) {
                const mod = challenge.modifiers[i];
                const iy = listY + i * itemH;
                const isSelected = i === this.challengeSelectedIndex;
                const isHovered = i === this.challengeHoveredIndex;
                const isActive = challenge.pendingModifiers.has(mod.id);

                this._challengeRects.push({ x: listX, y: iy, w: listW, h: itemH - 4 });

                // Row background
                if (isActive) {
                    ctx.fillStyle = `rgba(${this.hexToRgb(mod.color)}, 0.14)`;
                    ctx.strokeStyle = mod.color;
                    ctx.lineWidth = 1.5;
                } else if (isSelected || isHovered) {
                    ctx.fillStyle = this.theme.accentFill;
                    ctx.strokeStyle = this.theme.accentStroke;
                    ctx.lineWidth = 1;
                } else {
                    ctx.fillStyle = 'rgba(24, 22, 28, 0.6)';
                    ctx.strokeStyle = 'rgba(90, 80, 70, 0.35)';
                    ctx.lineWidth = 1;
                }
                this.roundRect(ctx, listX, iy, listW, itemH - 4, 6);
                ctx.fill();
                ctx.stroke();

                const midY = iy + (itemH - 4) / 2;

                // Active check / empty circle
                this._icon(ctx, isActive ? 'check' : 'circle', listX + 20, midY, 8,
                    isActive ? this.theme.successGreen : 'rgba(120, 112, 100, 0.5)');

                // Modifier icon — authored glyph per hex id
                this._icon(ctx, this._challengeIconName(mod.id), listX + 48, midY, 10, mod.color);

                // Name
                ctx.font = 'bold 15px Georgia, serif';
                ctx.textAlign = 'left';
                ctx.fillStyle = isActive ? mod.color : (isSelected || isHovered ? '#F0E2BC' : this.theme.textPrimary);
                ctx.fillText(mod.name, listX + 70, iy + 18);

                // Description
                ctx.font = '12px Georgia, serif';
                ctx.fillStyle = this.theme.textMuted;
                ctx.fillText(mod.description, listX + 70, iy + 38);

                // Gold bonus
                ctx.textAlign = 'right';
                ctx.font = 'bold 14px Georgia, serif';
                ctx.fillStyle = this.theme.brass;
                ctx.fillText(`+${Math.round(mod.goldBonus * 100)}% Gold`, listX + listW - 12, midY);
                ctx.textAlign = 'left';
            }

            // Total gold multiplier
            const totalY = listY + challenge.modifiers.length * itemH + 12;
            const pending = challenge.pendingModifiers;
            let pendingBonus = 0;
            for (const id of pending) {
                const mod = challenge.modifiers.find(m => m.id === id);
                if (mod) pendingBonus += mod.goldBonus;
            }
            const pendingMult = 1 + pendingBonus;

            ctx.textAlign = 'center';
            ctx.font = 'bold 17px "Cinzel", "Georgia", serif';
            if (pending.size > 0) {
                ctx.fillStyle = this.theme.brass;
                ctx.shadowColor = 'rgba(216, 180, 106, 0.4)';
                ctx.shadowBlur = 10;
                ctx.fillText(`GOLD MULTIPLIER: ${pendingMult.toFixed(1)}×`, w / 2, totalY);
                ctx.shadowBlur = 0;
                ctx.shadowColor = 'transparent';
            } else {
                ctx.fillStyle = this.theme.textMuted;
                ctx.fillText('No hexes bound', w / 2, totalY);
            }

            // Active count
            ctx.font = '12px Georgia, serif';
            ctx.fillStyle = this.theme.textMuted;
            ctx.fillText(`${pending.size} / ${challenge.maxActive} selected`, w / 2, totalY + 22);
        }

        // Back button
        const backW = 140;
        const backH = 36;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 50;
        this._challengeBackRect = { x: backX, y: backY, w: backW, h: backH };
        this._backButton(ctx, w, this._challengeBackRect);
    }

    _challengeIconName(id) {
        const map = {
            glass_cannon: 'skull',
            swarm: 'paw',
            no_heals: 'noheal',
            speed_demon: 'bolt',
            famine: 'bowl',
            iron_will: 'shield'
        };
        return map[id] || 'spark';
    }

    // ---- Render: Codex / Bestiary ----

    renderCodex(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const codex = this.game.systems.codex;

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(4, 3, 7, 0.88)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(700, w - 40);
        const panelH = Math.min(580, h - 40);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        this._stonePanel(ctx, panelX, panelY, panelW, panelH, 12);
        this._panelHeader(ctx, w, panelX, panelW, panelY, 'CODEX');

        // Category tabs
        const tabs = [
            { key: 'enemies', label: 'Enemies', icon: 'skull' },
            { key: 'weapons', label: 'Weapons', icon: 'swords' },
            { key: 'evolutions', label: 'Evolutions', icon: 'star' },
            { key: 'synergies', label: 'Synergies', icon: 'link' }
        ];
        const tabW = (panelW - 60) / tabs.length;
        const tabY = panelY + 76;
        const tabH = 36;
        this._codexTabRects = [];

        for (let i = 0; i < tabs.length; i++) {
            const tx = panelX + 30 + i * tabW;
            const isActive = i === this.codexTabIndex;
            this._codexTabRects.push({ x: tx, y: tabY, w: tabW - 4, h: tabH });

            if (isActive) {
                ctx.fillStyle = 'rgba(216, 180, 106, 0.14)';
                ctx.strokeStyle = this.theme.brass;
                ctx.lineWidth = 1.5;
            } else {
                ctx.fillStyle = 'rgba(24, 22, 28, 0.6)';
                ctx.strokeStyle = 'rgba(90, 80, 70, 0.35)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, tx, tabY, tabW - 4, tabH, 6);
            ctx.fill();
            ctx.stroke();

            const tabCx = tx + (tabW - 4) / 2;
            const tabCy = tabY + tabH / 2;
            ctx.font = 'bold 13px Georgia, serif';
            const labelW = ctx.measureText(tabs[i].label).width;
            const groupW = 14 + 6 + labelW;
            this._icon(ctx, tabs[i].icon, tabCx - groupW / 2 + 7, tabCy, 7,
                isActive ? this.theme.brass : this.theme.accentMuted);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = isActive ? '#F0E2BC' : this.theme.accentMuted;
            ctx.fillText(tabs[i].label, tabCx - groupW / 2 + 20, tabCy + 1);
        }

        // Completion bar for active tab
        const activeTab = tabs[this.codexTabIndex];
        const stats = codex ? codex.getCompletionStats() : null;
        const catStats = stats ? stats[activeTab.key] : { discovered: 0, total: 1, percent: 0 };

        const barY = tabY + tabH + 16;
        const barW = panelW - 60;
        const barX = panelX + 30;
        const barH = 14;

        ctx.fillStyle = 'rgba(30, 27, 34, 0.85)';
        this.roundRect(ctx, barX, barY, barW, barH, 4);
        ctx.fill();

        const fillW = Math.max(0, (catStats.discovered / catStats.total) * barW);
        if (fillW > 0) {
            const barGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
            barGrad.addColorStop(0, '#D8B45A');
            barGrad.addColorStop(1, '#9A7A30');
            ctx.fillStyle = barGrad;
            this.roundRect(ctx, barX, barY, fillW, barH, 4);
            ctx.fill();
        }

        ctx.textAlign = 'center';
        ctx.font = 'bold 11px Georgia, serif';
        ctx.fillStyle = '#F0E8D4';
        ctx.fillText(`${catStats.discovered} / ${catStats.total}  (${catStats.percent}%)`, barX + barW / 2, barY + barH / 2 + 1);

        // Discovery grid
        const gridY = barY + barH + 20;
        const gridX = panelX + 30;
        const gridW = panelW - 60;
        const cardW = 130;
        const cardH = 60;
        const gap = 10;
        const cols = Math.max(1, Math.floor((gridW + gap) / (cardW + gap)));

        const discoveries = codex ? codex.getDiscoveries(activeTab.key) : [];
        const totalSlots = catStats.total;

        // Build display list: discovered items + undiscovered placeholders
        const displayList = [];
        for (const entry of discoveries) {
            displayList.push({ id: entry.id, count: entry.count, discovered: true });
        }
        for (let i = displayList.length; i < totalSlots; i++) {
            displayList.push({ id: '???', count: 0, discovered: false });
        }

        for (let i = 0; i < displayList.length; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const cx = gridX + col * (cardW + gap);
            const cy = gridY + row * (cardH + gap);

            if (cy + cardH > panelY + panelH - 70) break;

            const item = displayList[i];

            if (item.discovered) {
                ctx.fillStyle = 'rgba(32, 29, 38, 0.75)';
                ctx.strokeStyle = 'rgba(216, 180, 106, 0.3)';
                ctx.lineWidth = 1;
            } else {
                ctx.fillStyle = 'rgba(16, 14, 19, 0.5)';
                ctx.strokeStyle = 'rgba(70, 62, 55, 0.3)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, cx, cy, cardW, cardH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.textAlign = 'left';
            if (item.discovered) {
                const displayName = item.id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                ctx.font = 'bold 12px Georgia, serif';
                ctx.fillStyle = this.theme.textPrimary;
                ctx.fillText(displayName, cx + 8, cy + 22);

                ctx.font = '11px Georgia, serif';
                ctx.fillStyle = this.theme.textMuted;
                ctx.fillText(`Seen ${item.count}x`, cx + 8, cy + 42);
            } else {
                ctx.font = 'bold 20px Georgia, serif';
                ctx.fillStyle = 'rgba(110, 100, 85, 0.45)';
                ctx.textAlign = 'center';
                ctx.fillText('?', cx + cardW / 2, cy + cardH / 2 + 6);
            }
        }

        // Overall completion at bottom
        if (stats) {
            let totalDisc = 0;
            let totalAll = 0;
            for (const cat of Object.values(stats)) {
                totalDisc += cat.discovered;
                totalAll += cat.total;
            }
            const overallPct = totalAll > 0 ? Math.round((totalDisc / totalAll) * 100) : 0;
            ctx.textAlign = 'center';
            ctx.font = '12px Georgia, serif';
            ctx.fillStyle = this.theme.textMuted;
            ctx.fillText(`Overall Completion: ${totalDisc}/${totalAll} (${overallPct}%)`, w / 2, panelY + panelH - 72);
        }

        // Back button
        const backW = 220;
        const backH = 38;
        const backX = (w - backW) / 2;
        const backY = panelY + panelH - 52;
        this._codexBackRect = { x: backX, y: backY, w: backW, h: backH };
        this._backButton(ctx, w, this._codexBackRect, 'ESC  ·  RETURN TO MENU');
    }

    handleCodexInput(k) {
        const tabs = ['enemies', 'weapons', 'evolutions', 'synergies'];
        if (k === 'arrowleft') {
            this.codexTabIndex = (this.codexTabIndex - 1 + tabs.length) % tabs.length;
            this.playHoverSound();
        } else if (k === 'arrowright') {
            this.codexTabIndex = (this.codexTabIndex + 1) % tabs.length;
            this.playHoverSound();
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        }
    }

    handleCodexClick(x, y) {
        // Back button
        const b = this._codexBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Tab clicks
        if (this._codexTabRects) {
            for (let i = 0; i < this._codexTabRects.length; i++) {
                const r = this._codexTabRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.codexTabIndex = i;
                    this.playSelectSound();
                    return;
                }
            }
        }
    }

    // ---- Render: Settings ----

    renderSettings(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;
        const sm = this.game.settingsMenu;
        const settings = sm ? sm.settings : {};

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(4, 3, 7, 0.88)';
        ctx.fillRect(0, 0, w, h);

        // Panel
        const panelW = Math.min(520, w - 40);
        const panelH = Math.min(560, h - 40);
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        this._stonePanel(ctx, panelX, panelY, panelW, panelH, 12);
        this._panelHeader(ctx, w, panelX, panelW, panelY, 'SETTINGS');

        // Settings items definition — authored icon glyphs, no emoji
        const items = [
            { key: 'masterVolume', label: 'Master Volume', type: 'slider', icon: 'speaker' },
            { key: 'musicVolume', label: 'Music Volume', type: 'slider', icon: 'note' },
            { key: 'sfxVolume', label: 'SFX Volume', type: 'slider', icon: 'note' },
            { key: 'particleEffects', label: 'Particle Effects', type: 'toggle', icon: 'spark' },
            { key: 'screenShake', label: 'Screen Shake', type: 'toggle', icon: 'shake' },
            { key: 'damageNumbers', label: 'Damage Numbers', type: 'toggle', icon: 'burst' },
            { key: 'lowFXMode', label: 'Low Effects Mode', type: 'toggle', icon: 'gauge' },
            { key: 'autoQuality', label: 'Auto Quality', type: 'toggle', icon: 'gear' },
            { key: 'showFPS', label: 'Show FPS', type: 'toggle', icon: 'eye' },
            { key: 'pauseOnFocusLoss', label: 'Pause on Focus Loss', type: 'toggle', icon: 'pause' }
        ];

        const itemH = 36;
        const itemGap = 4;
        const startY = panelY + 78;
        const contentX = panelX + 30;
        const contentW = panelW - 60;
        this._settingsItemRects = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const iy = startY + i * (itemH + itemGap);
            const isSelected = i === this.settingsSelectedIndex;

            this._settingsItemRects.push({ x: contentX, y: iy, w: contentW, h: itemH, item });

            // Row background
            if (isSelected) {
                ctx.fillStyle = 'rgba(216, 180, 106, 0.10)';
                ctx.strokeStyle = 'rgba(216, 180, 106, 0.35)';
                ctx.lineWidth = 1;
            } else {
                ctx.fillStyle = 'rgba(24, 22, 28, 0.45)';
                ctx.strokeStyle = 'rgba(80, 72, 62, 0.25)';
                ctx.lineWidth = 1;
            }
            this.roundRect(ctx, contentX, iy, contentW, itemH, 6);
            ctx.fill();
            ctx.stroke();

            // Icon + label
            this._icon(ctx, item.icon, contentX + 18, iy + itemH / 2, 8,
                isSelected ? this.theme.brass : 'rgba(190, 175, 145, 0.7)');
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '14px Georgia, serif';
            ctx.fillStyle = isSelected ? '#F0E2BC' : '#CFC6B2';
            ctx.fillText(item.label, contentX + 36, iy + itemH / 2);

            const val = settings[item.key];

            if (item.type === 'slider') {
                // Slider track
                const sliderX = contentX + contentW - 170;
                const sliderW = 120;
                const sliderY = iy + itemH / 2;
                const sliderH = 6;

                ctx.fillStyle = 'rgba(30, 27, 34, 0.85)';
                this.roundRect(ctx, sliderX, sliderY - sliderH / 2, sliderW, sliderH, 3);
                ctx.fill();

                // Slider fill
                const fillW = Math.max(0, (val || 0) * sliderW);
                if (fillW > 0) {
                    const sGrad = ctx.createLinearGradient(sliderX, 0, sliderX + fillW, 0);
                    sGrad.addColorStop(0, '#D8B45A');
                    sGrad.addColorStop(1, '#9A7A30');
                    ctx.fillStyle = sGrad;
                    this.roundRect(ctx, sliderX, sliderY - sliderH / 2, fillW, sliderH, 3);
                    ctx.fill();
                }

                // Value text
                ctx.textAlign = 'right';
                ctx.font = 'bold 12px "Courier New", monospace';
                ctx.fillStyle = isSelected ? '#F0E2BC' : '#A39A85';
                ctx.fillText(`${Math.round((val || 0) * 100)}%`, contentX + contentW - 12, iy + itemH / 2);

            } else if (item.type === 'toggle') {
                // Toggle pill
                const pillW = 36;
                const pillH = 18;
                const pillX = contentX + contentW - pillW - 12;
                const pillY = iy + (itemH - pillH) / 2;
                const isOn = !!val;

                ctx.fillStyle = isOn ? 'rgba(76, 175, 125, 0.25)' : 'rgba(60, 55, 50, 0.4)';
                ctx.strokeStyle = isOn ? '#4CAF7D' : 'rgba(120, 110, 95, 0.5)';
                ctx.lineWidth = 1;
                this.roundRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
                ctx.fill();
                ctx.stroke();

                // Toggle knob
                const knobR = 6;
                const knobX = isOn ? pillX + pillW - knobR - 3 : pillX + knobR + 3;
                ctx.fillStyle = isOn ? '#4CAF7D' : '#7A7264';
                ctx.beginPath();
                ctx.arc(knobX, pillY + pillH / 2, knobR, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Reset defaults button
        const resetW = 160;
        const resetH = 32;
        const resetX = w / 2 - resetW - 10;
        const resetY = panelY + panelH - 90;
        this._settingsResetRect = { x: resetX, y: resetY, w: resetW, h: resetH };

        ctx.fillStyle = 'rgba(139, 60, 30, 0.25)';
        ctx.strokeStyle = 'rgba(180, 90, 50, 0.5)';
        ctx.lineWidth = 1;
        this.roundRect(ctx, resetX, resetY, resetW, resetH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.textAlign = 'center';
        ctx.font = 'bold 12px Georgia, serif';
        ctx.fillStyle = '#D8A05A';
        ctx.fillText('Reset to Defaults', resetX + resetW / 2, resetY + resetH / 2 + 1);

        // Back button
        const backW = 140;
        const backH = 32;
        const backX = w / 2 + 10;
        const backY = panelY + panelH - 90;
        this._settingsBackRect = { x: backX, y: backY, w: backW, h: backH };
        this._backButton(ctx, w, this._settingsBackRect, 'ESC  ·  BACK');
    }

    handleSettingsInput(k) {
        const sm = this.game.settingsMenu;
        if (!sm) return;

        const items = this._settingsItemRects;
        const len = items.length;

        if (k === 'arrowup') {
            this.settingsSelectedIndex = (this.settingsSelectedIndex - 1 + len) % len;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.settingsSelectedIndex = (this.settingsSelectedIndex + 1) % len;
            this.playHoverSound();
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        } else {
            const rect = items[this.settingsSelectedIndex];
            if (!rect) return;
            const item = rect.item;

            if (item.type === 'toggle' && (k === 'enter' || k === ' ')) {
                sm.settings[item.key] = !sm.settings[item.key];
                sm.saveSettings();
                sm.apply();
                this.playSelectSound();
            } else if (item.type === 'slider') {
                const step = 0.1;
                if (k === 'arrowleft') {
                    sm.settings[item.key] = Math.max(0, (sm.settings[item.key] || 0) - step);
                    sm.saveSettings();
                    sm.apply();
                    this.playHoverSound();
                } else if (k === 'arrowright') {
                    sm.settings[item.key] = Math.min(1, (sm.settings[item.key] || 0) + step);
                    sm.saveSettings();
                    sm.apply();
                    this.playHoverSound();
                }
            }
        }
    }

    handleSettingsClick(x, y) {
        const sm = this.game.settingsMenu;

        // Back button
        const b = this._settingsBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Reset defaults
        const r = this._settingsResetRect;
        if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
            if (sm) {
                sm.resetToDefaults();
                this.playSelectSound();
            }
            return;
        }

        // Settings items
        if (!sm) return;
        for (let i = 0; i < this._settingsItemRects.length; i++) {
            const rect = this._settingsItemRects[i];
            if (!rect) continue;
            if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) {
                this.settingsSelectedIndex = i;
                const item = rect.item;

                if (item.type === 'toggle') {
                    sm.settings[item.key] = !sm.settings[item.key];
                    sm.saveSettings();
                    sm.apply();
                    this.playSelectSound();
                } else if (item.type === 'slider') {
                    // Click position on slider maps to value
                    const sliderX = rect.x + rect.w - 170;
                    const sliderW = 120;
                    if (x >= sliderX && x <= sliderX + sliderW) {
                        const val = Math.max(0, Math.min(1, (x - sliderX) / sliderW));
                        sm.settings[item.key] = Math.round(val * 10) / 10;
                        sm.saveSettings();
                        sm.apply();
                    }
                }
                return;
            }
        }
    }

    // ---- Pause Menu (in-game overlay) ----

    renderPauseMenu(ctx) {
        const w = this.game.canvas.width;
        const h = this.game.canvas.height;

        // Dim overlay
        ctx.fillStyle = 'rgba(3, 3, 6, 0.68)';
        ctx.fillRect(0, 0, w, h);

        // Panel — compact centered card
        const panelW = Math.min(380, w - 60);
        const panelH = 320;
        const panelX = (w - panelW) / 2;
        const panelY = (h - panelH) / 2;

        this._stonePanel(ctx, panelX, panelY, panelW, panelH, 12);
        this._panelHeader(ctx, w, panelX, panelW, panelY, 'PAUSED');

        // Run info (compact)
        const runTimer = this.game.systems.runTimer;
        const elapsed = runTimer ? runTimer.elapsed : this.game.gameTime || 0;
        const wave = this.game.systems.enemy?.getCurrentWave?.() || 1;
        const level = this.game.player?.level || 1;
        ctx.font = '13px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = this.theme.textMuted;
        ctx.fillText(`Lv ${level}   ·   Wave ${wave}   ·   ${this.formatTime(elapsed)}`, w / 2, panelY + 96);

        // Menu items
        const pauseItems = ['RESUME', 'SETTINGS', 'RETURN TO MENU'];
        const itemH = 46;
        const itemGap = 8;
        const itemsStartY = panelY + 122;
        const itemW = panelW - 60;
        this._pauseMenuRects = [];

        for (let i = 0; i < pauseItems.length; i++) {
            const iy = itemsStartY + i * (itemH + itemGap);
            const ix = (w - itemW) / 2;
            const isSelected = i === this.pauseSelectedIndex;
            const isHovered = i === this.pauseHoveredIndex;
            const active = isSelected || isHovered;

            const rect = { x: ix, y: iy, w: itemW, h: itemH };
            this._pauseMenuRects.push(rect);
            this._stoneButton(ctx, rect, pauseItems[i], { active, fontSize: active ? 19 : 17 });
        }

        // Selection marker
        const selRect = this._pauseMenuRects[this.pauseSelectedIndex];
        if (selRect) {
            const bounce = Math.sin(this.time * 4) * 3;
            const dx = selRect.x - 14 + bounce;
            const dy = selRect.y + selRect.h / 2;
            ctx.fillStyle = this.theme.brass;
            ctx.beginPath();
            ctx.moveTo(dx, dy - 4);
            ctx.lineTo(dx + 4, dy);
            ctx.lineTo(dx, dy + 4);
            ctx.lineTo(dx - 4, dy);
            ctx.closePath();
            ctx.fill();
        }

        // Controls hint
        ctx.font = '12px Georgia, serif';
        ctx.fillStyle = this.theme.textMuted;
        ctx.textAlign = 'center';
        ctx.fillText('ESC to resume', w / 2, panelY + panelH - 16);
    }

    handlePauseInput(k) {
        const items = ['RESUME', 'SETTINGS', 'RETURN TO MENU'];
        const len = items.length;

        if (k === 'arrowup') {
            this.pauseSelectedIndex = (this.pauseSelectedIndex - 1 + len) % len;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.pauseSelectedIndex = (this.pauseSelectedIndex + 1) % len;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            this.selectPauseItem(this.pauseSelectedIndex);
        } else if (k === 'escape') {
            this.game.resumeGame();
        }
    }

    handlePauseClick(x, y) {
        for (let i = 0; i < this._pauseMenuRects.length; i++) {
            const r = this._pauseMenuRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.pauseSelectedIndex = i;
                this.selectPauseItem(i);
                return;
            }
        }
    }

    handlePauseMouseMove(x, y) {
        this.pauseHoveredIndex = -1;
        for (let i = 0; i < this._pauseMenuRects.length; i++) {
            const r = this._pauseMenuRects[i];
            if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                this.pauseHoveredIndex = i;
                break;
            }
        }
    }

    selectPauseItem(index) {
        this.playSelectSound();
        switch (index) {
            case 0: // RESUME
                this.game.resumeGame();
                break;
            case 1: // SETTINGS
                this.game.settingsMenu.toggle();
                break;
            case 2: // RETURN TO MENU
                this.game.returnToMenu();
                break;
        }
    }

    handleChallengeInput(k) {
        const challenge = this.game.systems.challenge;
        if (!challenge) return;

        const len = challenge.modifiers.length;
        if (k === 'arrowup') {
            this.challengeSelectedIndex = (this.challengeSelectedIndex - 1 + len) % len;
            this.playHoverSound();
        } else if (k === 'arrowdown') {
            this.challengeSelectedIndex = (this.challengeSelectedIndex + 1) % len;
            this.playHoverSound();
        } else if (k === 'enter' || k === ' ') {
            if (challenge.isUnlocked()) {
                const mod = challenge.modifiers[this.challengeSelectedIndex];
                if (mod) {
                    challenge.togglePending(mod.id);
                    this.playSelectSound();
                }
            }
        } else if (k === 'escape') {
            this.triggerTransition('menu');
        }
    }

    handleChallengeClick(x, y) {
        const challenge = this.game.systems.challenge;
        if (!challenge) return;

        // Back button
        const b = this._challengeBackRect;
        if (b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
            this.triggerTransition('menu');
            return;
        }

        // Modifier rows
        if (challenge.isUnlocked()) {
            for (let i = 0; i < this._challengeRects.length; i++) {
                const r = this._challengeRects[i];
                if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.challengeSelectedIndex = i;
                    const mod = challenge.modifiers[i];
                    if (mod) {
                        challenge.togglePending(mod.id);
                        this.playSelectSound();
                    }
                    return;
                }
            }
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
    }

    formatPlaytime(seconds) {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs}h ${mins}m`;
        return `${mins}m`;
    }

    formatNumber(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
        return String(n);
    }

    // ---- Audio helpers ----

    playHoverSound() {
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('menuHover', 0.3);
        }
    }

    playSelectSound() {
        if (this.game.audioManager && this.game.audioManager.playVampireSound) {
            this.game.audioManager.playVampireSound('menuSelect', 0.5);
        }
    }

    // ---- Helpers ----

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    /**
     * Rounded-rect path. `r` is a number for uniform corners or
     * {tl, tr, br, bl} for per-corner radii.
     */
    roundRect(ctx, x, y, w, h, r) {
        let tl, tr, br, bl;
        if (typeof r === 'object' && r !== null) {
            tl = r.tl || 0; tr = r.tr || 0; br = r.br || 0; bl = r.bl || 0;
        } else {
            tl = tr = br = bl = r;
        }
        ctx.beginPath();
        ctx.moveTo(x + tl, y);
        ctx.lineTo(x + w - tr, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
        ctx.lineTo(x + w, y + h - br);
        ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        ctx.lineTo(x + bl, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
        ctx.lineTo(x, y + tl);
        ctx.quadraticCurveTo(x, y, x + tl, y);
        ctx.closePath();
    }

    reset() {
        this.selectedIndex = 0;
        this.hoveredIndex = -1;
        this.upgradeSelectedIndex = 0;
        this.upgradeHoveredIndex = -1;
        this.upgradeList = [];
        this.characterSelectedIndex = 0;
        this.characterHoveredIndex = -1;
        this.challengeSelectedIndex = 0;
        this.challengeHoveredIndex = -1;
        this.codexTabIndex = 0;
        this.settingsSelectedIndex = 0;
        this.pauseSelectedIndex = 0;
        this.pauseHoveredIndex = -1;
    }
}
