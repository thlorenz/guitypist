;(function(e,t,n){function i(n,s){if(!t[n]){if(!e[n]){var o=typeof require=="function"&&require;if(!s&&o)return o(n,!0);if(r)return r(n,!0);throw new Error("Cannot find module '"+n+"'")}var u=t[n]={exports:{}};e[n][0].call(u.exports,function(t){var r=e[n][1][t];return i(r?r:t)},u,u.exports)}return t[n].exports}var r=typeof require=="function"&&require;for(var s=0;s<n.length;s++)i(n[s]);return i})({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
var AudioContext =
     window.AudioContext
  || window.mozAudioContext
  || window.webkitAudioContext
  || window.msAudioContext
  || window.oAudioContext;

// TODO: warn user if not supported?
// the entire app will use the same audio context
module.exports =  AudioContext && new AudioContext();

},{}],3:[function(require,module,exports){
'use strict';

var audioContext = require('./audiocontext')
  , bufferFiller = require('./dsp-samplebuffer').bufferFiller
  , filters = require('./dsp-filters')
  , lp = filters.lp
  , hp = filters.hp;


/**
 *  Connects audio stream to buffer and inserts some filters.
 *
 * @name exports
 * @function
 * @param stream {Stream} provided by call to navigator.getUserMedia
 * @return void
 */
var go = module.exports = function (stream) {
  console.log('connecting audio stream');

  var src = audioContext.createMediaStreamSource(stream);

  src.connect(lp);
  lp.connect(hp);
  hp.connect(bufferFiller);
  bufferFiller.connect(audioContext.destination);
};

},{"./audiocontext":2,"./dsp-filters":6,"./dsp-samplebuffer":7}],4:[function(require,module,exports){
'use strict';

var go = module.exports = function (buffer) {
  var copy = [];
  for (var i = 0; i < buffer.length; copy[i] = buffer[i], i++);
  return copy;
};

},{}],5:[function(require,module,exports){
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

},{"./audiocontext":2}],6:[function(require,module,exports){
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

},{"./audiocontext":2}],7:[function(require,module,exports){
(function(){'use strict';

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

  for (i = bufferFillSize; i < buffer.length; i++)
    buffer[i - bufferFillSize] = buffer[i];

  var offset = buffer.length - bufferFillSize;

  for (i = 0; i < input.length; i++)
    buffer[offset + i] = input[i];
};

module.exports = { buffer: buffer, bufferFiller: bufferFiller };

})()
},{"./audiocontext":2,"./dsp-fft":5}],8:[function(require,module,exports){
module.exports = {
  'A0'  :  27.5,
  'A1'  :  55,
  'A2'  :  110,
  'A3'  :  220,
  'A4'  :  440,
  'A5'  :  880,
  'A6'  :  1760,
  'A7'  :  3520.00,
  'A#0' :  29.1352,
  'A#1' :  58.2705,
  'A#2' :  116.541,
  'A#3' :  233.082,
  'A#4' :  466.164,
  'A#5' :  932.328,
  'A#6' :  1864.66,
  'A#7' :  3729.31,
  'B0'  :  30.8677,
  'B1'  :  61.7354,
  'B2'  :  123.471,
  'B3'  :  246.942,
  'B4'  :  493.883,
  'B5'  :  987.767,
  'B6'  :  1975.53,
  'B7'  :  3951.07,
  'C1'  :  32.7032,
  'C2'  :  65.4064,
  'C3'  :  130.813,
  'C4'  :  261.626,
  'C5'  :  523.251,
  'C6'  :  1046.50,
  'C7'  :  2093,
  'C8'  :  4186.01,
  'C#1' :  34.6478,
  'C#2' :  69.2957,
  'C#3' :  138.591,
  'C#4' :  277.183,
  'C#5' :  554.365,
  'C#6' :  1108.73,
  'C#7' :  2217.46,
  'D1'  :  36.7081,
  'D2'  :  73.4162,
  'D3'  :  146.832,
  'D4'  :  293.665,
  'D5'  :  587.330,
  'D6'  :  1174.66,
  'D7'  :  2349.32,
  'D#1' :  38.8909,
  'D#2' :  77.7817,
  'D#3' :  155.563,
  'D#4' :  311.127,
  'D#5' :  622.254,
  'D#6' :  1244.51,
  'D#7' :  2489.02,
  'E1'  :  41.2034,
  'E2'  :  82.4069,
  'E3'  :  164.814,
  'E4'  :  329.628,
  'E5'  :  659.255,
  'E6'  :  1318.51,
  'E7'  :  2637.02,
  'F1'  :  43.6563,
  'F2'  :  87.3071,
  'F3'  :  174.614,
  'F4'  :  349.228,
  'F5'  :  698.456,
  'F6'  :  1396.91,
  'F7'  :  2793.83,
  'F#1' :  46.2493,
  'F#2' :  92.4986,
  'F#3' :  184.997,
  'F#4' :  369.994,
  'F#5' :  739.989,
  'F#6' :  1479.98,
  'F#7' :  2959.96,
  'G1'  :  48.9994,
  'G2'  :  97.9989,
  'G3'  :  195.998,
  'G4'  :  391.995,
  'G5'  :  783.991,
  'G6'  :  1567.98,
  'G7'  :  3135.96,
  'G#1' :  51.9131,
  'G#'  :  103.826,
  'G#3' :  207.652,
  'G#4' :  415.305,
  'G#5' :  830.609,
  'G#6' :  1661.22,
  'G#7' :  3322.44
};

},{}],9:[function(require,module,exports){
'use strict';

var frequencies = require('./frequencies');

var go = module.exports = function (freq) {
  // todo - combine this with pitcher to basically get an array of frequencies and
  // evaluate them in one place, instead of finding the best match of the best match
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

},{"./frequencies":8}],10:[function(require,module,exports){
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

},{}],11:[function(require,module,exports){
'use strict';

// TODO: warn user if none exists?
module.exports =
     navigator.getUserMedia
  || navigator.mozGetUserMedia
  || navigator.webkitGetUserMedia
  || navigator.msGetUserMedia
  || navigator.oGetUserMedia;

},{}],12:[function(require,module,exports){
'use strict';

module.exports = {
  'E4'  :  'b' ,
  'F4' :  'v',
  'F#4'  :  'c',
  'G4'  :  'x',
  'G#4' :  'z',

  'B3' : 'g' ,
  'C4' : 'f',
  'C#4': 'd',
  'D4' : 's',
  'D#4': 'a',

  'F#3':'t',
  'G3' :'r',
  'G#3':'e',
  'A3' :'w',
  'A#3':'q',
};

},{}],13:[function(require,module,exports){
'use strict';

// assumes to have hand in 5th fret
module.exports = {
  'B4' : 'b',
  'C4' : 'v',
  'C#4': 'c',
  'D4' : 'x',
  'D#4': 'z',

  'F#3': 'g',
  'G3' : 'f',
  'G#3': 'd',
  'A3' : 's',
  'A#3': 'a',

  'C#3': 't',
  'D3' : 'r',
  'D#3': 'e',
  'E3' : 'w',
  'F3' : 'q',
};

},{}],14:[function(require,module,exports){
'use strict';

// TODO: got broken is actually v now
module.exports = {
  'B3' : 'b' ,
  'C4' : 'v',
  'C#4': 'c',
  'D4' : 'x',
  'D#4': 'z',

  'F#3': 'g',
  'G3' : 'f',
  'G#3': 'd',
  'A3' : 's',
  'A#3': 'a',

  'C#3' :  't',
  'D3'  :  'r',
  'D#3' :  'e',
  'E3'  :  'w',
  'F3'  :  'q',
};

},{}],15:[function(require,module,exports){
'use strict';

var v    =  require('./note-to-letter-v')
  , vdgb =  require('./note-to-letter-v-dgb')
  , vii  =  require('./note-to-letter-vii');


module.exports = function (fret) {
  switch(fret) {
    case 'v'     :  return v;
    case 'v-dgb' :  return vdgb;
    case 'vii'   :  return vii;
  }
};

},{"./note-to-letter-v":13,"./note-to-letter-v-dgb":12,"./note-to-letter-vii":14}],16:[function(require,module,exports){
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

},{}],17:[function(require,module,exports){
(function(){'use strict';

var buffer               =  require('./dsp-samplebuffer').buffer
  , gauss                =  require('./dsp-filters').gauss
  , copyBuffer           =  require('./copy-buffer')
  , fft                  =  require('./dsp-fft')
  , adjustNoiseThreshold =  require('./adjust-noise-threshold')
  , sortSpectrumPoints   =  require('./sort-spectrum-points')
  , getSortedPeaks       =  require('./get-sorted-peaks')
  , audioContext         =  require('./audiocontext')
  , getPitch             =  require('./get-pitch')
  , pitcher              =  require('./pitcher')
  ;

function downsample (buf) {
  var downsampled = [];
  for (var i = 0; i < buf.length; downsampled.push(buf[i]), i += 4);
  return downsampled;
}

function upsample (buf) {
  var upsampled = [];
  for (var i = 0; i < buf.length; i++) {
    // would concat perform better here?
    upsampled.push(buf[i]);
    upsampled.push(0);
    upsampled.push(0);
    upsampled.push(0);
  }

  return upsampled;
}

var go = module.exports = function (interval, onpitch, onnopitch) {
  var gotPitch = pitcher(interval, onpitch, onnopitch);

  var maxTime       =  0
    , maxPeaks      =  0
    , maxPeakCount  =  0
    , sampleRate    =  audioContext.sampleRate
    , fftSize       =  fft.size
    , rateSizeRatio =  sampleRate / fftSize
    ;

  return function doprocess () {
    var buf = copyBuffer(buffer);
    gauss.process(buf);

    var downsampled = downsample(buf);
    var upsampled = upsample(downsampled);

    fft.forward(upsampled);

    var noiseThreshold =  adjustNoiseThreshold(fft.spectrum, interval)
      , spectrumPoints =  sortSpectrumPoints(fft.spectrum)
      , peaks          =  getSortedPeaks(spectrumPoints, noiseThreshold)
      ;

    if (peaks.length) {
      var peak = null;

      maxPeaks = Math.max(maxPeaks, peaks.length);
      if (maxPeaks > 0) maxPeakCount = 0;


      var fstFreq = peaks[0].x * rateSizeRatio;

      if (peaks.length > 1) {
        var sndFreq = peaks[1].x * rateSizeRatio;
        var fstsndRatio = fstFreq / sndFreq;
        if (1.4 < fstsndRatio && fstsndRatio < 1.6) peak = peaks[1];
      }

      if (peaks.length > 2) {
        var trdFreq = peaks[2].x * rateSizeRatio;
        var fsttrdRatio = fstFreq / trdFreq;
        if (1.4 < fsttrdRatio && fsttrdRatio < 1.6) peak = peaks[2];
      }

      if (peaks.length > 1 || maxPeaks === 1) {
        if (!peak) peak = peaks[0];

        var leftx = peak.x - 1
          , peakx = peak.x
          , rightx = peak.x + 1;

        var left = { x: leftx, y: Math.log(fft.spectrum[leftx]) };

        // TODO: re-using peak here in an ugly manner, check if that can be improved
        peak = { x: peakx, y: Math.log(fft.spectrum[peakx]) };

        var right = { x: rightx , y: Math.log(fft.spectrum[rightx]) };

        var interp = (0.5 * ((left.y - right.y) / (left.y - (2 * peak.y) + right.y)) + peak.x);
        var freq = interp * (sampleRate / fftSize);

        var pitch = getPitch(freq);
        gotPitch(pitch);
      }

    } else {
      maxPeaks = 0;
      maxPeakCount++;
      // Looks like the maxPeaks business is only needed for visualization?
      //if (maxPeakCount > 20) display.clear()

      gotPitch({ note: null, frequency: 0, diff: 0 });
    }
  };
};

})()
},{"./adjust-noise-threshold":1,"./audiocontext":2,"./copy-buffer":4,"./dsp-fft":5,"./dsp-filters":6,"./dsp-samplebuffer":7,"./get-pitch":9,"./get-sorted-peaks":10,"./pitcher":16,"./sort-spectrum-points":18}],18:[function(require,module,exports){
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

},{}],19:[function(require,module,exports){
(function(){'use strict';

// getUserMedia can only be invoked when attached to the navigator
navigator.getUserMedia = require('./lib/get-usermedia');

var connectAudioStream =  require('./lib/connect-audiostream')
  , processAudioBuffer =  require('./lib/process-audiobuffer')
  , noteToLetter       =  require('./lib/note-to-letter')('v-dgb')
  ;

var pitchResult =  document.getElementsByClassName('pitch')[0]
  , output      =  document.getElementsByClassName('output')[0]
  , debug       =  document.getElementsByClassName('debug')[0]
  , interval    =  20
  ;

navigator.getUserMedia({ audio: true }, onsuccess, onerror);

function onerror (err) {
  console.error('err: ', err);
}

function onsuccess(stream) {
  var processNext = processAudioBuffer(interval, onpitch, onnopitch);
  connectAudioStream(stream);
  setInterval(processNext, interval);
}

function onpitch(pitch) {
  pitchResult.textContent =
      'Note: '        + pitch.note
    + '\tFrequency: ' + pitch.frequency
    + '\tDiff: '      + pitch.diff;

  debug.textContent += pitch.note;
  var letter = noteToLetter[pitch.note] || ' ';
  output.textContent += letter;
}

function onnopitch () {
  debug.textContent += '.';
}

})()
},{"./lib/connect-audiostream":3,"./lib/get-usermedia":11,"./lib/note-to-letter":15,"./lib/process-audiobuffer":17}]},{},[19])
//@ sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIgbGliL2FkanVzdC1ub2lzZS10aHJlc2hvbGQuanMiLCIgbGliL2F1ZGlvY29udGV4dC5qcyIsIiBsaWIvY29ubmVjdC1hdWRpb3N0cmVhbS5qcyIsIiBsaWIvY29weS1idWZmZXIuanMiLCIgbGliL2RzcC1mZnQuanMiLCIgbGliL2RzcC1maWx0ZXJzLmpzIiwiIGxpYi9kc3Atc2FtcGxlYnVmZmVyLmpzIiwiIGxpYi9mcmVxdWVuY2llcy5qcyIsIiBsaWIvZ2V0LXBpdGNoLmpzIiwiIGxpYi9nZXQtc29ydGVkLXBlYWtzLmpzIiwiIGxpYi9nZXQtdXNlcm1lZGlhLmpzIiwiIGxpYi9ub3RlLXRvLWxldHRlci12LWRnYi5qcyIsIiBsaWIvbm90ZS10by1sZXR0ZXItdi5qcyIsIiBsaWIvbm90ZS10by1sZXR0ZXItdmlpLmpzIiwiIGxpYi9ub3RlLXRvLWxldHRlci5qcyIsIiBsaWIvcGl0Y2hlci5qcyIsIiBsaWIvcHJvY2Vzcy1hdWRpb2J1ZmZlci5qcyIsIiBsaWIvc29ydC1zcGVjdHJ1bS1wb2ludHMuanMiLCIgbWFpbi5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9HQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIG5vaXNlQ291bnQgICAgID0gIDBcbiAgLCBub2lzZVRocmVzaG9sZCA9ICAtSW5maW5pdHk7XG5cbi8qKlxuICogVGhlIGZpcnN0IDEwIHRpbWVzIHRoYXQgdGhlIGRhdGEgaXMgZXhhbWluZWQgKGkuZS4gdGhlIGZpcnN0IHNlY29uZCksXG4gKiB0aGUgZnJlcXVlbmN5IHNwZWN0cnVtIGlzIGV4YW1pbmVkIHdpdGggdGhlIGFzc3VtcHRpb24gdGhhdCBhbnkgZGF0YSByZWNpZXZlZCBpcyBwdXJlIG5vaXNlLlxuICogVGhlIG1heGltdW0gdmFsdWUgZnJvbSB0aGUgc3BlY3RydW1zIGFuZCB0aGVzZSAxMCBpbnRlcnZhbHMgaXMgc2V0IHRvIGJlIHRoZSBub2lzZVRocmVzaG9sZC5cbiAqIEFmdGVyIHRoYXQgdGhlIHNhbWUgdGhyZXNob2xkIGlzIHJldHVybmVkIG9uIGV2ZXJ5IGludm9jYXRpb24uXG4gKiBAbmFtZSBleHBvcnRzXG4gKiBAZnVuY3Rpb25cbiAqIEByZXR1cm4ge051bWJlcn0gdGhlIG5vaXNlIHRocmVzaG9sZFxuICovXG52YXIgZ28gPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGFkanVzdE5vaXNlVGhyZXNob2xkIChzcGVjdHJ1bSwgaW50ZXJ2YWwpIHtcblxuICBpZiAobm9pc2VDb3VudCA8IDEwMDAgLyBpbnRlcnZhbCkge1xuICAgIG5vaXNlVGhyZXNob2xkID0gT2JqZWN0LmtleXMoc3BlY3RydW0pXG4gICAgICAuZmlsdGVyKGZ1bmN0aW9uIChrKSB7XG4gICAgICAgIHJldHVybiAhflsnYnVmZmVyJywgJ2J5dGVMZW5ndGgnLCAnYnl0ZU9mZnNldCcsICdsZW5ndGgnXS5pbmRleE9mKGspO1xuICAgICAgfSlcbiAgICAgIC5yZWR1Y2UoZnVuY3Rpb24gKG1heCwgaykge1xuICAgICAgICB2YXIgc3AgPSBzcGVjdHJ1bVtrXTtcbiAgICAgICAgcmV0dXJuIHNwID4gbWF4ID8gc3AgOiBtYXg7XG4gICAgICB9LCBub2lzZVRocmVzaG9sZCk7XG5cbiAgICAvLyBUaGUgbm9pc2VUaHJlc2hvbGQgaXMgbGltaXRlZCB0byBiZWluZyAwLjAwMSwganVzdCBpbiBjYXNlIHRoZXJlIHdhcyB2YWxpZCBkYXRhIGluIHRoZSBzYW1wbGVzLlxuICAgIG5vaXNlVGhyZXNob2xkID0gTWF0aC5taW4obm9pc2VUaHJlc2hvbGQsIDAuMDAxKTtcblxuICAgIG5vaXNlQ291bnQrKztcbiAgfVxuICByZXR1cm4gbm9pc2VUaHJlc2hvbGQ7XG59O1xuIiwidmFyIEF1ZGlvQ29udGV4dCA9XG4gICAgIHdpbmRvdy5BdWRpb0NvbnRleHRcbiAgfHwgd2luZG93Lm1vekF1ZGlvQ29udGV4dFxuICB8fCB3aW5kb3cud2Via2l0QXVkaW9Db250ZXh0XG4gIHx8IHdpbmRvdy5tc0F1ZGlvQ29udGV4dFxuICB8fCB3aW5kb3cub0F1ZGlvQ29udGV4dDtcblxuLy8gVE9ETzogd2FybiB1c2VyIGlmIG5vdCBzdXBwb3J0ZWQ/XG4vLyB0aGUgZW50aXJlIGFwcCB3aWxsIHVzZSB0aGUgc2FtZSBhdWRpbyBjb250ZXh0XG5tb2R1bGUuZXhwb3J0cyA9ICBBdWRpb0NvbnRleHQgJiYgbmV3IEF1ZGlvQ29udGV4dCgpO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXVkaW9Db250ZXh0ID0gcmVxdWlyZSgnLi9hdWRpb2NvbnRleHQnKVxuICAsIGJ1ZmZlckZpbGxlciA9IHJlcXVpcmUoJy4vZHNwLXNhbXBsZWJ1ZmZlcicpLmJ1ZmZlckZpbGxlclxuICAsIGZpbHRlcnMgPSByZXF1aXJlKCcuL2RzcC1maWx0ZXJzJylcbiAgLCBscCA9IGZpbHRlcnMubHBcbiAgLCBocCA9IGZpbHRlcnMuaHA7XG5cblxuLyoqXG4gKiAgQ29ubmVjdHMgYXVkaW8gc3RyZWFtIHRvIGJ1ZmZlciBhbmQgaW5zZXJ0cyBzb21lIGZpbHRlcnMuXG4gKlxuICogQG5hbWUgZXhwb3J0c1xuICogQGZ1bmN0aW9uXG4gKiBAcGFyYW0gc3RyZWFtIHtTdHJlYW19IHByb3ZpZGVkIGJ5IGNhbGwgdG8gbmF2aWdhdG9yLmdldFVzZXJNZWRpYVxuICogQHJldHVybiB2b2lkXG4gKi9cbnZhciBnbyA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKHN0cmVhbSkge1xuICBjb25zb2xlLmxvZygnY29ubmVjdGluZyBhdWRpbyBzdHJlYW0nKTtcblxuICB2YXIgc3JjID0gYXVkaW9Db250ZXh0LmNyZWF0ZU1lZGlhU3RyZWFtU291cmNlKHN0cmVhbSk7XG5cbiAgc3JjLmNvbm5lY3QobHApO1xuICBscC5jb25uZWN0KGhwKTtcbiAgaHAuY29ubmVjdChidWZmZXJGaWxsZXIpO1xuICBidWZmZXJGaWxsZXIuY29ubmVjdChhdWRpb0NvbnRleHQuZGVzdGluYXRpb24pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGdvID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoYnVmZmVyKSB7XG4gIHZhciBjb3B5ID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgY29weVtpXSA9IGJ1ZmZlcltpXSwgaSsrKTtcbiAgcmV0dXJuIGNvcHk7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXVkaW9Db250ZXh0ID0gcmVxdWlyZSgnLi9hdWRpb2NvbnRleHQnKTtcblxuLy8gRFNQIC0gRmFzdCBGb3VyaWVyIFRyYW5zZm9ybVxuXG4vKlxuICogIFNlZTogaHR0cDovL3BoZW5vbW5vbW5vbWluYWwuZ2l0aHViLmlvL2RvY3MvdHVuZXIuaHRtbCNzZWN0aW9uLTE1XG4gKlxuICogIFRoZSBpbmNvbWluZyBhdWRpbyBmcm9tIHRoZSBtaWNyb3Bob25lIGhhcyBhIHNhbXBsZSByYXRlIChGcykgb2YgNDQxMDBIei5cbiAqICBTaW5jZSB0aGUgaGlnaGVzdCBwb3NzaWJsZSBmcmVxdWVuY3kgd2UgYXJlIGludGVyZXN0ZWQgaW4gaXMgdGhlICdUb3AgQycgb24gdGhlIHBpYW5vICg0MTg2LjAxSHopLFxuICogIHdlIGNhbiBzYWZlbHkgaWdub3JlIGRhdGEgb3ZlciByb3VnaGx5IDEwS0h6LiBUaGUgZG93bnNhbXBsZWQgcmF0ZSB0aGF0IHdlIHVzZSBpcyAxMTAyNUh6IChGcyAvIDQpLlxuICpcbiAqICBBcyB0aGUgRkZUIHJlcXVpcmVzIGEgaW5wdXQgb2YgbGVuZ3RoIDJuLCB3ZSB1c2UgODE5MiAoMjEzKS5cbiAqXG4gKiAgVGhlIHJlbGF0aW9uc2hpcCBiZXR3ZWVuIEZGVCBzYW1wbGUgcmF0ZSwgRkZUIGJ1ZmZlciBsZW5ndGggYW5kIEZGVCBiaW4gcmVzb2x1dGlvbiwgaXM6XG4gKlxuICogICAgRkZUciA9IEZGVHMgLyBGRlRMXG4gKlxuICogICAgRkZUcyBvZiAxMTAyNUh6IGFuZCBGRlQgYnVmZmVyIGxlbmd0aCBvZiA4MTkyIGdpdmVzIHVzIGEgYmluIHJlc29sdXRpb24gb2YgMS4zNDU4SHpcbiAqXG4gKi9cbnZhciBmZnRTaXplID0gODE5MlxuICAsIHNhbXBsZVJhdGUgPSBhdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcblxuLy8gRkZUIGNvbWVzIGZyb20gdGhlIGRzcC5qcyBsaWJyYXJ5IHB1bGxlZCBpbiB2aWEgc2NyaXB0IHRhZ1xudmFyIGZmdCA9IG1vZHVsZS5leHBvcnRzID0gbmV3IEZGVChmZnRTaXplLCBzYW1wbGVSYXRlIC8gNCk7XG5mZnQuc2l6ZSA9IGZmdFNpemU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBhdWRpb0NvbnRleHQgPSByZXF1aXJlKCcuL2F1ZGlvY29udGV4dCcpO1xuXG4vLyBEU1AgLSBGaWx0ZXJzXG4vLyBTZWU6IGh0dHA6Ly9waGVub21ub21ub21pbmFsLmdpdGh1Yi5pby9kb2NzL3R1bmVyLmh0bWwjc2VjdGlvbi0xOVxuXG4vKlxuICogQSBHYXVzc2lhbiB3aW5kb3cgZnVuY3Rpb24gaXMgdXNlZCBvbiB0aGUgdGltZS1kb21haW4gYnVmZmVyIGRhdGEuXG4gKiBBIEdhdXNzaWFuIGZ1bmN0aW9uIGlzIGFsc28gR2F1c3NpYW4gaW4gdGhlIGZyZXF1ZW5jeS1kb21haW4uXG4gKiBTaW5jZSB0aGUgbG9nIG9mIGEgR2F1c3NpYW4gaXMgYSBwYXJhYm9sYSxcbiAqIHRoZSByZXN1bHRpbmcgZGF0YSBjYW4gYmUgdXNlZCBmb3IgZXhhY3QgcGFyYWJvbGljIGludGVycG9sYXRpb24gaW4gdGhlIGZyZXF1ZW5jeSBkb21haW4sXG4gKiBhbGxvd2luZyBmb3IgaGlnaGx5IGFjY3VyYXRlIGZyZXF1ZW5jeSBlc3RpbWF0aW9uLlxuICovXG5cbi8vIFdpbmRvd0Z1bmN0aW9uIGlzIHBhcnQgb2YgRFNQXG5leHBvcnRzLmdhdXNzID0gbmV3IFdpbmRvd0Z1bmN0aW9uKERTUC5HQVVTUyk7XG5cbi8qXG4gKiBscCAtIEEgbG93LXBhc3MgZmlsdGVyIGlzIGFsc28gdXNlZCB0byBhdHRlbnVhdGUgZnJlcXVlbmNpZXMgYWJvdmUgOEtIeixcbiAqIGFzIHdlIGFyZSBub3QgaW50ZXJlc3RlZCBpbiB0aGVzZSBmcmVxdWVuY2llcy5cbiAqL1xuXG52YXIgbHAgPSBleHBvcnRzLmxwID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xubHAudHlwZSA9IGxwLkxPV1BBU1M7XG5scC5mcmVxdWVuY3kgPSA4MDAwO1xubHAuUSA9IDAuMTtcblxuLypcbiAqIGhwIC0gQSBoaWdoLXBhc3MgZmlsdGVyIGlzIHVzZWQgdG8gYXR0ZW51YXRlIGZyZXF1ZW5jaWVzIGJlbG93IDIwSHosXG4gKiBhcyB3ZSBhcmUgbm90IGludGVyZXN0ZWQgaW4gdGhlc2UgZnJlcXVlbmNpZXNcbiAqIChhbmQgdGhleSBhcmUgb3V0c2lkZSB0aGUgZnJlcXVlbmN5IHJlc3BvbnNlIG9mIG1hbnkgYmFzaWMgbWljcm9waG9uZXMgYW55d2F5KS5cbiAqL1xuXG52YXIgaHAgPSBleHBvcnRzLmhwID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJpcXVhZEZpbHRlcigpO1xuaHAudHlwZSA9IGhwLkhJR0hQQVNTO1xuaHAuZnJlcXVlbmN5ID0gMjA7XG5ocC5RID0gMC4xO1xuIiwiKGZ1bmN0aW9uKCl7J3VzZSBzdHJpY3QnO1xuXG52YXIgYXVkaW9Db250ZXh0ID0gcmVxdWlyZSgnLi9hdWRpb2NvbnRleHQnKTtcbnZhciBmZnQgPSByZXF1aXJlKCcuL2RzcC1mZnQnKTtcblxuLy8gRFNQIC0gU2FtcGxlIEJ1ZmZlclxuLypcbiAqIFNlZTogaHR0cDovL3BoZW5vbW5vbW5vbWluYWwuZ2l0aHViLmlvL2RvY3MvdHVuZXIuaHRtbCNzZWN0aW9uLTE3XG4gKiBJbiBvcmRlciB0byBhbHdheXMgaGF2ZSBlbm91Z2ggZGF0YSB0byBnZXQgc3VmZmljaWVudCByZXNvbHV0aW9uIHdoaWxlIG1haW50YWluaW5nIHRoZSByZWFsLXRpbWUgcmVxdWlyZW1lbnQgb2YgYSB0dW5lcixcbiAqIGEgc2hpZnRpbmcgd2luZG93IGJ1ZmZlciBpcyB1c2VkLlxuICogVGhpcyBidWZmZXIgYWx3YXlzIGNvbnRhaW5zIDgxOTIgc2FtcGxlcywgaG93ZXZlciB0aGUgYnVmZmVyIHdpbmRvd3Mgc2hpZnRzIGV2ZXJ5IDIwNDggc2FtcGxlcy5cbiAqL1xuXG52YXIgYnVmZmVyRmlsbFNpemUgPSAyMDQ4O1xuXG4vLyBpbml0IGVtcHR5IGFycmF5IGFzIGJ1ZmZlciAobm90IHN1cmUgaWYganVzdCBwYXNzaW5nIHVuaW5pdGlhbGl6ZWQgYXJyYXkgd291bGQgd29yayB0b28pXG52YXIgYnVmZmVyID0gKGZ1bmN0aW9uICgpIHtcbiAgdmFyIGFyciA9IFtdO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGZmdC5zaXplOyBhcnJbaSsrXSA9IDApO1xuICByZXR1cm4gYXJyO1xufSkoKTtcblxuXG52YXIgYnVmZmVyRmlsbGVyID0gYXVkaW9Db250ZXh0LmNyZWF0ZUphdmFTY3JpcHROb2RlKGJ1ZmZlckZpbGxTaXplLCAxLCAxKTtcblxuYnVmZmVyRmlsbGVyLm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24gKGUpIHtcbiAgdmFyIGlucHV0ID0gZS5pbnB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKVxuICAgICwgaTtcblxuICBmb3IgKGkgPSBidWZmZXJGaWxsU2l6ZTsgaSA8IGJ1ZmZlci5sZW5ndGg7IGkrKylcbiAgICBidWZmZXJbaSAtIGJ1ZmZlckZpbGxTaXplXSA9IGJ1ZmZlcltpXTtcblxuICB2YXIgb2Zmc2V0ID0gYnVmZmVyLmxlbmd0aCAtIGJ1ZmZlckZpbGxTaXplO1xuXG4gIGZvciAoaSA9IDA7IGkgPCBpbnB1dC5sZW5ndGg7IGkrKylcbiAgICBidWZmZXJbb2Zmc2V0ICsgaV0gPSBpbnB1dFtpXTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0geyBidWZmZXI6IGJ1ZmZlciwgYnVmZmVyRmlsbGVyOiBidWZmZXJGaWxsZXIgfTtcblxufSkoKSIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAnQTAnICA6ICAyNy41LFxuICAnQTEnICA6ICA1NSxcbiAgJ0EyJyAgOiAgMTEwLFxuICAnQTMnICA6ICAyMjAsXG4gICdBNCcgIDogIDQ0MCxcbiAgJ0E1JyAgOiAgODgwLFxuICAnQTYnICA6ICAxNzYwLFxuICAnQTcnICA6ICAzNTIwLjAwLFxuICAnQSMwJyA6ICAyOS4xMzUyLFxuICAnQSMxJyA6ICA1OC4yNzA1LFxuICAnQSMyJyA6ICAxMTYuNTQxLFxuICAnQSMzJyA6ICAyMzMuMDgyLFxuICAnQSM0JyA6ICA0NjYuMTY0LFxuICAnQSM1JyA6ICA5MzIuMzI4LFxuICAnQSM2JyA6ICAxODY0LjY2LFxuICAnQSM3JyA6ICAzNzI5LjMxLFxuICAnQjAnICA6ICAzMC44Njc3LFxuICAnQjEnICA6ICA2MS43MzU0LFxuICAnQjInICA6ICAxMjMuNDcxLFxuICAnQjMnICA6ICAyNDYuOTQyLFxuICAnQjQnICA6ICA0OTMuODgzLFxuICAnQjUnICA6ICA5ODcuNzY3LFxuICAnQjYnICA6ICAxOTc1LjUzLFxuICAnQjcnICA6ICAzOTUxLjA3LFxuICAnQzEnICA6ICAzMi43MDMyLFxuICAnQzInICA6ICA2NS40MDY0LFxuICAnQzMnICA6ICAxMzAuODEzLFxuICAnQzQnICA6ICAyNjEuNjI2LFxuICAnQzUnICA6ICA1MjMuMjUxLFxuICAnQzYnICA6ICAxMDQ2LjUwLFxuICAnQzcnICA6ICAyMDkzLFxuICAnQzgnICA6ICA0MTg2LjAxLFxuICAnQyMxJyA6ICAzNC42NDc4LFxuICAnQyMyJyA6ICA2OS4yOTU3LFxuICAnQyMzJyA6ICAxMzguNTkxLFxuICAnQyM0JyA6ICAyNzcuMTgzLFxuICAnQyM1JyA6ICA1NTQuMzY1LFxuICAnQyM2JyA6ICAxMTA4LjczLFxuICAnQyM3JyA6ICAyMjE3LjQ2LFxuICAnRDEnICA6ICAzNi43MDgxLFxuICAnRDInICA6ICA3My40MTYyLFxuICAnRDMnICA6ICAxNDYuODMyLFxuICAnRDQnICA6ICAyOTMuNjY1LFxuICAnRDUnICA6ICA1ODcuMzMwLFxuICAnRDYnICA6ICAxMTc0LjY2LFxuICAnRDcnICA6ICAyMzQ5LjMyLFxuICAnRCMxJyA6ICAzOC44OTA5LFxuICAnRCMyJyA6ICA3Ny43ODE3LFxuICAnRCMzJyA6ICAxNTUuNTYzLFxuICAnRCM0JyA6ICAzMTEuMTI3LFxuICAnRCM1JyA6ICA2MjIuMjU0LFxuICAnRCM2JyA6ICAxMjQ0LjUxLFxuICAnRCM3JyA6ICAyNDg5LjAyLFxuICAnRTEnICA6ICA0MS4yMDM0LFxuICAnRTInICA6ICA4Mi40MDY5LFxuICAnRTMnICA6ICAxNjQuODE0LFxuICAnRTQnICA6ICAzMjkuNjI4LFxuICAnRTUnICA6ICA2NTkuMjU1LFxuICAnRTYnICA6ICAxMzE4LjUxLFxuICAnRTcnICA6ICAyNjM3LjAyLFxuICAnRjEnICA6ICA0My42NTYzLFxuICAnRjInICA6ICA4Ny4zMDcxLFxuICAnRjMnICA6ICAxNzQuNjE0LFxuICAnRjQnICA6ICAzNDkuMjI4LFxuICAnRjUnICA6ICA2OTguNDU2LFxuICAnRjYnICA6ICAxMzk2LjkxLFxuICAnRjcnICA6ICAyNzkzLjgzLFxuICAnRiMxJyA6ICA0Ni4yNDkzLFxuICAnRiMyJyA6ICA5Mi40OTg2LFxuICAnRiMzJyA6ICAxODQuOTk3LFxuICAnRiM0JyA6ICAzNjkuOTk0LFxuICAnRiM1JyA6ICA3MzkuOTg5LFxuICAnRiM2JyA6ICAxNDc5Ljk4LFxuICAnRiM3JyA6ICAyOTU5Ljk2LFxuICAnRzEnICA6ICA0OC45OTk0LFxuICAnRzInICA6ICA5Ny45OTg5LFxuICAnRzMnICA6ICAxOTUuOTk4LFxuICAnRzQnICA6ICAzOTEuOTk1LFxuICAnRzUnICA6ICA3ODMuOTkxLFxuICAnRzYnICA6ICAxNTY3Ljk4LFxuICAnRzcnICA6ICAzMTM1Ljk2LFxuICAnRyMxJyA6ICA1MS45MTMxLFxuICAnRyMnICA6ICAxMDMuODI2LFxuICAnRyMzJyA6ICAyMDcuNjUyLFxuICAnRyM0JyA6ICA0MTUuMzA1LFxuICAnRyM1JyA6ICA4MzAuNjA5LFxuICAnRyM2JyA6ICAxNjYxLjIyLFxuICAnRyM3JyA6ICAzMzIyLjQ0XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZnJlcXVlbmNpZXMgPSByZXF1aXJlKCcuL2ZyZXF1ZW5jaWVzJyk7XG5cbnZhciBnbyA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZyZXEpIHtcbiAgLy8gdG9kbyAtIGNvbWJpbmUgdGhpcyB3aXRoIHBpdGNoZXIgdG8gYmFzaWNhbGx5IGdldCBhbiBhcnJheSBvZiBmcmVxdWVuY2llcyBhbmRcbiAgLy8gZXZhbHVhdGUgdGhlbSBpbiBvbmUgcGxhY2UsIGluc3RlYWQgb2YgZmluZGluZyB0aGUgYmVzdCBtYXRjaCBvZiB0aGUgYmVzdCBtYXRjaFxuICByZXR1cm4gT2JqZWN0LmtleXMoZnJlcXVlbmNpZXMpXG4gICAgLnJlZHVjZShmdW5jdGlvbiAoYmVzdE1hdGNoLCBrKSB7XG4gICAgICB2YXIgZiAgICAgICA9ICBmcmVxdWVuY2llc1trXVxuICAgICAgICAsIGRpZmYgICAgPSAgZiAtIGZyZXFcbiAgICAgICAgLCBhYnNEaWZmID0gIE1hdGguYWJzKGRpZmYpO1xuXG4gICAgICByZXR1cm4gYWJzRGlmZiA8IGJlc3RNYXRjaC5taW5EaWZmXG4gICAgICAgID8geyBkaWZmOiBkaWZmLCBtaW5EaWZmOiBhYnNEaWZmLCBub3RlOiBrLCBmcmVxdWVuY3k6IGZyZXEgfVxuICAgICAgICA6IGJlc3RNYXRjaDtcblxuICAgIH0sIHsgbm90ZTogbnVsbCwgZGlmZjogSW5maW5pdHksIG1pbkRpZmY6IEluZmluaXR5IH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLyoqXG4gKiBTZWxlY3RzIGhpZ2hlc3QgOCBwZWFrcywgcmVtb3ZlcyB0aGUgb25lcyB0aGF0IGFyZSB0b28gY2xvc2UgYW5kIHNvcnRzIHRoZW0gYnkgZnJlcXVlbmN5LlxuICpcbiAqIEBuYW1lIGV4cG9ydHNcbiAqIEBmdW5jdGlvblxuICogQHBhcmFtIHNwZWN0cnVtUG9pbnRzIHtbT2JqZWN0XX0ge3gsIHl9IGV4cGVjdGVkIHRvIGJlIHNvcnRlZFxuICogQHBhcmFtIG5vaXNlVGhyZXNob2xkXG4gKiBAcmV0dXJuIHtBcnJheX0gc29ydGVkIHBlYWtzIGVtcHR5IGlmIG5vIHBlYWtzIHdlcmUgZm91bmRcbiAqL1xudmFyIGdvID0gbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoc3BlY3RydW1Qb2ludHMsIG5vaXNlVGhyZXNob2xkKSB7XG4gIHZhciBwZWFrcyA9IFtdLCBpLCBqO1xuXG4gIC8vIFRPRE86IGltcHJvdmUgdmVyeSBpbXBlcmF0aXZlIGNvZGVcblxuICAvLyBzZWxlY3QgOCBoaWdoZXN0IHBlYWtzIChwcm92aWRlZCB0aGV5IGFyZSBzdWZmaWNpZW50bHkgbGFyZ2UpXG4gIGZvciAoaSA9IDA7IGkgPCA4OyBpKyspIHtcbiAgICB2YXIgcG9pbnQgPSBzcGVjdHJ1bVBvaW50c1tpXTtcbiAgICBpZiAocG9pbnQueSA+IG5vaXNlVGhyZXNob2xkICogNSkgcGVha3MucHVzaChwb2ludCk7XG4gIH1cblxuICBpZiAoIXBlYWtzLmxlbmd0aCkgcmV0dXJuIFtdO1xuXG4gIC8vIElmIHRoZXJlIGFyZSBhbnkgcGVha3MgZm91bmQsIGFueSB2YWx1ZXMgZnJvbSBlaXRoZXIgc2lkZSBvZiB0aGUgcGVha3MgYXJlIHJlbW92ZWRcbiAgLy8gKGFzIHRoZXkgYXJlIGFsc28gbGlrZWx5IHRvIGJlIHBlYWtzLCBidXQgdGhleSBwcm92aWRlIG5vIHVzZWZ1bCBpbmZvcm1hdGlvbikuXG4gIC8vIFRoZSByZW1haW5pbmcgcGVha3MgYXJlIHNvcnRlZCBieSB0aGVpciBmcmVxdWVuY3kgYWdhaW4sIHdpdGggbG93ZXIgdmFsdWVzIGhhdmluZyBsb3ZlciBpbmRleGVzLlxuICBmb3IgKGkgPSAwOyBpIDwgcGVha3MubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgcCA9IHBlYWtzW2ldO1xuICAgIGlmICghcCkgY29udGludWU7XG5cbiAgICBmb3IgKGogPSAwOyBqIDwgcGVha3MubGVuZ3RoOyBqKyspIHtcbiAgICAgIHZhciBxID0gcGVha3Nbal07XG4gICAgICBpZiAoaSA9PT0gaiB8fCAhcSkgY29udGludWU7XG4gICAgICAvLyBtYXJrIGZvciBkZWxldGlvbiBpZiBkaWZmZXJlbmNlIGlzbid0IGxhcmdlIGVub3VnaFxuICAgICAgaWYgKE1hdGguYWJzKHAueCAtIHEueCkgPCA1KSBwZWFrc1tqXSA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBlYWtzXG4gICAgLmZpbHRlcihmdW5jdGlvbiAoeCkgeyByZXR1cm4gISF4OyB9KVxuICAgIC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7IHJldHVybiBhLnggLSBiLng7IH0pO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gVE9ETzogd2FybiB1c2VyIGlmIG5vbmUgZXhpc3RzP1xubW9kdWxlLmV4cG9ydHMgPVxuICAgICBuYXZpZ2F0b3IuZ2V0VXNlck1lZGlhXG4gIHx8IG5hdmlnYXRvci5tb3pHZXRVc2VyTWVkaWFcbiAgfHwgbmF2aWdhdG9yLndlYmtpdEdldFVzZXJNZWRpYVxuICB8fCBuYXZpZ2F0b3IubXNHZXRVc2VyTWVkaWFcbiAgfHwgbmF2aWdhdG9yLm9HZXRVc2VyTWVkaWE7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICAnRTQnICA6ICAnYicgLFxuICAnRjQnIDogICd2JyxcbiAgJ0YjNCcgIDogICdjJyxcbiAgJ0c0JyAgOiAgJ3gnLFxuICAnRyM0JyA6ICAneicsXG5cbiAgJ0IzJyA6ICdnJyAsXG4gICdDNCcgOiAnZicsXG4gICdDIzQnOiAnZCcsXG4gICdENCcgOiAncycsXG4gICdEIzQnOiAnYScsXG5cbiAgJ0YjMyc6J3QnLFxuICAnRzMnIDoncicsXG4gICdHIzMnOidlJyxcbiAgJ0EzJyA6J3cnLFxuICAnQSMzJzoncScsXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBhc3N1bWVzIHRvIGhhdmUgaGFuZCBpbiA1dGggZnJldFxubW9kdWxlLmV4cG9ydHMgPSB7XG4gICdCNCcgOiAnYicsXG4gICdDNCcgOiAndicsXG4gICdDIzQnOiAnYycsXG4gICdENCcgOiAneCcsXG4gICdEIzQnOiAneicsXG5cbiAgJ0YjMyc6ICdnJyxcbiAgJ0czJyA6ICdmJyxcbiAgJ0cjMyc6ICdkJyxcbiAgJ0EzJyA6ICdzJyxcbiAgJ0EjMyc6ICdhJyxcblxuICAnQyMzJzogJ3QnLFxuICAnRDMnIDogJ3InLFxuICAnRCMzJzogJ2UnLFxuICAnRTMnIDogJ3cnLFxuICAnRjMnIDogJ3EnLFxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gVE9ETzogZ290IGJyb2tlbiBpcyBhY3R1YWxseSB2IG5vd1xubW9kdWxlLmV4cG9ydHMgPSB7XG4gICdCMycgOiAnYicgLFxuICAnQzQnIDogJ3YnLFxuICAnQyM0JzogJ2MnLFxuICAnRDQnIDogJ3gnLFxuICAnRCM0JzogJ3onLFxuXG4gICdGIzMnOiAnZycsXG4gICdHMycgOiAnZicsXG4gICdHIzMnOiAnZCcsXG4gICdBMycgOiAncycsXG4gICdBIzMnOiAnYScsXG5cbiAgJ0MjMycgOiAgJ3QnLFxuICAnRDMnICA6ICAncicsXG4gICdEIzMnIDogICdlJyxcbiAgJ0UzJyAgOiAgJ3cnLFxuICAnRjMnICA6ICAncScsXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdiAgICA9ICByZXF1aXJlKCcuL25vdGUtdG8tbGV0dGVyLXYnKVxuICAsIHZkZ2IgPSAgcmVxdWlyZSgnLi9ub3RlLXRvLWxldHRlci12LWRnYicpXG4gICwgdmlpICA9ICByZXF1aXJlKCcuL25vdGUtdG8tbGV0dGVyLXZpaScpO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGZyZXQpIHtcbiAgc3dpdGNoKGZyZXQpIHtcbiAgICBjYXNlICd2JyAgICAgOiAgcmV0dXJuIHY7XG4gICAgY2FzZSAndi1kZ2InIDogIHJldHVybiB2ZGdiO1xuICAgIGNhc2UgJ3ZpaScgICA6ICByZXR1cm4gdmlpO1xuICB9XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgbWlubGVuID0gMTAwOyAvLyBtc1xuXG5mdW5jdGlvbiBmaW5kTW9zdENvbW1vblBpdGNoIChwaXRjaGVzKSB7XG4gIHJldHVybiBwaXRjaGVzXG4gICAgLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBwKSB7XG4gICAgICB2YXIgY291bnRzID0gYWNjLmNvdW50c1xuICAgICAgICAsIHdpbm5lciA9IGFjYy53aW5uZXI7XG5cbiAgICAgIGlmICghY291bnRzW3Aubm90ZV0pIGNvdW50c1twLm5vdGVdID0gMDtcbiAgICAgIHZhciBjID0gKytjb3VudHNbcC5ub3RlXTtcblxuICAgICAgaWYgKGMgPiB3aW5uZXIuY291bnQpIHtcbiAgICAgICAgaWYgKHAubm90ZSA9PT0gd2lubmVyLm5vdGUpIHtcbiAgICAgICAgICB3aW5uZXIuY291bnQrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBwLmNvdW50ICAgID0gIGM7XG4gICAgICAgICAgcC5zbmRub3RlICA9ICB3aW5uZXIubm90ZTtcbiAgICAgICAgICBwLnNuZGNvdW50ID0gIHdpbm5lci5jb3VudDtcbiAgICAgICAgICBhY2Mud2lubmVyID0gcDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIGFjYztcbiAgICB9XG4gICAgLCB7IGNvdW50czogeyB9LCB3aW5uZXI6IHsgY291bnQ6IDAgfSB9XG4gICAgKVxuICAgIC53aW5uZXI7XG59XG5cbnZhciBnbyA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGludGVydmFsLCBvbnBpdGNoLCBvbm5vcGl0Y2gpIHtcbiAgdmFyIGN1cnJlbnQgPSBudWxsXG4gICAgLCBzZWVuID0gMFxuICAgICwgcGl0Y2hlcyA9IFtdXG4gICAgLCBtaW5zZWVuID0gbWlubGVuIC8gaW50ZXJ2YWw7XG5cbiAgY29uc29sZS5sb2coJ21pbnNlZW4gOiAnLCBtaW5zZWVuKTtcblxuICByZXR1cm4gZnVuY3Rpb24gKHBpdGNoKSB7XG4gICAgLy8gc2FtZSBub3RlIGFzIGJlZm9yZVxuICAgIGlmIChwaXRjaC5ub3RlICE9PSBudWxsKSB7XG5cbiAgICAgIGlmIChjdXJyZW50ID09PSBudWxsKSB7XG4gICAgICAgIG9ubm9waXRjaCgpO1xuICAgICAgICBjdXJyZW50ID0gcGl0Y2gubm90ZTtcbiAgICAgIH1cblxuICAgICAgcGl0Y2hlcy5wdXNoKHBpdGNoKTtcblxuICAgICAgaWYgKHBpdGNoZXMubGVuZ3RoID09PSBtaW5zZWVuKSB7XG4gICAgICAgIHZhciBwID0gZmluZE1vc3RDb21tb25QaXRjaChwaXRjaGVzKTtcbiAgICAgICAgY29uc29sZS5sb2coeyBub3RlOiBwLm5vdGUsIGNvdW50OiBwLmNvdW50LCBzbmRub3RlOiBwLnNuZG5vdGUsIHNuZGNvdW50OiBwLnNuZGNvdW50IH0pO1xuXG4gICAgICAgIG9ucGl0Y2gocCk7XG4gICAgICAgIC8vIG5lZWQgdGhpcyB3aGVuIHdlIHVzZSBsb25nIG5vdGVzIChhdCB0aGF0IHBvaW50IHJlc2V0IHBpdGNoZXMgd2hlbiB3ZSBzZWUgbm9waXRjaClcbiAgICAgICAgLy9waXRjaGVzID0gW107XG4gICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgY3VycmVudCA9IG51bGw7XG4gICAgICBwaXRjaGVzID0gW107XG4gICAgfVxuXG4gIH07XG59O1xuIiwiKGZ1bmN0aW9uKCl7J3VzZSBzdHJpY3QnO1xuXG52YXIgYnVmZmVyICAgICAgICAgICAgICAgPSAgcmVxdWlyZSgnLi9kc3Atc2FtcGxlYnVmZmVyJykuYnVmZmVyXG4gICwgZ2F1c3MgICAgICAgICAgICAgICAgPSAgcmVxdWlyZSgnLi9kc3AtZmlsdGVycycpLmdhdXNzXG4gICwgY29weUJ1ZmZlciAgICAgICAgICAgPSAgcmVxdWlyZSgnLi9jb3B5LWJ1ZmZlcicpXG4gICwgZmZ0ICAgICAgICAgICAgICAgICAgPSAgcmVxdWlyZSgnLi9kc3AtZmZ0JylcbiAgLCBhZGp1c3ROb2lzZVRocmVzaG9sZCA9ICByZXF1aXJlKCcuL2FkanVzdC1ub2lzZS10aHJlc2hvbGQnKVxuICAsIHNvcnRTcGVjdHJ1bVBvaW50cyAgID0gIHJlcXVpcmUoJy4vc29ydC1zcGVjdHJ1bS1wb2ludHMnKVxuICAsIGdldFNvcnRlZFBlYWtzICAgICAgID0gIHJlcXVpcmUoJy4vZ2V0LXNvcnRlZC1wZWFrcycpXG4gICwgYXVkaW9Db250ZXh0ICAgICAgICAgPSAgcmVxdWlyZSgnLi9hdWRpb2NvbnRleHQnKVxuICAsIGdldFBpdGNoICAgICAgICAgICAgID0gIHJlcXVpcmUoJy4vZ2V0LXBpdGNoJylcbiAgLCBwaXRjaGVyICAgICAgICAgICAgICA9ICByZXF1aXJlKCcuL3BpdGNoZXInKVxuICA7XG5cbmZ1bmN0aW9uIGRvd25zYW1wbGUgKGJ1Zikge1xuICB2YXIgZG93bnNhbXBsZWQgPSBbXTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWYubGVuZ3RoOyBkb3duc2FtcGxlZC5wdXNoKGJ1ZltpXSksIGkgKz0gNCk7XG4gIHJldHVybiBkb3duc2FtcGxlZDtcbn1cblxuZnVuY3Rpb24gdXBzYW1wbGUgKGJ1Zikge1xuICB2YXIgdXBzYW1wbGVkID0gW107XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmLmxlbmd0aDsgaSsrKSB7XG4gICAgLy8gd291bGQgY29uY2F0IHBlcmZvcm0gYmV0dGVyIGhlcmU/XG4gICAgdXBzYW1wbGVkLnB1c2goYnVmW2ldKTtcbiAgICB1cHNhbXBsZWQucHVzaCgwKTtcbiAgICB1cHNhbXBsZWQucHVzaCgwKTtcbiAgICB1cHNhbXBsZWQucHVzaCgwKTtcbiAgfVxuXG4gIHJldHVybiB1cHNhbXBsZWQ7XG59XG5cbnZhciBnbyA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGludGVydmFsLCBvbnBpdGNoLCBvbm5vcGl0Y2gpIHtcbiAgdmFyIGdvdFBpdGNoID0gcGl0Y2hlcihpbnRlcnZhbCwgb25waXRjaCwgb25ub3BpdGNoKTtcblxuICB2YXIgbWF4VGltZSAgICAgICA9ICAwXG4gICAgLCBtYXhQZWFrcyAgICAgID0gIDBcbiAgICAsIG1heFBlYWtDb3VudCAgPSAgMFxuICAgICwgc2FtcGxlUmF0ZSAgICA9ICBhdWRpb0NvbnRleHQuc2FtcGxlUmF0ZVxuICAgICwgZmZ0U2l6ZSAgICAgICA9ICBmZnQuc2l6ZVxuICAgICwgcmF0ZVNpemVSYXRpbyA9ICBzYW1wbGVSYXRlIC8gZmZ0U2l6ZVxuICAgIDtcblxuICByZXR1cm4gZnVuY3Rpb24gZG9wcm9jZXNzICgpIHtcbiAgICB2YXIgYnVmID0gY29weUJ1ZmZlcihidWZmZXIpO1xuICAgIGdhdXNzLnByb2Nlc3MoYnVmKTtcblxuICAgIHZhciBkb3duc2FtcGxlZCA9IGRvd25zYW1wbGUoYnVmKTtcbiAgICB2YXIgdXBzYW1wbGVkID0gdXBzYW1wbGUoZG93bnNhbXBsZWQpO1xuXG4gICAgZmZ0LmZvcndhcmQodXBzYW1wbGVkKTtcblxuICAgIHZhciBub2lzZVRocmVzaG9sZCA9ICBhZGp1c3ROb2lzZVRocmVzaG9sZChmZnQuc3BlY3RydW0sIGludGVydmFsKVxuICAgICAgLCBzcGVjdHJ1bVBvaW50cyA9ICBzb3J0U3BlY3RydW1Qb2ludHMoZmZ0LnNwZWN0cnVtKVxuICAgICAgLCBwZWFrcyAgICAgICAgICA9ICBnZXRTb3J0ZWRQZWFrcyhzcGVjdHJ1bVBvaW50cywgbm9pc2VUaHJlc2hvbGQpXG4gICAgICA7XG5cbiAgICBpZiAocGVha3MubGVuZ3RoKSB7XG4gICAgICB2YXIgcGVhayA9IG51bGw7XG5cbiAgICAgIG1heFBlYWtzID0gTWF0aC5tYXgobWF4UGVha3MsIHBlYWtzLmxlbmd0aCk7XG4gICAgICBpZiAobWF4UGVha3MgPiAwKSBtYXhQZWFrQ291bnQgPSAwO1xuXG5cbiAgICAgIHZhciBmc3RGcmVxID0gcGVha3NbMF0ueCAqIHJhdGVTaXplUmF0aW87XG5cbiAgICAgIGlmIChwZWFrcy5sZW5ndGggPiAxKSB7XG4gICAgICAgIHZhciBzbmRGcmVxID0gcGVha3NbMV0ueCAqIHJhdGVTaXplUmF0aW87XG4gICAgICAgIHZhciBmc3RzbmRSYXRpbyA9IGZzdEZyZXEgLyBzbmRGcmVxO1xuICAgICAgICBpZiAoMS40IDwgZnN0c25kUmF0aW8gJiYgZnN0c25kUmF0aW8gPCAxLjYpIHBlYWsgPSBwZWFrc1sxXTtcbiAgICAgIH1cblxuICAgICAgaWYgKHBlYWtzLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgdmFyIHRyZEZyZXEgPSBwZWFrc1syXS54ICogcmF0ZVNpemVSYXRpbztcbiAgICAgICAgdmFyIGZzdHRyZFJhdGlvID0gZnN0RnJlcSAvIHRyZEZyZXE7XG4gICAgICAgIGlmICgxLjQgPCBmc3R0cmRSYXRpbyAmJiBmc3R0cmRSYXRpbyA8IDEuNikgcGVhayA9IHBlYWtzWzJdO1xuICAgICAgfVxuXG4gICAgICBpZiAocGVha3MubGVuZ3RoID4gMSB8fCBtYXhQZWFrcyA9PT0gMSkge1xuICAgICAgICBpZiAoIXBlYWspIHBlYWsgPSBwZWFrc1swXTtcblxuICAgICAgICB2YXIgbGVmdHggPSBwZWFrLnggLSAxXG4gICAgICAgICAgLCBwZWFreCA9IHBlYWsueFxuICAgICAgICAgICwgcmlnaHR4ID0gcGVhay54ICsgMTtcblxuICAgICAgICB2YXIgbGVmdCA9IHsgeDogbGVmdHgsIHk6IE1hdGgubG9nKGZmdC5zcGVjdHJ1bVtsZWZ0eF0pIH07XG5cbiAgICAgICAgLy8gVE9ETzogcmUtdXNpbmcgcGVhayBoZXJlIGluIGFuIHVnbHkgbWFubmVyLCBjaGVjayBpZiB0aGF0IGNhbiBiZSBpbXByb3ZlZFxuICAgICAgICBwZWFrID0geyB4OiBwZWFreCwgeTogTWF0aC5sb2coZmZ0LnNwZWN0cnVtW3BlYWt4XSkgfTtcblxuICAgICAgICB2YXIgcmlnaHQgPSB7IHg6IHJpZ2h0eCAsIHk6IE1hdGgubG9nKGZmdC5zcGVjdHJ1bVtyaWdodHhdKSB9O1xuXG4gICAgICAgIHZhciBpbnRlcnAgPSAoMC41ICogKChsZWZ0LnkgLSByaWdodC55KSAvIChsZWZ0LnkgLSAoMiAqIHBlYWsueSkgKyByaWdodC55KSkgKyBwZWFrLngpO1xuICAgICAgICB2YXIgZnJlcSA9IGludGVycCAqIChzYW1wbGVSYXRlIC8gZmZ0U2l6ZSk7XG5cbiAgICAgICAgdmFyIHBpdGNoID0gZ2V0UGl0Y2goZnJlcSk7XG4gICAgICAgIGdvdFBpdGNoKHBpdGNoKTtcbiAgICAgIH1cblxuICAgIH0gZWxzZSB7XG4gICAgICBtYXhQZWFrcyA9IDA7XG4gICAgICBtYXhQZWFrQ291bnQrKztcbiAgICAgIC8vIExvb2tzIGxpa2UgdGhlIG1heFBlYWtzIGJ1c2luZXNzIGlzIG9ubHkgbmVlZGVkIGZvciB2aXN1YWxpemF0aW9uP1xuICAgICAgLy9pZiAobWF4UGVha0NvdW50ID4gMjApIGRpc3BsYXkuY2xlYXIoKVxuXG4gICAgICBnb3RQaXRjaCh7IG5vdGU6IG51bGwsIGZyZXF1ZW5jeTogMCwgZGlmZjogMCB9KTtcbiAgICB9XG4gIH07XG59O1xuXG59KSgpIiwiJ3VzZSBzdHJpY3QnO1xuXG4vKipcbiAqIFNvcnRzIEZGVCBzcGVjdHJ1bSB2YWx1ZXMgYnkgdGhlaXIgcGVhayB2YWx1ZS5cbiAqXG4gKiBAbmFtZSBleHBvcnRzXG4gKiBAZnVuY3Rpb25cbiAqIEBwYXJhbSBzcGVjdHJ1bVxuICogQHJldHVybiB7W09iamVjdF19IHsgeCwgeSB9IHNwZWN0cnVtIHZhbHVlc1xuICovXG52YXIgZ28gPSBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzcGVjdHJ1bSkge1xuXG4gIC8vIG5vdCBzdXJlIHdoeSB3ZSBvbmx5IGl0ZXJhdGUgb3ZlciBmaXJzdCBxdWFydGVyIG9mIHNwZWN0cnVtXG4gIC8vIHNwZWN0cnVtUG9pbnRzID0gKHg6IHgsIHk6IGZmdC5zcGVjdHJ1bVt4XSBmb3IgeCBpbiBbMC4uLihmZnQuc3BlY3RydW0ubGVuZ3RoIC8gNCldKVxuICB2YXIgc3BlY3RydW1Qb2ludHMgPSBbXTtcbiAgZm9yICh2YXIgeCA9IDA7IHggPD0gc3BlY3RydW0ubGVuZ3RoIC8gNDsgc3BlY3RydW1Qb2ludHMucHVzaCh7IHg6IHgsIHk6IHNwZWN0cnVtW3hdIH0pLCB4KyspO1xuXG4gIHNwZWN0cnVtUG9pbnRzLnNvcnQoZnVuY3Rpb24oYSwgYikgeyByZXR1cm4gYi55IC0gYS55OyB9KTtcblxuICByZXR1cm4gc3BlY3RydW1Qb2ludHM7XG59O1xuIiwiKGZ1bmN0aW9uKCl7J3VzZSBzdHJpY3QnO1xuXG4vLyBnZXRVc2VyTWVkaWEgY2FuIG9ubHkgYmUgaW52b2tlZCB3aGVuIGF0dGFjaGVkIHRvIHRoZSBuYXZpZ2F0b3Jcbm5hdmlnYXRvci5nZXRVc2VyTWVkaWEgPSByZXF1aXJlKCcuL2xpYi9nZXQtdXNlcm1lZGlhJyk7XG5cbnZhciBjb25uZWN0QXVkaW9TdHJlYW0gPSAgcmVxdWlyZSgnLi9saWIvY29ubmVjdC1hdWRpb3N0cmVhbScpXG4gICwgcHJvY2Vzc0F1ZGlvQnVmZmVyID0gIHJlcXVpcmUoJy4vbGliL3Byb2Nlc3MtYXVkaW9idWZmZXInKVxuICAsIG5vdGVUb0xldHRlciAgICAgICA9ICByZXF1aXJlKCcuL2xpYi9ub3RlLXRvLWxldHRlcicpKCd2LWRnYicpXG4gIDtcblxudmFyIHBpdGNoUmVzdWx0ID0gIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ3BpdGNoJylbMF1cbiAgLCBvdXRwdXQgICAgICA9ICBkb2N1bWVudC5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKCdvdXRwdXQnKVswXVxuICAsIGRlYnVnICAgICAgID0gIGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ2RlYnVnJylbMF1cbiAgLCBpbnRlcnZhbCAgICA9ICAyMFxuICA7XG5cbm5hdmlnYXRvci5nZXRVc2VyTWVkaWEoeyBhdWRpbzogdHJ1ZSB9LCBvbnN1Y2Nlc3MsIG9uZXJyb3IpO1xuXG5mdW5jdGlvbiBvbmVycm9yIChlcnIpIHtcbiAgY29uc29sZS5lcnJvcignZXJyOiAnLCBlcnIpO1xufVxuXG5mdW5jdGlvbiBvbnN1Y2Nlc3Moc3RyZWFtKSB7XG4gIHZhciBwcm9jZXNzTmV4dCA9IHByb2Nlc3NBdWRpb0J1ZmZlcihpbnRlcnZhbCwgb25waXRjaCwgb25ub3BpdGNoKTtcbiAgY29ubmVjdEF1ZGlvU3RyZWFtKHN0cmVhbSk7XG4gIHNldEludGVydmFsKHByb2Nlc3NOZXh0LCBpbnRlcnZhbCk7XG59XG5cbmZ1bmN0aW9uIG9ucGl0Y2gocGl0Y2gpIHtcbiAgcGl0Y2hSZXN1bHQudGV4dENvbnRlbnQgPVxuICAgICAgJ05vdGU6ICcgICAgICAgICsgcGl0Y2gubm90ZVxuICAgICsgJ1xcdEZyZXF1ZW5jeTogJyArIHBpdGNoLmZyZXF1ZW5jeVxuICAgICsgJ1xcdERpZmY6ICcgICAgICArIHBpdGNoLmRpZmY7XG5cbiAgZGVidWcudGV4dENvbnRlbnQgKz0gcGl0Y2gubm90ZTtcbiAgdmFyIGxldHRlciA9IG5vdGVUb0xldHRlcltwaXRjaC5ub3RlXSB8fCAnICc7XG4gIG91dHB1dC50ZXh0Q29udGVudCArPSBsZXR0ZXI7XG59XG5cbmZ1bmN0aW9uIG9ubm9waXRjaCAoKSB7XG4gIGRlYnVnLnRleHRDb250ZW50ICs9ICcuJztcbn1cblxufSkoKSJdfQ==
;