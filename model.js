/**
 * Teachable Machine Model Manager for "Fist Fight"
 * Built on @tensorflow/tfjs and @teachablemachine/image.
 *
 * Implements the user's core model & webcam setup logic with
 * robust enhancements: cloud URL loading, local file uploads,
 * auto-mapping of gesture classes, confidence thresholds, and cooldowns.
 */

class TeachableMachineManager {
    constructor() {
        this.model = null;
        this.webcam = null;
        this.maxPredictions = 0;
        this.isRunning = false;
        this.animFrameId = null;

        // Default local path as in user's code
        this.baseURL = "./my_model/";

        // Action mappings: maps class index or name to 'PUNCH' | 'BLOCK' | 'IDLE'
        this.mappings = {}; 
        this.classNames = [];

        // Thresholds and timing
        this.confidenceThreshold = 0.70;
        this.lastAction = 'IDLE';
        this.lastPunchTime = 0;
        this.punchCooldownMs = 380; // Minimum delay between consecutive punch triggers

        // Callbacks
        this.onActionCallback = null;
        this.onPredictionsUpdate = null;
        this.onStatusChange = null;
    }

    setStatus(status, isError = false) {
        if (this.onStatusChange) {
            this.onStatusChange(status, isError);
        }
        console.log(`[TM Manager] ${status}`);
    }

    /**
     * Load model from a URL path (local or cloud)
     * e.g. "./my_model/" or "https://teachablemachine.withgoogle.com/models/XYZ/"
     */
    async loadFromURL(url = this.baseURL) {
        try {
            this.setStatus("Loading Teachable Machine model...");
            // Ensure trailing slash
            const formattedURL = url.endsWith('/') ? url : url + '/';
            const modelURL = formattedURL + "model.json";
            const metadataURL = formattedURL + "metadata.json";

            // As requested in user's code:
            this.model = await tmImage.load(modelURL, metadataURL);
            this.maxPredictions = this.model.getTotalClasses();
            this.classNames = this.model.getClassLabels();
            this.autoConfigureMappings();

            this.setStatus(`Model loaded successfully! Found ${this.maxPredictions} classes.`);
            return true;
        } catch (err) {
            console.error("Error loading model from URL:", err);
            this.setStatus(`Failed to load model from "${url}": ${err.message}`, true);
            return false;
        }
    }

    /**
     * Load model directly from user-selected files (model.json, weights.bin, metadata.json)
     */
    async loadFromFiles(modelFile, weightsFile, metadataFile) {
        try {
            this.setStatus("Loading model from uploaded files...");
            this.model = await tmImage.loadFromFiles(modelFile, weightsFile, metadataFile);
            this.maxPredictions = this.model.getTotalClasses();
            this.classNames = this.model.getClassLabels();
            this.autoConfigureMappings();

            this.setStatus(`Uploaded model loaded successfully! (${this.maxPredictions} classes)`);
            return true;
        } catch (err) {
            console.error("Error loading model from files:", err);
            this.setStatus(`Failed to load uploaded files: ${err.message}`, true);
            return false;
        }
    }

    /**
     * Auto-detect and configure class actions based on label names
     */
    autoConfigureMappings() {
        this.mappings = {};
        this.classNames.forEach((name, idx) => {
            const lower = name.toLowerCase();
            if (lower.includes('punch') || lower.includes('fist') || lower.includes('attack') || lower.includes('hit')) {
                this.mappings[idx] = 'PUNCH';
            } else if (lower.includes('block') || lower.includes('palm') || lower.includes('open') || lower.includes('shield') || lower.includes('guard')) {
                this.mappings[idx] = 'BLOCK';
            } else {
                // Default fallback based on index if generic names (e.g. Class 1, Class 2, Class 3)
                if (idx === 0) this.mappings[idx] = 'PUNCH';
                else if (idx === 1) this.mappings[idx] = 'BLOCK';
                else this.mappings[idx] = 'IDLE';
            }
        });
    }

    /**
     * Set explicit mapping for class index
     */
    setMapping(classIndex, action) {
        this.mappings[classIndex] = action;
    }

    /**
     * Initialize webcam (as in user's code)
     */
    async setupWebcam(width = 220, height = 220, flip = true) {
        try {
            this.setStatus("Requesting camera access...");
            this.webcam = new tmImage.Webcam(width, height, flip);
            await this.webcam.setup(); // request access to the webcam
            await this.webcam.play();
            this.setStatus("Camera active!");
            return this.webcam.canvas;
        } catch (err) {
            console.error("Webcam setup error:", err);
            this.setStatus(`Camera access failed: ${err.message}. Check browser permissions!`, true);
            throw err;
        }
    }

    /**
     * Start the prediction loop
     */
    startLoop() {
        if (this.isRunning) return;
        this.isRunning = true;

        const loop = async () => {
            if (!this.isRunning) return;
            if (this.webcam) {
                this.webcam.update(); // update webcam frame
                await this.predict();
            }
            this.animFrameId = window.requestAnimationFrame(loop);
        };

        this.animFrameId = window.requestAnimationFrame(loop);
    }

    /**
     * Stop the prediction loop
     */
    stopLoop() {
        this.isRunning = false;
        if (this.animFrameId) {
            window.cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }
        if (this.webcam) {
            try {
                this.webcam.stop();
            } catch (e) {}
        }
    }

    /**
     * Run webcam image through the model and evaluate actions
     */
    async predict() {
        if (!this.model || !this.webcam) return;

        // Predict can take in an image, video or canvas html element
        const predictions = await this.model.predict(this.webcam.canvas);

        // Find highest confidence prediction
        let topPrediction = predictions[0];
        let topIndex = 0;
        for (let i = 1; i < predictions.length; i++) {
            if (predictions[i].probability > topPrediction.probability) {
                topPrediction = predictions[i];
                topIndex = i;
            }
        }

        // Notify UI prediction bars
        if (this.onPredictionsUpdate) {
            this.onPredictionsUpdate(predictions, topIndex);
        }

        // Action detection logic
        const now = performance.now();
        if (topPrediction.probability >= this.confidenceThreshold) {
            const mappedAction = this.mappings[topIndex] || 'IDLE';

            if (mappedAction === 'PUNCH') {
                if (now - this.lastPunchTime >= this.punchCooldownMs) {
                    this.lastPunchTime = now;
                    this.lastAction = 'PUNCH';
                    if (this.onActionCallback) {
                        this.onActionCallback('PUNCH', topPrediction.probability, topPrediction.className);
                    }
                }
            } else if (mappedAction === 'BLOCK') {
                this.lastAction = 'BLOCK';
                if (this.onActionCallback) {
                    this.onActionCallback('BLOCK', topPrediction.probability, topPrediction.className);
                }
            } else {
                // IDLE
                if (this.lastAction !== 'IDLE') {
                    this.lastAction = 'IDLE';
                    if (this.onActionCallback) {
                        this.onActionCallback('IDLE', topPrediction.probability, topPrediction.className);
                    }
                }
            }
        } else {
            // Below threshold -> IDLE
            if (this.lastAction !== 'IDLE') {
                this.lastAction = 'IDLE';
                if (this.onActionCallback) {
                    this.onActionCallback('IDLE', 0, 'None');
                }
            }
        }
    }
}

window.tmManager = new TeachableMachineManager();
