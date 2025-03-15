/**
 * Filter effect implementation
 */

/**
 * Create filter node for the audio processor
 * @param {Object} processor - The AudioProcessor instance
 */
function createFilterNode(processor) {
    // Create biquad filter
    processor.biquadFilter = processor.context.createBiquadFilter();
    processor.biquadFilter.type = 'bandpass';
    processor.biquadFilter.frequency.value = 1000;
    processor.biquadFilter.Q.value = 5;
}

/**
 * Update filter parameters
 * @param {Object} processor - The AudioProcessor instance
 */
function updateFilterParameters(processor) {
    if (!processor.biquadFilter) return;
    
    processor.biquadFilter.frequency.value = parseFloat($('#filter-freq').val());
    processor.biquadFilter.Q.value = parseFloat($('#filter-q').val());
}

/**
 * Apply filter settings from a preset
 * @param {Object} processor - The AudioProcessor instance
 * @param {Object} filterSettings - The filter settings from the preset
 */
function applyFilterPreset(processor, filterSettings) {
    const filterToggle = $('#filter-toggle');
    if (filterToggle.length) {
        filterToggle.prop('checked', filterSettings.toggle);
    }

    // Apply parameter values
    Object.keys(filterSettings).forEach(param => {
        if (param !== 'toggle') {
            const control = $(`#filter-${param}`);
            const valueDisplay = $(`#filter-${param}-value`);

            if (control.length) {
                control.val(filterSettings[param]);
                if (valueDisplay.length && control.attr('type') === 'range') {
                    valueDisplay.text(filterSettings[param]);
                }
            }
        }
    });

    updateFilterParameters(processor);
}