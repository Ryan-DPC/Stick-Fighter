// Game Configuration
export const CONFIG = {
    SERVER_URL: 'https://server-1-z9ok.onrender.com', // WS URL
    API_URL: 'https://backend-ether.onrender.com',
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 600,
    PLAYER_SIZE: 20,
    PLAYER_SPEED: 3,
    ACCELERATION: 0.5, // Progressive acceleration
    FRICTION: 0.85,    // Friction for stopping
    JUMP_FORCE: 7,     // Slightly increased for double jump balance
    DOUBLE_JUMP_FORCE: 6,
    WALL_JUMP_FORCE: { x: 6, y: 8 },
    GRAVITY: 0.25,
    WALL_SLIDE_SPEED: 2,
    DASH_DISTANCE: 100, // Increased for Hyper Dash feel
    DASH_DURATION: 10,  // Faster dash
    DASH_COOLDOWN: 60,
    MELEE_RANGE: 50,
    MELEE_DAMAGE: 15,
    KNOCKBACK_FORCE: 2.5,
    PROJECTILE_SPEED: 10,
    PROJECTILE_DAMAGE: 10,
    MAX_HEALTH: 100,
    ITEM_DURATION: 5000,
    ITEM_SPAWN_INTERVAL: 30000,
    MAX_ITEM_SLOTS: 2,
    ROUND_TIME: 99,
    LIFESTEAL_PERCENT: 0.2, // 20% lifesteal on hit
};

// Medieval Items
export const ITEMS = {
    HEALTH_POTION: {
        name: 'HEALTH_POTION',
        icon: '🍷',
        color: '#ff0000',
        type: 'heal',
        value: 20,
        description: 'Drink Potion (20 HP)'
    },
    CROSSBOW: {
        name: 'CROSSBOW',
        icon: '🏹',
        color: '#8b4513',
        type: 'projectile',
        description: 'Fire Bolt'
    },
    BERSERK: {
        name: 'BERSERK_RAGE',
        icon: '💢',
        color: '#800000',
        type: 'buff',
        description: 'Sacrifice HP for Speed'
    },
    FIRE_SPELL: {
        name: 'FIRE_SPELL',
        icon: '🔥',
        color: '#ff4500',
        type: 'projectile',
        piercing: true,
        description: 'Cast Fireball'
    },
    HASTE: {
        name: 'HASTE_SCROLL',
        icon: '📜',
        color: '#ffd700',
        type: 'buff',
        description: 'Run Faster'
    },
    IRON_SHIELD: {
        name: 'IRON_SHIELD',
        icon: '🛡️',
        color: '#a9a9a9',
        type: 'buff',
        description: 'Block Damage'
    },
};
