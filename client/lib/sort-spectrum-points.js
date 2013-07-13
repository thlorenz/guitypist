'use strict';

/**
 * Sorts FFT spectrum values by their peak value
 *
 * @name exports
 * @function
 * @param spectrum
 * @return
 */
var go = module.exports = function (spectrum) {
  //  spectrumPoints = (x: x, y: fft.spectrum[x] for x in [0...(fft.spectrum.length / 4)])

  var spectrumPoints = [];
  spectrumPoints.sort(function(a, b) { return b.y - a.y; });
  return spectrumPoints;
};
