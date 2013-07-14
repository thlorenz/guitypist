'use strict';

// getUserMedia can only be invoked when attached to the navigator
navigator.getUserMedia = require('./lib/get-usermedia');

var connectAudioStream =  require('./lib/connect-audiostream')
  , processAudioBuffer =  require('./lib/process-audiobuffer')
  , pitchResult = document.getElementsByClassName('pitch')[0]
  ;

navigator.getUserMedia({ audio: true }, onsuccess, onerror);

function onerror (err) {
  console.error('err: ', err);
}

function onsuccess(stream) {
  var processNext = processAudioBuffer(onpitch);
  connectAudioStream(stream);
  setInterval(processNext, 100);
}

function onpitch(pitch) {
  pitchResult.textContent =
      'Note: '        + pitch.note
    + '\tFrequency: ' + pitch.frequency
    + '\tDiff: '      + pitch.diff;
}

