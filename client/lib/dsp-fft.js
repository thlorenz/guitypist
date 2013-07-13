'use strict';

var audioContext = require('./audiocontext');

// DSP - Fast Fourier Transform

/*
 *  See: http://phenomnomnominal.github.io/docs/tuner.html#section-15
 *
 *  The incoming audio from the microphone has a sample rate (Fs) of 44100Hz.
 *  Since the highest possible frequency we are interested in is the 'Top C' on the piano (4186.01Hz),
 *  we can safely ignore data over roughly 10KHz. The downsampled rate that we use is 11025Hz (Fs / 4).
 *
 *  As the FFT requires a input of length 2n, we use 8192 (213).
 *
 *  The relationship between FFT sample rate, FFT buffer length and FFT bin resolution, is:
 *
 *    FFTr = FFTs / FFTL
 *
 *    FFTs of 11025Hz and FFT buffer length of 8192 gives us a bin resolution of 1.3458Hz
 *
 */
var fftSize = 8192
  , sampleRate = audioContext.sampleRate;

// FFT comes from the dsp.js library pulled in via script tag
var fft = module.exports = new FFT(fftSize, sampleRate / 4);
fft.size = fftSize;
