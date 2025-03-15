/**
 * Audio visualizer implementation
 */

/**
 * Draw the audio visualizer
 * @param {Object} processor - The AudioProcessor instance
 */
function drawVisualizer(processor) {
    if (!processor.isPlaying) return;

    requestAnimationFrame(() => drawVisualizer(processor));

    const canvas = $('#visualizer')[0];
    if (!canvas || !processor.canvasCtx) return;

    const WIDTH = canvas.width = canvas.clientWidth;
    const HEIGHT = canvas.height = canvas.clientHeight;

    const bufferLength = processor.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    processor.analyser.getByteFrequencyData(dataArray);

    processor.canvasCtx.fillStyle = 'rgb(0, 0, 0)';
    processor.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

    const barWidth = (WIDTH / bufferLength) * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 255 * HEIGHT;

        const gradient = processor.canvasCtx.createLinearGradient(0, HEIGHT, 0, HEIGHT - barHeight);
        gradient.addColorStop(0, 'rgb(50, 200, 50)');
        gradient.addColorStop(1, 'rgb(0, 255, 0)');

        processor.canvasCtx.fillStyle = gradient;
        processor.canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);

        x += barWidth + 1;
    }
}