'use strict';

var audioContext = require('./audiocontext');

// DSP - Filters
// See: http://phenomnomnominal.github.io/docs/tuner.html#section-19

/*
 * A Gaussian window function is used on the time-domain buffer data.
 * A Gaussian function is also Gaussian in the frequency-domain.
 * Since the log of a Gaussian is a parabola,
 * the resulting data can be used for exact parabolic interpolation in the frequency domain,
 * allowing for highly accurate frequency estimation.
 */

// WindowFunction is part of DSP
exports.gauss = new WindowFunction(DSP.GAUSS);

/*
 * lp - A low-pass filter is also used to attenuate frequencies above 8KHz,
 * as we are not interested in these frequencies.
 */

var lp = exports.lp = audioContext.createBiquadFilter();
lp.type = lp.LOWPASS;
lp.frequency = 8000;
lp.Q = 0.1;

/*
 * hp - A high-pass filter is used to attenuate frequencies below 20Hz,
 * as we are not interested in these frequencies
 * (and they are outside the frequency response of many basic microphones anyway).
 */

var hp = exports.hp = audioContext.createBiquadFilter();
hp.type = hp.HIGHPASS;
hp.frequency = 20;
hp.Q = 0.1;
