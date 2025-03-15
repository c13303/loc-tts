/**
 * Core AudioProcessor object
 * Acts as a facade that coordinates between all the specialized files
 */

// AudioProcessor object definition
const AudioProcessor = {
    // Audio variables
    context: null,
    source: null,
    audioEl: null,
    analyser: null,
    canvasCtx: null,
    isPlaying: false,

    // Effects mode
    effectsMode: Config.DEFAULT_EFFECTS_MODE,

    // Presets data
    presets: null,
    localPresetsLoaded: false,

    // Initialization function
    init: function () {
        // Initialize presets with default
        this.presets = {
            none: {
                delay: { toggle: false },
                filter: { toggle: false },
                lfo: { toggle: false },
                distortion: { toggle: false },
                reverb: { toggle: false },
                speed: { toggle: false, value: 1.0 }
            }
        };

        // Set up UI event handlers
        setupEventHandlers(this);

        // Load voices
        loadAvailableVoices();

        // Apply default preset
        updatePresetButtons(this, this.presets);
        applyPreset(this, Config.DEFAULT_PRESET);

        // Load presets
        loadPresetsFromServer(this);
    },

    // Audio context initialization
    initAudioContext: function() {
        return initAudioContext(this);
    },

    // Event handling methods
    updateEffectParameters: function() {
        updateEffectParameters(this);
    },

    connectAudioNodes: function() {
        connectAudioNodes(this);
    },

    drawVisualizer: function() {
        drawVisualizer(this);
    },

    // Synthesis methods
    synthesizeAudio: function() {
        synthesizeAudio(this);
    },

    // Preset methods
    loadPresetsFromServer: function() {
        return loadPresetsFromServer(this);
    },

    applyPreset: function(presetName) {
        applyPreset(this, presetName);
    },

    updatePresetButtons: function(presets) {
        updatePresetButtons(this, presets);
    },

    savePresetToServer: function(name, presetData) {
        return savePresetToServer(this, name, presetData);
    },

    deletePresetFromServer: function(name) {
        return deletePresetFromServer(this, name);
    },

    showPresetModal: function() {
        showPresetModal(this);
    },

    // Utility methods
    showStatus: function(message, type) {
        showStatus(message, type);
    }
};