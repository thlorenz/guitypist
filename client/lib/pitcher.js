'use strict';

var minlen = 100; // ms

function findMostCommonPitch (pitches) {
  return pitches
    .reduce(function (acc, p) {
      var counts = acc.counts
        , winner = acc.winner;

      if (!counts[p.note]) counts[p.note] = 0;
      var c = ++counts[p.note];

      if (c > winner.count) {
        if (p.note === winner.note) {
          winner.count++;
        } else {
          p.count    =  c;
          p.sndnote  =  winner.note;
          p.sndcount =  winner.count;
          acc.winner = p;
        }
      }
      return acc;
    }
    , { counts: { }, winner: { count: 0 } }
    )
    .winner;
}

var go = module.exports = function (interval, onpitch, onnopitch) {
  var current = null
    , seen = 0
    , pitches = []
    , minseen = minlen / interval;

  console.log('minseen : ', minseen);

  return function (pitch) {
    // same note as before
    if (pitch.note !== null) {

      if (current === null) {
        onnopitch();
        current = pitch.note;
      }

      pitches.push(pitch);

      if (pitches.length === minseen) {
        var p = findMostCommonPitch(pitches);
        console.log({ note: p.note, count: p.count, sndnote: p.sndnote, sndcount: p.sndcount });

        onpitch(p);
        // need this when we use long notes (at that point reset pitches when we see nopitch)
        //pitches = [];
      }

    } else {
      current = null;
      pitches = [];
    }

  };
};
