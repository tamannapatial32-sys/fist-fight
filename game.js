/**
 * Game Engine for "Fist Fight"
 * Combat loop, CPU AI, collision detection, particles & VFX,
 * round manager, and canvas rendering.
 */

class FistFightGame {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.width = 800;
        this.height = 450;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        // Entities
        this.player = new Fighter({
            name: 'PLAYER 1',
            isPlayer: true,
            x: 240,
            y: 310,
            color: '#00f0ff'
        });

        this.cpu = new Fighter({
            name: 'IRON BRUISER',
            isPlayer: false,
            x: 560,
            y: 310,
            color: '#ff0055'
        });

        // Hit register tracking (prevent multi-hits in single punch animation)
        this.playerHitRegistered = false;
        this.cpuHitRegistered = false;

        // CPU AI parameters
        this.cpuDifficulty = 'NORMAL'; // EASY, NORMAL, HARD
        this.cpuDecisionTimer = 0;
        this.cpuNextActionTime = 0.8;

        // Match State
        this.matchState = 'READY'; // READY, FIGHT, ROUND_OVER, GAME_OVER
        this.round = 1;
        this.maxRounds = 3;
        this.playerWins = 0;
        this.cpuWins = 0;
        this.roundTime = 60; // seconds
        this.stateMessage = 'PRESS START OR THROW A FIST';
        this.messageTimer = 0;

        // Combos & Score
        this.comboCount = 0;
        this.comboTimer = 0;
        this.score = 0;

        // VFX
        this.shake = 0;
        this.particles = [];
        this.floatingTexts = [];

        // Timing
        this.lastTime = performance.now();
        this.isRunning = false;

        // Setup background styling
        this.setupArenaBackground();
    }

    setupArenaBackground() {
        // Cached gradient/lighting
        this.bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        this.bgGradient.addColorStop(0, '#090a14');
        this.bgGradient.addColorStop(0.65, '#13182b');
        this.bgGradient.addColorStop(0.66, '#1e2438');
        this.bgGradient.addColorStop(1, '#0b0d17');
    }

    startMatch() {
        this.round = 1;
        this.playerWins = 0;
        this.cpuWins = 0;
        this.score = 0;
        this.startRound();
        if (!this.isRunning) {
            this.isRunning = true;
            this.lastTime = performance.now();
            requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    startRound() {
        this.player.reset(240, 310);
        this.cpu.reset(560, 310);
        this.playerHitRegistered = false;
        this.cpuHitRegistered = false;
        this.roundTime = 60;
        this.matchState = 'ROUND_INTRO';
        this.stateMessage = `ROUND ${this.round}`;
        this.messageTimer = 2.0;

        if (window.soundEngine) {
            window.soundEngine.playBell();
        }

        setTimeout(() => {
            if (this.matchState === 'ROUND_INTRO') {
                this.stateMessage = 'FIGHT!';
                this.messageTimer = 1.0;
                this.matchState = 'FIGHT';
            }
        }, 1500);
    }

    // Input handlers
    playerPunch() {
        if (this.matchState !== 'FIGHT') return;

        // Check if ready for Super Move (100% meter)
        const isSuper = this.player.superMeter >= 100;
        const executed = this.player.punch(isSuper);

        if (executed) {
            this.playerHitRegistered = false;
            if (window.soundEngine) {
                window.soundEngine.playWhoosh();
            }
            if (isSuper) {
                this.player.superMeter = 0;
                this.addFloatingText('SUPER COMBO!', this.player.x, this.player.y - 100, '#00f0ff', 24);
                this.triggerShake(12);
            }
        }
    }

    playerBlock(isBlocking) {
        if (this.matchState !== 'FIGHT') return;
        this.player.block(isBlocking);
    }

    // Visual effect: Screen shake
    triggerShake(amount = 8) {
        this.shake = amount;
    }

    // Visual effect: Particle Burst
    spawnHitParticles(x, y, color, count = 16) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 60 + Math.random() * 200;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 50,
                color: color,
                size: 2 + Math.random() * 4,
                life: 0.35 + Math.random() * 0.25,
                maxLife: 0.6
            });
        }
    }

    // Floating combat text (POW, BAM, -15, BLOCKED!)
    addFloatingText(text, x, y, color = '#ffea00', size = 20) {
        this.floatingTexts.push({
            text: text,
            x: x + (Math.random() * 20 - 10),
            y: y,
            color: color,
            size: size,
            life: 0.8,
            maxLife: 0.8,
            vy: -70
        });
    }

    // CPU AI logic
    updateCPU(dt) {
        if (this.matchState !== 'FIGHT' || this.cpu.state === 'KO' || this.cpu.state === 'HURT') return;

        this.cpuDecisionTimer += dt;
        if (this.cpuDecisionTimer >= this.cpuNextActionTime) {
            this.cpuDecisionTimer = 0;

            // Decision speed depends on difficulty
            const speedScale = this.cpuDifficulty === 'HARD' ? 0.45 : (this.cpuDifficulty === 'NORMAL' ? 0.75 : 1.1);
            this.cpuNextActionTime = (0.4 + Math.random() * 0.8) * speedScale;

            const rand = Math.random();

            // Reaction to player state
            if (this.player.state === 'PUNCHING') {
                // If player is throwing a punch, CPU tries to block
                const blockChance = this.cpuDifficulty === 'HARD' ? 0.75 : (this.cpuDifficulty === 'NORMAL' ? 0.45 : 0.2);
                if (rand < blockChance) {
                    this.cpu.block(true);
                    setTimeout(() => {
                        this.cpu.block(false);
                    }, 400 + Math.random() * 300);
                    return;
                }
            }

            // Normal offensive decision
            if (rand < 0.6) {
                // Throw punch
                const isSuper = this.cpu.superMeter >= 100;
                const punchOk = this.cpu.punch(isSuper);
                if (punchOk) {
                    this.cpuHitRegistered = false;
                    if (window.soundEngine) window.soundEngine.playWhoosh();
                    if (isSuper) {
                        this.cpu.superMeter = 0;
                        this.addFloatingText('BRUISER RAGE!', this.cpu.x, this.cpu.y - 100, '#ff0055', 22);
                        this.triggerShake(10);
                    }
                }
            } else if (rand < 0.85) {
                // Quick Guard
                this.cpu.block(true);
                setTimeout(() => {
                    this.cpu.block(false);
                }, 300 + Math.random() * 250);
            } else {
                // Idle / rest
                this.cpu.block(false);
            }
        }
    }

    // Combat physics & hit collisions
    checkCombatCollisions() {
        const attackRange = 175; // Hit distance threshold
        const distance = Math.abs(this.cpu.x - this.player.x);

        // 1. Check Player Punch hitting CPU
        if (this.player.state === 'PUNCHING' && !this.playerHitRegistered) {
            if (this.player.armExtension > 0.75 && distance <= attackRange) {
                this.playerHitRegistered = true;
                const isBlocked = this.cpu.state === 'BLOCKING';
                const isSuper = this.player.subState === 'super';
                const baseDamage = isSuper ? 38 : (14 + Math.floor(Math.random() * 6));

                const damageDealt = this.cpu.takeDamage(baseDamage, isBlocked);

                const hitX = this.cpu.x - 20;
                const hitY = this.cpu.y - 30;

                if (isBlocked) {
                    if (window.soundEngine) window.soundEngine.playBlock();
                    this.addFloatingText('BLOCKED!', hitX, hitY, '#00f0ff', 16);
                    this.spawnHitParticles(hitX, hitY, '#00f0ff', 10);
                    this.triggerShake(3);
                } else {
                    if (window.soundEngine) window.soundEngine.playHit(isSuper);
                    this.comboCount++;
                    this.comboTimer = 2.0;
                    this.score += damageDealt * 10 * this.comboCount;

                    const comicWords = ['POW!', 'BAM!', 'CRUSH!', 'SMASH!'];
                    const word = isSuper ? 'CRITICAL K.O.!' : comicWords[Math.floor(Math.random() * comicWords.length)];
                    this.addFloatingText(word, hitX, hitY - 20, '#ffe600', isSuper ? 26 : 20);
                    this.addFloatingText(`-${damageDealt}`, hitX, hitY + 10, '#ff3366', 16);
                    this.spawnHitParticles(hitX, hitY, isSuper ? '#00f0ff' : '#ffe600', isSuper ? 28 : 16);
                    this.triggerShake(isSuper ? 14 : 7);

                    this.player.superMeter = Math.min(100, this.player.superMeter + 15);
                }

                if (this.cpu.state === 'KO') {
                    this.handleKnockout(this.player, this.cpu);
                }
            }
        }

        // 2. Check CPU Punch hitting Player
        if (this.cpu.state === 'PUNCHING' && !this.cpuHitRegistered) {
            if (this.cpu.armExtension > 0.75 && distance <= attackRange) {
                this.cpuHitRegistered = true;
                const isBlocked = this.player.state === 'BLOCKING';
                const isSuper = this.cpu.subState === 'super';
                const baseDamage = isSuper ? 34 : (12 + Math.floor(Math.random() * 5));

                const damageDealt = this.player.takeDamage(baseDamage, isBlocked);

                const hitX = this.player.x + 20;
                const hitY = this.player.y - 30;

                if (isBlocked) {
                    if (window.soundEngine) window.soundEngine.playBlock();
                    this.addFloatingText('BLOCKED!', hitX, hitY, '#00f0ff', 16);
                    this.spawnHitParticles(hitX, hitY, '#00f0ff', 10);
                    this.triggerShake(3);
                } else {
                    if (window.soundEngine) window.soundEngine.playHit(isSuper);
                    this.comboCount = 0; // Break player combo
                    this.addFloatingText('OUCH!', hitX, hitY - 20, '#ff0055', 18);
                    this.addFloatingText(`-${damageDealt}`, hitX, hitY + 10, '#ff3366', 16);
                    this.spawnHitParticles(hitX, hitY, '#ff0055', 16);
                    this.triggerShake(isSuper ? 12 : 6);

                    this.cpu.superMeter = Math.min(100, this.cpu.superMeter + 15);
                }

                if (this.player.state === 'KO') {
                    this.handleKnockout(this.cpu, this.player);
                }
            }
        }
    }

    handleKnockout(winner, loser) {
        this.matchState = 'ROUND_OVER';
        this.stateMessage = 'K. N. O. C. K. O. U. T. !';
        this.messageTimer = 3.5;
        this.triggerShake(16);

        if (window.soundEngine) {
            window.soundEngine.playKO();
        }

        if (winner === this.player) {
            this.playerWins++;
            this.score += 1000 + Math.round(this.roundTime) * 20;
        } else {
            this.cpuWins++;
        }

        setTimeout(() => {
            if (this.playerWins >= 2 || this.cpuWins >= 2 || this.round >= this.maxRounds) {
                // Match Over
                this.matchState = 'GAME_OVER';
                const playerWon = this.playerWins > this.cpuWins;
                this.stateMessage = playerWon ? 'VICTORY! CHAMPION!' : 'DEFEAT! TRY AGAIN!';
                if (window.soundEngine) {
                    if (playerWon) window.soundEngine.playVictory();
                    else window.soundEngine.playDefeat();
                }
            } else {
                // Next Round
                this.round++;
                this.startRound();
            }
        }, 3200);
    }

    update(dt) {
        // Shake dampening
        if (this.shake > 0) {
            this.shake = Math.max(0, this.shake - dt * 25);
        }

        // Combo timer
        if (this.comboCount > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) {
                this.comboCount = 0;
            }
        }

        // Message timer
        if (this.messageTimer > 0) {
            this.messageTimer -= dt;
        }

        // Round timer countdown during active fight
        if (this.matchState === 'FIGHT') {
            this.roundTime -= dt;
            if (this.roundTime <= 0) {
                this.roundTime = 0;
                // Time up! Decide round by remaining health
                if (this.player.health >= this.cpu.health) {
                    this.handleKnockout(this.player, this.cpu);
                } else {
                    this.handleKnockout(this.cpu, this.player);
                }
            }
        }

        // Entity updates
        this.player.update(dt);
        this.cpu.update(dt);
        this.updateCPU(dt);
        this.checkCombatCollisions();

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 300 * dt; // Gravity
            p.life -= dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update Floating Texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y += ft.vy * dt;
            ft.life -= dt;
            if (ft.life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.save();

        // Apply Screen Shake
        if (this.shake > 0) {
            const sx = (Math.random() * 2 - 1) * this.shake;
            const sy = (Math.random() * 2 - 1) * this.shake;
            this.ctx.translate(sx, sy);
        }

        // Arena Background
        this.ctx.fillStyle = this.bgGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Neon Arena Ring Ropes & Posts
        this.drawRing();

        // Crowd Silhouettes & Neon Lights
        this.drawAtmosphere();

        // Draw Fighters
        this.player.draw(this.ctx);
        this.cpu.draw(this.ctx);

        // Particles
        this.particles.forEach((p) => {
            this.ctx.save();
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life / p.maxLife;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // Floating Hit Texts
        this.floatingTexts.forEach((ft) => {
            this.ctx.save();
            this.ctx.font = `900 ${ft.size}px "Impact", "Arial Black", sans-serif`;
            this.ctx.fillStyle = ft.color;
            this.ctx.shadowColor = '#000000';
            this.ctx.shadowBlur = 6;
            this.ctx.globalAlpha = ft.life / ft.maxLife;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(ft.text, ft.x, ft.y);
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeText(ft.text, ft.x, ft.y);
            this.ctx.restore();
        });

        // Overlay Big Announcement Banner (e.g. "ROUND 1", "FIGHT!", "KNOCKOUT!")
        if (this.messageTimer > 0 || this.matchState === 'GAME_OVER' || this.matchState === 'READY') {
            this.drawBanner();
        }

        this.ctx.restore();
    }

    drawRing() {
        // Floor canvas mat
        this.ctx.fillStyle = '#181b2a';
        this.ctx.beginPath();
        this.ctx.moveTo(60, 310);
        this.ctx.lineTo(740, 310);
        this.ctx.lineTo(800, 450);
        this.ctx.lineTo(0, 450);
        this.ctx.closePath();
        this.ctx.fill();

        // Grid lines on mat
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
        this.ctx.lineWidth = 1.5;
        for (let x = 80; x < 740; x += 60) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 310);
            this.ctx.lineTo(x + (x - 400) * 0.4, 450);
            this.ctx.stroke();
        }

        // Glowing Ring Ropes
        const ropeColors = ['#00f0ff', '#ff0055', '#ffe600'];
        [220, 255, 290].forEach((ropeY, idx) => {
            this.ctx.save();
            this.ctx.strokeStyle = ropeColors[idx];
            this.ctx.lineWidth = 3;
            this.ctx.shadowColor = ropeColors[idx];
            this.ctx.shadowBlur = 8;
            this.ctx.beginPath();
            this.ctx.moveTo(40, ropeY);
            this.ctx.lineTo(760, ropeY);
            this.ctx.stroke();
            this.ctx.restore();
        });

        // Corner Ring Posts
        this.ctx.fillStyle = '#22293f';
        this.ctx.fillRect(35, 190, 10, 130);
        this.ctx.fillRect(755, 190, 10, 130);
    }

    drawAtmosphere() {
        // Overhead arena spotlights
        this.ctx.save();
        const spot1 = this.ctx.createRadialGradient(240, 0, 10, 240, 300, 320);
        spot1.addColorStop(0, 'rgba(0, 240, 255, 0.16)');
        spot1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = spot1;
        this.ctx.fillRect(0, 0, this.width, this.height);

        const spot2 = this.ctx.createRadialGradient(560, 0, 10, 560, 300, 320);
        spot2.addColorStop(0, 'rgba(255, 0, 85, 0.16)');
        spot2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = spot2;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.ctx.restore();
    }

    drawBanner() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(10, 12, 22, 0.75)';
        this.ctx.fillRect(0, 160, this.width, 95);

        this.ctx.strokeStyle = '#ffe600';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, 160);
        this.ctx.lineTo(this.width, 160);
        this.ctx.moveTo(0, 255);
        this.ctx.lineTo(this.width, 255);
        this.ctx.stroke();

        this.ctx.font = '900 40px "Impact", "Arial Black", sans-serif';
        this.ctx.fillStyle = '#ffe600';
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = '#ff0055';
        this.ctx.shadowBlur = 15;
        this.ctx.fillText(this.stateMessage, this.width / 2, 225);

        this.ctx.restore();
    }

    gameLoop(timestamp) {
        const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        if (this.isRunning) {
            requestAnimationFrame((t) => this.gameLoop(t));
        }
    }
}

window.FistFightGame = FistFightGame;
