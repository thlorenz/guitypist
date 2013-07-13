'use strict';

var audioContext = require('./audiocontext');
var fft = require('./dsp-fft');

// DSP - Sample Buffer
/*
 * See: http://phenomnomnominal.github.io/docs/tuner.html#section-17
 * In order to always have enough data to get sufficient resolution while maintaining the real-time requirement of a tuner,
 * a shifting window buffer is used.
 * This buffer always contains 8192 samples, however the buffer windows shifts every 2048 samples.
 */

var bufferFillSize = 2048;

// init empty array as buffer (not sure if just passing uninitialized array would work too)
var buffer = (function () {
  var arr = [];
  for (var i = 0; i < fft.size; arr[i++] = 0);
  return arr;
})();


var bufferFiller = audioContext.createJavaScriptNode(bufferFillSize, 1, 1);

bufferFiller.onaudioprocess = function (e) {
  var input = e.inputBuffer.getChannelData(0)
    , i;

  for (i = bufferFillSize; i <= buffer.length; i++)
    buffer[i - bufferFillSize] = buffer[i];

  var offset = buffer.length - bufferFillSize;

  for (i = 0; i <= input.length; i++)
    buffer[offset + i] = input[i];
};

module.exports = { buffer: buffer, bufferFiller: bufferFiller };
