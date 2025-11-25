// Game Configuration
export const CONFIG = {
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
    KNOCKBACK_FORCE: 5,
    PROJECTILE_SPEED: 10,
    PROJECTILE_DAMAGE: 10,
    MAX_HEALTH: 100,
    ITEM_DURATION: 5000,
    ITEM_SPAWN_INTERVAL: 15000,
    MAX_ITEM_SLOTS: 2,
    ROUND_TIME: 99,
    LIFESTEAL_PERCENT: 0.2, // 20% lifesteal on hit
};

// Vampire Items
export const ITEMS = {
    BLOOD_ORB: {
        name: 'BLOOD_ORB',
        icon: '🩸',
        color: '#ff0000',
        type: 'heal',
        value: 20,
        description: 'Regenerate 20 HP'
    },
    BAT_SWARM: {
        name: 'BAT_SWARM',
        icon: '🦇',
        color: '#4a0e4e',
        type: 'projectile',
        description: 'Bat Swarm Attack'
    },
    VAMPIRE_DASH: {
        name: 'VAMPIRE_DASH',
        icon: '🧛',
        color: '#880e4f',
        type: 'buff',
        description: 'Dash drains HP'
    },
    HELLFIRE: {
        name: 'HELLFIRE',
        icon: '🔥',
        color: '#ff5722',
        type: 'projectile',
        piercing: true,
        description: 'Hellfire Blast'
    },
    SPEED: {
        name: 'SPEED_BOOST',
        icon: '⚡',
        color: '#ffeb3b',
        type: 'buff',
        description: 'Speed Boost'
    },
    SHIELD: {
        name: 'SHIELD',
        icon: '🛡️',
        color: '#2196f3',
        type: 'buff',
        description: 'Shield'
    },
};
