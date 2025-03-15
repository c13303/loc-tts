/**
 * Effects manager - coordinates all audio effects
 */

/**
 * Update all effect parameters from UI
 * @param {Object} processor - The AudioProcessor instance
 */
function updateEffectParameters(processor) {
    if (!processor.context) return;

    // Update delay parameters
    updateDelayParameters(processor);

    // Update filter parameters
    updateFilterParameters(processor);

    // Update LFO parameters
    updateLFOParameters(processor);

    // Update distortion parameters
    updateDistortionParameters(processor);

    // Update reverb parameters
    updateReverbParameters(processor);

    // Update speed
    updatePlaybackSpeed(processor);

    // Reconnect if playing
    if (processor.isPlaying) {
        connectAudioNodes(processor);
    }
}