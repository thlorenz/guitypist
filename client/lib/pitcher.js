'use strict';

var minlen = 40; // ms

var go = module.exports = function (interval, onpitch, onnopitch) {
  var current = { note: null }
    , seen = 0
    , minseen = minlen / interval;

  console.log('minseen : ', minseen);

  return function (pitch) {
    // same note as before
    if (pitch.note === current.note) return seen++;

    // when we see another note and it was played often enough, we emit a pitch or absence thereof
    if (seen >= minseen) {
      if (current.note) onpitch(current); else onnopitch();
    }

    current = pitch;
    seen = 1;
  };
};
