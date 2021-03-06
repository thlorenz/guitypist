'use strict';

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
