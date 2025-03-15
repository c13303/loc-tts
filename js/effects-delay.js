/**
 * Delay effect implementation
 */

/**
 * Create delay nodes for the audio processor
 * @param {Object} processor - The AudioProcessor instance
 */
function createDelayNodes(processor) {
    // Delay node with feedback
    processor.delayNode = processor.context.createDelay(5.0);
    processor.delayFeedback = processor.context.createGain();
    processor.delayNode.delayTime.value = 0.3;
    processor.delayFeedback.gain.value = 0.5;
    processor.delayNode.connect(processor.delayFeedback);
    processor.delayFeedback.connect(processor.delayNode);
}

/**
 * Update delay parameters
 * @param {Object} processor - The AudioProcessor instance
 */
function updateDelayParameters(processor) {
    if (!processor.delayNode || !processor.delayFeedback) return;
    
    processor.delayNode.delayTime.value = parseFloat($('#delay-time').val());
    processor.delayFeedback.gain.value = parseFloat($('#delay-feedback').val());
}

/**
 * Apply delay settings from a preset
 * @param {Object} processor - The AudioProcessor instance
 * @param {Object} delaySettings - The delay settings from the preset
 */
function applyDelayPreset(processor, delaySettings) {
    const delayToggle = $('#delay-toggle');
    if (delayToggle.length) {
        delayToggle.prop('checked', delaySettings.toggle);
    }

    // Apply parameter values
    Object.keys(delaySettings).forEach(param => {
        if (param !== 'toggle') {
            const control = $(`#delay-${param}`);
            const valueDisplay = $(`#delay-${param}-value`);

            if (control.length) {
                control.val(delaySettings[param]);
                if (valueDisplay.length && control.attr('type') === 'range') {
                    valueDisplay.text(delaySettings[param]);
                }
            }
        }
    });

    updateDelayParameters(processor);
}