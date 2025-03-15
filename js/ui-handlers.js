/**
 * UI event handlers and updates
 */

/**
 * Set up all event handlers
 * @param {Object} processor - The AudioProcessor instance
 */
function setupEventHandlers(processor) {
    // Initialize slider value displays
    initSliderValueDisplays();
    
    // Set up all the effect control event handlers
    setupEffectControlHandlers(processor);
    
    // Set up mode selection
    setupModeSelection(processor);
    
    // Set up button handlers
    setupButtonHandlers(processor);
    
    // Set up specific handlers for speed controls
    setupSpeedEventHandlers(processor);
    
    // Set up context menu tip
    setupContextMenuTip();
}

/**
 * Initialize the display values for sliders
 */
function initSliderValueDisplays() {
    $('.effect-slider').each(function () {
        const valueDisplay = $(`#${this.id}-value`);
        if (valueDisplay.length) {
            valueDisplay.text(this.value);
        }

        // Update delay slider range for more granularity between 0.01 and 0.5s
        if (this.id === 'delay-time') {
            $(this).attr('min', '0.01');
            $(this).attr('max', '0.5');
            $(this).attr('step', '0.01');
        }
    });
}

/**
 * Set up event handlers for effect controls
 * @param {Object} processor - The AudioProcessor instance
 */
function setupEffectControlHandlers(processor) {
    // Slider input handler
    $('.effect-slider').on('input', (e) => {
        const valueDisplay = $(`#${e.target.id}-value`);
        if (valueDisplay.length) {
            valueDisplay.text(e.target.value);
        }

        // Handle playback speed changes immediately
        if (e.target.id === 'playback-speed') {
            updatePlaybackSpeed(processor);
        }

        if (processor.effectsMode === 'realtime') {
            updateEffectParameters(processor);
        }
    });

    // Effect toggle handler
    $('.effect-checkbox').on('change', (e) => {
        // Handle speed toggle changes immediately
        if (e.target.id === 'speed-toggle') {
            updatePlaybackSpeed(processor);
        }

        if (processor.effectsMode === 'realtime' && processor.context) {
            connectAudioNodes(processor);
        }
    });

    // LFO target change
    $('#lfo-target').on('change', () => {
        if (processor.effectsMode === 'realtime' && processor.context && $('#lfo-toggle').prop('checked')) {
            connectAudioNodes(processor);
        }
    });

    // Audio loop checkbox
    $('#loop-audio').on('change', (e) => {
        if (processor.audioEl) {
            processor.audioEl.loop = e.target.checked;
        }
    });
}

/**
 * Set up mode selection handlers
 * @param {Object} processor - The AudioProcessor instance
 */
function setupModeSelection(processor) {
    $('.mode-option').on('click', (e) => {
        $('.mode-option').removeClass('mode-active');
        $(e.target).addClass('mode-active');
        processor.effectsMode = $(e.target).data('mode');
        
        console.log(`Mode changed to: ${processor.effectsMode}`);
    });
}

/**
 * Set up button handlers
 * @param {Object} processor - The AudioProcessor instance
 */
function setupButtonHandlers(processor) {
    // Synthesize button
    $('#synthesize').on('click', () => synthesizeAudio(processor));

    // Save preset
    $('#save-preset').on('click', () => showPresetModal(processor));

    // Refresh presets
    $('#refresh-presets').on('click', () => {
        console.log("Refreshing presets...");
        loadPresetsFromServer(processor);
    });
}

/**
 * Set up context menu tip
 */
function setupContextMenuTip() {
    const contextTip = $('.context-tip');
    $(document).on('mousemove', (e) => {
        if ($(e.target).hasClass('preset-button') && !$(e.target).hasClass('add-preset')) {
            contextTip.css({
                display: 'block',
                left: `${e.pageX + 10}px`,
                top: `${e.pageY + 10}px`
            });
        } else {
            contextTip.css('display', 'none');
        }
    });
}