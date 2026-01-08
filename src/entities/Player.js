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

        // Combat State
        this.isBlocking = false;

        // Animation State
        this.currentAnim = 'IDLE';
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.facingRight = id === 1; // Default facing

        // Dash mechanics (Celeste-style)
        this.isDashing = false;

        this.ANIMATIONS = {
            IDLE: { row: 0, frames: 4, speed: 15 },
            RUN: { row: 1, frames: 6, speed: 6 },
            JUMP: { row: 2, frames: 2, speed: 10 },
            FALL: { row: 2, frames: 2, speed: 10, offset: 2 },
            ATTACK1: { row: 3, frames: 4, speed: 5 }, // Fast swipes
            LAUNCHER: { row: 4, frames: 3, speed: 8 }, // Up attack
            METEOR: { row: 4, frames: 3, speed: 8, offset: 3 }, // Down attack
            BLOCK: { row: 5, frames: 1, speed: 60 },
            HITSTUN: { row: 5, frames: 1, speed: 60, offset: 1 }
        };
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

    melee(opponent, game, input) {
        if (this.meleeCooldown > 0) return;

        // Default inputs if not provided (e.g., AI/network)
        if (!input) input = { y: 0 };

        let type = 'NEUTRAL';
        if (input.y < -0.5) type = 'UP';
        else if (input.y > 0.5) type = 'DOWN';

        this.currentAttackType = type; // Store for animation

        // Combo Logic
        if (this.comboTimer > 0 && type === 'NEUTRAL') {
            this.comboCount = (this.comboCount + 1) % 3;
        } else {
            this.comboCount = 0;
        }
        this.comboTimer = 40; // Reset combo timer (frames)

        // Attack Properties
        let damage = CONFIG.MELEE_DAMAGE;
        let knockbackForce = CONFIG.KNOCKBACK_FORCE;
        let cooldown = 20;
        let range = CONFIG.MELEE_RANGE;
        let launchX = 1.0;
        let launchY = 0.5; // Slight pop up by default

        // Directional Variations
        if (type === 'UP') {
            // LAUNCHER
            damage *= 0.8; // Less damage, more setup
            launchY = 2.5; // Launch high
            launchX = 0.2; // Keep close
            cooldown = 30;
            this.comboCount = 0; // Reset combo
            game.createHitParticles(this.x + this.width / 2, this.y, '#0000FF', 'spark'); // Blue effect
        } else if (type === 'DOWN') {
            if (!this.onGround) {
                // METEOR SMASH (Air)
                damage *= 1.5;
                launchY = -3.0; // Spike down
                launchX = 0.5;
                knockbackForce *= 1.5;
                cooldown = 45;
                game.createHitParticles(this.x + this.width / 2, this.y + this.height, '#FFA500', 'spark'); // Orange
            } else {
                // SWEEP (Ground)
                damage *= 0.7;
                launchY = 1.5; // Trip
                launchX = 0.5;
            }
            this.comboCount = 0;
        }
        // Neutral Combo Scaling
        else {
            if (this.comboCount === 1) {
                damage *= 1.2;
                cooldown = 25;
            } else if (this.comboCount === 2) {
                // FINISHER
                damage *= 2;
                knockbackForce *= 2;
                cooldown = 45;
                range *= 1.5;
            }
        }

        this.meleeActive = true;
        this.meleeCooldown = cooldown;
        if (game.soundManager) game.soundManager.playAttack();

        // EMIT MELEE EVENT
        if (game.gameMode === 'online' && game.socket && this.id === game.myPlayerId) {
            game.socket.emit('stick-arena:melee', {
                playerId: this.id,
                comboCount: this.comboCount,
                type: type
            });
        }

        const dx = opponent.x - this.x;
        const dy = opponent.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < range) {
            // Buffs
            if (this.activeBuff === 'HELLFIRE') {
                damage *= 1.5;
            }

            // Knockback Direction
            let knockbackDirX = this.facingRight ? 1 : -1;

            // Apply Damage with Custom Launch Vector
            // We overload takeDamage 3rd arg to pass vector if needed, or update takeDamage signature.
            // Current takeDamage: (amount, game, knockbackDirScalar)
            // Let's modify takeDamage later or hack it: 
            // We'll pass a special object or adjust takeDamage. 
            // For now, let's use the scalar but we need vertical control.

            // Wait, existing takeDamage sets vy = -CONFIG.KNOCKBACK_FORCE / 2
            // We need to override this.

            opponent.takeDamage(damage, game, knockbackDirX * (knockbackForce / CONFIG.KNOCKBACK_FORCE), launchY);

            // Visuals
            if (type === 'DOWN' && !this.onGround) {
                // Meteor Visuals
                game.screenShake(20, 10);
                if (game.soundManager) game.soundManager.playFinisher();
            } else if (this.comboCount === 2) {
                if (game.soundManager) game.soundManager.playFinisher();
                game.screenShake(15, 10);
                game.createHitParticles(opponent.x, opponent.y, '#FF0000', 'blood');
                game.createHitParticles(opponent.x, opponent.y, '#FFFFFF', 'spark');
            } else {
                game.createHitParticles(opponent.x + opponent.width / 2, opponent.y + opponent.height / 2, '#ff0000', 'blood');
            }

            // Lifesteal (Vampire Passive)
            const lifesteal = damage * CONFIG.LIFESTEAL_PERCENT;
            this.health = Math.min(this.maxHealth, this.health + lifesteal);
            this.updateHealthBar();
        }

        setTimeout(() => this.meleeActive = false, 200);
    } // End of melee

    shoot(game) {
        // Basic shoot removed/replaced by items, but keeping for legacy or fallback
    }

    takeDamage(amount, game, knockbackDir = 0, launchY = 0.5) {
        if (this.activeBuff === 'SHIELD') {
            amount *= 0.5;
        }

        // Blocking Logic
        let blocked = false;
        if (this.isBlocking) {
            if ((this.facingRight && knockbackDir < 0) || (!this.facingRight && knockbackDir > 0)) {
                blocked = true;
            }
        }

        if (blocked) {
            amount *= 0.4; // 60% Reduction
            if (game.soundManager) game.soundManager.playBlock();
            game.createHitParticles(this.x + this.width / 2, this.y + this.height / 2, '#FFFF00', 'spark');
        } else {
            // Apply knockback only if not blocked
            if (knockbackDir !== 0) {
                this.knockbackVx = knockbackDir * CONFIG.KNOCKBACK_FORCE;
                // launchY acts as a multiplier/override for Vertical Knockback
                // Standard was -CONFIG.KNOCKBACK_FORCE / 2 which implies launchY is relative
                // Let's assume launchY is multiplier of BASE knockback
                this.knockbackVy = -CONFIG.KNOCKBACK_FORCE * launchY;
            }
        }

        this.health = Math.max(0, this.health - amount);
        this.updateHealthBar();

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

    dash(game, input) {
        if (this.dashCooldown > 0 || this.isDashing) return;

        let dx = 0;
        let dy = 0;

        // Input-based Direction (Celeste Style)
        if (Math.abs(input.x) > 0.2) dx = Math.sign(input.x);
        if (Math.abs(input.y) > 0.2) dy = Math.sign(input.y);

        // If no input, default to facing direction
        if (dx === 0 && dy === 0) {
            dx = this.facingRight ? 1 : -1;
        }

        // Normalize diagonals
        if (dx !== 0 && dy !== 0) {
            dx *= 0.707;
            dy *= 0.707;
        }

        this.isDashing = true;
        this.dashTimer = CONFIG.DASH_DURATION;
        this.dashCooldown = CONFIG.DASH_COOLDOWN;
        this.dashDirX = dx;
        this.dashDirY = dy;

        // Initial Burst Speed
        // Reduce vertical dash power relative to horizontal (User Request)
        const verticalScale = 0.6;
        this.vx = dx * (CONFIG.DASH_DISTANCE / CONFIG.DASH_DURATION);
        this.vy = dy * (CONFIG.DASH_DISTANCE / CONFIG.DASH_DURATION) * verticalScale;

        // Visual Effect
        game.createHitParticles(this.x + this.width / 2, this.y + this.height / 2, '#00ffff');
        if (game.soundManager) game.soundManager.playDash();

        if (game.gameMode === 'online' && game.socket && this.id === game.myPlayerId) {
            game.socket.emit('stick-arena:dash', { x: this.x, y: this.y, dx, dy });
        }
    }

    updateAnimation() {
        // Determine Animation State
        let nextAnim = 'IDLE';

        if (this.meleeActive) {
            // Check combo count or input type
            // We need to track which attack is happening more precisely
            // For now, heuristic based on type or just use standard ATTACK1
            // Ideally melee() sets a 'currentAttackType' property
            if (this.currentAttackType === 'UP') nextAnim = 'LAUNCHER';
            else if (this.currentAttackType === 'DOWN') nextAnim = 'METEOR';
            else nextAnim = 'ATTACK1';
        } else if (this.isBlocking) {
            nextAnim = 'BLOCK';
        } else if (this.isDashing) {
            nextAnim = 'RUN'; // Or dash frame if available
        } else if (!this.onGround) {
            if (this.vy < 0) nextAnim = 'JUMP';
            else nextAnim = 'FALL';
        } else if (Math.abs(this.vx) > 0.5) {
            nextAnim = 'RUN';
        }

        // State Transition
        if (this.currentAnim !== nextAnim) {
            this.currentAnim = nextAnim;
            this.frameIndex = 0;
            this.frameTimer = 0;
        }

        // Advance Frame
        const anim = this.ANIMATIONS[this.currentAnim];
        this.frameTimer++;
        if (this.frameTimer >= anim.speed) {
            this.frameTimer = 0;
            this.frameIndex++;
            if (this.frameIndex >= anim.frames) {
                // Loop or Clamp
                if (this.meleeActive) {
                    this.frameIndex = anim.frames - 1; // Hold last frame of attack
                } else {
                    this.frameIndex = 0;
                }
            }
        }
    }

    update(game, input) {
        this.updateAnimation();

        // Fallback for missing input (e.g. game just started)
        if (!input) input = { x: 0, y: 0, jump: false, dash: false, attack: false, block: false, item: false, switchItem: false };

        // Handle Actions via Input
        if (input.dash) this.dash(game, input);
        if (input.attack) this.melee(game.player1 === this ? game.player2 : game.player1, game, input);
        if (input.item && !this.prevItemInput) this.useItem(game);
        if (input.switchItem && !this.prevSwitchInput) this.switchItemNext();

        // Input latching to prevent machine-gun inputs
        this.prevItemInput = input.item;
        this.prevSwitchInput = input.switchItem;

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

            // Movement from Input
            if (input.x < -0.2) { targetVx = -maxSpeed; this.facingRight = false; }
            if (input.x > 0.2) { targetVx = maxSpeed; this.facingRight = true; }

            // Blocking logic
            // Can only block on ground
            if (input.block && this.onGround) {
                this.isBlocking = true;
                targetVx = 0; // Stop movement while blocking
            } else {
                this.isBlocking = false;
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
            if (input.jump && !this.jumpKeyHeld) {
                this.performJump(game);
                this.jumpKeyHeld = true;
            } else if (!input.jump) {
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

    performJump(game) {
        if (this.onGround) {
            // Normal Jump
            this.vy = -CONFIG.JUMP_FORCE;
            this.onGround = false;
            this.jumpsRemaining--;
            if (game.soundManager) game.soundManager.playJump();
        } else if (this.isWallSliding) {
            // Wall Jump
            this.vy = -CONFIG.WALL_JUMP_FORCE.y;
            this.vx = -this.wallSlideDir * CONFIG.WALL_JUMP_FORCE.x; // Jump away from wall
            this.jumpsRemaining = 1; // Allow one more jump after wall jump
            if (game.soundManager) game.soundManager.playJump();
        } else if (this.jumpsRemaining > 0 && this.canDoubleJump) {
            // Double Jump
            this.vy = -CONFIG.DOUBLE_JUMP_FORCE;
            this.jumpsRemaining--;
            if (game.soundManager) game.soundManager.playJump();
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
        if (this.activeBuff === 'SHIELD' || this.isBlocking) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width + 10, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Sprite Rendering
        if (game.spritesLoaded && game.spriteSheet) {
            const anim = this.ANIMATIONS[this.currentAnim];
            if (anim) {
                // Calculate Frame Position
                // Assuming 6x6 grid.
                const cols = 6;
                const rows = 6;
                // Use Game calculated dimensions or fallback
                const sheetW = game.spriteSheetWidth || 1024;
                const sheetH = game.spriteSheetHeight || 1024;

                const frameW = sheetW / cols;
                const frameH = sheetH / rows;

                let col = this.frameIndex + (anim.offset || 0);
                let row = anim.row;

                // Source Rect
                const sx = col * frameW;
                const sy = row * frameH;

                ctx.save();
                ctx.translate(this.x + this.width / 2, this.y + this.height / 2);

                // Scale and Flip
                const scale = 2.0;
                ctx.scale(this.facingRight ? scale : -scale, scale);

                // Draw Image
                // We draw centered
                ctx.drawImage(
                    game.spriteSheet,
                    sx, sy, frameW, frameH,
                    -frameW / 2, -frameH / 2, frameW, frameH
                );

                ctx.restore();
            }
        } else {
            // Fallback: Rectangle
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
        }

        // --- UI OVERLAYS ---
        // Speed effect
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
}

