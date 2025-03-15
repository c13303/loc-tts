/**
 * Utility functions for the Audio Processor
 */

/**
 * Display status messages
 * @param {string} message - The message to display
 * @param {string} type - The type of message (success, error, warning, info)
 */
function showStatus(message, type) {
    const statusEl = $('#status');
    statusEl.text(message)
        .attr('class', type)
        .css('display', 'block');

    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            statusEl.fadeOut(500);
        }, 5000);
    }
}

/**
 * Create a distortion curve
 * @param {number} amount - The amount of distortion
 * @returns {Float32Array} The distortion curve
 */
function makeDistortionCurve(amount) {
    const k = amount * 100;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);

    for (let i = 0; i < n_samples; i++) {
        const x = i * 2 / n_samples - 1;
        curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
    }

    return curve;
}

/**
 * Create an impulse response for reverb
 * @param {AudioContext} context - The audio context
 * @param {number} duration - The duration of the impulse
 * @returns {AudioBuffer} The impulse response buffer
 */
function createReverbImpulse(context, duration) {
    const sampleRate = context.sampleRate;
    const length = sampleRate * duration;
    const impulse = context.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = i / length;
        left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, 2);
        right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, 2);
    }

    return impulse;
}