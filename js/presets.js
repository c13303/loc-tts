/**
 * Preset management functionality
 */

/**
 * Load initial presets (from local and server)
 */
function loadInitialPresets() {
    const defaultPresets = {
        none: {
            delay: { toggle: false },
            filter: { toggle: false },
            lfo: { toggle: false },
            distortion: { toggle: false },
            reverb: { toggle: false },
            speed: { toggle: false, value: 1.0 }
        }
    };

    // First try to load presets from JSON file
    $.getJSON('presets.json', (data) => {
        console.log("Local presets loaded from JSON:", data);

        // Make sure we have a 'none' preset
        if (!data.none) {
            data.none = defaultPresets.none;
        }

        // Update AudioProcessor presets
        AudioProcessor.presets = data;

        // Update UI with presets from JSON
        updatePresetButtons(AudioProcessor, data);

        // Now try to load from server with a slight delay
        setTimeout(() => {
            console.log("Loading presets from server (after JSON load)");
            loadPresetsFromServer(AudioProcessor).then(presets => {
                console.log("Server presets loaded successfully:", presets);
                updatePresetButtons(AudioProcessor, presets);
            }).catch(err => {
                console.error("Failed to load server presets:", err);
            });
        }, 500);

    }).fail((jqxhr, textStatus, error) => {
        console.warn('Error loading presets.json:', textStatus, error);
        showStatus('Failed to load local presets. Using defaults.', 'warning');

        // Try to load from server right away since JSON failed
        console.log("Loading presets from server (JSON failed)");
        loadPresetsFromServer(AudioProcessor).then(presets => {
            console.log("Server presets loaded successfully:", presets);
            updatePresetButtons(AudioProcessor, presets);
        }).catch(err => {
            console.error("Failed to load server presets:", err);
        });
    });
}

/**
 * Load presets from server
 * @param {Object} processor - The AudioProcessor instance
 * @returns {Promise<Object>} The loaded presets
 */
async function loadPresetsFromServer(processor) {
    try {
        console.log("Loading presets from server...");
        // First, ensure we have default presets as a fallback
        if (!processor.presets) {
            processor.presets = {
                none: {
                    delay: { toggle: false },
                    filter: { toggle: false },
                    lfo: { toggle: false },
                    distortion: { toggle: false },
                    reverb: { toggle: false },
                    speed: { toggle: false, value: 1.0 }
                }
            };
        }

        // Try to load from server
        let serverPresetsLoaded = false;
        try {
            const response = await fetch(`${Config.SERVER_URL}/presets`);
            if (response.ok) {
                const serverPresets = await response.json();
                console.log("Server presets loaded:", serverPresets);

                // Merge with existing presets, prioritizing server ones
                processor.presets = {
                    ...processor.presets,
                    ...serverPresets
                };

                serverPresetsLoaded = true;
            } else {
                console.warn('Server returned error when loading presets:', response.status);
            }
        } catch (fetchError) {
            console.warn('Unable to load presets from server:', fetchError);
        }

        // If server presets failed, try to load local presets if not already loaded
        if (!serverPresetsLoaded && !processor.localPresetsLoaded) {
            try {
                console.log('Attempting to load local presets...');
                await new Promise((resolve, reject) => {
                    $.getJSON('presets.json', (data) => {
                        console.log("Local presets loaded:", data);
                        // Merge with existing presets
                        processor.presets = {
                            ...processor.presets,
                            ...data
                        };
                        processor.localPresetsLoaded = true;
                        resolve();
                    }).fail((jqxhr, textStatus, error) => {
                        console.warn('Error loading local presets.json:', textStatus, error);
                        reject(error);
                    });
                });
            } catch (localError) {
                console.warn('Unable to load local presets:', localError);
            }
        }

        // Make sure we have a 'none' preset
        if (!processor.presets.none) {
            console.log("Adding 'none' preset as it wasn't found");
            processor.presets.none = {
                delay: { toggle: false },
                filter: { toggle: false },
                lfo: { toggle: false },
                distortion: { toggle: false },
                reverb: { toggle: false },
                speed: { toggle: false, value: 1.0 }
            };
        }

        // Update UI with presets
        console.log("Updating UI with presets:", processor.presets);
        updatePresetButtons(processor, processor.presets);
        return processor.presets;
    } catch (error) {
        console.error('Error in loadPresetsFromServer:', error);
        showStatus(`Error loading presets: ${error.message}`, 'error');

        // Ensure we at least have a 'none' preset
        if (!processor.presets || !processor.presets.none) {
            processor.presets = {
                none: {
                    delay: { toggle: false },
                    filter: { toggle: false },
                    lfo: { toggle: false },
                    distortion: { toggle: false },
                    reverb: { toggle: false },
                    speed: { toggle: false, value: 1.0 }
                }
            };
            updatePresetButtons(processor, processor.presets);
        }

        return processor.presets;
    }
}

/**
 * Apply a preset to all controls
 * @param {Object} processor - The AudioProcessor instance
 * @param {string} presetName - The name of the preset to apply
 */
function applyPreset(processor, presetName) {
    const preset = processor.presets[presetName];
    if (!preset) {
        console.error(`Preset '${presetName}' not found`);
        return;
    }

    console.log(`Applying preset '${presetName}'`, preset);

    // Mark selected in UI
    $('.preset-button').removeClass('selected');
    $(`.preset-button[data-preset="${presetName}"]`).addClass('selected');

    // Apply values to controls
    Object.keys(preset).forEach(effect => {
        // Handle playback speed specially
        if (effect === 'speed') {
            applySpeedPreset(processor, preset[effect]);
            return;
        }

        // Handle other effects
        switch (effect) {
            case 'delay':
                applyDelayPreset(processor, preset[effect]);
                break;
            case 'filter':
                applyFilterPreset(processor, preset[effect]);
                break;
            case 'lfo':
                applyLFOPreset(processor, preset[effect]);
                break;
            case 'distortion':
                applyDistortionPreset(processor, preset[effect]);
                break;
            case 'reverb':
                applyReverbPreset(processor, preset[effect]);
                break;
        }
    });

    // Update effects in realtime
    if (processor.effectsMode === 'realtime' && processor.context) {
        updateEffectParameters(processor);
        connectAudioNodes(processor);
    }
    updatePlaybackSpeed(processor);
}

/**
 * Get current preset data from UI
 * @param {Object} processor - The AudioProcessor instance
 * @returns {Object} The current preset data
 */
function getCurrentPresetData(processor) {
    const presetData = {};
    const effectGroups = ['delay', 'filter', 'lfo', 'distortion', 'reverb', 'speed'];

    effectGroups.forEach(effect => {
        // Handle playback speed specially
        if (effect === 'speed') {
            const speedToggle = $('#speed-toggle');
            const speedSlider = $('#playback-speed');

            if (speedToggle.length && speedSlider.length) {
                presetData[effect] = {
                    toggle: speedToggle.prop('checked'),
                    value: parseFloat(speedSlider.val())
                };
            }
            return;
        }

        // Handle other effects
        const toggleEl = $(`#${effect}-toggle`);
        if (!toggleEl.length) return;

        presetData[effect] = {
            toggle: toggleEl.prop('checked')
        };

        // Collect parameters
        $(`#${effect}-group .effect-slider, #${effect}-group .effect-select`).each(function () {
            const paramName = this.id.split('-').pop();
            presetData[effect][paramName] = this.type === 'range' ? parseFloat(this.value) : this.value;
        });
    });

    return presetData;
}

/**
 * Update preset buttons in UI
 * @param {Object} processor - The AudioProcessor instance
 * @param {Object} presets - The presets data
 */
function updatePresetButtons(processor, presets) {
    console.log("updatePresetButtons called with:", presets);

    // Make sure we have presets to work with
    if (!presets || Object.keys(presets).length === 0) {
        console.warn("No presets available to update buttons");
        presets = {
            none: {
                delay: { toggle: false },
                filter: { toggle: false },
                lfo: { toggle: false },
                distortion: { toggle: false },
                reverb: { toggle: false },
                speed: { toggle: false, value: 1.0 }
            }
        };
    }

    // Store presets locally
    processor.presets = presets;

    // Find the presets container
    const presetsContainer = $('.presets');
    if (presetsContainer.length === 0) {
        console.error("Presets container element not found!");
        return;
    }

    // Remove old preset buttons
    presetsContainer.empty();

    // Add "No effects" preset first
    const noneButton = $('<button>')
        .addClass('preset-button')
        .attr('data-preset', 'none')
        .text('Aucun effet')
        .on('click', () => applyPreset(processor, 'none'));

    presetsContainer.append(noneButton);

    // Add buttons for all presets
    let presetCount = 0;
    Object.keys(presets).forEach(presetName => {
        if (presetName === 'none') return;

        const button = $('<button>')
            .addClass('preset-button')
            .attr('data-preset', presetName)
            .text(presetName);

        // Context menu for deletion
        button.on('contextmenu', (e) => {
            e.preventDefault();
            if (confirm(`Voulez-vous supprimer le preset "${presetName}" ?`)) {
                deletePresetFromServer(processor, presetName);
            }
        });

        button.on('click', () => {
            console.log(`Clicked preset: ${presetName}`);
            applyPreset(processor, presetName);
        });

        presetsContainer.append(button);
        presetCount++;
    });

    console.log(`Added ${presetCount} preset buttons`);

    // Add button to create new preset
    const addButton = $('<button>')
        .addClass('preset-button add-preset')
        .html('+ Ajouter')
        .on('click', () => showPresetModal(processor));

    presetsContainer.append(addButton);
}

/**
 * Show preset save modal
 * @param {Object} processor - The AudioProcessor instance
 */
function showPresetModal(processor) {
    const modal = $('#preset-modal');
    const nameInput = $('#preset-name');

    // Reset input
    nameInput.val('');

    // Show modal
    modal.css('display', 'flex');

    // Focus on input
    nameInput.focus();

    // Set up buttons
    $('#confirm-save').off('click').on('click', () => {
        const name = nameInput.val().trim();
        if (name) {
            const presetData = getCurrentPresetData(processor);
            savePresetToServer(processor, name, presetData);
            modal.css('display', 'none');
        } else {
            alert('Veuillez entrer un nom pour le preset.');
        }
    });

    $('#cancel-save').off('click').on('click', () => {
        modal.css('display', 'none');
    });

    // Close when clicking outside
    modal.off('click').on('click', (e) => {
        if (e.target === modal[0]) {
            modal.css('display', 'none');
        }
    });

    // Close when pressing Escape
    $(document).off('keydown.presetModal').on('keydown.presetModal', (e) => {
        if (e.key === 'Escape') {
            modal.css('display', 'none');
            $(document).off('keydown.presetModal');
        }
    });
}

/**
 * Save preset to server
 * @param {Object} processor - The AudioProcessor instance
 * @param {string} name - The preset name
 * @param {Object} presetData - The preset data
 * @returns {Promise} A promise for the save operation
 */
async function savePresetToServer(processor, name, presetData) {
    try {
        const response = await fetch(`${Config.SERVER_URL}/presets/${name}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(presetData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP Error ${response.status}`);
        }

        const result = await response.json();
        showStatus(result.message, 'success');

        // Reload presets
        loadPresetsFromServer(processor);

        return result;
    } catch (error) {
        console.error('Error saving preset:', error);
        showStatus(`Error saving: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Delete preset from server
 * @param {Object} processor - The AudioProcessor instance
 * @param {string} name - The preset name to delete
 * @returns {Promise} A promise for the delete operation
 */
async function deletePresetFromServer(processor, name) {
    try {
        const response = await fetch(`${Config.SERVER_URL}/presets/${name}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP Error ${response.status}`);
        }

        const result = await response.json();
        showStatus(result.message, 'success');

        // Delete from local presets immediately
        if (processor.presets[name]) {
            delete processor.presets[name];
            updatePresetButtons(processor, processor.presets);
        }

        // Also reload presets from server
        loadPresetsFromServer(processor);

        return result;
    } catch (error) {
        console.error('Error deleting preset:', error);
        showStatus(`Error deleting: ${error.message}`, 'error');
        return null;
    }
}