import { CONFIG, ITEMS } from '../config.js';
import { Projectile } from './Projectile.js';
import { Particle } from './Particle.js';

export class Player {
    constructor(x, y, color, id) {
        this.x = x;
        this.y = y;
        this.width = CONFIG.PLAYER_SIZE;
        this.height = CONFIG.PLAYER_SIZE * 2;
        this.color = color;
        this.id = id;

        this.vx = 0;
        this.vy = 0;
        this.onGround = false;
        this.facingRight = id === 1;

        // Advanced Movement State
        this.canDoubleJump = true;
        this.isWallSliding = false;
        this.wallSlideDir = 0; // -1 left, 1 right
        this.jumpsRemaining = 2; // For double jump
        this.jumpKeyHeld = false;

        this.health = CONFIG.MAX_HEALTH;
        this.maxHealth = CONFIG.MAX_HEALTH;

        // Mario Kart-style item inventory
        this.inventory = []; // Array of {type, stack}
        this.currentItemIndex = 0; // Currently selected item

        // Active buff system
        this.activeBuff = null; // SPEED or SHIELD
        this.buffTimer = 0;

        this.meleeActive = false;
        this.meleeCooldown = 0;
        this.comboCount = 0;
        this.comboTimer = 0;

        // Knockback
        this.knockbackVx = 0;
        this.knockbackVy = 0;

        // Dash mechanics (Celeste-style)
        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCooldown = 0;
        this.dashDirX = 0;
        this.dashDirY = 0;

        // Animation State (Current Angles for Interpolation)
        this.anim = {
            legL: 0, legR: 0,
            legL_lower: 0, legR_lower: 0,
            armL: 0, armR: 0,
            armL_lower: 0, armR_lower: 0,
            bodyRot: 0,
            headY: -15,
            yOffset: 0
        };

        // Initial UI Update
        this.updateHealthBar();
        this.updateItemDisplay();
    }

    // Item inventory management
    pickupItem(itemType) {
        // Check if item already exists in inventory
        const existingItem = this.inventory.find(item => item.type === itemType);

        if (existingItem) {
            // Add to existing stack
            existingItem.stack++;
        } else if (this.inventory.length < CONFIG.MAX_ITEM_SLOTS) {
            // Add new item to empty slot
            this.inventory.push({ type: itemType, stack: 1 });
        } else {
            // Inventory full, can't pick up
            return false;
        }

        this.updateItemDisplay();
        return true;
    }

    switchItemNext() {
        if (this.inventory.length === 0) return;
        this.currentItemIndex = (this.currentItemIndex + 1) % this.inventory.length;
        this.updateItemDisplay();
    }

    switchItemPrev() {
        if (this.inventory.length === 0) return;
        this.currentItemIndex = (this.currentItemIndex - 1 + this.inventory.length) % this.inventory.length;
        this.updateItemDisplay();
    }

    updateHealthBar() {
        // Find health bar element
        const bar = document.getElementById(`health-p${this.id}`);
        if (bar) {
            const percent = (this.health / this.maxHealth) * 100;
            bar.style.width = `${percent}%`;
        }
    }

    updateItemDisplay() {
        // Find item container
        const container = document.getElementById(`items-p${this.id}`);
        if (!container) return;

        container.innerHTML = ''; // Clear

        this.inventory.forEach((item, index) => {
            const slot = document.createElement('div');
            slot.className = 'item-slot';
            if (index === this.currentItemIndex) slot.classList.add('selected');

            // Get item config
            const itemConfig = ITEMS[item.type];
            if (itemConfig) {
                slot.textContent = itemConfig.icon + ' x' + item.stack;
                slot.style.borderColor = itemConfig.color;
                slot.title = itemConfig.name;
            } else {
                slot.textContent = '?';
            }

            container.appendChild(slot);
        });
    }


    useItem(game) {
        if (this.inventory.length === 0) return;

        const currentItem = this.inventory[this.currentItemIndex];
        if (!currentItem) return;

        const itemData = ITEMS[currentItem.type];

        // Use the item based on its type
        if (itemData.type === 'buff') {
            this.activeBuff = currentItem.type;
            this.buffTimer = CONFIG.ITEM_DURATION;

            // Immediate effect for Berserk (Old Vampire Dash)
            if (currentItem.type === 'BERSERK') {
                this.health = Math.max(1, this.health - 5); // Sacrifice 5 HP
                this.updateHealthBar();
            }
        } else if (itemData.type === 'heal') {
            // Health Potion (Old Blood Orb)
            this.health = Math.min(this.maxHealth, this.health + itemData.value);
            this.updateHealthBar();
            game.createHitParticles(this.x + this.width / 2, this.y + this.height / 2, itemData.color);
        } else if (itemData.type === 'projectile') {
            // Launch projectile
            const dir = this.facingRight ? 1 : -1;
            const projectile = new Projectile(
                this.x + (this.facingRight ? this.width : 0),
                this.y + this.height / 2,
                dir,
                this.id,
                currentItem.type
            );
            game.projectiles.push(projectile);

            // EMIT SHOOT EVENT
            if (game.gameMode === 'online' && game.socket && this.id === game.myPlayerId) {
                game.socket.emit('stick-arena:shoot', {
                    projectile: {
                        x: projectile.x,
                        y: projectile.y,
                        vx: projectile.vx,
                        owner: projectile.owner,
                        type: projectile.type
                    }
                });
            }
        }

        // Decrease stack
        currentItem.stack--;

        // Remove item if stack is 0
        if (currentItem.stack <= 0) {
            this.inventory.splice(this.currentItemIndex, 1);
            this.currentItemIndex = Math.min(this.currentItemIndex, this.inventory.length - 1);
        }

        this.updateItemDisplay();
    }

    // ... (rest of methods)

    melee(opponent, game) {
        if (this.meleeCooldown > 0) return;

        // Combo Logic
        if (this.comboTimer > 0) {
            this.comboCount = (this.comboCount + 1) % 3;
        } else {
            this.comboCount = 0;
        }
        this.comboTimer = 40; // Reset combo timer (frames)

        // Attack Properties based on Combo Step
        let damage = CONFIG.MELEE_DAMAGE;
        let knockbackForce = CONFIG.KNOCKBACK_FORCE;
        let cooldown = 20;
        let range = CONFIG.MELEE_RANGE;

        if (this.comboCount === 1) {
            damage *= 1.2; // Medium hit
            cooldown = 25;
        } else if (this.comboCount === 2) {
            damage *= 2; // Heavy finisher
            knockbackForce *= 2;
            cooldown = 45;
            range *= 1.5;
        }

        this.meleeActive = true;
        this.meleeCooldown = cooldown;

        // EMIT MELEE EVENT
        if (game.gameMode === 'online' && game.socket && this.id === game.myPlayerId) {
            game.socket.emit('stick-arena:melee', {
                playerId: this.id,
                comboCount: this.comboCount
            });
        }

        const dx = opponent.x - this.x;
        const dy = opponent.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < range) {
            // Apply Hellfire buff if active
            if (this.activeBuff === 'HELLFIRE') {
                damage *= 1.5;
                game.createHitParticles(opponent.x, opponent.y, '#ff5722');
            }

            // Calculate knockback direction
            const knockbackDir = this.facingRight ? 1 : -1;

            opponent.takeDamage(damage, game, knockbackDir * (knockbackForce / CONFIG.KNOCKBACK_FORCE));

            // Lifesteal (Vampire Passive)
            const lifesteal = damage * CONFIG.LIFESTEAL_PERCENT;
            this.health = Math.min(this.maxHealth, this.health + lifesteal);
            this.updateHealthBar();

            // Blood Particles
            game.createHitParticles(opponent.x + opponent.width / 2, opponent.y + opponent.height / 2, '#ff0000');
        }

        setTimeout(() => this.meleeActive = false, 200);
    } // End of melee

    shoot(game) {
        // Basic shoot removed/replaced by items, but keeping for legacy or fallback
    }

    takeDamage(amount, game, knockbackDir = 0) {
        if (this.activeBuff === 'SHIELD') {
            amount *= 0.5;
        }

        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();

        // Apply knockback
        if (knockbackDir !== 0) {
            this.knockbackVx = knockbackDir * CONFIG.KNOCKBACK_FORCE;
            this.knockbackVy = -CONFIG.KNOCKBACK_FORCE / 2; // Slight pop up
        }

        // EMIT DAMAGE EVENT (If we are the one taking damage, we should notify server/opponent for sync, although usually attacker notifies or both)
        // In P2P trust model, usually the attacker sends "I hit you", but taking damage is Authoritative on Self if we want Anti-Cheat, or Authoritative on Attacker if we want Responsiveness.
        // Let's emit it so opponent knows valid hit confirmed? Or just rely on visual sync from state update?
        // Actually, 'playerDamaged' relay is useful for special effects etc.
        if (game.gameMode === 'online' && game.socket && this.id === game.myPlayerId) {
            game.socket.emit('stick-arena:playerDamaged', {
                playerId: this.id,
                damage: amount,
                health: this.health
            });
        }
    }

    update(game) {
        // Update dash state
        if (this.isDashing) {
            this.dashTimer--;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        }

        // Update dash cooldown
        if (this.dashCooldown > 0) {
            this.dashCooldown--;
        }

        // Update buff timer
        if (this.buffTimer > 0) {
            this.buffTimer--;
            if (this.buffTimer === 0) {
                this.activeBuff = null;
            }
        }

        // Handle movement with progressive acceleration
        const maxSpeed = this.activeBuff === 'SPEED' ? CONFIG.PLAYER_SPEED * 1.5 : CONFIG.PLAYER_SPEED;

        // Dash movement overrides normal movement
        if (this.isDashing) {
            const dashSpeed = CONFIG.DASH_DISTANCE / CONFIG.DASH_DURATION;
            this.vx = this.dashDirX * dashSpeed;
            this.vy = this.dashDirY * dashSpeed;
        } else {
            // Normal movement controls
            let targetVx = 0;
            let jumpPressed = false;

            if (this.id === 1) {
                if (game.keys['a']) { targetVx = -maxSpeed; this.facingRight = false; }
                if (game.keys['d']) { targetVx = maxSpeed; this.facingRight = true; }
                if (game.keys['w']) jumpPressed = true;
            } else {
                if (game.keys['arrowleft']) { targetVx = -maxSpeed; this.facingRight = false; }
                if (game.keys['arrowright']) { targetVx = maxSpeed; this.facingRight = true; }
                if (game.keys['arrowup']) jumpPressed = true;
            }

            // Apply acceleration/friction
            if (targetVx !== 0) {
                this.vx += (targetVx - this.vx) * CONFIG.ACCELERATION;
            } else {
                this.vx *= CONFIG.FRICTION;
                if (Math.abs(this.vx) < 0.1) this.vx = 0;
            }

            // Apply knockback decay
            if (Math.abs(this.knockbackVx) > 0.1) {
                this.vx += this.knockbackVx;
                this.knockbackVx *= 0.9; // Decay
            }
            if (Math.abs(this.knockbackVy) > 0.1) {
                this.vy += this.knockbackVy;
                this.knockbackVy *= 0.9;
            }

            // Jump Logic (Normal, Double, Wall)
            if (jumpPressed && !this.jumpKeyHeld) {
                this.performJump();
                this.jumpKeyHeld = true;
            } else if (!jumpPressed) {
                this.jumpKeyHeld = false;
            }
        }

        // Apply gravity & Wall Slide
        if (!this.isDashing) {
            if (this.isWallSliding && this.vy > 0) {
                this.vy = CONFIG.WALL_SLIDE_SPEED; // Slower fall when sliding
            } else {
                this.vy += CONFIG.GRAVITY;
            }
        }

        // Update position
        this.x += this.vx;
        this.y += this.vy;

        // Platform collision & Wall Detection
        this.onGround = false;
        this.isWallSliding = false;
        this.wallSlideDir = 0;

        game.platforms.forEach(platform => {
            if (this.checkOverlap(platform)) {
                this.resolveCollision(platform);
            }
        });

        // Boundaries
        if (this.x < 0) { this.x = 0; this.vx = 0; }
        if (this.x > CONFIG.CANVAS_WIDTH - this.width) { this.x = CONFIG.CANVAS_WIDTH - this.width; this.vx = 0; }

        // Reset jumps on ground
        if (this.onGround) {
            this.jumpsRemaining = 2;
            this.canDoubleJump = true;
        }

        if (this.meleeCooldown > 0) {
            this.meleeCooldown--;
        }

        // Update combo timer
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer === 0) {
                this.comboCount = 0; // Reset combo if time runs out
            }
        }
    }

    performJump() {
        if (this.onGround) {
            // Normal Jump
            this.vy = -CONFIG.JUMP_FORCE;
            this.onGround = false;
            this.jumpsRemaining--;
        } else if (this.isWallSliding) {
            // Wall Jump
            this.vy = -CONFIG.WALL_JUMP_FORCE.y;
            this.vx = -this.wallSlideDir * CONFIG.WALL_JUMP_FORCE.x; // Jump away from wall
            this.jumpsRemaining = 1; // Allow one more jump after wall jump
        } else if (this.jumpsRemaining > 0 && this.canDoubleJump) {
            // Double Jump
            this.vy = -CONFIG.DOUBLE_JUMP_FORCE;
            this.jumpsRemaining--;
            // Visual effect for double jump could go here
        }
    }

    checkOverlap(rect) {
        return this.x < rect.x + rect.width &&
            this.x + this.width > rect.x &&
            this.y < rect.y + rect.height &&
            this.y + this.height > rect.y;
    }

    resolveCollision(platform) {
        const overlapLeft = (this.x + this.width) - platform.x;
        const overlapRight = (platform.x + platform.width) - this.x;
        const overlapTop = (this.y + this.height) - platform.y;
        const overlapBottom = (platform.y + platform.height) - this.y;

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop && this.vy > 0) {
            this.y = platform.y - this.height;
            this.vy = 0;
            this.onGround = true;
        } else if (minOverlap === overlapBottom && this.vy < 0) {
            this.y = platform.y + platform.height;
            this.vy = 0;
        } else if (minOverlap === overlapLeft && this.vx > 0) {
            this.x = platform.x - this.width;
            this.vx = 0;
            // Wall Slide Detection (Left Wall)
            if (!this.onGround && this.vy > 0) {
                this.isWallSliding = true;
                this.wallSlideDir = 1; // Wall is to the right
            }
        } else if (minOverlap === overlapRight && this.vx < 0) {
            this.x = platform.x + platform.width;
            this.vx = 0;
            // Wall Slide Detection (Right Wall)
            if (!this.onGround && this.vy > 0) {
                this.isWallSliding = true;
                this.wallSlideDir = -1; // Wall is to the left
            }
        }
    }

    updateHealthBar() {
        const healthBar = document.getElementById(`health-p${this.id}`);
        if (healthBar) {
            healthBar.style.width = `${(this.health / this.maxHealth) * 100}%`;
            if (this.health < 30) {
                healthBar.style.background = 'linear-gradient(90deg, #ff0000, #ff3333)';
            } else {
                healthBar.style.background = this.id === 1 ? '#00ffff' : '#ff00ff';
            }
        }
    }

    draw(ctx, game) {
        // Draw dash trail effect
        if (this.isDashing) {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.dashDirX * 10, this.y - this.dashDirY * 10, this.width, this.height);
            ctx.globalAlpha = 1;
        }

        // Draw shield effect
        if (this.activeBuff === 'SHIELD') {
            ctx.strokeStyle = ITEMS.SHIELD.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        // --- PROCEDURAL STICK FIGURE ANIMATION ---

        ctx.save();
        ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

        // Base Scale & Direction
        const scale = 1.2;
        ctx.scale(this.facingRight ? scale : -scale, scale);

        // Animation State Calculation
        const time = Date.now() / 100;
        let legL = 0, legR = 0, armL = 0, armR = 0, bodyRot = 0, headY = -15;
        let armL_lower = 0, armR_lower = 0;
        let legL_lower = 0, legR_lower = 0;

        // State Machine for Poses
        if (this.meleeActive) {
            // ATTACK: Heavy Swing
            const progress = 1 - (this.meleeCooldown / 20); // 0 to 1 approx
            bodyRot = 0.2 + progress * 0.5; // Lean forward
            armR = -Math.PI / 2 + progress * Math.PI; // Swing over head
            armR_lower = -0.5; // Straightish sword arm
            armL = 0.5; // Balance
            legL = 0.5;
            legR = -0.5;
        } else if (!this.onGround) {
            // JUMP / AIR
            if (this.vy < 0) {
                // Going Up
                legL = 0.5; legL_lower = 1;
                legR = -0.2; legR_lower = 0.5;
                armL = -2; armR = -2; // Arms up
            } else {
                // Falling
                legL = 0.2; legL_lower = 0.2;
                legR = 0.1; legR_lower = 0.2;
                armL = -2.5; armR = -2.5; // Flailing up
            }
        } else if (Math.abs(this.vx) > 0.5) {
            // RUNNING
            const runSpeed = 0.8;
            bodyRot = 0.2; // Lean forward
            legL = Math.sin(time * 1.5) * 0.8;
            legR = Math.sin(time * 1.5 + Math.PI) * 0.8;
            legL_lower = Math.max(0, legL); // Knee bend
            legR_lower = Math.max(0, legR);

            armL = Math.sin(time * 1.5 + Math.PI) * 0.8;
            armR = Math.sin(time * 1.5) * 0.8;
            armL_lower = -0.5;
            armR_lower = -0.5;
        } else {
            // IDLE (Breathing)
            headY = -15 + Math.sin(time) * 0.5;
            armL = Math.sin(time) * 0.1;
            armR = Math.sin(time + Math.PI) * 0.1;
            legL = 0;
            legR = 0;
        }

        // --- DRAW SKELETON ---
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Body
        ctx.beginPath();
        ctx.moveTo(0, 0); // Hips
        const neckX = Math.sin(bodyRot) * 15;
        const neckY = -Math.cos(bodyRot) * 15;
        ctx.lineTo(neckX, neckY); // Neck
        ctx.stroke();

        // 2. Head
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(neckX, neckY - 5, 6, 0, Math.PI * 2);
        ctx.fill();

        // White Face/Visor
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(neckX + 3, neckY - 5, 2, 0, Math.PI * 2); // Eye
        ctx.fill();

        // 3. Legs
        const hipY = 0;
        const legLen = 12;

        // Leg Left
        this.drawLimb(ctx, 0, hipY, legL, legL_lower, legLen, this.color);
        // Leg Right
        this.drawLimb(ctx, 0, hipY, legR, legR_lower, legLen, this.color);

        // 4. Arms
        const shoulderX = neckX;
        const shoulderY = neckY + 3;
        const armLen = 10;

        // Arm Left (Back)
        this.drawLimb(ctx, shoulderX, shoulderY, armL, armL_lower, armLen, this.color);

        // Arm Right (Front & Weapon holder)
        const handPos = this.drawLimb(ctx, shoulderX, shoulderY, armR, armR_lower, armLen, this.color);

        // 5. Weapon (Sword)
        // If has crossbow or other item, render differently?
        // Default Sword
        ctx.save();
        ctx.translate(handPos.x, handPos.y);
        ctx.rotate(armR + armR_lower + Math.PI / 2); // Align with hand

        // Sword Handle
        ctx.fillStyle = '#666';
        ctx.fillRect(-2, -5, 4, 10);

        // Crossguard
        ctx.fillStyle = '#888';
        ctx.fillRect(-6, -5, 12, 3);

        // Blade
        ctx.fillStyle = '#00ffff'; // Energy blade
        if (this.id === 2) ctx.fillStyle = '#ff00ff';

        // Glow
        ctx.shadowBlur = 5;
        ctx.shadowColor = ctx.fillStyle;

        ctx.fillRect(-2, -35, 4, 30);

        ctx.restore();

        ctx.restore();

        // Speed effect particles or tint
        if (this.activeBuff === 'SPEED') {
            ctx.fillStyle = ITEMS.SPEED.color;
            ctx.globalAlpha = 0.3;
            ctx.fillRect(this.x - 5, this.y, this.width + 10, this.height);
            ctx.globalAlpha = 1;
        }

        // Dash cooldown indicator
        if (this.dashCooldown > 0 && !this.isDashing) {
            const cooldownPercent = this.dashCooldown / CONFIG.DASH_COOLDOWN;
            ctx.fillStyle = 'rgba(255, 255, 0, 0.3)';
            ctx.fillRect(this.x, this.y - 5, this.width * (1 - cooldownPercent), 3);
        }

        // Combo Counter
        if (this.comboCount > 0) {
            ctx.fillStyle = '#ff00ff';
            ctx.font = '10px "Press Start 2P"';
            ctx.fillText(`x${this.comboCount}`, this.x, this.y - 10);
        }
    }

    drawLimb(ctx, origX, origY, angle1, angle2, length, color) {
        ctx.beginPath();
        ctx.moveTo(origX, origY);

        // Upper
        const x1 = origX + Math.sin(angle1) * length;
        const y1 = origY + Math.cos(angle1) * length;
        ctx.lineTo(x1, y1);

        // Lower
        const x2 = x1 + Math.sin(angle1 + angle2) * length;
        const y2 = y1 + Math.cos(angle1 + angle2) * length;
        ctx.lineTo(x2, y2);

        ctx.stroke();

        return { x: x2, y: y2 };
    }
}

