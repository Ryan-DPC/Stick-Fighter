const fs = require('fs');
const { PNG } = require('pngjs');

// Config
const INPUT_PATH = "C:\\Users\\pa70iyc\\.gemini\\antigravity\\brain\\53aff8a9-64d9-45e9-8b85-fe94e9ce3cae\\medieval_knights_green_bg_1766054599638.png";
const OUTPUT_PATH = "c:\\Users\\pa70iyc\\Documents\\GitHub\\Stick-Fighter\\assets\\sprites.png";

fs.createReadStream(INPUT_PATH)
    .pipe(new PNG())
    .on('parsed', function () {
        // Loop through each pixel
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const idx = (this.width * y + x) << 2;

                const r = this.data[idx];
                const g = this.data[idx + 1];
                const b = this.data[idx + 2];

                // Green Screen Removal Logic (Bright Green)
                // If Green is dominant and bright
                if (g > 200 && r < 100 && b < 100) {
                    this.data[idx + 3] = 0; // Alpha = 0
                }

                // Finer tolerance for potential compression artifacts
                if (g > r + 50 && g > b + 50 && g > 100) {
                    this.data[idx + 3] = 0;
                }
            }
        }

        this.pack().pipe(fs.createWriteStream(OUTPUT_PATH));
        console.log('Processed sprites.png with transparency.');
    })
    .on('error', (err) => {
        console.error('Error processing PNG:', err);
    });
