'use strict';

var noiseCount     =  0
  , noiseThreshold =  -Infinity;

/**
 * The first 10 times that the data is examined (i.e. the first second),
 * the frequency spectrum is examined with the assumption that any data recieved is pure noise.
 * The maximum value from the spectrums and these 10 intervals is set to be the noiseThreshold.
 * After that the same threshold is returned on every invocation.
 * @name exports
 * @function
 * @return {Number} the noise threshold
 */
var go = module.exports = function adjustNoiseThreshold (spectrum, interval) {

  if (noiseCount < 1000 / interval) {
    noiseThreshold = Object.keys(spectrum)
      .filter(function (k) {
        return !~['buffer', 'byteLength', 'byteOffset', 'length'].indexOf(k);
      })
      .reduce(function (max, k) {
        var sp = spectrum[k];
        return sp > max ? sp : max;
      }, noiseThreshold);

    // The noiseThreshold is limited to being 0.001, just in case there was valid data in the samples.
    noiseThreshold = Math.min(noiseThreshold, 0.001);

    noiseCount++;
  }
  return noiseThreshold;
};
