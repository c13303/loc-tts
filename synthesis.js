// Audio Processing Script - Optimized with jQuery
const AudioProcessor = {
    // Configuration
    SERVER_URL: '',

    // Audio variables
    context: null,
    source: null,
    audioEl: null,
    analyser: null,
    canvasCtx: null,
    isPlaying: false,

    // Effect nodes
    delayNode: null,
    delayFeedback: null,
    biquadFilter: null,
    distortionNode: null,
    convolverNode: null,
    dryGainNode: null,
    wetGainNode: null,

    // LFO
    lfoNode: null,
    lfoGainNode: null,
    currentLfoTarget: null,

    // Mode
    effectsMode: 'realtime',

    // Presets data
    presets: null,

    // Initialization
    init: function () {
        // Initialize the presets with at least the 'none' preset
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

        // Flag to track if local presets were already loaded
        this.localPresetsLoaded = false;

        // Load voices and presets
        this.loadAvailableVoices();
        this.loadPresetsFromServer();

        // Apply default preset
        this.applyPreset('none');

        // Set up UI event handlers
        this.setupEventHandlers();
    },
    initAudioContext: function () {
        // Create audio context if it doesn't exist
        if (!this.context) {
            // Use AudioContext with fallback for older browsers
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.context = new AudioContext();

            // Create analyzer for visualizer
            this.analyser = this.context.createAnalyser();
            this.analyser.fftSize = 256;

            // Reference to audio element
            this.audioEl = $('#audio')[0];

            // Create media element source
            this.source = this.context.createMediaElementSource(this.audioEl);

            // Create canvas context for visualizer
            const canvas = $('#visualizer')[0];
            if (canvas) {
                this.canvasCtx = canvas.getContext('2d');
            }

            // Create all effect nodes
            this.createEffectNodes();

            // Connect nodes
            this.connectAudioNodes();

            // Start visualizer
            this.audioEl.addEventListener('play', () => {
                this.isPlaying = true;
                this.drawVisualizer();
                this.updatePlaybackSpeed();
            });

            this.audioEl.addEventListener('pause', () => {
                this.isPlaying = false;
            });

            this.audioEl.addEventListener('ended', () => {
                this.isPlaying = false;
            });


        }

        return this.context;
    },

    // Load available TTS voices
    // Add this function to your existing AudioProcessor object
    loadAvailableVoices: async function () {
        try {
            console.log("Attempting to load voices from server...");
            const response = await fetch(`${this.SERVER_URL}/voices`);

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
                this.showStatus('Could not load voices from server. Using default voice.', 'warning');
            }
        } catch (error) {
            console.error('Error loading voices:', error);
            this.showStatus('Error connecting to voice server.', 'error');
        }
    },

    // Create all audio effect nodes
    createEffectNodes: function () {
        // Delay node with feedback
        this.delayNode = this.context.createDelay(5.0);
        this.delayFeedback = this.context.createGain();
        this.delayNode.delayTime.value = 0.3;
        this.delayFeedback.gain.value = 0.5;
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);

        // Filter
        this.biquadFilter = this.context.createBiquadFilter();
        this.biquadFilter.type = 'bandpass';
        this.biquadFilter.frequency.value = 1000;
        this.biquadFilter.Q.value = 5;

        // LFO
        this.lfoNode = this.context.createOscillator();
        this.lfoGainNode = this.context.createGain();
        this.lfoNode.frequency.value = 2;
        this.lfoGainNode.gain.value = 0;
        this.lfoNode.type = 'sine';
        this.lfoNode.connect(this.lfoGainNode);
        this.lfoNode.start();

        // Distortion
        this.distortionNode = this.context.createWaveShaper();
        this.distortionNode.curve = this.makeDistortionCurve(0.2);

        // Reverb
        this.convolverNode = this.context.createConvolver();
        this.createReverbImpulse(2.0);

        // Dry/wet
        this.dryGainNode = this.context.createGain();
        this.wetGainNode = this.context.createGain();
        this.dryGainNode.gain.value = 0.7;
        this.wetGainNode.gain.value = 0.3;
    },

    // Connect audio nodes based on active effects
    connectAudioNodes: function () {
        // Disconnect all nodes
        this.source.disconnect();
        this.delayNode.disconnect();
        this.delayFeedback.disconnect();
        this.biquadFilter.disconnect();
        this.distortionNode.disconnect();
        this.convolverNode.disconnect();
        this.dryGainNode.disconnect();
        this.wetGainNode.disconnect();

        // Connect based on active effects
        let currentNode = this.source;

        // Filter
        if ($('#filter-toggle').prop('checked')) {
            currentNode.connect(this.biquadFilter);
            currentNode = this.biquadFilter;
        }

        // Apply LFO
        if ($('#lfo-toggle').prop('checked')) {
            const targetParam = $('#lfo-target').val();
            const depth = parseFloat($('#lfo-depth').val()) / 100;

            // Disconnect previous target
            if (this.currentLfoTarget) {
                try {
                    this.lfoGainNode.disconnect(this.currentLfoTarget);
                } catch (e) {
                    console.log("LFO disconnection error:", e);
                }
            }

            // Connect to new target
            switch (targetParam) {
                case 'filter-freq':
                    this.lfoGainNode.gain.value = 2000 * depth;
                    this.lfoGainNode.connect(this.biquadFilter.frequency);
                    this.currentLfoTarget = this.biquadFilter.frequency;
                    break;
                case 'filter-q':
                    this.lfoGainNode.gain.value = 20 * depth;
                    this.lfoGainNode.connect(this.biquadFilter.Q);
                    this.currentLfoTarget = this.biquadFilter.Q;
                    break;
                case 'delay-time':
                    this.lfoGainNode.gain.value = 0.2 * depth;
                    this.lfoGainNode.connect(this.delayNode.delayTime);
                    this.currentLfoTarget = this.delayNode.delayTime;
                    break;
                case 'reverb-mix':
                    this.lfoGainNode.gain.value = 0.5 * depth;
                    this.lfoGainNode.connect(this.wetGainNode.gain);
                    this.currentLfoTarget = this.wetGainNode.gain;

                    // Keep dry+wet = 1
                    const inverseLfo = this.context.createGain();
                    inverseLfo.gain.value = -1;
                    this.lfoGainNode.connect(inverseLfo);
                    inverseLfo.connect(this.dryGainNode.gain);
                    break;
                case 'distortion-amount':
                    // Note: This is more complex as we need to regenerate the curve
                    // We'll update the amount periodically via requestAnimationFrame
                    this.startDistortionLFO(depth);
                    break;
            }
        } else if (this.currentLfoTarget) {
            try {
                this.lfoGainNode.disconnect(this.currentLfoTarget);
                this.currentLfoTarget = null;
                this.stopDistortionLFO(); // Stop distortion LFO if it was running
            } catch (e) {
                console.log("LFO disconnection error:", e);
            }
        }

        // Distortion
        if ($('#distortion-toggle').prop('checked')) {
            currentNode.connect(this.distortionNode);
            currentNode = this.distortionNode;
        }

        // Delay
        if ($('#delay-toggle').prop('checked')) {
            currentNode.connect(this.delayNode);
            currentNode.connect(this.analyser);

            // Reconnect the feedback loop
            this.delayNode.connect(this.delayFeedback);
            this.delayFeedback.connect(this.delayNode);

            this.delayNode.connect(this.analyser);
        } else {
            currentNode.connect(this.analyser);
        }

        // Reverb
        if ($('#reverb-toggle').prop('checked')) {
            this.analyser.connect(this.dryGainNode);
            this.analyser.connect(this.convolverNode);
            this.convolverNode.connect(this.wetGainNode);
            this.dryGainNode.connect(this.context.destination);
            this.wetGainNode.connect(this.context.destination);
        } else {
            this.analyser.connect(this.context.destination);
        }
    },

    // Update all effect parameters from UI
    updateEffectParameters: function () {
        if (!this.context) return;

        // Delay
        this.delayNode.delayTime.value = parseFloat($('#delay-time').val());
        this.delayFeedback.gain.value = parseFloat($('#delay-feedback').val());

        // Filter
        this.biquadFilter.frequency.value = parseFloat($('#filter-freq').val());
        this.biquadFilter.Q.value = parseFloat($('#filter-q').val());

        // LFO
        if ($('#lfo-toggle').prop('checked')) {
            this.lfoNode.frequency.value = parseFloat($('#lfo-freq').val());
            this.lfoNode.type = $('#lfo-wave').val();
        }

        // Distortion
        this.distortionNode.curve = this.makeDistortionCurve(parseFloat($('#distortion-amount').val()));

        // Reverb
        this.createReverbImpulse(parseFloat($('#reverb-decay').val()));
        this.dryGainNode.gain.value = 1 - parseFloat($('#reverb-mix').val());
        this.wetGainNode.gain.value = parseFloat($('#reverb-mix').val());

        // Reconnect if playing
        if (this.isPlaying) {
            this.connectAudioNodes();
        }
    },

    // Update playback speed in real-time
    updatePlaybackSpeed: function () {
        if (!this.audioEl) {
            console.log("No audio element found for playback speed update");
            return;
        }

        const speedToggle = $('#speed-toggle');
        const speedSlider = $('#playback-speed');

        if (speedToggle.prop('checked') && speedSlider.length) {
            const newRate = parseFloat(speedSlider.val());
            console.log("Setting playback rate to:", newRate);
            this.audioEl.playbackRate = newRate;
        } else {
            console.log("Speed toggle not checked, setting playback rate to 1.0");
            this.audioEl.playbackRate = 1.0;
        }
    },

    // Distortion LFO implementation
    distortionLFOActive: false,
    distortionLFODepth: 0,
    distortionLFOBaseAmount: 0,

    startDistortionLFO: function (depth) {
        this.distortionLFOActive = true;
        this.distortionLFODepth = depth;
        this.distortionLFOBaseAmount = parseFloat($('#distortion-amount').val());

        // Start the LFO loop if not already running
        if (!this.distortionLFOAnimFrame) {
            this.updateDistortionLFO();
        }
    },

    stopDistortionLFO: function () {
        this.distortionLFOActive = false;
        if (this.distortionLFOAnimFrame) {
            cancelAnimationFrame(this.distortionLFOAnimFrame);
            this.distortionLFOAnimFrame = null;
        }
    },

    updateDistortionLFO: function () {
        if (!this.distortionLFOActive) return;

        const time = this.context.currentTime;
        const lfoFreq = parseFloat($('#lfo-freq').val());
        const wave = $('#lfo-wave').val();

        // Calculate modulation based on wave type
        let mod;
        switch (wave) {
            case 'sine':
                mod = Math.sin(time * lfoFreq * Math.PI * 2) * 0.5 + 0.5;
                break;
            case 'square':
                mod = ((time * lfoFreq) % 1) < 0.5 ? 1 : 0;
                break;
            case 'sawtooth':
                mod = ((time * lfoFreq) % 1);
                break;
            case 'triangle':
                const phase = ((time * lfoFreq) % 1);
                mod = phase < 0.5 ? phase * 2 : 2 - phase * 2;
                break;
            default:
                mod = Math.sin(time * lfoFreq * Math.PI * 2) * 0.5 + 0.5;
        }

        // Apply modulation to distortion amount
        const baseAmount = this.distortionLFOBaseAmount;
        const depth = this.distortionLFODepth;
        const amount = baseAmount * (1 + mod * depth);

        // Update distortion curve
        this.distortionNode.curve = this.makeDistortionCurve(amount);

        // Schedule next update
        this.distortionLFOAnimFrame = requestAnimationFrame(() => this.updateDistortionLFO());
    },

    // Create distortion curve
    makeDistortionCurve: function (amount) {
        const k = amount * 100;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);

        for (let i = 0; i < n_samples; i++) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * (Math.PI / 180) / (Math.PI + k * Math.abs(x));
        }

        return curve;
    },

    // Create reverb impulse response
    createReverbImpulse: function (duration) {
        const sampleRate = this.context.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.context.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = i / length;
            left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, 2);
            right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, 2);
        }

        this.convolverNode.buffer = impulse;
    },

    // Draw audio visualizer
    drawVisualizer: function () {
        if (!this.isPlaying) return;

        requestAnimationFrame(() => this.drawVisualizer());

        const canvas = $('#visualizer')[0];
        if (!canvas || !this.canvasCtx) return;

        const WIDTH = canvas.width = canvas.clientWidth;
        const HEIGHT = canvas.height = canvas.clientHeight;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        this.canvasCtx.fillStyle = 'rgb(0, 0, 0)';
        this.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

        const barWidth = (WIDTH / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] / 255 * HEIGHT;

            const gradient = this.canvasCtx.createLinearGradient(0, HEIGHT, 0, HEIGHT - barHeight);
            gradient.addColorStop(0, 'rgb(50, 200, 50)');
            gradient.addColorStop(1, 'rgb(0, 255, 0)');

            this.canvasCtx.fillStyle = gradient;
            this.canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    },

    // Set up all event handlers
    setupEventHandlers: function () {
        // Slider value display
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

        // Slider input handler
        $('.effect-slider').on('input', (e) => {
            const valueDisplay = $(`#${e.target.id}-value`);
            if (valueDisplay.length) {
                valueDisplay.text(e.target.value);
            }

            // Handle playback speed changes immediately
            if (e.target.id === 'playback-speed') {
                this.updatePlaybackSpeed();
            }

            if (this.effectsMode === 'realtime') {
                this.updateEffectParameters();
            }
        });

        // Effect toggle handler
        $('.effect-checkbox').on('change', (e) => {
            // Handle speed toggle changes immediately
            if (e.target.id === 'speed-toggle') {
                this.updatePlaybackSpeed();
            }

            if (this.effectsMode === 'realtime' && this.context) {
                this.connectAudioNodes();
            }
        });

        // Mode selection
        $('.mode-option').on('click', (e) => {
            $('.mode-option').removeClass('mode-active');
            $(e.target).addClass('mode-active');
            this.effectsMode = $(e.target).data('mode');
        });

        // Synthesize button
        $('#synthesize').on('click', () => this.synthesizeAudio());

        // Save preset
        $('#save-preset').on('click', () => this.showPresetModal());

        // Refresh presets
        $('#refresh-presets').on('click', () => {
            console.log("Refreshing presets...");
            this.loadPresetsFromServer();
        });

        // Audio loop checkbox
        $('#loop-audio').on('change', (e) => {
            if (this.audioEl) {
                this.audioEl.loop = e.target.checked;
            }
        });

        // LFO target change
        $('#lfo-target').on('change', () => {
            if (this.effectsMode === 'realtime' && this.context && $('#lfo-toggle').prop('checked')) {
                this.connectAudioNodes();
            }
        });

        // Context menu tip
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

        $('#speed-toggle').on('change', (e) => {
            console.log("Speed toggle changed:", e.target.checked);
            this.updatePlaybackSpeed();
        });

        // Make sure the speed slider has a direct handler
        $('#playback-speed').on('input', (e) => {
            console.log("Playback speed slider changed:", e.target.value);
            const valueDisplay = $('#playback-speed-value');
            if (valueDisplay.length) {
                valueDisplay.text(e.target.value);
            }
            this.updatePlaybackSpeed();
        });
    },

    // Synthesize audio from text
    synthesizeAudio: async function () {
        const text = $('#text').val().trim();
        const voice = $('#voice').val();
        const spinner = $('#spinner');

        if (!text) {
            this.showStatus('Veuillez entrer du texte à synthétiser.', 'error');
            return;
        }

        this.showStatus('Synthèse en cours...', 'info');
        spinner.css('display', 'inline-block');

        try {
            const effects = this.getEffectsForServer();

            const response = await fetch(`${this.SERVER_URL}/synthesize`, {
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
                if (this.effectsMode === 'realtime') {
                    this.initAudioContext();
                    this.updateEffectParameters();
                    // Apply playback speed immediately once audio is loaded
                    audioElement.addEventListener('loadedmetadata', () => {
                        console.log("Audio loaded, initializing playback speed");
                        this.updatePlaybackSpeed();
                    });
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
                } else if (this.effectsMode === 'realtime') {
                    statusMessage += ' (effets en temps réel activés)';
                }

                this.showStatus(statusMessage, 'success');
            } else {
                throw new Error(data.error || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Erreur:', error);
            this.showStatus(`Erreur: ${error.message}`, 'error');
        } finally {
            spinner.css('display', 'none');
        }
    },

    // Display status messages
    showStatus: function (message, type) {
        const statusEl = $('#status');
        statusEl.text(message)
            .attr('class', type)
            .css('display', 'block');

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                statusEl.fadeOut(500);
            }, 5000);
        }
    },

    // Get effects configuration for server-side processing
    getEffectsForServer: function () {
        if (this.effectsMode === 'realtime') {
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
    },

    // Apply a preset to all controls
    applyPreset: function (presetName) {
        const preset = this.presets[presetName];
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
                const speedToggle = $('#speed-toggle');
                if (speedToggle.length) {
                    speedToggle.prop('checked', preset[effect].toggle);
                }

                const speedSlider = $('#playback-speed');
                const valueDisplay = $('#playback-speed-value');

                if (speedSlider.length && preset[effect].value !== undefined) {
                    speedSlider.val(preset[effect].value);

                    if (valueDisplay.length) {
                        valueDisplay.text(preset[effect].value);
                    }
                }

                this.updatePlaybackSpeed();
                return;
            }

            // Handle normal effects
            const toggle = $(`#${effect}-toggle`);
            if (toggle.length) {
                toggle.prop('checked', preset[effect].toggle);
            }

            // Apply parameter values
            Object.keys(preset[effect]).forEach(param => {
                if (param !== 'toggle') {
                    const control = $(`#${effect}-${param}`);
                    const valueDisplay = $(`#${effect}-${param}-value`);

                    if (control.length) {
                        control.val(preset[effect][param]);
                        if (valueDisplay.length && control.attr('type') === 'range') {
                            valueDisplay.text(preset[effect][param]);
                        }
                    }
                }
            });
        });

        // Update effects in realtime
        if (this.effectsMode === 'realtime' && this.context) {
            this.updateEffectParameters();
            this.connectAudioNodes();
        }
        this.updatePlaybackSpeed();

    },

    // Get current preset data from UI
    getCurrentPresetData: function () {
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
    },

    // Show preset save modal
    showPresetModal: function () {
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
                const presetData = this.getCurrentPresetData();
                this.savePresetToServer(name, presetData);
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
    },

    // Load presets from server
    async loadPresetsFromServer() {
        try {
            console.log("Loading presets from server...");
            // First, ensure we have default presets as a fallback
            if (!this.presets) {
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
            }

            // Try to load from server
            let serverPresetsLoaded = false;
            try {
                const response = await fetch(`${this.SERVER_URL}/presets`);
                if (response.ok) {
                    const serverPresets = await response.json();
                    console.log("Server presets loaded:", serverPresets);

                    // Merge with existing presets, prioritizing server ones
                    this.presets = {
                        ...this.presets,
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
            if (!serverPresetsLoaded && !this.localPresetsLoaded) {
                try {
                    console.log('Attempting to load local presets...');
                    await new Promise((resolve, reject) => {
                        $.getJSON('presets.json', (data) => {
                            console.log("Local presets loaded:", data);
                            // Merge with existing presets
                            this.presets = {
                                ...this.presets,
                                ...data
                            };
                            this.localPresetsLoaded = true;
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
            if (!this.presets.none) {
                console.log("Adding 'none' preset as it wasn't found");
                this.presets.none = {
                    delay: { toggle: false },
                    filter: { toggle: false },
                    lfo: { toggle: false },
                    distortion: { toggle: false },
                    reverb: { toggle: false },
                    speed: { toggle: false, value: 1.0 }
                };
            }

            // Update UI with presets
            console.log("Updating UI with presets:", this.presets);
            this.updatePresetButtons(this.presets);
            return this.presets;
        } catch (error) {
            console.error('Error in loadPresetsFromServer:', error);
            this.showStatus(`Error loading presets: ${error.message}`, 'error');

            // Ensure we at least have a 'none' preset
            if (!this.presets || !this.presets.none) {
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
                this.updatePresetButtons(this.presets);
            }

            return this.presets;
        }
    },

    // Save preset to server
    async savePresetToServer(name, presetData) {
        try {
            const response = await fetch(`${this.SERVER_URL}/presets/${name}`, {
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
            this.showStatus(result.message, 'success');

            // Reload presets
            this.loadPresetsFromServer();

            return result;
        } catch (error) {
            console.error('Error saving preset:', error);
            this.showStatus(`Error saving: ${error.message}`, 'error');
            return null;
        }
    },

    // Delete preset from server
    async deletePresetFromServer(name) {
        try {
            const response = await fetch(`${this.SERVER_URL}/presets/${name}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP Error ${response.status}`);
            }

            const result = await response.json();
            this.showStatus(result.message, 'success');

            // Delete from local presets immediately
            if (this.presets[name]) {
                delete this.presets[name];
                this.updatePresetButtons(this.presets);
            }

            // Also reload presets from server
            this.loadPresetsFromServer();

            return result;
        } catch (error) {
            console.error('Error deleting preset:', error);
            this.showStatus(`Error deleting: ${error.message}`, 'error');
            return null;
        }
    },

    // Update preset buttons in UI
    updatePresetButtons: function (presets) {
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
        this.presets = presets;

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
            .on('click', () => this.applyPreset('none'));

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
                    this.deletePresetFromServer(presetName);
                }
            });

            button.on('click', () => {
                console.log(`Clicked preset: ${presetName}`);
                this.applyPreset(presetName);
            });

            presetsContainer.append(button);
            presetCount++;
        });

        console.log(`Added ${presetCount} preset buttons`);

        // Add button to create new preset
        const addButton = $('<button>')
            .addClass('preset-button add-preset')
            .html('+ Ajouter')
            .on('click', () => this.showPresetModal());

        presetsContainer.append(addButton);
    }
};

// Modified initialization process for AudioProcessor with JSON loading restored

// Replace the jQuery document.ready section at the bottom of your script with this:
$(document).ready(function () {
    console.log("Document ready - initializing AudioProcessor");

    // First set up default presets to ensure we have something
    AudioProcessor.presets = {
        none: {
            delay: { toggle: false },
            filter: { toggle: false },
            lfo: { toggle: false },
            distortion: { toggle: false },
            reverb: { toggle: false },
            speed: { toggle: false, value: 1.0 }
        }
    };

    // Update UI with presets initially
    AudioProcessor.updatePresetButtons(AudioProcessor.presets);

    // Apply the 'none' preset
    AudioProcessor.applyPreset('none');

    // Set up event handlers first
    AudioProcessor.setupEventHandlers();

    // Now load voices
    AudioProcessor.loadAvailableVoices();

    // First try to load presets from JSON file
    $.getJSON('presets.json', (data) => {
        console.log("Local presets loaded from JSON:", data);

        // Make sure we have a 'none' preset
        if (!data.none) {
            data.none = AudioProcessor.presets.none;
        }

        // Update presets
        AudioProcessor.presets = data;

        // Update UI with presets from JSON
        AudioProcessor.updatePresetButtons(AudioProcessor.presets);

        // Now try to load from server with a slight delay
        setTimeout(() => {
            console.log("Loading presets from server (after JSON load)");
            AudioProcessor.loadPresetsFromServer().then(presets => {
                console.log("Server presets loaded successfully:", presets);
                AudioProcessor.updatePresetButtons(presets);
            }).catch(err => {
                console.error("Failed to load server presets:", err);
            });
        }, 500);

    }).fail((jqxhr, textStatus, error) => {
        console.warn('Error loading presets.json:', textStatus, error);
        AudioProcessor.showStatus('Failed to load local presets. Using defaults.', 'warning');

        // Try to load from server right away since JSON failed
        console.log("Loading presets from server (JSON failed)");
        AudioProcessor.loadPresetsFromServer().then(presets => {
            console.log("Server presets loaded successfully:", presets);
            AudioProcessor.updatePresetButtons(presets);
        }).catch(err => {
            console.error("Failed to load server presets:", err);
        });
    });

    // Also manually add a click handler to the refresh button to ensure it works
    $('#refresh-presets').off('click').on('click', function () {
        console.log("Refresh presets button clicked");
        AudioProcessor.loadPresetsFromServer().then(presets => {
            console.log("Presets refreshed successfully:", presets);
            AudioProcessor.updatePresetButtons(presets);
        }).catch(err => {
            console.error("Failed to refresh presets:", err);
        });
    });
});