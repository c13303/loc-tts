/**
 * Text-to-speech synthesis functionality
 */

/**
 * Load available TTS voices from the server
 * @returns {Promise} A promise resolved when voices are loaded
 */
async function loadAvailableVoices() {
    try {
        console.log("Attempting to load voices from server...");
        const response = await fetch(`${Config.SERVER_URL}/voices`);

        if (response.ok) {
            const voiceData = await response.json();
            console.log("Voice data received:", voiceData);

            const voiceSelect = $('#voice');
            if (!voiceSelect.length) {
                console.error("Voice select element not found!");
                return;
            }

            // Clear existing options
            voiceSelect.empty();

            // Add each voice as an option
            Object.keys(voiceData).forEach(voiceKey => {
                const voice = voiceData[voiceKey];
                const option = $('<option>')
                    .val(voiceKey)
                    .text(voice.description);
                voiceSelect.append(option);
            });

            // Update note message
            const noteEl = $('.note');
            if (noteEl.length) {
                if (Object.keys(voiceData).length > 1) {
                    noteEl.html('<strong>Note:</strong> ' + Object.keys(voiceData).length + ' voices are available.');
                } else {
                    noteEl.html('<strong>Note:</strong> Only one voice is currently available.');
                }
            }
        } else {
            console.error('Failed to load voices - server returned:', response.status);
            // Fall back to default voice option
            showStatus('Could not load voices from server. Using default voice.', 'warning');
        }
    } catch (error) {
        console.error('Error loading voices:', error);
        showStatus('Error connecting to voice server.', 'error');
    }
}

/**
 * Synthesize audio from text input
 * @param {Object} processor - The AudioProcessor instance
 */
async function synthesizeAudio(processor) {
    const text = $('#text').val().trim();
    const voice = $('#voice').val();
    const spinner = $('#spinner');

    if (!text) {
        showStatus('Veuillez entrer du texte à synthétiser.', 'error');
        return;
    }

    showStatus('Synthèse en cours...', 'info');
    spinner.css('display', 'inline-block');

    try {
        const effects = getEffectsForServer(processor);

        const response = await fetch(`${Config.SERVER_URL}/synthesize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text, voice, effects }),
        });

        const data = await response.json();

        if (data.success) {
            const audioUrl = data.audioUrl;
            const audioElement = $('#audio')[0];

            // Update audio source
            audioElement.src = audioUrl;
            $('#audioControls').css('display', 'block');

            // Set loop state from checkbox
            const loopCheckbox = $('#loop-audio');
            audioElement.loop = loopCheckbox.prop('checked');

            // Initialize audio context for real-time effects
            if (processor.effectsMode === 'realtime') {
                initAudioContext(processor);
                updateEffectParameters(processor);
                
                // Apply playback speed immediately once audio is loaded
                initPlaybackSpeed(processor, audioElement);
            }

            // Set up download button
            $('#download').off('click').on('click', () => {
                const a = $('<a>')
                    .attr('href', audioUrl)
                    .attr('download', 'synthese_vocale.wav')
                    .appendTo('body');
                a[0].click();
                a.remove();
            });

            // Show status message
            let statusMessage = `Synthèse ${data.cached ? 'récupérée du cache' : 'générée'} avec succès !`;
            if (Object.keys(effects).length > 0) {
                statusMessage += ' (avec effets pré-traités)';
            } else if (processor.effectsMode === 'realtime') {
                statusMessage += ' (effets en temps réel activés)';
            }

            showStatus(statusMessage, 'success');
        } else {
            throw new Error(data.error || 'Erreur inconnue');
        }
    } catch (error) {
        console.error('Erreur:', error);
        showStatus(`Erreur: ${error.message}`, 'error');
    } finally {
        spinner.css('display', 'none');
    }
}

/**
 * Get effects configuration for server-side processing
 * @param {Object} processor - The AudioProcessor instance
 * @returns {Object} The effects configuration for the server
 */
function getEffectsForServer(processor) {
    if (processor.effectsMode === 'realtime') {
        return {}; // No server-side effects in realtime mode
    }

    const effects = {};

    // Flanger
    if ($('#filter-toggle').prop('checked') && $('#lfo-toggle').prop('checked') && $('#lfo-target').val() === 'filter-freq') {
        effects.flanger = {
            delay: 5,
            depth: Math.min(10, parseFloat($('#lfo-depth').val()) * 0.1)
        };
    }

    // Phaser
    if ($('#filter-toggle').prop('checked') && (!$('#lfo-toggle').prop('checked') || $('#lfo-target').val() !== 'filter-freq')) {
        effects.phaser = {
            inGain: 0.6,
            outGain: 0.7
        };
    }

    // Delay
    if ($('#delay-toggle').prop('checked')) {
        effects.delay = {
            time: parseFloat($('#delay-time').val()) * 1000,
            decay: parseFloat($('#delay-feedback').val())
        };
    }

    // Reverb
    if ($('#reverb-toggle').prop('checked')) {
        effects.reverb = {
            roomSize: parseFloat($('#reverb-decay').val()) * 50,
            decay: parseFloat($('#reverb-mix').val())
        };
    }

    return effects;
}