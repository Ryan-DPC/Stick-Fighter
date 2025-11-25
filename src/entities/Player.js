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

    useItem(game) {
        if (this.inventory.length === 0) return;

        const currentItem = this.inventory[this.currentItemIndex];
        if (!currentItem) return;

        const itemData = ITEMS[currentItem.type];

        // Use the item based on its type
        if (itemData.type === 'buff') {
            this.activeBuff = currentItem.type;
            this.buffTimer = CONFIG.ITEM_DURATION;

            // Immediate effect for Vampire Dash
            if (currentItem.type === 'VAMPIRE_DASH') {
                this.health = Math.max(1, this.health - 5); // Drain 5 HP
                this.updateHealthBar();
            }
        } else if (itemData.type === 'heal') {
            // Blood Orb
            this.health = Math.min(this.maxHealth, this.health + itemData.value);
            this.updateHealthBar();
            game.createHitParticles(this.x + this.width / 2, this.y + this.height / 2, itemData.color);
        } else if (itemData.type === 'projectile') {
            // Launch projectile (Hellfire or Bat Swarm)
            const dir = this.facingRight ? 1 : -1;
            const projectile = new Projectile(
                this.x + (this.facingRight ? this.width : 0),
                this.y + this.height / 2,
                dir,
                this.id,
                currentItem.type
            );
            game.projectiles.push(projectile);
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

    updateItemDisplay() {
        const itemDisplay = document.getElementById(`weapon-p${this.id}`);
        if (!itemDisplay) return; // Safety check

        if (this.inventory.length === 0) {
            itemDisplay.textContent = 'No Items';
        } else {
            const item = this.inventory[this.currentItemIndex];
            if (!item) {
                // Safety: reset index if invalid
                this.currentItemIndex = 0;
                itemDisplay.textContent = 'No Items';
                return;
            }
            const itemData = ITEMS[item.type];
            itemDisplay.textContent = `${itemData.icon} x${item.stack}`;
        }
    }

    dash(game) {
        // Can't dash if already dashing or on cooldown
        if (this.isDashing || this.dashCooldown > 0) return;

        // Determine dash direction based on input
        let dashDirX = 0;
        let dashDirY = 0;

        if (this.id === 1) {
            if (game.keys['w']) dashDirY = -1;
            if (game.keys['s']) dashDirY = 1;
            if (game.keys['a']) dashDirX = -1;
            if (game.keys['d']) dashDirX = 1;
        } else {
            if (game.keys['arrowup']) dashDirY = -1;
            if (game.keys['arrowdown']) dashDirY = 1;
            if (game.keys['arrowleft']) dashDirX = -1;
            if (game.keys['arrowright']) dashDirX = 1;
        }

        // Default to facing direction if no input
        if (dashDirX === 0 && dashDirY === 0) {
            dashDirX = this.facingRight ? 1 : -1;
        }

        // Normalize diagonal dashes (Celeste-style)
        if (dashDirX !== 0 && dashDirY !== 0) {
            const length = Math.sqrt(dashDirX * dashDirX + dashDirY * dashDirY);
            dashDirX /= length;
            dashDirY /= length;
        }

        // Start dash
        this.isDashing = true;
        this.dashTimer = CONFIG.DASH_DURATION;
        this.dashDirX = dashDirX;
        this.dashDirY = dashDirY;
        this.dashCooldown = CONFIG.DASH_COOLDOWN;

        // Create dash particles
        for (let i = 0; i < 8; i++) {
            game.particles.push(new Particle(this.x + this.width / 2, this.y + this.height / 2, this.color));
        }
    }

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
    }

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

    draw(ctx) {
        // Draw dash trail effect
        if (this.isDashing) {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = this.color;
            // Draw afterimage behind the player
            ctx.fillRect(this.x - this.dashDirX * 10, this.y - this.dashDirY * 10, this.width, this.height);
            ctx.globalAlpha = 1;
        }

        // Draw shield effect
        if (this.activeBuff === 'SHIELD') {
            ctx.strokeStyle = ITEMS.SHIELD.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, this.width + 5, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw dash glow during dash
        if (this.isDashing) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = this.color;
        }

        // Draw player body
        ctx.fillStyle = this.color;

        // Head
        ctx.fillRect(this.x + 5, this.y, 10, 10);

        // Body
        ctx.fillRect(this.x + 7, this.y + 10, 6, 15);

        // Arms
        if (this.meleeActive) {
            const armX = this.facingRight ? this.x + 13 : this.x - 8;
            ctx.fillRect(armX, this.y + 12, 8, 4);
        } else {
            ctx.fillRect(this.x + 3, this.y + 12, 5, 4);
            ctx.fillRect(this.x + 12, this.y + 12, 5, 4);
        }

        // Legs
        ctx.fillRect(this.x + 5, this.y + 25, 4, 15);
        ctx.fillRect(this.x + 11, this.y + 25, 4, 15);

        // Reset shadow
        ctx.shadowBlur = 0;

        // Draw weapon indicator
        if (this.meleeActive) {
            ctx.fillStyle = '#ffff00';
            const weaponX = this.facingRight ? this.x + this.width : this.x - 10;
            ctx.fillRect(weaponX, this.y + 15, 10, 3);
        }

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
