/**
 * Playback speed implementation with pitch control option
 */

/**
 * Update playback speed in real-time
 * @param {Object} processor - The AudioProcessor instance
 */
function updatePlaybackSpeed(processor) {
    if (!processor.audioEl) {
        console.log("No audio element found for playback speed update");
        return;
    }

    const speedToggle = $('#speed-toggle');
    const speedSlider = $('#playback-speed');
    const preservePitchToggle = $('#preserve-pitch-toggle');

    if (speedToggle.prop('checked') && speedSlider.length) {
        const newRate = parseFloat(speedSlider.val());
        console.log("Setting playback rate to:", newRate);
        
        // Apply the playback rate
        processor.audioEl.playbackRate = newRate;
        
        // Set preservesPitch based on checkbox
        // When unchecked, we DON'T preserve pitch (old-school effect)
        processor.audioEl.preservesPitch = preservePitchToggle.prop('checked');
        console.log("Preserve pitch:", processor.audioEl.preservesPitch);
    } else {
        console.log("Speed toggle not checked, setting playback rate to 1.0");
        processor.audioEl.playbackRate = 1.0;
        // Default modern behavior is to preserve pitch
        processor.audioEl.preservesPitch = true;
    }
}

/**
 * Apply the playback speed when audio is loaded
 * @param {Object} processor - The AudioProcessor instance
 * @param {HTMLAudioElement} audioElement - The audio element
 */
function initPlaybackSpeed(processor, audioElement) {
    audioElement.addEventListener('loadedmetadata', () => {
        console.log("Audio loaded, initializing playback speed");
        
        // Set default for preservesPitch property
        audioElement.preservesPitch = $('#preserve-pitch-toggle').prop('checked');
        
        updatePlaybackSpeed(processor);
    });
}

/**
 * Setup event handlers for playback speed controls
 * @param {Object} processor - The AudioProcessor instance
 */
function setupSpeedEventHandlers(processor) {
    // Speed toggle change handler
    $('#speed-toggle').on('change', (e) => {
        console.log("Speed toggle changed:", e.target.checked);
        updatePlaybackSpeed(processor);
    });

    // Speed slider change handler
    $('#playback-speed').on('input', (e) => {
        console.log("Playback speed slider changed:", e.target.value);
        const valueDisplay = $('#playback-speed-value');
        if (valueDisplay.length) {
            valueDisplay.text(e.target.value);
        }
        updatePlaybackSpeed(processor);
    });
    
    // Preserve pitch toggle handler
    $('#preserve-pitch-toggle').on('change', (e) => {
        console.log("Preserve pitch toggle changed:", e.target.checked);
        updatePlaybackSpeed(processor);
    });
}

/**
 * Apply the playback speed settings from a preset
 * @param {Object} processor - The AudioProcessor instance
 * @param {Object} speedSettings - The speed settings from the preset
 */
function applySpeedPreset(processor, speedSettings) {
    const speedToggle = $('#speed-toggle');
    if (speedToggle.length) {
        speedToggle.prop('checked', speedSettings.toggle);
    }

    const speedSlider = $('#playback-speed');
    const valueDisplay = $('#playback-speed-value');

    if (speedSlider.length && speedSettings.value !== undefined) {
        speedSlider.val(speedSettings.value);

        if (valueDisplay.length) {
            valueDisplay.text(speedSettings.value);
        }
    }
    
    // Apply preserve pitch setting if included in preset
    if (speedSettings.preservePitch !== undefined) {
        const preservePitchToggle = $('#preserve-pitch-toggle');
        if (preservePitchToggle.length) {
            preservePitchToggle.prop('checked', speedSettings.preservePitch);
        }
    }

    updatePlaybackSpeed(processor);
}