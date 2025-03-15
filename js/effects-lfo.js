/**
 * LFO effect implementation
 */

/**
 * Create LFO nodes for the audio processor
 * @param {Object} processor - The AudioProcessor instance
 */
function createLFONodes(processor) {
    // Create LFO
    processor.lfoNode = processor.context.createOscillator();
    processor.lfoGainNode = processor.context.createGain();
    processor.lfoNode.frequency.value = 2;
    processor.lfoGainNode.gain.value = 0;
    processor.lfoNode.type = 'sine';
    processor.lfoNode.connect(processor.lfoGainNode);
    processor.lfoNode.start();
    
    // Initialize the LFO target reference
    processor.currentLfoTarget = null;
}

/**
 * Update LFO parameters
 * @param {Object} processor - The AudioProcessor instance
 */
function updateLFOParameters(processor) {
    if (!processor.lfoNode) return;
    
    processor.lfoNode.frequency.value = parseFloat($('#lfo-freq').val());
    processor.lfoNode.type = $('#lfo-wave').val();
}

/**
 * Apply LFO settings from a preset
 * @param {Object} processor - The AudioProcessor instance
 * @param {Object} lfoSettings - The LFO settings from the preset
 */
function applyLFOPreset(processor, lfoSettings) {
    const lfoToggle = $('#lfo-toggle');
    if (lfoToggle.length) {
        lfoToggle.prop('checked', lfoSettings.toggle);
    }

    // Apply parameter values
    Object.keys(lfoSettings).forEach(param => {
        if (param !== 'toggle') {
            const control = $(`#lfo-${param}`);
            const valueDisplay = $(`#lfo-${param}-value`);

            if (control.length) {
                control.val(lfoSettings[param]);
                if (valueDisplay.length && control.attr('type') === 'range') {
                    valueDisplay.text(lfoSettings[param]);
                }
            }
        }
    });

    updateLFOParameters(processor);
}