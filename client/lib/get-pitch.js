'use strict';

var frequencies = require('./frequencies');

var go = module.exports = function (freq) {
  return Object.keys(frequencies)
    .reduce(function (bestMatch, k) {
      var f       =  frequencies[k]
        , diff    =  f - freq
        , absDiff =  Math.abs(diff);

      return absDiff < bestMatch.minDiff
        ? { diff: diff, minDiff: absDiff, note: k, frequency: freq }
        : bestMatch;

    }, { note: null, diff: Infinity, minDiff: Infinity });
};
