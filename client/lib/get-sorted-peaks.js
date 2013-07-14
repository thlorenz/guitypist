'use strict';

/**
 * Selects highest 8 peaks, removes the ones that are too close and sorts them by frequency.
 *
 * @name exports
 * @function
 * @param spectrumPoints {[Object]} {x, y} expected to be sorted
 * @param noiseThreshold
 * @return {Array} sorted peaks empty if no peaks were found
 */
var go = module.exports = function (spectrumPoints, noiseThreshold) {
  var peaks = [], i, j;

  // TODO: improve very imperative code

  // select 8 highest peaks (provided they are sufficiently large)
  for (i = 0; i < 8; i++) {
    var point = spectrumPoints[i];
    if (point.y > noiseThreshold * 5) peaks.push(point);
  }

  if (!peaks.length) return [];

  // If there are any peaks found, any values from either side of the peaks are removed
  // (as they are also likely to be peaks, but they provide no useful information).
  // The remaining peaks are sorted by their frequency again, with lower values having lover indexes.
  for (i = 0; i < peaks.length; i++) {
    var p = peaks[i];
    if (!p) continue;

    for (j = 0; j < peaks.length; j++) {
      var q = peaks[j];
      if (i === j || !q) continue;
      // mark for deletion if difference isn't large enough
      if (Math.abs(p.x - q.x) < 5) peaks[j] = null;
    }
  }

  return peaks
    .filter(function (x) { return !!x; })
    .sort(function (a, b) { return a.x - b.x; });
};
