/**
 * Audio context initialization and management
 */

/**
 * Initialize the audio context and set up audio nodes
 * @param {Object} processor - The AudioProcessor instance
 * @returns {AudioContext} The initialized audio context
 */
function initAudioContext(processor) {
    // Create audio context if it doesn't exist
    if (!processor.context) {
        // Use AudioContext with fallback for older browsers
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        processor.context = new AudioContext();

        // Create analyzer for visualizer
        processor.analyser = processor.context.createAnalyser();
        processor.analyser.fftSize = Config.FFT_SIZE;

        // Reference to audio element
        processor.audioEl = $('#audio')[0];

        // Create media element source
        processor.source = processor.context.createMediaElementSource(processor.audioEl);

        // Create canvas context for visualizer
        const canvas = $('#visualizer')[0];
        if (canvas) {
            processor.canvasCtx = canvas.getContext('2d');
        }

        // Create all effect nodes
        createEffectNodes(processor);

        // Connect nodes
        connectAudioNodes(processor);

        // Start visualizer and update playback speed when audio plays
        processor.audioEl.addEventListener('play', () => {
            processor.isPlaying = true;
            drawVisualizer(processor);
            updatePlaybackSpeed(processor);
        });

        processor.audioEl.addEventListener('pause', () => {
            processor.isPlaying = false;
        });

        processor.audioEl.addEventListener('ended', () => {
            processor.isPlaying = false;
        });
    }

    return processor.context;
}

/**
 * Create all audio effect nodes
 * @param {Object} processor - The AudioProcessor instance
 */
function createEffectNodes(processor) {
    // Create all effect nodes
    createDelayNodes(processor);
    createFilterNode(processor);
    createLFONodes(processor);
    createDistortionNode(processor);
    createReverbNodes(processor);
}

/**
 * Connect audio nodes based on active effects
 * @param {Object} processor - The AudioProcessor instance
 */
function connectAudioNodes(processor) {
    // Disconnect all nodes
    processor.source.disconnect();
    processor.delayNode.disconnect();
    processor.delayFeedback.disconnect();
    processor.biquadFilter.disconnect();
    processor.distortionNode.disconnect();
    processor.convolverNode.disconnect();
    processor.dryGainNode.disconnect();
    processor.wetGainNode.disconnect();

    // Connect based on active effects
    let currentNode = processor.source;

    // Filter
    if ($('#filter-toggle').prop('checked')) {
        currentNode.connect(processor.biquadFilter);
        currentNode = processor.biquadFilter;
    }

    // Apply LFO
    if ($('#lfo-toggle').prop('checked')) {
        const targetParam = $('#lfo-target').val();
        const depth = parseFloat($('#lfo-depth').val()) / 100;

        // Disconnect previous target
        if (processor.currentLfoTarget) {
            try {
                processor.lfoGainNode.disconnect(processor.currentLfoTarget);
            } catch (e) {
                console.log("LFO disconnection error:", e);
            }
        }

        // Connect to new target
        switch (targetParam) {
            case 'filter-freq':
                processor.lfoGainNode.gain.value = 2000 * depth;
                processor.lfoGainNode.connect(processor.biquadFilter.frequency);
                processor.currentLfoTarget = processor.biquadFilter.frequency;
                break;
            case 'filter-q':
                processor.lfoGainNode.gain.value = 20 * depth;
                processor.lfoGainNode.connect(processor.biquadFilter.Q);
                processor.currentLfoTarget = processor.biquadFilter.Q;
                break;
            case 'delay-time':
                processor.lfoGainNode.gain.value = 0.2 * depth;
                processor.lfoGainNode.connect(processor.delayNode.delayTime);
                processor.currentLfoTarget = processor.delayNode.delayTime;
                break;
            case 'reverb-mix':
                processor.lfoGainNode.gain.value = 0.5 * depth;
                processor.lfoGainNode.connect(processor.wetGainNode.gain);
                processor.currentLfoTarget = processor.wetGainNode.gain;

                // Keep dry+wet = 1
                const inverseLfo = processor.context.createGain();
                inverseLfo.gain.value = -1;
                processor.lfoGainNode.connect(inverseLfo);
                inverseLfo.connect(processor.dryGainNode.gain);
                break;
            case 'distortion-amount':
                // Note: This is more complex as we need to regenerate the curve
                // We'll update the amount periodically via requestAnimationFrame
                startDistortionLFO(processor, depth);
                break;
        }
    } else if (processor.currentLfoTarget) {
        try {
            processor.lfoGainNode.disconnect(processor.currentLfoTarget);
            processor.currentLfoTarget = null;
            stopDistortionLFO(processor); // Stop distortion LFO if it was running
        } catch (e) {
            console.log("LFO disconnection error:", e);
        }
    }

    // Distortion
    if ($('#distortion-toggle').prop('checked')) {
        currentNode.connect(processor.distortionNode);
        currentNode = processor.distortionNode;
    }

    // Delay
    if ($('#delay-toggle').prop('checked')) {
        currentNode.connect(processor.delayNode);
        currentNode.connect(processor.analyser);

        // Reconnect the feedback loop
        processor.delayNode.connect(processor.delayFeedback);
        processor.delayFeedback.connect(processor.delayNode);

        processor.delayNode.connect(processor.analyser);
    } else {
        currentNode.connect(processor.analyser);
    }

    // Reverb
    if ($('#reverb-toggle').prop('checked')) {
        processor.analyser.connect(processor.dryGainNode);
        processor.analyser.connect(processor.convolverNode);
        processor.convolverNode.connect(processor.wetGainNode);
        processor.dryGainNode.connect(processor.context.destination);
        processor.wetGainNode.connect(processor.context.destination);
    } else {
        processor.analyser.connect(processor.context.destination);
    }
}