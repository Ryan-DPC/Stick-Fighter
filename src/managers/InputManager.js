export class InputManager {
    constructor() {
        this.keys = {};
        this.gamepads = {};

        // Keyboard Listeners
        window.addEventListener('keydown', (e) => this.keys[e.key.toLowerCase()] = true);
        window.addEventListener('keyup', (e) => this.keys[e.key.toLowerCase()] = false);

        // Gamepad Listeners
        window.addEventListener("gamepadconnected", (e) => {
            console.log("Gamepad connected at index %d: %s. %d buttons, %d axes.",
                e.gamepad.index, e.gamepad.id,
                e.gamepad.buttons.length, e.gamepad.axes.length);
            this.gamepads[e.gamepad.index] = e.gamepad;
        });

        window.addEventListener("gamepaddisconnected", (e) => {
            console.log("Gamepad disconnected from index %d: %s",
                e.gamepad.index, e.gamepad.id);
            delete this.gamepads[e.gamepad.index];
        });
    }

    // Get input state for a specific player (1 or 2)
    getInput(playerId) {
        const input = {
            x: 0,
            y: 0,
            jump: false,
            dash: false,
            attack: false,
            block: false,
            item: false,
            switchItem: false
        };

        // --- KEYBOARD MAPPING ---
        if (playerId === 1) {
            if (this.keys['w']) input.y = -1;
            if (this.keys['s']) input.y = 1;
            if (this.keys['a']) input.x = -1;
            if (this.keys['d']) input.x = 1;
            if (this.keys[' ']) input.item = true; // Space for Item
            if (this.keys['e']) input.attack = true;
            if (this.keys['q']) input.switchItem = true;
            if (this.keys['shift']) input.dash = true;

            // Block is Down + Ground (Handled in Player, here we just pass Y direction)
            // But we can also map a dedicated block button if we want
            if (this.keys['s']) input.block = true;

            // Jump mapping (W is already Y=-1, but let's separate 'jump' intention)
            if (this.keys['w']) input.jump = true;

        } else if (playerId === 2) {
            if (this.keys['arrowup']) input.y = -1;
            if (this.keys['arrowdown']) input.y = 1;
            if (this.keys['arrowleft']) input.x = -1;
            if (this.keys['arrowright']) input.x = 1;
            if (this.keys['enter']) input.item = true;
            if (this.keys['l']) input.attack = true;
            if (this.keys['k']) input.switchItem = true;
            if (this.keys['control']) input.dash = true;
            if (this.keys['arrowdown']) input.block = true;
            if (this.keys['arrowup']) input.jump = true;
        }

        // --- GAMEPAD MAPPING ---
        // Player 1 gets Gamepad 0, Player 2 gets Gamepad 1 (Logic can be adjusted)
        const gpIndex = playerId - 1;
        const gp = navigator.getGamepads ? navigator.getGamepads()[gpIndex] : null;

        if (gp) {
            // Deadzone
            const deadzone = 0.2;

            // Left Stick
            if (Math.abs(gp.axes[0]) > deadzone) input.x = gp.axes[0];
            if (Math.abs(gp.axes[1]) > deadzone) input.y = gp.axes[1];

            // D-Pad (Standard Mapping usually 12, 13, 14, 15)
            if (gp.buttons[12].pressed) input.y = -1; // Up
            if (gp.buttons[13].pressed) input.y = 1;  // Down
            if (gp.buttons[14].pressed) input.x = -1; // Left
            if (gp.buttons[15].pressed) input.x = 1;  // Right

            // Buttons (Standard: 0=A/X, 1=B/Circle, 2=X/Square, 3=Y/Triangle)
            if (gp.buttons[0].pressed) input.jump = true; // A / Cross -> Jump
            if (gp.buttons[2].pressed) input.attack = true; // X / Square -> Attack
            if (gp.buttons[3].pressed) input.item = true;   // Y / Triangle -> Use Item
            if (gp.buttons[1].pressed) input.switchItem = true; // B / Circle -> Switch Item

            // Triggers/Shoulders
            if (gp.buttons[5].pressed || gp.buttons[7].pressed) input.dash = true; // R1/R2 -> Dash
            if (gp.buttons[4].pressed || gp.buttons[6].pressed || input.y > 0.5) input.block = true; // L1/L2 or Down -> Block

            // Override jump if mapped to stick up (optional, sticking to buttons is better for pro play)
        }

        return input;
    }
}
