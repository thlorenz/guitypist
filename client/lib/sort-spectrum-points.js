'use strict';

/**
 * Sorts FFT spectrum values by their peak value.
 *
 * @name exports
 * @function
 * @param spectrum
 * @return {[Object]} { x, y } spectrum values
 */
var go = module.exports = function (spectrum) {

  // not sure why we only iterate over first quarter of spectrum
  // spectrumPoints = (x: x, y: fft.spectrum[x] for x in [0...(fft.spectrum.length / 4)])
  var spectrumPoints = [];
  for (var x = 0; x <= spectrum.length / 4; spectrumPoints.push({ x: x, y: spectrum[x] }), x++);

  spectrumPoints.sort(function(a, b) { return b.y - a.y; });

  return spectrumPoints;
};
