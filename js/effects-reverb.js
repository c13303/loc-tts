/**
 * Reverb effect implementation
 */

/**
 * Create reverb nodes for the audio processor
 * @param {Object} processor - The AudioProcessor instance
 */
function createReverbNodes(processor) {
    // Create convolver for reverb
    processor.convolverNode = processor.context.createConvolver();
    
    // Create reverb impulse
    const impulse = createReverbImpulse(processor.context, 2.0);
    processor.convolverNode.buffer = impulse;

    // Create dry/wet gain nodes
    processor.dryGainNode = processor.context.createGain();
    processor.wetGainNode = processor.context.createGain();
    processor.dryGainNode.gain.value = 0.7;
    processor.wetGainNode.gain.value = 0.3;
}

/**
 * Update reverb parameters
 * @param {Object} processor - The AudioProcessor instance
 */
function updateReverbParameters(processor) {
    if (!processor.convolverNode || !processor.dryGainNode || !processor.wetGainNode) return;
    
    // Update decay time by creating a new impulse
    const decayTime = parseFloat($('#reverb-decay').val());
    const impulse = createReverbImpulse(processor.context, decayTime);
    processor.convolverNode.buffer = impulse;
    
    // Update dry/wet mix
    const mixLevel = parseFloat($('#reverb-mix').val());
    processor.dryGainNode.gain.value = 1 - mixLevel;
    processor.wetGainNode.gain.value = mixLevel;
}

/**
 * Apply reverb settings from a preset
 * @param {Object} processor - The AudioProcessor instance
 * @param {Object} reverbSettings - The reverb settings from the preset
 */
function applyReverbPreset(processor, reverbSettings) {
    const reverbToggle = $('#reverb-toggle');
    if (reverbToggle.length) {
        reverbToggle.prop('checked', reverbSettings.toggle);
    }

    // Apply parameter values
    Object.keys(reverbSettings).forEach(param => {
        if (param !== 'toggle') {
            const control = $(`#reverb-${param}`);
            const valueDisplay = $(`#reverb-${param}-value`);

            if (control.length) {
                control.val(reverbSettings[param]);
                if (valueDisplay.length && control.attr('type') === 'range') {
                    valueDisplay.text(reverbSettings[param]);
                }
            }
        }
    });

    updateReverbParameters(processor);
}