/**
 * Distortion effect implementation
 */

/**
 * Create distortion node for the audio processor
 * @param {Object} processor - The AudioProcessor instance
 */
function createDistortionNode(processor) {
    // Create distortion node
    processor.distortionNode = processor.context.createWaveShaper();
    processor.distortionNode.curve = makeDistortionCurve(0.2);
    
    // Initialize distortion LFO properties
    processor.distortionLFOActive = false;
    processor.distortionLFODepth = 0;
    processor.distortionLFOBaseAmount = 0;
    processor.distortionLFOAnimFrame = null;
}

/**
 * Update distortion parameters
 * @param {Object} processor - The AudioProcessor instance
 */
function updateDistortionParameters(processor) {
    if (!processor.distortionNode) return;
    
    const amount = parseFloat($('#distortion-amount').val());
    processor.distortionNode.curve = makeDistortionCurve(amount);
}

/**
 * Start distortion LFO
 * @param {Object} processor - The AudioProcessor instance
 * @param {number} depth - The LFO depth
 */
function startDistortionLFO(processor, depth) {
    processor.distortionLFOActive = true;
    processor.distortionLFODepth = depth;
    processor.distortionLFOBaseAmount = parseFloat($('#distortion-amount').val());

    // Start the LFO loop if not already running
    if (!processor.distortionLFOAnimFrame) {
        updateDistortionLFO(processor);
    }
}

/**
 * Stop distortion LFO
 * @param {Object} processor - The AudioProcessor instance
 */
function stopDistortionLFO(processor) {
    processor.distortionLFOActive = false;
    if (processor.distortionLFOAnimFrame) {
        cancelAnimationFrame(processor.distortionLFOAnimFrame);
        processor.distortionLFOAnimFrame = null;
    }
}

/**
 * Update distortion LFO
 * @param {Object} processor - The AudioProcessor instance
 */
function updateDistortionLFO(processor) {
    if (!processor.distortionLFOActive) return;

    const time = processor.context.currentTime;
    const lfoFreq = parseFloat($('#lfo-freq').val());
    const wave = $('#lfo-wave').val();

    // Calculate modulation based on wave type
    let mod;
    switch (wave) {
        case 'sine':
            mod = Math.sin(time * lfoFreq * Math.PI * 2) * 0.5 + 0.5;
            break;
        case 'square':
            mod = ((time * lfoFreq) % 1) < 0.5 ? 1 : 0;
            break;
        case 'sawtooth':
            mod = ((time * lfoFreq) % 1);
            break;
        case 'triangle':
            const phase = ((time * lfoFreq) % 1);
            mod = phase < 0.5 ? phase * 2 : 2 - phase * 2;
            break;
        default:
            mod = Math.sin(time * lfoFreq * Math.PI * 2) * 0.5 + 0.5;
    }

    // Apply modulation to distortion amount
    const baseAmount = processor.distortionLFOBaseAmount;
    const depth = processor.distortionLFODepth;
    const amount = baseAmount * (1 + mod * depth);

    // Update distortion curve
    processor.distortionNode.curve = makeDistortionCurve(amount);

    // Schedule next update
    processor.distortionLFOAnimFrame = requestAnimationFrame(() => updateDistortionLFO(processor));
}

/**
 * Apply distortion settings from a preset
 * @param {Object} processor - The AudioProcessor instance
 * @param {Object} distortionSettings - The distortion settings from the preset
 */
function applyDistortionPreset(processor, distortionSettings) {
    const distortionToggle = $('#distortion-toggle');
    if (distortionToggle.length) {
        distortionToggle.prop('checked', distortionSettings.toggle);
    }

    // Apply parameter values
    Object.keys(distortionSettings).forEach(param => {
        if (param !== 'toggle') {
            const control = $(`#distortion-${param}`);
            const valueDisplay = $(`#distortion-${param}-value`);

            if (control.length) {
                control.val(distortionSettings[param]);
                if (valueDisplay.length && control.attr('type') === 'range') {
                    valueDisplay.text(distortionSettings[param]);
                }
            }
        }
    });

    updateDistortionParameters(processor);
}