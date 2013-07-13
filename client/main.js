'use strict';

// getUserMedia can only be invoked when attached to the navigator
navigator.getUserMedia = require('./lib/get-usermedia');

var fft                  =  require('./lib/dsp-fft');
var connectAudioStream   =  require('./lib/connect-audiostream');
var processAudioBuffer   =  require('./lib/process-audiobuffer');
var adjustNoiseThreshold =  require('./lib/adjust-noise-threshold');


navigator.getUserMedia({ audio: true }, onsuccess, onerror);

function onerror (err) {
  console.error('err: ', err);
}

function onsuccess(stream) {

  var maxTime        =  0
    , maxPeaks       =  0
    , maxPeakCount   =  0
    , noiseThreshold
    , spectrumPoints
    ;


  function updateAndSortSpectrumPoints () {
    //  spectrumPoints = (x: x, y: fft.spectrum[x] for x in [0...(fft.spectrum.length / 4)])
    //  spectrumPoints.sort (a, b) -> (b.y - a.y)


  }


  connectAudioStream(stream);
  console.log('starting to process');

  adjustNoiseThreshold(fft.spectrum);


  processAudioBuffer();
  //setInterval(processAudioBuffer, 100);
}

