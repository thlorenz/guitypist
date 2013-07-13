'use strict';

// getUserMedia can only be invoked when attached to the navigator
navigator.getUserMedia = require('./lib/get-usermedia');
var connectAudioStream = require('./lib/connect-audiostream');

navigator.getUserMedia({ audio: true }, onsuccess, onerror);

function onerror (err) {
  console.error('err: ', err);
}

function onsuccess(stream) {
  connectAudioStream(stream);
  console.log('ready to process');
}
