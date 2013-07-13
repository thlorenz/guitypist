'use strict';

var buffer     =  require('./dsp-samplebuffer').buffer
  , gauss      =  require('./dsp-filters').gauss
  , copyBuffer =  require('./copy-buffer')
  , fft        =  require('./dsp-fft')
  ;

var maxTime        =  0
  , noiseCount     =  0
  , maxPeaks       =  0
  , maxPeakCount   =  0
  , noiseThreshold =  -Infinity
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

var go = module.exports = function () {
  var buf = copyBuffer(buffer);
  gauss.process(buf);

  var downsampled = downsample(buf);
  var upsampled = upsample(downsampled);

  fft.forward(upsampled);
  console.log('processed');
};
