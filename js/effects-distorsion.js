// js/effects-distortion.js
/**
 * Distortion effect implementation
 */
import { makeDistortionCurve } from './utils.js';

export function createDistortionNode(processor) {
    // Distortion
    processor.distortionNode = processor.context.createWaveShaper();
    processor.distortionNode.curve = makeDistortionCurve(0.2);
}

export function startDistortionLFO(processor, depth) {
    processor.distortionLFOActive = true;
    processor.distortionLFODepth = depth;
    processor.distortionLFOBaseAmount = parseFloat($('#distortion-amount').val());

    // Start the LFO loop if not already running
    if (!processor.distortionLFOAnimFrame) {
        updateDistortionLFO(processor);
    }
}

export function stopDistortionLFO(processor) {
    processor.distortionLFOActive = false;
    if (processor.distortionLFOAnimFrame) {
        cancelAnimationFrame(processor.distortionLFOAnimFrame);
        processor.distortionLFOAnimFrame = null;
    }
}

function updateDistortionLFO(processor) {
    if (!processor.distortionLFOActive) return;

    const time = processor.context.currentTime;
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
    const baseAmount = processor.distortionLFOBaseAmount;
    const depth = processor.distortionLFODepth;
    const amount = baseAmount * (1 + mod * depth);

    // Update distortion curve
    processor.distortionNode.curve = makeDistortionCurve(amount);

    // Schedule next update
    processor.distortionLFOAnimFrame = requestAnimationFrame(() => updateDistortionLFO(processor));
}