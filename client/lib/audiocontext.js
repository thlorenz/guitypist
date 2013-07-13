var AudioContext =
     window.AudioContext
  || window.mozAudioContext
  || window.webkitAudioContext
  || window.msAudioContext
  || window.oAudioContext;

// TODO: warn user if not supported?
// the entire app will use the same audio context
module.exports =  AudioContext && new AudioContext();
