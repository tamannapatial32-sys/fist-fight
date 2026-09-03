/**
 * Fighter Entity for "Fist Fight"
 * Handles state machine, stamina, health, super meter,
 * and procedural arcade canvas rendering with animations.
 */

class Fighter {
    constructor(config) {
        this.name = config.name || 'FIGHTER';
        this.isPlayer = !!config.isPlayer;
        this.x = config.x || 200;
        this.baseX = this.x;
        this.y = config.y || 280;
        this.baseY = this.y;
        this.color = config.color || (this.isPlayer ? '#00f0ff' : '#ff0055');
        this.facing = this.isPlayer ? 1 : -1; // 1 = right, -1 = left

        // Stats
        this.maxHealth = 100;
        this.health = 100;
        this.maxStamina = 100;
        this.stamina = 100;
        this.superMeter = 0; // 0 to 100

        // State Machine: IDLE, PUNCHING, BLOCKING, HURT, KO
        this.state = 'IDLE';
        this.subState = 'jab'; // 'jab' | 'hook' | 'super'
        this.stateTimer = 0;
        this.hurtTimer = 0;
        this.punchDuration = 0.22; // seconds

        // Animation attributes
        this.bobCycle = Math.random() * Math.PI * 2;
        this.armExtension = 0; // 0 to 1
        this.shakeOffset = { x: 0, y: 0 };
        this.shieldOpacity = 0;
        this.koProgress = 0; // 0 to 1
    }

    reset(x, y) {
        this.health = this.maxHealth;
        this.stamina = this.maxStamina;
        this.superMeter = 0;
        this.state = 'IDLE';
        this.stateTimer = 0;
        this.hurtTimer = 0;
        this.koProgress = 0;
        if (x !== undefined) {
            this.x = x;
            this.baseX = x;
        }
        if (y !== undefined) {
            this.y = y;
            this.baseY = y;
        }
    }

    punch(isSuper = false) {
        if (this.state === 'KO' || this.state === 'HURT') return false;
        if (this.stamina < 15 && !isSuper) return false;

        this.state = 'PUNCHING';
        this.stateTimer = 0;
        this.subState = isSuper ? 'super' : (Math.random() > 0.4 ? 'jab' : 'hook');
        this.stamina = Math.max(0, this.stamina - (isSuper ? 30 : 15));
        this.punchDuration = isSuper ? 0.35 : 0.22;
        return true;
    }

    block(enable) {
        if (this.state === 'KO') return;
        if (enable) {
            if (this.state !== 'PUNCHING' && this.state !== 'HURT') {
                this.state = 'BLOCKING';
            }
        } else {
            if (this.state === 'BLOCKING') {
                this.state = 'IDLE';
            }
        }
    }

    takeDamage(amount, isBlocked = false) {
        if (this.state === 'KO') return 0;

        let actualDamage = amount;
        if (isBlocked) {
            actualDamage = Math.round(amount * 0.2); // 80% damage reduction when blocking
            this.stamina = Math.max(0, this.stamina - 15);
        } else {
            this.state = 'HURT';
            this.hurtTimer = 0.25;
            this.superMeter = Math.min(100, this.superMeter + 10);
        }

        this.health = Math.max(0, this.health - actualDamage);

        if (this.health <= 0) {
            this.state = 'KO';
            this.stateTimer = 0;
        }

        return actualDamage;
    }

    update(dt) {
        this.stateTimer += dt;
        this.bobCycle += dt * 5;

        // Passive stamina regen
        if (this.state === 'IDLE') {
            this.stamina = Math.min(this.maxStamina, this.stamina + dt * 25);
        } else if (this.state === 'BLOCKING') {
            this.stamina = Math.min(this.maxStamina, this.stamina + dt * 8);
        }

        // Shield animation
        if (this.state === 'BLOCKING') {
            this.shieldOpacity = Math.min(1, this.shieldOpacity + dt * 8);
        } else {
            this.shieldOpacity = Math.max(0, this.shieldOpacity - dt * 6);
        }

        // State transitions
        if (this.state === 'PUNCHING') {
            const progress = this.stateTimer / this.punchDuration;
            if (progress < 0.4) {
                // Extending arm
                this.armExtension = progress / 0.4;
            } else if (progress < 0.65) {
                // Peak extension
                this.armExtension = 1;
            } else if (progress < 1.0) {
                // Retracting arm
                this.armExtension = 1 - (progress - 0.65) / 0.35;
            } else {
                this.armExtension = 0;
                this.state = 'IDLE';
            }
        } else {
            this.armExtension = 0;
        }

        if (this.state === 'HURT') {
            this.hurtTimer -= dt;
            const shake = 8 * Math.sin(this.stateTimer * 45);
            this.shakeOffset.x = shake;
            this.shakeOffset.y = Math.cos(this.stateTimer * 40) * 3;

            if (this.hurtTimer <= 0) {
                this.state = 'IDLE';
                this.shakeOffset = { x: 0, y: 0 };
            }
        } else if (this.state !== 'KO') {
            this.shakeOffset = { x: 0, y: 0 };
        }

        if (this.state === 'KO') {
            this.koProgress = Math.min(1, this.koProgress + dt * 1.5);
        }
    }

    draw(ctx) {
        ctx.save();

        const curX = this.x + this.shakeOffset.x;
        const curY = this.y + (this.state === 'IDLE' ? Math.sin(this.bobCycle) * 4 : 0) + this.shakeOffset.y;

        ctx.translate(curX, curY);

        if (this.state === 'KO') {
            // Fall backwards when knocked out
            const angle = this.facing * this.koProgress * (Math.PI / 2.3);
            ctx.translate(0, 40 * this.koProgress);
            ctx.rotate(angle);
        }

        // Shadow under fighter
        ctx.save();
        ctx.scale(1, 0.3);
        ctx.beginPath();
        ctx.arc(0, 190, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fill();
        ctx.restore();

        // Color theme
        const glowColor = this.color;
        const skinColor = this.isPlayer ? '#f7b084' : '#e0956f';
        const trunkColor = this.isPlayer ? '#0f2042' : '#4a0e1c';
        const gloveColor = this.color;

        // Legs / Trunks
        ctx.fillStyle = trunkColor;
        ctx.fillRect(-22, 10, 44, 32);
        // Trunks waistband
        ctx.fillStyle = glowColor;
        ctx.fillRect(-22, 8, 44, 6);

        // Legs
        ctx.fillStyle = skinColor;
        // Left Leg
        ctx.fillRect(-18, 42, 14, 28);
        // Right Leg
        ctx.fillRect(4, 42, 14, 28);
        // Boxing shoes
        ctx.fillStyle = '#111';
        ctx.fillRect(-20, 68, 18, 12);
        ctx.fillRect(2, 68, 18, 12);

        // Torso / Chest
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.moveTo(-24, -30);
        ctx.lineTo(24, -30);
        ctx.lineTo(18, 10);
        ctx.lineTo(-18, 10);
        ctx.closePath();
        ctx.fill();

        // Chest muscle shading
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.arc(this.facing * 4, -14, 9, 0, Math.PI * 2);
        ctx.fill();

        // Head & Face
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(0, -48, 18, 0, Math.PI * 2);
        ctx.fill();

        // Fighter Headband / Headgear
        ctx.fillStyle = glowColor;
        ctx.fillRect(-18, -58, 36, 9);

        // Eyes
        ctx.fillStyle = '#ffffff';
        const eyeX = this.facing * 6;
        ctx.fillRect(eyeX - 3, -50, 5, 4);
        ctx.fillStyle = '#000000';
        ctx.fillRect(eyeX + (this.facing * 1) - 2, -49, 3, 3);

        // Arms & Gloves Rendering
        const punchReach = this.armExtension * 75 * this.facing;
        const isPunch = this.state === 'PUNCHING';
        const isBlock = this.state === 'BLOCKING';

        // Back Arm (Idle / Guard)
        ctx.save();
        ctx.fillStyle = skinColor;
        const backArmX = -this.facing * 16;
        ctx.fillRect(backArmX - 5, -24, 10, 26);

        // Back Glove
        ctx.fillStyle = gloveColor;
        ctx.beginPath();
        ctx.arc(backArmX + (this.facing * 8), -8, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Lead Arm (Front)
        ctx.save();
        ctx.fillStyle = skinColor;
        if (isPunch) {
            // Extended punch arm
            const armStart = this.facing * 12;
            ctx.beginPath();
            ctx.moveTo(armStart, -24);
            ctx.lineTo(armStart + punchReach, -16);
            ctx.lineWidth = 14;
            ctx.strokeStyle = skinColor;
            ctx.stroke();

            // Lead Glove at end of punch
            const gloveX = armStart + punchReach;
            const gloveY = -16;

            // Glove glow trail
            ctx.shadowColor = gloveColor;
            ctx.shadowBlur = this.subState === 'super' ? 25 : 12;

            ctx.fillStyle = gloveColor;
            ctx.beginPath();
            ctx.arc(gloveX, gloveY, this.subState === 'super' ? 18 : 14, 0, Math.PI * 2);
            ctx.fill();

            // Energy speedlines behind glove
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(gloveX - this.facing * 12, gloveY - 6);
            ctx.lineTo(gloveX - this.facing * 35, gloveY - 6);
            ctx.moveTo(gloveX - this.facing * 14, gloveY + 6);
            ctx.lineTo(gloveX - this.facing * 40, gloveY + 6);
            ctx.stroke();

        } else if (isBlock) {
            // Guard stance: both gloves crossed in front of face
            ctx.fillStyle = skinColor;
            ctx.fillRect(this.facing * 8, -38, 12, 20);

            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 10;
            ctx.fillStyle = gloveColor;
            ctx.beginPath();
            ctx.arc(this.facing * 14, -38, 14, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Default relaxed stance
            ctx.fillRect(this.facing * 10, -22, 10, 22);
            ctx.fillStyle = gloveColor;
            ctx.beginPath();
            ctx.arc(this.facing * 16, -16, 12, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        // Energy Shield effect when blocking
        if (this.shieldOpacity > 0.05) {
            ctx.save();
            ctx.globalAlpha = this.shieldOpacity * 0.75;
            ctx.strokeStyle = '#00f0ff';
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 15;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(this.facing * 28, -25, 45, -Math.PI / 2, Math.PI / 2, this.facing < 0);
            ctx.stroke();

            // Hexagon pattern or inner ring
            ctx.beginPath();
            ctx.arc(this.facing * 28, -25, 26, -Math.PI / 2, Math.PI / 2, this.facing < 0);
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        }

        // Damage flash
        if (this.state === 'HURT') {
            ctx.save();
            ctx.globalCompositeOperation = 'source-atop';
            ctx.fillStyle = 'rgba(255, 60, 60, 0.45)';
            ctx.fillRect(-40, -80, 80, 160);
            ctx.restore();
        }

        ctx.restore();
    }
}

window.Fighter = Fighter;
