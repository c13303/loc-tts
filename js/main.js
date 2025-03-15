/**
 * Main entry point for the Audio Processor application
 */

$(document).ready(function () {
    console.log("Document ready - initializing AudioProcessor");

    // Initialize AudioProcessor
    AudioProcessor.init();

    // Load initial presets
    loadInitialPresets();

    // Add refresh presets button handler
    $('#refresh-presets').off('click').on('click', function () {
        console.log("Refresh presets button clicked");
        AudioProcessor.loadPresetsFromServer().then(presets => {
            console.log("Presets refreshed successfully:", presets);
            AudioProcessor.updatePresetButtons(presets);
        }).catch(err => {
            console.error("Failed to refresh presets:", err);
        });
    });
    
    // Add debug information
    console.log("AudioProcessor initialization complete");
    console.log("Current effect mode:", AudioProcessor.effectsMode);
});